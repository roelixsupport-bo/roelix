/**
 * Customer reviews: cloud-first, local fallback.
 *
 * Reviews live in `product_reviews` when Supabase is configured. On a local-only
 * install (no env vars) they are kept in local storage instead, so the review
 * form still works in the offline demo build the rest of this app supports.
 *
 * The cloud is treated as optional at runtime, not just at build time: if the
 * table is missing, its schema cache is stale, or the connection drops, the store
 * trips a session-long breaker and serves the local queue instead. A shopper can
 * always write a review — it is saved on the device, the admin sees it in the
 * dashboard, and nothing throws its way into the UI.
 */
export type ReviewRating = 1 | 2 | 3 | 4 | 5;

/**
 * Moderation state of a review.
 *
 * `pending` is what a customer writes; only an admin can move it to `published`
 * (readable by everyone) or pull a live one back to `hidden`. Rows arrive from
 * the storefront, the admin queue and local storage through the same reader, so
 * anything unrecognised fails closed to `pending` rather than leaking publicly.
 */
export type ReviewStatus = "pending" | "published" | "hidden";

export type ProductReview = {
  id: string;
  productId: string;
  authorName: string;
  rating: ReviewRating;
  body: string;
  status: ReviewStatus;
  createdAt: string;
};

export type ReviewInput = {
  productId: string;
  authorName: string;
  rating: number;
  body: string;
};

export type ReviewFieldError = { field: "authorName" | "rating" | "body" };

export const REVIEW_LIMITS = {
  nameMin: 2,
  nameMax: 60,
  bodyMin: 4,
  bodyMax: 2000,
} as const;

const LOCAL_KEY = "roelix_reviews";

export type ReviewSummary = {
  count: number;
  /** Mean rating, 0 when there are no reviews. */
  average: number;
  distribution: Record<ReviewRating, number>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampRating(value: unknown): ReviewRating | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rating = Math.round(value);
  return rating >= 1 && rating <= 5 ? (rating as ReviewRating) : null;
}

/** Cloud is only reachable outside tests and when the project is configured. */
export function reviewsCloudEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env["MODE"] === "test") return false;
  return Boolean(import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_ANON_KEY"]);
}

// --- Cloud availability -----------------------------------------------------

/**
 * Postgres/PostgREST failures that mean "this table cannot be used right now".
 *
 * 42P01       relation does not exist
 * PGRST205    "Could not find the table in the schema cache" (the reported bug)
 * PGRST202/204 stale schema cache after a column/function change
 * 3F000       invalid schema
 * 08xxx       connection exceptions
 */
const UNUSABLE_TABLE_CODES = new Set([
  "42P01",
  "PGRST205",
  "PGRST204",
  "PGRST202",
  "PGRST001",
  "PGRST002",
  "PGRST003",
  "3F000",
  "08000",
  "08003",
  "08006",
]);

const UNUSABLE_TABLE_MESSAGE =
  /schema cache|could not find the table|no such table|undefined table|relation .* does not exist|does not exist|failed to fetch|networkerror|network error|fetch failed|load failed|connection (?:closed|refused|reset|terminated)|timed out|timeout/i;

function readErrorShape(value: unknown): { code: string; message: string } {
  if (typeof value === "string") return { code: "", message: value };
  if (!isRecord(value)) return { code: "", message: "" };
  const code = typeof value["code"] === "string" ? value["code"] : "";
  const message = [value["message"], value["details"], value["hint"]]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
  return { code, message };
}

/**
 * True when the failure is about the reviews table/connection rather than about
 * this particular review. RLS denials (42501) and constraint violations (23514)
 * stay visible: they are fixable configuration problems, not reasons to quietly
 * store a review somewhere the storefront will never read.
 */
export function isReviewInfrastructureError(value: unknown): boolean {
  const { code, message } = readErrorShape(value);
  if (code && UNUSABLE_TABLE_CODES.has(code)) return true;
  return UNUSABLE_TABLE_MESSAGE.test(message);
}

let cloudReviewFailure: { code: string; message: string } | null = null;

/** True once a schema/connection failure has been seen in this page session. */
export function reviewCloudDisabled(): boolean {
  return cloudReviewFailure !== null;
}

/**
 * Latches the breaker. Every later call in this session skips Supabase entirely,
 * so a broken table costs the customer one failed request instead of one per
 * keystroke, render and poll.
 */
function tripCloudBreaker(error: unknown): void {
  if (cloudReviewFailure) return;
  cloudReviewFailure = readErrorShape(error);
  console.warn(
    "ROELIX reviews: Supabase reviews are unavailable, falling back to local storage for this session",
    error,
  );
}

/** Test hook: forget a tripped breaker so each test starts clean. */
export function resetReviewCloudState(): void {
  cloudReviewFailure = null;
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return "";
}

/**
 * Reads a review from either shape it arrives in: a `product_reviews` row
 * (snake_case) or the local-storage copy of a mapped review (camelCase). One
 * reader keeps validation identical for cloud and offline data.
 */
export function reviewFromRecord(value: unknown): ProductReview | null {
  if (!isRecord(value)) return null;
  const rating = clampRating(value["rating"]);
  const id = readString(value, "id");
  const productId = readString(value, "product_id", "productId");
  const authorName = readString(value, "author_name", "authorName").trim();
  const body = readString(value, "body").trim();
  const createdAt = readString(value, "created_at", "createdAt");
  if (!id || !productId || !authorName || !body || !createdAt || rating === null) return null;

  return {
    id,
    productId,
    authorName,
    rating,
    body,
    // Fail closed: an unknown or missing status must never publish a review.
    status: readStatus(value["status"]),
    createdAt,
  };
}

function readStatus(value: unknown): ReviewStatus {
  return value === "published" || value === "hidden" ? value : "pending";
}

/** Returns the first invalid field, or null when the submission is usable. */
export function validateReviewInput(input: ReviewInput): ReviewFieldError | null {
  const name = input.authorName.trim();
  if (name.length < REVIEW_LIMITS.nameMin || name.length > REVIEW_LIMITS.nameMax) {
    return { field: "authorName" };
  }
  if (clampRating(input.rating) === null) return { field: "rating" };
  const body = input.body.trim();
  if (body.length < REVIEW_LIMITS.bodyMin || body.length > REVIEW_LIMITS.bodyMax) {
    return { field: "body" };
  }
  return null;
}

export function summarizeReviews(reviews: ProductReview[]): ReviewSummary {
  const distribution: Record<ReviewRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let counted = 0;

  for (const review of reviews) {
    const rating = clampRating(review.rating);
    if (rating === null) continue;
    distribution[rating] += 1;
    total += rating;
    counted += 1;
  }

  return { count: counted, average: counted === 0 ? 0 : total / counted, distribution };
}

// --- Local storage fallback -------------------------------------------------

function readLocalReviews(): ProductReview[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(reviewFromRecord)
      .filter((review): review is ProductReview => review !== null);
  } catch (error) {
    console.error("Could not read the local ROELIX reviews", error);
    return [];
  }
}

function writeLocalReviews(reviews: ProductReview[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(reviews));
  } catch (error) {
    console.error("Could not save the local ROELIX reviews", error);
  }
}

/** Adds a review to the device queue, replacing any row with the same id. */
function saveLocalReview(review: ProductReview): ProductReview {
  writeLocalReviews([
    review,
    ...readLocalReviews().filter((existing) => existing.id !== review.id),
  ]);
  return review;
}

function newReviewId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newestFirst(a: ProductReview, b: ProductReview): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function localPublishedFor(productId?: string): ProductReview[] {
  return readLocalReviews()
    .filter((review) => review.status === "published")
    .filter((review) => (productId ? review.productId === productId : true))
    .sort(newestFirst);
}

function localQueue(): ProductReview[] {
  return readLocalReviews().sort(newestFirst);
}

/** Turns a Supabase error into something the storefront can show a customer. */
function reviewError(error: { code?: string; message?: string }): Error {
  if (error.code === "42501") {
    return new Error("Only a ROELIX administrator can change the status of a review.");
  }
  if (error.code === "23514" && /status/i.test(error.message ?? "")) {
    // The table still only allows published/hidden, so pending inserts are rejected.
    return new Error(
      "Review approval is not enabled on this project yet. Apply the 20261028160000 review approval migration.",
    );
  }
  if (error.code === "23514") {
    return new Error("The review did not pass validation. Check the name, rating and comment.");
  }
  return new Error(error.message || "The review could not be saved.");
}

const REVIEW_COLUMNS = "id,product_id,author_name,rating,body,status,created_at";

/** Opens a client, or null when the module/env is missing. Never throws. */
async function reviewClient(): Promise<
  Awaited<typeof import("@/lib/supabase")>["supabase"] | null
> {
  try {
    const { supabase } = await import("@/lib/supabase");
    return supabase;
  } catch (error) {
    tripCloudBreaker(error);
    return null;
  }
}

// --- Reads ------------------------------------------------------------------

/** Published reviews for one product. Falls back to the local cache on any failure. */
export async function fetchProductReviews(productId: string): Promise<ProductReview[]> {
  if (!reviewsCloudEnabled() || reviewCloudDisabled()) return localPublishedFor(productId);

  try {
    const supabase = await reviewClient();
    if (!supabase) return localPublishedFor(productId);

    const { data, error } = await supabase
      .from("product_reviews")
      .select(REVIEW_COLUMNS)
      .eq("product_id", productId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    return (data ?? [])
      .map(reviewFromRecord)
      .filter((review): review is ProductReview => review !== null);
  } catch (error) {
    if (isReviewInfrastructureError(error)) tripCloudBreaker(error);
    else console.warn("ROELIX reviews: live fetch failed, using the local cache", error);
    return localPublishedFor(productId);
  }
}

/**
 * Moderation list: pending, published and hidden, newest first.
 *
 * A broken table falls back to the device queue rather than throwing at the
 * dashboard, so the admin can still approve what was written on this browser.
 */
export async function fetchAllReviews(): Promise<ProductReview[]> {
  if (!reviewsCloudEnabled() || reviewCloudDisabled()) return localQueue();

  try {
    const supabase = await reviewClient();
    if (!supabase) return localQueue();

    const { data, error } = await supabase
      .from("product_reviews")
      .select(REVIEW_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    return (data ?? [])
      .map(reviewFromRecord)
      .filter((review): review is ProductReview => review !== null);
  } catch (error) {
    if (isReviewInfrastructureError(error)) {
      tripCloudBreaker(error);
      return localQueue();
    }
    throw error instanceof Error ? error : new Error("Could not load reviews");
  }
}

// --- Writes -----------------------------------------------------------------

/**
 * Saves a customer review and always resolves.
 *
 * The row is written to Supabase when the table is usable. If the table is
 * missing, its schema cache is stale, the network drops, or the breaker is
 * already open, it is written to the device instead and the caller still gets a
 * review back, so the form can clear and confirm. Only real configuration
 * problems (RLS denial, a constraint that rejects `pending`) surface as errors.
 *
 * The insert deliberately does not read the row back: with approval enabled a
 * customer cannot select their own pending row, so asking for the representation
 * would fail on a healthy project.
 */
export async function submitProductReview(input: ReviewInput): Promise<ProductReview> {
  const invalid = validateReviewInput(input);
  if (invalid) throw new Error("The review did not pass validation");

  const draft: ProductReview = {
    id: newReviewId(),
    productId: input.productId,
    authorName: input.authorName.trim(),
    rating: clampRating(input.rating) ?? 5,
    body: input.body.trim(),
    // Nothing a customer writes is live until an admin approves it.
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  if (!reviewsCloudEnabled() || reviewCloudDisabled()) return saveLocalReview(draft);

  try {
    const supabase = await reviewClient();
    if (!supabase) return saveLocalReview(draft);

    const { error } = await supabase.from("product_reviews").insert({
      product_id: draft.productId,
      author_name: draft.authorName,
      rating: draft.rating,
      body: draft.body,
      // Explicit, not just the column default: RLS only accepts pending inserts,
      // so a project without the approval migration fails loudly instead of
      // publishing straight to the storefront.
      status: "pending",
    });
    if (error) throw error;

    return draft;
  } catch (error) {
    if (isReviewInfrastructureError(error)) {
      tripCloudBreaker(error);
      console.warn(
        "ROELIX reviews: Supabase is unavailable, keeping the review on this device",
        error,
      );
      return saveLocalReview(draft);
    }
    throw reviewError(readErrorShape(error));
  }
}

/** Approves a pending review: the only state the storefront will show. */
export async function approveReview(id: string): Promise<void> {
  await setReviewStatus(id, "published");
}

export async function setReviewStatus(id: string, status: ReviewStatus): Promise<void> {
  const applyLocally = () =>
    writeLocalReviews(
      readLocalReviews().map((review) => (review.id === id ? { ...review, status } : review)),
    );

  if (!reviewsCloudEnabled() || reviewCloudDisabled()) {
    applyLocally();
    return;
  }

  try {
    const supabase = await reviewClient();
    if (!supabase) {
      applyLocally();
      return;
    }
    const { error } = await supabase.from("product_reviews").update({ status }).eq("id", id);
    if (error) throw error;
  } catch (error) {
    if (isReviewInfrastructureError(error)) {
      // The cloud row cannot be reached; keep the local copy in step so the
      // dashboard still reflects the decision the admin just made.
      tripCloudBreaker(error);
      applyLocally();
      return;
    }
    throw reviewError(readErrorShape(error));
  }
}

export async function deleteReview(id: string): Promise<void> {
  const applyLocally = () =>
    writeLocalReviews(readLocalReviews().filter((review) => review.id !== id));

  if (!reviewsCloudEnabled() || reviewCloudDisabled()) {
    applyLocally();
    return;
  }

  try {
    const supabase = await reviewClient();
    if (!supabase) {
      applyLocally();
      return;
    }
    const { error } = await supabase.from("product_reviews").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    if (isReviewInfrastructureError(error)) {
      tripCloudBreaker(error);
      applyLocally();
      return;
    }
    throw reviewError(readErrorShape(error));
  }
}

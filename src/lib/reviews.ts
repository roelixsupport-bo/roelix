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
  /** Auth user who wrote it; null on rows written before sign-in was required. */
  authorId: string | null;
  /** Public URL of the customer photo, when one was attached. */
  imageUrl: string | null;
  /** This device still owns the review; it has not been accepted by Supabase yet. */
  pendingUpload?: boolean;
};

export type ReviewInput = {
  productId: string;
  authorName: string;
  rating: number;
  body: string;
  /** Set by the signed-in reviewer; the database pins the row to this user. */
  authorId?: string | null;
  /** Storage URL returned by `uploadReviewImage`. */
  imageUrl?: string | null;
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
 * 42P01        relation does not exist
 * PGRST205     "Could not find the table in the schema cache" (the reported bug)
 * PGRST202/204 stale schema cache after a column/function change
 * PGRST301/302 expired or bad JWT
 * 3F000        invalid schema
 * 08xxx        connection exceptions
 * 42501        row-level security denial — a misconfigured key or policy
 *
 * None of these are the customer's fault and none of them can be fixed from the
 * storefront, so a submission must degrade to the device queue instead of
 * failing in the shopper's face.
 */
const UNUSABLE_TABLE_CODES = new Set([
  "42P01",
  "PGRST205",
  "PGRST204",
  "PGRST202",
  "PGRST001",
  "PGRST002",
  "PGRST003",
  "PGRST301",
  "PGRST302",
  "3F000",
  "08000",
  "08003",
  "08006",
  "42501",
]);

const UNUSABLE_TABLE_MESSAGE =
  /schema cache|could not find the table|no such table|undefined table|relation .* does not exist|does not exist|failed to fetch|networkerror|network error|fetch failed|load failed|connection (?:closed|refused|reset|terminated)|timed out|timeout|jwt|api ?key|no suitable key|unauthorized|invalid claim|permission denied/i;

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
 * True when the failure is about the table, the connection or the credentials,
 * rather than about this particular review.
 *
 * Constraint violations (23514 and the 22xxx data errors) stay visible: those are
 * real answers about the review being written. A 42501 RLS denial counts as
 * infrastructure here so a shopper's text is never lost to a misconfigured
 * policy — the moderation callers test for it first and still report
 * "administrators only" in the dashboard.
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
  // `comment` is what the oldest deployed table called this column.
  const body = readString(value, "body", "comment").trim();
  const createdAt = readString(value, "created_at", "createdAt");
  if (!id || !productId || !authorName || !body || !createdAt || rating === null) return null;

  const imageUrl = readString(value, "image_url", "imageUrl").trim();

  return {
    id,
    productId,
    authorName,
    rating,
    body,
    // Fail closed: an unknown or missing status must never publish a review.
    status: readStatus(value["status"]),
    createdAt,
    authorId: readString(value, "user_id", "userId", "authorId").trim() || null,
    // A stored value that is not a URL would render as a broken image; drop it.
    imageUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : null,
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

// --- Paging -----------------------------------------------------------------

/** Reviews shown per page in the storefront ledger. */
export const REVIEWS_PER_PAGE = 6;

export type ReviewPage = {
  items: ProductReview[];
  /** 1-based page actually shown, clamped into the available range. */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based position of the first and last row on this page; 0 when empty. */
  from: number;
  to: number;
};

/**
 * Slices one page of the ledger.
 *
 * A page number left over from a longer list (an admin hid a review, the product
 * changed) is pulled back into range instead of rendering an empty page.
 */
export function paginateReviews(
  reviews: ProductReview[],
  page: number,
  perPage: number = REVIEWS_PER_PAGE,
): ReviewPage {
  const size = Math.max(1, Math.floor(perPage));
  const total = reviews.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(pageCount, Math.max(1, Math.floor(page) || 1));
  const start = (current - 1) * size;
  const items = reviews.slice(start, start + size);

  return {
    items,
    page: current,
    pageCount,
    total,
    from: items.length === 0 ? 0 : start + 1,
    to: start + items.length,
  };
}

/** The page numerals to render: a window that keeps the current page centred. */
export function reviewPageNumbers(page: number, pageCount: number, max = 5): number[] {
  const count = Math.max(1, pageCount);
  const width = Math.min(count, Math.max(1, max));
  const current = Math.min(count, Math.max(1, page));
  const start = Math.min(Math.max(1, current - Math.floor(width / 2)), count - width + 1);

  return Array.from({ length: width }, (_, index) => start + index);
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
    return new Error(
      "The database rejected this review status. Apply the 20261109153200 repair review status constraint migration.",
    );
  }
  if (error.code === "23514") {
    return new Error("The review did not pass validation. Check the name, rating and comment.");
  }
  return new Error(error.message || "The review could not be saved.");
}

/**
 * The review text column.
 *
 * The shipped schema calls it `body`, but the first deployed version of the table
 * used `comment`. Reads ask for whichever one this project actually has, flipped
 * by a single failed request, so the storefront works before the rename migration
 * is applied — and afterwards without another change.
 */
let bodyColumn: "body" | "comment" = "body";

/** Test hook: assume a project where the column is already `body`. */
export function resetReviewBodyColumn(): void {
  bodyColumn = "body";
}

function reviewBaseColumns(): string {
  return `id,product_id,author_name,rating,${bodyColumn},status,created_at`;
}

/**
 * Author and photo columns added by the 2026-11-03 migration.
 *
 * A project that has not run it yet still serves reviews: one failed read flips
 * this off for the session and everything falls back to the base columns, rather
 * than the storefront losing every review until the DDL is applied.
 */
const REVIEW_MEDIA_COLUMNS = "user_id,image_url";
let mediaColumnsAvailable = true;

/** Test hook: pretend a fresh deployment where the media columns exist. */
export function resetReviewMediaColumns(): void {
  mediaColumnsAvailable = true;
}

function reviewColumns(): string {
  const base = reviewBaseColumns();
  return mediaColumnsAvailable ? `${base},${REVIEW_MEDIA_COLUMNS}` : base;
}

function isMissingColumnError(value: unknown): boolean {
  const { code, message } = readErrorShape(value);
  return code === "42703" || code === "PGRST204" || /column .* does not exist/i.test(message);
}

/** The text column itself is missing: this project predates the `body` rename. */
function isMissingBodyColumn(value: unknown): boolean {
  const { code, message } = readErrorShape(value);
  return (
    (code === "42703" || code === "PGRST204" || isMissingColumnError(value)) &&
    /\bbody\b/i.test(message) &&
    bodyColumn === "body"
  );
}

type ReviewQueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

/**
 * Runs a review select, retrying once without the author/photo columns when the
 * project has not been migrated. Only that failure demotes the columns; any
 * other error is returned untouched for the caller to classify.
 */
async function readReviewRows(
  run: (columns: string) => PromiseLike<ReviewQueryResult>,
): Promise<ReviewQueryResult> {
  let result = await run(reviewColumns());

  // The oldest deployed table called the text column `comment`.
  if (result.error && isMissingBodyColumn(result.error)) {
    console.warn(
      "ROELIX reviews: this project stores review text in `comment`. Apply supabase/migrations/20261105120000_reviews_body_column.sql to align it with `body`.",
    );
    bodyColumn = "comment";
    result = await run(reviewColumns());
  }

  if (result.error && isMissingColumnError(result.error)) {
    console.warn(
      "ROELIX reviews: author/photo columns are missing. Apply supabase/migrations/20261103120000_review_auth_and_images.sql.",
    );
    mediaColumnsAvailable = false;
    result = await run(reviewColumns());
  }
  return result;
}

/** Opens a client, or null when the module/env is missing. Never throws. */
async function reviewClient(): Promise<
  Awaited<typeof import("@/lib/supabase")>["supabase"] | null
> {
  try {
    const { supabase, healStaleSession } = await import("@/lib/supabase");
    // An unverifiable stored session makes every review request 401 and would
    // otherwise push a healthy project onto the local fallback for good.
    await healStaleSession();
    return supabase;
  } catch (error) {
    tripCloudBreaker(error);
    return null;
  }
}

type ReviewSupabaseClient = NonNullable<Awaited<ReturnType<typeof reviewClient>>>;

type ReviewInsertFields = {
  /** Client-generated id, used by the device queue so replays are idempotent. */
  id?: string;
  productId: string;
  authorName: string;
  rating: number;
  body: string;
  userId?: string | null;
  imageUrl?: string | null;
};

/**
 * Inserts one pending review, adapting to the project's schema as it goes.
 *
 * Two migrations are still not applied everywhere: the text column was once
 * called `comment`, and the author/photo columns arrived later. Each adaptation
 * is learned once per session from a real error and then reused, so a shopper
 * never has to meet a 400 because their project is one migration behind.
 */
async function insertReview(
  client: ReviewSupabaseClient,
  fields: ReviewInsertFields,
): Promise<{ error: { code?: string; message?: string } | null }> {
  const payload = (): Record<string, unknown> => ({
    ...(fields.id ? { id: fields.id } : {}),
    product_id: fields.productId,
    author_name: fields.authorName,
    rating: fields.rating,
    [bodyColumn]: fields.body,
    // Explicit, not just the column default: RLS only accepts pending inserts,
    // so a project without the approval migration fails loudly instead of
    // publishing straight to the storefront.
    status: "pending" as const,
    ...(mediaColumnsAvailable && fields.userId ? { user_id: fields.userId } : {}),
    ...(mediaColumnsAvailable && fields.imageUrl ? { image_url: fields.imageUrl } : {}),
  });

  let result = await client.from("product_reviews").insert(payload());

  if (result.error && isMissingBodyColumn(result.error)) {
    bodyColumn = "comment";
    result = await client.from("product_reviews").insert(payload());
  }
  if (result.error && isMissingColumnError(result.error)) {
    mediaColumnsAvailable = false;
    result = await client.from("product_reviews").insert(payload());
  }
  return result;
}

// --- Reads ------------------------------------------------------------------

/** Published reviews for one product. Falls back to the local cache on any failure. */
export async function fetchProductReviews(productId: string): Promise<ProductReview[]> {
  if (!reviewsCloudEnabled() || reviewCloudDisabled()) return localPublishedFor(productId);

  try {
    const supabase = await reviewClient();
    if (!supabase) return localPublishedFor(productId);

    const { data, error } = await readReviewRows((columns) =>
      supabase
        .from("product_reviews")
        .select(columns)
        .eq("product_id", productId)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(100),
    );
    if (error) throw error;

    // The cloud answered, so anything queued on this device can go up now.
    void drainQueuedReviews();

    return ((data ?? []) as unknown[])
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

  // Drain first so the moderation queue the admin sees already contains what
  // this device was holding.
  await drainQueuedReviews();

  try {
    const supabase = await reviewClient();
    if (!supabase) return localQueue();

    const { data, error } = await readReviewRows((columns) =>
      supabase
        .from("product_reviews")
        .select(columns)
        .order("created_at", { ascending: false })
        .limit(500),
    );
    if (error) throw error;

    const cloudReviews = ((data ?? []) as unknown[])
      .map(reviewFromRecord)
      .filter((review): review is ProductReview => review !== null);
    const cloudIds = new Set(cloudReviews.map((review) => review.id));
    const queuedReviews = readLocalReviews()
      .filter((review) => review.status === "pending" && !cloudIds.has(review.id))
      .map((review) => ({ ...review, pendingUpload: true }));

    return [...cloudReviews, ...queuedReviews].sort(newestFirst);
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
    authorId: input.authorId?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
  };

  if (!reviewsCloudEnabled() || reviewCloudDisabled()) return saveLocalReview(draft);

  try {
    const supabase = await reviewClient();
    if (!supabase) return saveLocalReview(draft);

    const { error } = await insertReview(supabase, {
      productId: draft.productId,
      authorName: draft.authorName,
      rating: draft.rating,
      body: draft.body,
      userId: draft.authorId,
      imageUrl: draft.imageUrl,
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
  const queuedReview = readLocalReviews().find((review) => review.id === id);
  if (
    reviewsCloudEnabled() &&
    !reviewCloudDisabled() &&
    queuedReview?.status === "pending" &&
    status !== "pending"
  ) {
    throw new Error(
      "This review is still saved on this device. Sign in with the account that wrote it and retry the upload before approving it.",
    );
  }

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
    // A row-level-security denial is an answer about *this admin*, not a broken
    // table: it must be shown, not quietly applied to the local copy.
    if (readErrorShape(error).code === "42501") throw reviewError(readErrorShape(error));
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
  const queuedReview = readLocalReviews().find((review) => review.id === id);
  if (reviewsCloudEnabled() && !reviewCloudDisabled() && queuedReview?.status === "pending") {
    writeLocalReviews(readLocalReviews().filter((review) => review.id !== id));
    return;
  }

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
    if (readErrorShape(error).code === "42501") throw reviewError(readErrorShape(error));
    if (isReviewInfrastructureError(error)) {
      tripCloudBreaker(error);
      applyLocally();
      return;
    }
    throw reviewError(readErrorShape(error));
  }
}

// --- Device-queue drain -----------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReviewDrainResult = {
  /** Rows Supabase now owns. */
  uploaded: number;
  /** Rows still waiting on this device. */
  pending: number;
};

/** Reviews written here that have not reached Supabase yet. */
export function queuedReviewCount(): number {
  return readLocalReviews().filter((review) => review.status === "pending").length;
}

let drainPromise: Promise<ReviewDrainResult> | null = null;

/**
 * Uploads reviews that were queued on this device while the cloud was unusable.
 *
 * Runs whenever a cloud read succeeds, so nothing the shopper wrote is stranded
 * on one browser: their review reaches the moderation queue as soon as the
 * connection (or the project) recovers.
 *
 * Idempotent by construction — the client id is the row's primary key, so a
 * replay after a half-finished upload collides on `23505` and is treated as
 * already delivered rather than duplicated. The insert policy demands
 * `user_id = auth.uid()`, so rows only travel while their author is signed in on
 * this device; otherwise they stay queued instead of failing repeatedly.
 */
export function drainQueuedReviews(): Promise<ReviewDrainResult> {
  drainPromise ??= runDrain().finally(() => {
    drainPromise = null;
  });
  return drainPromise;
}

async function runDrain(): Promise<ReviewDrainResult> {
  const queue = readLocalReviews().filter((review) => review.status === "pending");
  if (queue.length === 0) return { uploaded: 0, pending: 0 };
  if (!reviewsCloudEnabled() || reviewCloudDisabled()) {
    return { uploaded: 0, pending: queue.length };
  }

  const supabase = await reviewClient();
  if (!supabase) return { uploaded: 0, pending: queue.length };

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id ?? null;
  } catch (error) {
    console.warn("ROELIX reviews: could not read the session before draining", error);
  }
  if (!userId) return { uploaded: 0, pending: queue.length };

  const uploaded = new Set<string>();

  for (const review of queue) {
    // A legacy id (`local-…`) is not a uuid and cannot be the cloud primary key,
    // and another account's review cannot satisfy the policy.
    if (!UUID_PATTERN.test(review.id) || review.authorId !== userId) continue;

    try {
      const { error } = await insertReview(supabase, {
        id: review.id,
        productId: review.productId,
        authorName: review.authorName,
        rating: review.rating,
        body: review.body,
        userId,
        imageUrl: review.imageUrl,
      });

      if (!error) {
        uploaded.add(review.id);
        continue;
      }
      // Already there from an interrupted run: treat as delivered, not an error.
      if (readErrorShape(error).code === "23505") {
        uploaded.add(review.id);
        continue;
      }
      console.warn("ROELIX reviews: a queued review was not uploaded", error);
      // The backend itself is unusable: leave the rest queued rather than burning
      // a request per row. A policy rejection (42501) is about this row, not the
      // table, so reads elsewhere in the session keep working.
      if (isReviewInfrastructureError(error)) {
        if (readErrorShape(error).code !== "42501") tripCloudBreaker(error);
        break;
      }
    } catch (error) {
      if (isReviewInfrastructureError(error)) tripCloudBreaker(error);
      break;
    }
  }

  if (uploaded.size > 0) {
    writeLocalReviews(readLocalReviews().filter((review) => !uploaded.has(review.id)));
    console.info(`ROELIX reviews: uploaded ${uploaded.size} queued review(s) to Supabase`);
  }

  return { uploaded: uploaded.size, pending: queuedReviewCount() };
}

/**
 * Customer reviews: cloud-first, local fallback.
 *
 * Reviews live in `product_reviews` when Supabase is configured. On a local-only
 * install (no env vars) they are kept in local storage instead, so the review
 * form still works in the offline demo build the rest of this app supports.
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

function newReviewId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newestFirst(a: ProductReview, b: ProductReview): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/** Turns a Supabase error into something the storefront can show a customer. */
function reviewError(error: { code?: string; message?: string }): Error {
  if (error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? "")) {
    return new Error(
      "Reviews are not enabled on this project yet. Apply the ROELIX reviews migration first.",
    );
  }
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
  return new Error(error.message ?? "The review could not be saved.");
}

const REVIEW_COLUMNS = "id,product_id,author_name,rating,body,status,created_at";

// --- Reads ------------------------------------------------------------------

export async function fetchProductReviews(productId: string): Promise<ProductReview[]> {
  const local = readLocalReviews().filter((review) => review.productId === productId);
  if (!reviewsCloudEnabled())
    return local.filter((r) => r.status === "published").sort(newestFirst);

  try {
    const { supabase } = await import("@/lib/supabase");
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
    // A missing table or a network drop must not empty a page that has reviews
    // cached locally.
    console.warn("ROELIX reviews: live fetch failed, using the local cache", error);
    return local.filter((r) => r.status === "published").sort(newestFirst);
  }
}

/** Moderation list: published and hidden, newest first. */
export async function fetchAllReviews(): Promise<ProductReview[]> {
  if (!reviewsCloudEnabled()) return readLocalReviews().sort(newestFirst);
  try {
    const { supabase } = await import("@/lib/supabase");
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
    console.warn("ROELIX reviews: could not load the moderation list", error);
    throw error instanceof Error ? error : new Error("Could not load reviews");
  }
}

// --- Writes -----------------------------------------------------------------

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

  if (!reviewsCloudEnabled()) {
    writeLocalReviews([draft, ...readLocalReviews()]);
    return draft;
  }

  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase
    .from("product_reviews")
    .insert({
      product_id: draft.productId,
      author_name: draft.authorName,
      rating: draft.rating,
      body: draft.body,
      // Explicit, not just the column default: RLS only accepts pending inserts,
      // so a project without the approval migration fails loudly instead of
      // publishing straight to the storefront.
      status: "pending",
    })
    .select(REVIEW_COLUMNS)
    .single();

  if (error) throw reviewError(error);
  const saved = reviewFromRecord(data);
  return saved ?? draft;
}

/** Approves a pending review: the only state the storefront will show. */
export async function approveReview(id: string): Promise<void> {
  await setReviewStatus(id, "published");
}

export async function setReviewStatus(id: string, status: ReviewStatus): Promise<void> {
  if (!reviewsCloudEnabled()) {
    writeLocalReviews(
      readLocalReviews().map((review) => (review.id === id ? { ...review, status } : review)),
    );
    return;
  }

  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase.from("product_reviews").update({ status }).eq("id", id);
  if (error) throw reviewError(error);
}

export async function deleteReview(id: string): Promise<void> {
  if (!reviewsCloudEnabled()) {
    writeLocalReviews(readLocalReviews().filter((review) => review.id !== id));
    return;
  }

  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase.from("product_reviews").delete().eq("id", id);
  if (error) throw reviewError(error);
}

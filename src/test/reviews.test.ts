import { beforeEach, describe, expect, it } from "vitest";

import {
  approveReview,
  fetchAllReviews,
  fetchProductReviews,
  setReviewStatus,
  submitProductReview,
  summarizeReviews,
  validateReviewInput,
  type ProductReview,
} from "@/lib/reviews";

const review = (patch: Partial<ProductReview> = {}): ProductReview => ({
  id: "r1",
  productId: "aurelia-sateen",
  authorName: "Nour",
  rating: 5,
  body: "Cool and heavy, exactly as described.",
  status: "published",
  createdAt: "2026-10-01T10:00:00.000Z",
  ...patch,
});

describe("review summary", () => {
  it("reports an empty summary without dividing by zero", () => {
    expect(summarizeReviews([])).toEqual({
      count: 0,
      average: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it("averages and groups ratings, ignoring malformed values", () => {
    const summary = summarizeReviews([
      review({ id: "a", rating: 5 }),
      review({ id: "b", rating: 4 }),
      review({ id: "c", rating: 4 }),
      review({ id: "d", rating: 0 as ProductReview["rating"] }),
    ]);

    expect(summary.count).toBe(3);
    expect(summary.average).toBeCloseTo(13 / 3, 5);
    expect(summary.distribution[4]).toBe(2);
    expect(summary.distribution[5]).toBe(1);
    expect(summary.distribution[1]).toBe(0);
  });
});

describe("review validation", () => {
  const valid = {
    productId: "aurelia-sateen",
    authorName: "Nour",
    rating: 5,
    body: "Beautiful hand feel.",
  };

  it("accepts a complete submission", () => {
    expect(validateReviewInput(valid)).toBeNull();
  });

  it("names the first invalid field", () => {
    expect(validateReviewInput({ ...valid, authorName: "N" })).toEqual({ field: "authorName" });
    expect(validateReviewInput({ ...valid, rating: 0 })).toEqual({ field: "rating" });
    expect(validateReviewInput({ ...valid, rating: 6 })).toEqual({ field: "rating" });
    expect(validateReviewInput({ ...valid, body: "ok" })).toEqual({ field: "body" });
  });
});

describe("local review storage", () => {
  beforeEach(() => localStorage.clear());

  it("keeps a new review off the storefront until an admin approves it", async () => {
    const saved = await submitProductReview({
      productId: "aurelia-sateen",
      authorName: "  Nour ",
      rating: 4,
      body: "  Lighter than expected, in a good way. ",
    });

    expect(saved.status).toBe("pending");
    // Nothing a customer writes is public yet…
    expect(await fetchProductReviews("aurelia-sateen")).toHaveLength(0);

    // …but the moderation queue holds it, with the trimmed text intact.
    const queue = await fetchAllReviews();
    expect(queue).toHaveLength(1);
    expect(queue[0]?.authorName).toBe("Nour");
    expect(queue[0]?.rating).toBe(4);
    expect(queue[0]?.body).toBe("Lighter than expected, in a good way.");
    expect(queue[0]?.status).toBe("pending");

    await approveReview(queue[0]!.id);

    const published = await fetchProductReviews("aurelia-sateen");
    expect(published).toHaveLength(1);
    expect(published[0]?.status).toBe("published");
    expect(published[0]?.authorName).toBe("Nour");

    // Other products stay untouched throughout.
    expect(await fetchProductReviews("cloud-pillow")).toHaveLength(0);
  });

  it("withdraws an approved review without deleting the record", async () => {
    const saved = await submitProductReview({
      productId: "cloud-pillow",
      authorName: "Hana",
      rating: 5,
      body: "Perfect loft for side sleepers.",
    });
    await approveReview(saved.id);
    expect(await fetchProductReviews("cloud-pillow")).toHaveLength(1);

    await setReviewStatus(saved.id, "hidden");
    expect(await fetchProductReviews("cloud-pillow")).toHaveLength(0);
    expect(await fetchAllReviews()).toHaveLength(1);
  });

  it("refuses an invalid submission", async () => {
    await expect(
      submitProductReview({
        productId: "aurelia-sateen",
        authorName: "N",
        rating: 5,
        body: "Great.",
      }),
    ).rejects.toThrow(/validation/i);
    expect(await fetchProductReviews("aurelia-sateen")).toHaveLength(0);
  });
});

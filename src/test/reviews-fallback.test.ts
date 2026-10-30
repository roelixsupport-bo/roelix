import { beforeEach, describe, expect, it } from "vitest";

import {
  fetchAllReviews,
  fetchProductReviews,
  isReviewInfrastructureError,
  resetReviewCloudState,
  reviewCloudDisabled,
  submitProductReview,
} from "@/lib/reviews";

beforeEach(() => {
  localStorage.clear();
  resetReviewCloudState();
});

describe("review infrastructure failures", () => {
  it("treats a stale schema cache or a missing table as unusable", () => {
    expect(
      isReviewInfrastructureError({
        code: "PGRST205",
        message: "Could not find the table 'public.product_reviews' in the schema cache",
      }),
    ).toBe(true);

    expect(
      isReviewInfrastructureError({
        code: "42P01",
        message: 'relation "public.product_reviews" does not exist',
      }),
    ).toBe(true);

    expect(isReviewInfrastructureError({ message: "TypeError: Failed to fetch" })).toBe(true);

    expect(isReviewInfrastructureError("Load failed")).toBe(true);
  });

  it("keeps real configuration errors visible instead of hiding them", () => {
    expect(isReviewInfrastructureError({ code: "23514", message: "status check failed" })).toBe(
      false,
    );
    expect(
      isReviewInfrastructureError({
        code: "42501",
        message: "new row violates row-level security",
      }),
    ).toBe(false);
  });

  it("starts each session with the cloud path open", () => {
    expect(reviewCloudDisabled()).toBe(false);
  });
});

describe("submission never breaks the form", () => {
  it("returns a pending review immediately and keeps it on the device", async () => {
    const saved = await submitProductReview({
      productId: "cloud-pillow",
      authorName: "Hana",
      rating: 5,
      body: "Perfect loft for side sleepers.",
    });

    expect(saved.status).toBe("pending");
    expect(saved.authorName).toBe("Hana");

    // The moderation queue can read it back, the storefront cannot see it yet.
    expect(await fetchAllReviews()).toHaveLength(1);
    expect(await fetchProductReviews("cloud-pillow")).toHaveLength(0);
  });

  it("still rejects input that fails validation", async () => {
    await expect(
      submitProductReview({
        productId: "cloud-pillow",
        authorName: "H",
        rating: 5,
        body: "Great.",
      }),
    ).rejects.toThrow(/validation/i);
  });
});

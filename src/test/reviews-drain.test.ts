import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  drainQueuedReviews,
  fetchAllReviews,
  queuedReviewCount,
  setReviewStatus,
  type ProductReview,
} from "@/lib/reviews";

/**
 * The drain only matters in a real deployment: it exists for reviews written on
 * a device while Supabase was unusable. Cloud is switched on for these tests and
 * a fake client records exactly what would have been sent.
 */
const inserts: Array<Record<string, unknown>> = [];
let cloudRows: Array<Record<string, unknown>> = [];
let insertError: { code?: string; message?: string } | null = null;
let sessionUserId: string | null = "user-1";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: sessionUserId ? { user: { id: sessionUserId } } : null },
        error: null,
      }),
    },
    from: () => ({
      insert: async (payload: Record<string, unknown>) => {
        if (insertError) return { error: insertError };
        inserts.push(payload);
        return { error: null };
      },
      select: () => ({
        order: () => ({
          limit: async () => ({ data: cloudRows, error: null }),
        }),
      }),
    }),
  },
  healStaleSession: async () => false,
}));

const LOCAL_KEY = "roelix_reviews";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const review = (patch: Partial<ProductReview> = {}): ProductReview => ({
  id: uuid(1),
  productId: "aurelia-sateen",
  authorName: "Hana",
  rating: 5,
  body: "Cool to the touch.",
  status: "pending",
  createdAt: "2026-11-05T09:00:00.000Z",
  authorId: "user-1",
  imageUrl: null,
  ...patch,
});

const queue = (...reviews: ProductReview[]) => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(reviews));
};

beforeEach(async () => {
  vi.stubEnv("MODE", "production");
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
  localStorage.clear();
  inserts.length = 0;
  cloudRows = [];
  insertError = null;
  sessionUserId = "user-1";
  const { resetReviewCloudState } = await import("@/lib/reviews");
  resetReviewCloudState();
});

describe("device review queue drain", () => {
  it("uploads a queued review and clears it from the device", async () => {
    queue(review());

    await expect(drainQueuedReviews()).resolves.toEqual({ uploaded: 1, pending: 0 });

    // The client id becomes the primary key, which is what makes a replay safe.
    expect(inserts[0]).toMatchObject({
      id: uuid(1),
      product_id: "aurelia-sateen",
      rating: 5,
      status: "pending",
      user_id: "user-1",
    });
    expect(queuedReviewCount()).toBe(0);
  });

  it("treats an already-uploaded row as delivered instead of retrying forever", async () => {
    queue(review());
    insertError = { code: "23505", message: "duplicate key value violates unique constraint" };

    await expect(drainQueuedReviews()).resolves.toEqual({ uploaded: 1, pending: 0 });
    expect(queuedReviewCount()).toBe(0);
  });

  it("waits while the author is not signed in on this device", async () => {
    queue(review());
    sessionUserId = null;

    await expect(drainQueuedReviews()).resolves.toEqual({ uploaded: 0, pending: 1 });
    expect(inserts).toHaveLength(0);
    expect(queuedReviewCount()).toBe(1);
  });

  it("keeps another account's review and legacy non-uuid ids queued", async () => {
    queue(
      review({ id: uuid(2), authorId: "someone-else" }),
      review({ id: "local-abc123", authorId: "user-1" }),
    );

    await expect(drainQueuedReviews()).resolves.toEqual({ uploaded: 0, pending: 2 });
    expect(inserts).toHaveLength(0);
  });

  it("shows a review that cannot sync in the admin queue without allowing approval", async () => {
    queue(review({ authorId: "another-account" }));
    sessionUserId = "admin-account";

    await expect(fetchAllReviews()).resolves.toMatchObject([
      { id: uuid(1), status: "pending", pendingUpload: true },
    ]);

    await expect(setReviewStatus(uuid(1), "published")).rejects.toThrow(
      "still saved on this device",
    );
    expect(queuedReviewCount()).toBe(1);
    expect(inserts).toHaveLength(0);
  });

  it("leaves the queue intact when the backend rejects the insert", async () => {
    queue(review());
    insertError = { code: "42501", message: "new row violates row-level security policy" };

    await expect(drainQueuedReviews()).resolves.toEqual({ uploaded: 0, pending: 1 });
    expect(queuedReviewCount()).toBe(1);
  });

  it("uploads nothing when the queue is already empty", async () => {
    await expect(drainQueuedReviews()).resolves.toEqual({ uploaded: 0, pending: 0 });
    expect(inserts).toHaveLength(0);
  });

  it("never sends a published local row back up", async () => {
    queue(review({ status: "published" }));

    await expect(drainQueuedReviews()).resolves.toEqual({ uploaded: 0, pending: 0 });
    expect(inserts).toHaveLength(0);
  });
});

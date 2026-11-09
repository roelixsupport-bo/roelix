import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchProductReviews,
  editOwnReview,
  reviewsCloudEnabled,
  submitProductReview,
  summarizeReviews,
  toggleReviewLike,
  type ProductReview,
  type ReviewInput,
  type ReviewSummary,
} from "@/lib/reviews";

export type UseProductReviews = {
  reviews: ProductReview[];
  summary: ReviewSummary;
  loading: boolean;
  submitting: boolean;
  submit: (input: Omit<ReviewInput, "productId">) => Promise<ProductReview | null>;
  edit: (input: { reviewId: string; authorId: string; rating: number; body: string }) => Promise<void>;
  toggleLike: (reviewId: string, viewerId: string) => Promise<void>;
  reload: () => Promise<void>;
};

/**
 * Loads one product's reviews and keeps them live.
 *
 * Realtime alone is not enough on phones — backgrounded tabs lose the socket —
 * so the subscription is paired with a refresh on visibility/focus, matching the
 * catalogue sync strategy in the store.
 */
export function useProductReviews(
  productId: string | undefined,
  viewerId?: string,
): UseProductReviews {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    if (!productId) {
      setReviews([]);
      setLoading(false);
      return;
    }
    try {
      setReviews(await fetchProductReviews(productId, viewerId));
    } catch (error) {
      console.warn("ROELIX reviews: could not refresh", error);
    } finally {
      setLoading(false);
    }
  }, [productId, viewerId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!productId || !reviewsCloudEnabled() || typeof window === "undefined") return;

    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let removeChannel: (() => void) | undefined;

    const refreshSoon = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void reload(), 400);
    };
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") refreshSoon();
    };

    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);

    void (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const channel = supabase
          .channel(`roelix-reviews-${productId}-${Math.random().toString(36).slice(2, 8)}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "product_reviews",
              filter: `product_id=eq.${productId}`,
            },
            refreshSoon,
          )
          .subscribe();

        if (disposed) {
          void supabase.removeChannel(channel);
          return;
        }
        removeChannel = () => void supabase.removeChannel(channel);
      } catch (error) {
        console.warn("ROELIX reviews: realtime unavailable, using focus refresh", error);
      }
    })();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      if (refreshTimer) clearTimeout(refreshTimer);
      removeChannel?.();
    };
  }, [productId, reload]);

  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);

  const submit = useCallback(
    async (input: Omit<ReviewInput, "productId">) => {
      if (!productId) return null;
      setSubmitting(true);
      try {
        const saved = await submitProductReview({ ...input, productId });
        await reload();
        return saved;
      } catch (error) {
        console.error("Could not submit the ROELIX review", error);
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [productId, reload],
  );

  const edit = useCallback(
    async (input: { reviewId: string; authorId: string; rating: number; body: string }) => {
      await editOwnReview(input);
      await reload();
    },
    [reload],
  );

  const toggleLike = useCallback(
    async (reviewId: string, currentViewerId: string) => {
      const like = await toggleReviewLike(reviewId, currentViewerId);
      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                likesCount: like.likesCount,
                likedByViewer: like.likedByViewer,
              }
            : review,
        ),
      );
    },
    [],
  );

  return { reviews, summary, loading, submitting, submit, edit, toggleLike, reload };
}

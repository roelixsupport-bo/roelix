import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { StarRating } from "@/components/product/star-rating";
import {
  approveReview,
  deleteReview,
  fetchAllReviews,
  reviewsCloudEnabled,
  setReviewStatus,
  type ProductReview,
  type ReviewStatus,
} from "@/lib/reviews";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    title: "Customer reviews",
    hint: "A review written on a product page waits here until you approve it. Approving publishes it to the storefront immediately; deleting removes it for good.",
    all: "All",
    pending: "Pending",
    published: "Published",
    hidden: "Hidden",
    pendingLabel: "Awaiting approval",
    publishedLabel: "Published",
    hiddenLabel: "Hidden",
    total: "Reviews",
    pendingStat: "Awaiting approval",
    average: "Average rating",
    approve: "Approve",
    approveTitle: "Approve and publish this review",
    hide: "Withdraw from the storefront",
    restore: "Publish again",
    remove: "Delete review",
    loading: "Loading reviews…",
    empty: "No reviews yet. Reviews submitted on a product page land here for approval.",
    emptyPending: "Nothing is waiting for approval.",
    emptyFilter: "No reviews match this filter.",
    approvedToast: "Review approved and live on the product page",
    hiddenToast: "Review withdrawn from the storefront",
    publishedToast: "Review published",
    removedToast: "Review deleted",
    loadFailed: "Could not load reviews.",
    unknownProduct: "Deleted product",
    stars: "stars",
  },
  ar: {
    title: "تقييمات العملاء",
    hint: "التقييم المكتوب في صفحة المنتج ينتظر هنا حتى توافق عليه. الموافقة تنشره في المتجر فوراً، والحذف يزيله نهائياً.",
    all: "الكل",
    pending: "بانتظار الموافقة",
    published: "المنشورة",
    hidden: "المخفية",
    pendingLabel: "بانتظار الموافقة",
    publishedLabel: "منشور",
    hiddenLabel: "مخفي",
    total: "التقييمات",
    pendingStat: "بانتظار الموافقة",
    average: "متوسط التقييم",
    approve: "موافقة",
    approveTitle: "الموافقة على التقييم ونشره",
    hide: "سحب من المتجر",
    restore: "نشر مرة أخرى",
    remove: "حذف التقييم",
    loading: "جارٍ تحميل التقييمات…",
    empty: "لا توجد تقييمات بعد. تصل تقييمات صفحة المنتج إلى هنا للموافقة.",
    emptyPending: "لا يوجد تقييم بانتظار الموافقة.",
    emptyFilter: "لا توجد تقييمات مطابقة لهذا التصنيف.",
    approvedToast: "تمت الموافقة على التقييم ونشره في صفحة المنتج",
    hiddenToast: "تم سحب التقييم من المتجر",
    publishedToast: "تم نشر التقييم",
    removedToast: "تم حذف التقييم",
    loadFailed: "تعذر تحميل التقييمات.",
    unknownProduct: "منتج محذوف",
    stars: "نجوم",
  },
} as const;

type Filter = "pending" | "published" | "hidden" | "all";

const STATUS_LABEL = {
  pending: "pendingLabel",
  published: "publishedLabel",
  hidden: "hiddenLabel",
} as const satisfies Record<ReviewStatus, string>;

/**
 * Review moderation for the dashboard.
 *
 * The queue opens on pending reviews because that is the only state that needs a
 * decision. Approving publishes a review to the storefront, withdrawing takes it
 * back off without losing the row, and deleting is permanent. Every one of those
 * transitions is admin-only at the database level, not just in this UI.
 */
export function ReviewsPanel({
  isArabic,
  productName,
}: {
  isArabic: boolean;
  productName: (id: string) => string;
}) {
  const text = COPY[isArabic ? "ar" : "en"];
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");

  const load = useCallback(async () => {
    try {
      setReviews(await fetchAllReviews());
    } catch (error) {
      console.error("Could not load ROELIX reviews", error);
      toast.error(error instanceof Error ? error.message : text.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [text.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live moderation: a review submitted on any device shows up without a refresh.
  useEffect(() => {
    if (!reviewsCloudEnabled() || typeof window === "undefined") return;

    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let removeChannel: (() => void) | undefined;

    const refreshSoon = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void load(), 500);
    };
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") refreshSoon();
    };

    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);

    void (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const channel = supabase
          .channel(`roelix-reviews-admin-${Math.random().toString(36).slice(2, 8)}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "product_reviews" },
            refreshSoon,
          )
          .subscribe();

        if (disposed) {
          void supabase.removeChannel(channel);
          return;
        }
        removeChannel = () => void supabase.removeChannel(channel);
      } catch (error) {
        console.warn("ROELIX reviews: admin realtime unavailable", error);
      }
    })();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
      if (refreshTimer) clearTimeout(refreshTimer);
      removeChannel?.();
    };
  }, [load]);

  const stats = useMemo(() => {
    const pending = reviews.filter((review) => review.status === "pending").length;
    const published = reviews.filter((review) => review.status === "published");
    const average =
      published.length === 0
        ? 0
        : published.reduce((total, review) => total + review.rating, 0) / published.length;
    return {
      total: reviews.length,
      pending,
      published: published.length,
      hidden: reviews.length - published.length - pending,
      average,
    };
  }, [reviews]);

  const visible = useMemo(
    () => (filter === "all" ? reviews : reviews.filter((review) => review.status === filter)),
    [reviews, filter],
  );

  const runAction = async (action: () => Promise<void>, successToast: string) => {
    try {
      await action();
      toast.success(successToast);
      await load();
    } catch (error) {
      console.error("Could not moderate the ROELIX review", error);
      toast.error(error instanceof Error ? error.message : text.loadFailed);
    }
  };

  const emptyMessage =
    reviews.length === 0 ? text.empty : filter === "pending" ? text.emptyPending : text.emptyFilter;

  return (
    <section className="mt-6 space-y-5">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl">{text.title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{text.hint}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            [text.pendingStat, stats.pending, stats.pending > 0],
            [text.published, stats.published, false],
            [text.hidden, stats.hidden, false],
            [text.average, stats.average === 0 ? "—" : stats.average.toFixed(1), false],
          ] as Array<[string, string | number, boolean]>
        ).map(([label, value, waiting]) => (
          <div key={label} className={cn("border p-4", waiting && "border-gold bg-gold/5")}>
            <p className="eyebrow text-[0.6rem] text-muted-foreground">{label}</p>
            <p className={cn("mt-1.5 font-serif text-2xl", waiting && "text-gold")}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={text.title}>
        {(
          [
            ["pending", `${text.pending}${stats.pending > 0 ? ` (${stats.pending})` : ""}`],
            ["published", text.published],
            ["hidden", text.hidden],
            ["all", text.all],
          ] as Array<[Filter, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "border px-3 py-2 text-xs uppercase tracking-[0.12em] transition duration-200",
              filter === value
                ? "border-navy bg-navy text-navy-foreground"
                : "hover:border-gold hover:bg-gold/5",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && reviews.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {text.loading}
        </p>
      ) : visible.length === 0 ? (
        <p className="border border-dashed p-5 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((review) => (
            <li
              key={review.id}
              className={cn(
                "border p-4",
                review.status === "pending" && "border-s-2 border-s-gold bg-gold/5",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-base leading-tight">
                    {productName(review.productId) || text.unknownProduct}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <StarRating
                      value={review.rating}
                      size={12}
                      label={`${review.rating} ${text.stars}`}
                    />
                    <span className="font-medium text-foreground">{review.authorName}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {new Date(review.createdAt).toLocaleDateString(isArabic ? "ar-EG" : "en-GB")}
                    </span>
                    <span
                      className={cn(
                        "border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.12em]",
                        review.status === "published"
                          ? "border-emerald/40 text-emerald"
                          : review.status === "pending"
                            ? "border-gold/60 text-gold"
                            : "border-border text-muted-foreground",
                      )}
                    >
                      {text[STATUS_LABEL[review.status]]}
                    </span>
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                  {review.status === "pending" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(() => approveReview(review.id), text.approvedToast)
                      }
                      aria-label={text.approveTitle}
                      title={text.approveTitle}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 border border-gold bg-gold/15 px-3 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-foreground transition duration-200 hover:bg-gold/25 focus-visible:ring-1 focus-visible:ring-gold focus-visible:outline-hidden sm:flex-none"
                    >
                      <Check size={14} aria-hidden="true" />
                      {text.approve}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          () =>
                            setReviewStatus(
                              review.id,
                              review.status === "published" ? "hidden" : "published",
                            ),
                          review.status === "published" ? text.hiddenToast : text.publishedToast,
                        )
                      }
                      aria-label={review.status === "published" ? text.hide : text.restore}
                      title={review.status === "published" ? text.hide : text.restore}
                      className="border p-2 text-muted-foreground transition duration-200 hover:border-gold hover:text-foreground"
                    >
                      {review.status === "published" ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void runAction(() => deleteReview(review.id), text.removedToast)}
                    aria-label={text.remove}
                    title={text.remove}
                    className="border p-2 text-muted-foreground transition duration-200 hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                {review.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

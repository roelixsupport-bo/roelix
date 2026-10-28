import { useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { StarPicker, StarRating } from "@/components/product/star-rating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  REVIEW_LIMITS,
  validateReviewInput,
  type ProductReview,
  type ReviewFieldError,
  type ReviewRating,
  type ReviewSummary,
} from "@/lib/reviews";

const COPY = {
  en: {
    title: "Customer reviews",
    count: (count: number) => `${count} ${count === 1 ? "review" : "reviews"}`,
    averageOf: "out of 5",
    basedOn: (count: number) => `Based on ${count} ${count === 1 ? "review" : "reviews"}`,
    noRating: "No ratings yet",
    write: "Write a review",
    writeHint: "Reviews are published once our team approves them.",
    name: "Your name",
    namePlaceholder: "How should we credit you?",
    rating: "Your rating",
    comment: "Your review",
    commentPlaceholder: "How did the fabric feel, and how was the fit?",
    submit: "Submit review",
    submitting: "Sending…",
    success: "Thank you — your review is with our team for approval.",
    failure: "Your review could not be saved. Please try again.",
    nameError: "Enter a name between 2 and 60 characters.",
    ratingError: "Choose a rating from 1 to 5 stars.",
    bodyError: `Write between ${REVIEW_LIMITS.bodyMin} and ${REVIEW_LIMITS.bodyMax} characters.`,
    loading: "Loading reviews…",
    empty: "No reviews yet. Be the first to share how this piece feels at home.",
    stars: "stars",
    distribution: "Rating breakdown",
  },
  ar: {
    title: "تقييمات العملاء",
    count: (count: number) => `${count} تقييم`,
    averageOf: "من 5",
    basedOn: (count: number) => `بناءً على ${count} تقييم`,
    noRating: "لا توجد تقييمات بعد",
    write: "أضف تقييمك",
    writeHint: "تُنشر التقييمات بعد موافقة فريقنا عليها.",
    name: "اسمك",
    namePlaceholder: "كيف نعرض اسمك؟",
    rating: "تقييمك",
    comment: "تعليقك",
    commentPlaceholder: "كيف كانت الخامة والمقاس عند الاستخدام؟",
    submit: "إرسال التقييم",
    submitting: "جارٍ الإرسال…",
    success: "شكراً لك — تقييمك بانتظار موافقة فريقنا.",
    failure: "تعذر حفظ تقييمك. حاول مرة أخرى.",
    nameError: "أدخل اسماً بين حرفين و60 حرفاً.",
    ratingError: "اختر تقييماً من 1 إلى 5 نجوم.",
    bodyError: `اكتب بين ${REVIEW_LIMITS.bodyMin} و${REVIEW_LIMITS.bodyMax} حرفاً.`,
    loading: "جارٍ تحميل التقييمات…",
    empty: "لا توجد تقييمات بعد. كن أول من يشارك تجربته مع هذا المنتج.",
    stars: "نجوم",
    distribution: "توزيع التقييمات",
  },
} as const;

function formatDate(value: string, isArabic: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(isArabic ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export type ReviewsSectionProps = {
  isArabic: boolean;
  reviews: ProductReview[];
  summary: ReviewSummary;
  loading: boolean;
  submitting: boolean;
  onSubmit: (input: {
    authorName: string;
    rating: number;
    body: string;
  }) => Promise<ProductReview | null>;
};

/**
 * Ratings summary, submission form and review list.
 *
 * Everything is driven by props so the product page owns the single live
 * subscription (`useProductReviews`) instead of opening one per section.
 */
export function ReviewsSection({
  isArabic,
  reviews,
  summary,
  loading,
  submitting,
  onSubmit,
}: ReviewsSectionProps) {
  const copy = COPY[isArabic ? "ar" : "en"];
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<ReviewFieldError["field"] | null>(null);

  const errorText =
    error === "authorName"
      ? copy.nameError
      : error === "rating"
        ? copy.ratingError
        : error === "body"
          ? copy.bodyError
          : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalid = validateReviewInput({ productId: "pending", authorName, rating, body });
    if (invalid) {
      setError(invalid.field);
      return;
    }
    setError(null);
    try {
      const saved = await onSubmit({ authorName, rating, body });
      if (!saved) return;
      toast.success(copy.success);
      setAuthorName("");
      setRating(0);
      setBody("");
    } catch (submitError) {
      console.error("Could not publish the ROELIX review", submitError);
      toast.error(submitError instanceof Error ? submitError.message : copy.failure);
    }
  };

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="mt-16 scroll-mt-24 border-t pt-10 sm:mt-24 sm:pt-14"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="reviews-heading" className="font-serif text-2xl sm:text-3xl">
          {copy.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.count(summary.count)}</p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-6">
          {/* ------------------------------------------------------------ Summary */}
          <div className="border p-5">
            <div className="flex items-center gap-4">
              <p className="font-serif text-4xl leading-none">
                {summary.count === 0 ? "—" : summary.average.toFixed(1)}
              </p>
              <div className="min-w-0">
                <StarRating
                  value={summary.average}
                  size={15}
                  label={`${summary.average.toFixed(1)} ${copy.averageOf}`}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.count === 0 ? copy.noRating : copy.basedOn(summary.count)}
                </p>
              </div>
            </div>

            {summary.count > 0 && (
              <div className="mt-5 space-y-2" aria-label={copy.distribution}>
                {([5, 4, 3, 2, 1] as ReviewRating[]).map((star) => {
                  const amount = summary.distribution[star];
                  const percent = Math.round((amount / summary.count) * 100);
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-muted-foreground">{star}</span>
                      <Star
                        size={11}
                        aria-hidden="true"
                        className="fill-gold text-gold"
                        strokeWidth={1.5}
                      />
                      <span className="h-1.5 min-w-0 flex-1 bg-muted">
                        <span className="block h-full bg-gold" style={{ width: `${percent}%` }} />
                      </span>
                      <span className="w-6 text-end text-muted-foreground">{amount}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* --------------------------------------------------------------- Form */}
          <form onSubmit={handleSubmit} className="border p-5" noValidate>
            <h3 className="font-serif text-lg">{copy.write}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.writeHint}</p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="eyebrow text-[0.62rem]">{copy.rating}</p>
                <div className="mt-1.5">
                  <StarPicker
                    value={rating}
                    onChange={(next) => {
                      setRating(next);
                      if (error === "rating") setError(null);
                    }}
                    isArabic={isArabic}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="review-author" className="eyebrow text-[0.62rem]">
                  {copy.name}
                </label>
                <Input
                  id="review-author"
                  value={authorName}
                  maxLength={REVIEW_LIMITS.nameMax}
                  placeholder={copy.namePlaceholder}
                  dir="auto"
                  disabled={submitting}
                  aria-invalid={error === "authorName"}
                  onChange={(event) => {
                    setAuthorName(event.target.value);
                    if (error === "authorName") setError(null);
                  }}
                  className="h-10 rounded-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="review-body" className="eyebrow text-[0.62rem]">
                  {copy.comment}
                </label>
                <Textarea
                  id="review-body"
                  value={body}
                  rows={4}
                  maxLength={REVIEW_LIMITS.bodyMax}
                  placeholder={copy.commentPlaceholder}
                  dir="auto"
                  disabled={submitting}
                  aria-invalid={error === "body"}
                  onChange={(event) => {
                    setBody(event.target.value);
                    if (error === "body") setError(null);
                  }}
                  className="min-h-24 rounded-none"
                />
              </div>

              {errorText && (
                <p role="alert" className="text-xs text-destructive">
                  {errorText}
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-none bg-foreground text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-background hover:bg-foreground/90"
              >
                {submitting ? copy.submitting : copy.submit}
              </Button>
            </div>
          </form>
        </div>

        {/* ----------------------------------------------------------------- List */}
        <div className="min-w-0">
          {loading && reviews.length === 0 ? (
            <div className="space-y-4" role="status" aria-label={copy.loading}>
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-2 border-b pb-4">
                  <div className="h-3 w-32 animate-pulse bg-muted" />
                  <div className="h-3 w-20 animate-pulse bg-muted" />
                  <div className="h-12 w-full animate-pulse bg-muted" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <p className="border border-dashed p-6 text-sm leading-relaxed text-muted-foreground">
              {copy.empty}
            </p>
          ) : (
            <ul className="space-y-6">
              {reviews.map((review) => (
                <li key={review.id} className="border-b pb-5 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 font-serif text-sm text-gold"
                    >
                      {review.authorName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="font-serif text-base leading-tight">{review.authorName}</p>
                        <p className="text-[0.68rem] text-muted-foreground">
                          {formatDate(review.createdAt, isArabic)}
                        </p>
                      </div>
                      <StarRating
                        value={review.rating}
                        size={13}
                        label={`${review.rating} ${copy.stars}`}
                        className="mt-1"
                      />
                      <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                        {review.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

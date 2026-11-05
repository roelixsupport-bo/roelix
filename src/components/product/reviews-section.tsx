import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Lock, Star } from "lucide-react";
import { toast } from "sonner";

import { ReviewPhotoField } from "@/components/product/review-photo-field";
import { StarPicker, StarRating } from "@/components/product/star-rating";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reviewImageLimit, uploadReviewImage } from "@/lib/review-images";
import {
  REVIEW_LIMITS,
  paginateReviews,
  reviewPageNumbers,
  validateReviewInput,
  type ProductReview,
  type ReviewFieldError,
  type ReviewRating,
  type ReviewSummary,
} from "@/lib/reviews";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    title: "Customer reviews",
    count: (count: number) => `${count} ${count === 1 ? "review" : "reviews"}`,
    averageOf: "out of 5",
    basedOn: (count: number) => `Based on ${count} ${count === 1 ? "review" : "reviews"}`,
    noRating: "No ratings yet",
    write: "Write a review",
    writeHint: "Reviews appear once our team approves them.",
    reviewingAs: "Reviewing as",
    rating: "Your rating",
    comment: "Your review",
    commentPlaceholder: "How did the fabric feel, and how was the fit?",
    photo: "Product photo",
    photoAdd: "Add photo",
    photoReplace: "Replace",
    photoRemove: "Remove photo",
    photoHint: "JPG, PNG or WebP, up to 5 MB.",
    photoTooLarge: "That photo is larger than 5 MB.",
    photoWrongType: "Choose a JPG, PNG or WebP photo.",
    photoFailed: "The photo could not be uploaded. Try again.",
    photoDropped:
      "Your review was sent without the photo — the upload did not finish. You can review it on the product page later.",
    submit: "Submit review",
    submitting: "Sending…",
    success: "Thank you — your review is with our team for approval.",
    failure: "Your review could not be saved. Please try again.",
    ratingError: "Choose a rating from 1 to 5 stars.",
    bodyError: `Write between ${REVIEW_LIMITS.bodyMin} and ${REVIEW_LIMITS.bodyMax} characters.`,
    signInTitle: "Sign in to write a review",
    signInBody:
      "Your name and account are attached to the review, so a photo of your piece stays with it.",
    signInCta: "Sign in",
    loading: "Loading reviews…",
    empty: "No reviews yet. Be the first to share how this piece feels at home.",
    stars: "stars",
    distribution: "Rating breakdown",
    pages: "Review pages",
    previous: "Previous page",
    next: "Next page",
    page: (n: number) => `Page ${n}`,
    range: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total}`,
    photoTitle: "Customer photo",
    photoBody: "Photo attached to this review.",
    photoOpen: "Open the photo",
  },
  ar: {
    title: "تقييمات العملاء",
    count: (count: number) => `${count} تقييم`,
    averageOf: "من 5",
    basedOn: (count: number) => `بناءً على ${count} تقييم`,
    noRating: "لا توجد تقييمات بعد",
    write: "أضف تقييمك",
    writeHint: "تظهر التقييمات بعد موافقة فريقنا عليها.",
    reviewingAs: "تكتب باسم",
    rating: "تقييمك",
    comment: "تعليقك",
    commentPlaceholder: "كيف كانت الخامة والمقاس عند الاستخدام؟",
    photo: "صورة المنتج",
    photoAdd: "أضف صورة",
    photoReplace: "تغيير",
    photoRemove: "إزالة الصورة",
    photoHint: "JPG أو PNG أو WebP، حتى 5 ميجابايت.",
    photoTooLarge: "حجم الصورة أكبر من 5 ميجابايت.",
    photoWrongType: "اختر صورة JPG أو PNG أو WebP.",
    photoFailed: "تعذر رفع الصورة. حاول مرة أخرى.",
    photoDropped:
      "تم إرسال تقييمك بدون الصورة — لم يكتمل رفع الصورة. يمكنك إرفاقها لاحقاً من صفحة المنتج.",
    submit: "إرسال التقييم",
    submitting: "جارٍ الإرسال…",
    success: "شكراً لك — تقييمك بانتظار موافقة فريقنا.",
    failure: "تعذر حفظ تقييمك. حاول مرة أخرى.",
    ratingError: "اختر تقييماً من 1 إلى 5 نجوم.",
    bodyError: `اكتب بين ${REVIEW_LIMITS.bodyMin} و${REVIEW_LIMITS.bodyMax} حرفاً.`,
    signInTitle: "سجّل الدخول لإضافة تقييم",
    signInBody: "يُربط التقييم بحسابك واسمك، وتبقى صورة قطعتك معه.",
    signInCta: "تسجيل الدخول",
    loading: "جارٍ تحميل التقييمات…",
    empty: "لا توجد تقييمات بعد. كن أول من يشارك تجربته مع هذا المنتج.",
    stars: "نجوم",
    distribution: "توزيع التقييمات",
    pages: "صفحات التقييمات",
    previous: "الصفحة السابقة",
    next: "الصفحة التالية",
    page: (n: number) => `صفحة ${n}`,
    range: (from: number, to: number, total: number) => `عرض ${from}–${to} من ${total}`,
    photoTitle: "صورة العميل",
    photoBody: "الصورة المرفقة بهذا التقييم.",
    photoOpen: "افتح الصورة",
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

/** The signed-in customer, or null for a visitor who cannot write a review. */
export type ReviewsViewer = { id: string; name: string };

export type ReviewSubmission = {
  authorName: string;
  rating: number;
  body: string;
  authorId: string;
  imageUrl: string | null;
};

export type ReviewsSectionProps = {
  isArabic: boolean;
  reviews: ProductReview[];
  summary: ReviewSummary;
  loading: boolean;
  submitting: boolean;
  viewer: ReviewsViewer | null;
  /** Opens the storefront auth card; the section never owns a second one. */
  onRequestSignIn: () => void;
  onSubmit: (input: ReviewSubmission) => Promise<ProductReview | null>;
};

/**
 * Ratings summary, signed-in composer and the review ledger.
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
  viewer,
  onRequestSignIn,
  onSubmit,
}: ReviewsSectionProps) {
  const copy = COPY[isArabic ? "ar" : "en"];
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<ReviewFieldError["field"] | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  /** Set after a successful submit whose photo was dropped, so the customer knows why. */
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const pageInfo = paginateReviews(reviews, page);
  const busy = submitting || uploading;

  // A page left over from a longer list is pulled back into range rather than
  // showing an empty ledger after an admin hides a review.
  useEffect(() => {
    setPage((current) => Math.min(current, pageInfo.pageCount));
  }, [pageInfo.pageCount]);

  // The object URL is the browser's handle on the chosen file; revoke it as soon
  // as the file changes or the section unmounts.
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Signing out mid-draft must not leave a form that cannot be submitted.
  useEffect(() => {
    if (viewer) return;
    setRating(0);
    setBody("");
    setImageFile(null);
    setError(null);
    setPhotoError(null);
  }, [viewer]);

  const errorText =
    error === "rating" ? copy.ratingError : error === "body" ? copy.bodyError : null;

  function pickPhoto(file: File | null) {
    setPhotoNotice(null);
    setPhotoError(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    const limit = reviewImageLimit(file);
    if (limit) {
      setPhotoError(limit === "tooLarge" ? copy.photoTooLarge : copy.photoWrongType);
      return;
    }
    setImageFile(file);
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!viewer || busy) return;

    const invalid = validateReviewInput({
      productId: "pending",
      authorName: viewer.name,
      rating,
      body,
    });
    if (invalid) {
      setError(invalid.field);
      return;
    }

    setError(null);
    setPhotoError(null);
    setPhotoNotice(null);
    setUploading(true);

    // The photo is a bonus, the review is the point: an upload that fails or
    // stalls must not hold the customer's words hostage.
    let imageUrl: string | null = null;
    let photoDropped = false;
    if (imageFile) {
      try {
        imageUrl = await uploadReviewImage(imageFile, viewer.id);
      } catch (photoFailure) {
        photoDropped = true;
        console.warn(
          "ROELIX reviews: sending the review without its photo — the upload did not complete",
          photoFailure,
        );
      }
    }

    try {
      const saved = await onSubmit({
        authorName: viewer.name,
        rating,
        body,
        authorId: viewer.id,
        imageUrl,
      });
      if (!saved) return;

      toast.success(copy.success);
      if (photoDropped) setPhotoNotice(copy.photoDropped);
      setRating(0);
      setBody("");
      setImageFile(null);
    } catch (submitError) {
      console.error("Could not publish the ROELIX review", submitError);
      const message = submitError instanceof Error ? submitError.message : copy.failure;
      toast.error(message);
    } finally {
      setUploading(false);
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

      {/* ------------------------------------------------------------- Summary band */}
      <div className="mt-6 grid gap-6 border-y py-6 sm:grid-cols-[minmax(0,15rem)_minmax(0,24rem)] sm:items-center sm:gap-12">
        <div className="flex items-baseline gap-4">
          <p className="font-serif text-5xl leading-none">
            {summary.count === 0 ? "—" : summary.average.toFixed(1)}
          </p>
          <div className="min-w-0">
            <StarRating
              value={summary.average}
              size={15}
              label={`${summary.average.toFixed(1)} ${copy.averageOf}`}
            />
            <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
              {summary.count === 0 ? copy.noRating : copy.basedOn(summary.count)}
            </p>
          </div>
        </div>

        {summary.count > 0 && (
          <div className="space-y-1.5" aria-label={copy.distribution}>
            {([5, 4, 3, 2, 1] as ReviewRating[]).map((star) => {
              const amount = summary.distribution[star];
              const percent = Math.round((amount / summary.count) * 100);
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums text-muted-foreground">{star}</span>
                  <Star
                    size={11}
                    aria-hidden="true"
                    className="fill-gold text-gold"
                    strokeWidth={1.5}
                  />
                  <span className="h-1.5 min-w-0 flex-1 bg-muted">
                    <span className="block h-full bg-gold" style={{ width: `${percent}%` }} />
                  </span>
                  <span className="w-6 text-end tabular-nums text-muted-foreground">{amount}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- Composer */}
      {viewer ? (
        <form onSubmit={handleSubmit} className="mt-8 border p-5 sm:p-6" noValidate>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-serif text-lg">{copy.write}</h3>
            <p className="text-[0.68rem] text-muted-foreground">
              {copy.reviewingAs} <span className="text-foreground">{viewer.name}</span>
            </p>
          </div>

          <div className="mt-4">
            <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              {copy.rating}
            </p>
            <div className="mt-1.5">
              <StarPicker
                value={rating}
                onChange={(next) => {
                  setRating(next);
                  if (error === "rating") setError(null);
                }}
                isArabic={isArabic}
                disabled={busy}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_6rem]">
            <div className="min-w-0">
              <label
                htmlFor="review-body"
                className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {copy.comment}
              </label>
              <Textarea
                id="review-body"
                value={body}
                rows={4}
                maxLength={REVIEW_LIMITS.bodyMax}
                placeholder={copy.commentPlaceholder}
                dir="auto"
                disabled={busy}
                aria-invalid={error === "body"}
                onChange={(event) => {
                  setBody(event.target.value);
                  if (error === "body") setError(null);
                }}
                className="mt-1.5 min-h-28 rounded-none"
              />
            </div>

            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                {copy.photo}
              </p>
              <div className="mt-1.5">
                <ReviewPhotoField
                  file={imageFile}
                  previewUrl={previewUrl}
                  disabled={busy}
                  errorText={photoError}
                  onSelect={pickPhoto}
                  labels={{
                    add: copy.photoAdd,
                    replace: copy.photoReplace,
                    remove: copy.photoRemove,
                  }}
                />
              </div>
            </div>
          </div>

          {photoNotice && (
            <p role="status" className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <span aria-hidden="true" className="mt-0.5 size-1.5 shrink-0 rounded-full bg-gold" />
              {photoNotice}
            </p>
          )}

          {errorText && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              {errorText}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p className="text-[0.68rem] leading-relaxed text-muted-foreground">
              {copy.writeHint} {copy.photoHint}
            </p>
            <Button
              type="submit"
              disabled={busy}
              className="h-11 rounded-none bg-foreground px-6 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-background hover:bg-foreground/90"
            >
              {busy ? copy.submitting : copy.submit}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border bg-muted/30 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-gold/45 text-gold">
              <Lock size={14} aria-hidden="true" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <p className="font-serif text-lg leading-tight">{copy.signInTitle}</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                {copy.signInBody}
              </p>
            </div>
          </div>
          <button type="button" onClick={onRequestSignIn} className="btn-lux shrink-0">
            {copy.signInCta}
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------- Ledger */}
      <div className="mt-8">
        {loading && reviews.length === 0 ? (
          <div className="space-y-4" role="status" aria-label={copy.loading}>
            {[0, 1, 2].map((index) => (
              <div key={index} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-b pb-4">
                <div className="size-12 animate-pulse bg-muted" />
                <div className="space-y-2">
                  <div className="h-3 w-32 animate-pulse bg-muted" />
                  <div className="h-3 w-20 animate-pulse bg-muted" />
                  <div className="h-10 w-full animate-pulse bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="border-t pt-8 text-sm leading-relaxed text-muted-foreground">
            {copy.empty}
          </p>
        ) : (
          <>
            <ol className="border-t">
              {pageInfo.items.map((review) => (
                <li
                  key={review.id}
                  className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 border-b py-6 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-6"
                >
                  {review.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setLightbox(review.imageUrl)}
                      aria-label={`${copy.photoOpen}: ${review.authorName}`}
                      title={copy.photoOpen}
                      className="group block size-12 overflow-hidden border border-border sm:size-16"
                    >
                      <img
                        src={review.imageUrl}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid size-12 place-items-center rounded-full border border-gold/40 font-serif text-sm text-gold sm:size-16 sm:text-base"
                    >
                      {review.authorName.slice(0, 1).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0">
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
                </li>
              ))}
            </ol>

            {pageInfo.pageCount > 1 && (
              <nav
                aria-label={copy.pages}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-4"
              >
                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                  {copy.range(pageInfo.from, pageInfo.to, pageInfo.total)}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage(pageInfo.page - 1)}
                    disabled={pageInfo.page <= 1}
                    aria-label={copy.previous}
                    title={copy.previous}
                    className="grid size-8 place-items-center border text-muted-foreground transition-colors hover:border-gold hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronLeft size={15} aria-hidden="true" className="rtl:rotate-180" />
                  </button>

                  {reviewPageNumbers(pageInfo.page, pageInfo.pageCount).map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setPage(number)}
                      aria-label={copy.page(number)}
                      aria-current={number === pageInfo.page ? "page" : undefined}
                      className={cn(
                        "size-8 border text-xs tabular-nums transition-colors",
                        number === pageInfo.page
                          ? "border-navy bg-navy text-navy-foreground"
                          : "text-muted-foreground hover:border-gold hover:text-foreground",
                      )}
                    >
                      {number}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setPage(pageInfo.page + 1)}
                    disabled={pageInfo.page >= pageInfo.pageCount}
                    aria-label={copy.next}
                    title={copy.next}
                    className="grid size-8 place-items-center border text-muted-foreground transition-colors hover:border-gold hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronRight size={15} aria-hidden="true" className="rtl:rotate-180" />
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>

      {/* --------------------------------------------------------------- Lightbox */}
      <Dialog open={lightbox !== null} onOpenChange={(open) => (open ? null : setLightbox(null))}>
        <DialogContent
          showCloseButton
          overlayClassName="bg-navy/70 backdrop-blur-xs"
          className="w-auto max-w-[min(92vw,44rem)] gap-0 rounded-[2px] border bg-card p-2"
        >
          <DialogTitle className="sr-only">{copy.photoTitle}</DialogTitle>
          <DialogDescription className="sr-only">{copy.photoBody}</DialogDescription>
          {lightbox && (
            <img
              src={lightbox}
              alt={copy.photoTitle}
              className="max-h-[78vh] w-auto max-w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

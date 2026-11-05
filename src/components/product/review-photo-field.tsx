import { useId } from "react";
import { ImagePlus, X } from "lucide-react";

import { REVIEW_IMAGE_TYPES } from "@/lib/review-images";
import { cn } from "@/lib/utils";

const IMAGE_ACCEPT = REVIEW_IMAGE_TYPES.join(",");

export type ReviewPhotoLabels = {
  add: string;
  replace: string;
  remove: string;
};

/**
 * The photo slot in the review form.
 *
 * The chosen file is previewed from a local object URL the parent owns, so the
 * customer sees exactly what will be uploaded before anything leaves the device.
 * The file input stays in the DOM (visually replaced by the slot) so clicking the
 * label, the keyboard and a screen reader all follow the same path.
 */
export function ReviewPhotoField({
  file,
  previewUrl,
  labels,
  disabled,
  errorText,
  onSelect,
}: {
  file: File | null;
  previewUrl: string | null;
  labels: ReviewPhotoLabels;
  disabled?: boolean;
  errorText?: string | null;
  onSelect: (file: File | null) => void;
}) {
  const inputId = useId();
  const showPreview = Boolean(file && previewUrl);

  return (
    <div>
      <input
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        disabled={disabled}
        aria-describedby={errorText ? `${inputId}-error` : undefined}
        onChange={(event) => {
          const next = event.target.files?.[0] ?? null;
          // Cleared so picking the same file again still fires a change event.
          event.target.value = "";
          if (next) onSelect(next);
        }}
      />

      {showPreview ? (
        <div className="inline-block">
          <div className="relative inline-block">
            <img
              src={previewUrl ?? ""}
              alt=""
              width={96}
              height={96}
              className="size-24 border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label={labels.remove}
              title={labels.remove}
              className="absolute -end-2 -top-2 grid size-6 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
          <label
            htmlFor={inputId}
            className="mt-2 block cursor-pointer text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground underline underline-offset-4 transition-colors hover:text-gold"
          >
            {labels.replace}
          </label>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "flex size-24 cursor-pointer flex-col items-center justify-center gap-1.5 border bg-muted/40 px-2 text-center transition-colors",
            errorText ? "border-destructive/60" : "border-border hover:border-gold/70",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <ImagePlus size={18} aria-hidden="true" className="text-gold" strokeWidth={1.5} />
          <span className="text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            {labels.add}
          </span>
        </label>
      )}

      {errorText && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 max-w-40 text-xs text-destructive">
          {errorText}
        </p>
      )}
    </div>
  );
}

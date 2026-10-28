import { useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Displays a 0–5 rating with half-star resolution.
 *
 * Each star is a full outline with a gold overlay clipped to the fraction
 * needed, so 4.5 reads as four solid stars and one half — no integer rounding
 * that would overstate a 4.4 average.
 */
export function StarRating({
  value,
  size = 14,
  className,
  label,
}: {
  value: number;
  size?: number;
  className?: string;
  /** Accessible description; defaults to "<n> out of 5". */
  label?: string;
}) {
  const clamped = Math.min(5, Math.max(0, value));
  const halves = Math.round(clamped * 2) / 2;

  return (
    <span
      role="img"
      aria-label={label ?? `${halves} / 5`}
      className={cn("inline-flex items-center gap-[3px]", className)}
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.min(1, Math.max(0, halves - index));
        return (
          <span
            key={index}
            className="relative inline-block shrink-0"
            style={{ width: size, height: size }}
          >
            <Star
              size={size}
              strokeWidth={1.6}
              aria-hidden="true"
              // Bright enough to read as "empty star" at 13–16px, not as a blur.
              className="absolute inset-0 text-gold/45"
            />
            {fill > 0 && (
              <span
                className="absolute inset-y-0 start-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  size={size}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="fill-gold text-gold"
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Interactive 1–5 star picker used by the review form. */
export function StarPicker({
  value,
  onChange,
  isArabic,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  isArabic: boolean;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div
      role="radiogroup"
      aria-label={isArabic ? "تقييمك" : "Your rating"}
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={isArabic ? `${star} من 5` : `${star} of 5`}
          disabled={disabled}
          onMouseEnter={() => setHovered(star)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="p-1 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            size={22}
            strokeWidth={1.5}
            aria-hidden="true"
            className={cn(
              star <= shown ? "fill-gold text-gold" : "text-muted-foreground/40",
              "transition-colors",
            )}
          />
        </button>
      ))}
    </div>
  );
}

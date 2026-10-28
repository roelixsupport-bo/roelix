import {
  axisStock,
  distinctVariantValues,
  LOW_STOCK_THRESHOLD,
  type ProductVariant,
  type VariantSelection,
} from "@/lib/product-variants";
import { cn } from "@/lib/utils";

/**
 * Styling for one variant option (size, dimension).
 *
 * Exported because products without a variant matrix render plain size buttons
 * on the PDP and both controls have to look and feel identical: a lift on hover,
 * a gold edge, and a focus ring for keyboard users. Motion is suppressed for
 * visitors who ask for reduced motion.
 */
export function variantOptionClassName(active: boolean, selectable: boolean): string {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 border px-3.5 py-2.5 text-sm",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out",
    "focus-visible:ring-1 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden",
    "motion-safe:hover:-translate-y-px",
    active
      ? "border-navy bg-navy text-navy-foreground shadow-sm hover:shadow-md"
      : selectable
        ? "border-border bg-background hover:border-gold hover:bg-gold/5 hover:text-foreground hover:shadow-sm"
        : "border-border/50 bg-background/70 text-muted-foreground/70",
    // An option with no stock anywhere on its axis can never be bought, so it is
    // disabled, dimmed and skipped by the keyboard rather than merely labelled.
    "disabled:cursor-not-allowed disabled:border-border/45 disabled:bg-background/60",
    "disabled:text-muted-foreground/55 disabled:opacity-60 disabled:shadow-none",
    "disabled:hover:border-border/45 disabled:hover:bg-background/60",
    "disabled:motion-safe:hover:translate-y-0",
  );
}

/**
 * Two independent button groups — size and dimension — that together resolve one
 * variant, so a single click updates price, SKU and stock on the page.
 *
 * The groups are deliberately independent: picking a size keeps whichever
 * dimension is already selected (and vice versa). Nothing is auto-corrected
 * behind the shopper's back; when a pair is not sold together the PDP says so.
 *
 * Every option reads its own live stock from the variant matrix (which is the
 * Supabase `product_variants` table, refreshed by the store's realtime
 * subscription): zero stock disables and dims the button, low stock advertises
 * the remaining count.
 *
 * Products that only carry sizes (or only dimensions) render a single group; the
 * component adapts to whichever axes the matrix actually has.
 */
export function VariantPicker({
  variants,
  selection,
  onSelect,
  isArabic,
}: {
  variants: ProductVariant[];
  selection: VariantSelection;
  onSelect: (next: VariantSelection) => void;
  isArabic: boolean;
}) {
  const sizes = distinctVariantValues(variants, "sizeName");
  const dimensions = distinctVariantValues(variants, "dimension");
  const copy = {
    size: isArabic ? "المقاس" : "Size",
    dimension: isArabic ? "الأبعاد" : "Dimension",
    sizeHint: isArabic ? "اختر المقاس" : "Choose a size",
    dimensionHint: isArabic
      ? "اختر الأبعاد لعرض السعر والتوفر"
      : "Choose a dimension to see its price and availability",
    outOfStock: isArabic ? "نفذت الكمية" : "Out of stock",
    left: (count: number) => (isArabic ? `باقي ${count}` : `${count} left`),
    unavailable: isArabic ? "غير متاح" : "Unavailable",
  };

  // Each click rewrites exactly one axis and leaves the other as the shopper set it.
  const pickSize = (sizeName: string) => onSelect({ sizeName, dimension: selection.dimension });
  const pickDimension = (dimension: string) =>
    onSelect({ sizeName: selection.sizeName, dimension });

  const isActive = (current: string, option: string) =>
    current.trim().toLowerCase() === option.toLowerCase();

  /** "Out of stock" at zero, "3 left" near the end of the run, nothing in between. */
  const stockCaption = (stock: number, active: boolean): { text: string; tone: string } | null => {
    if (stock === 0) {
      return {
        text: copy.outOfStock,
        tone: active ? "text-navy-foreground/80" : "text-destructive/80",
      };
    }
    if (stock <= LOW_STOCK_THRESHOLD) {
      return { text: copy.left(stock), tone: active ? "text-navy-foreground/75" : "text-gold" };
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {sizes.length > 0 && (
        <fieldset>
          <legend className="eyebrow text-xs">{copy.size}</legend>
          {dimensions.length > 0 && (
            <p className="mt-1 text-[0.68rem] text-muted-foreground">{copy.sizeHint}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((size) => {
              const active = isActive(selection.sizeName, size);
              const exists = variants.some((variant) => isActive(variant.sizeName, size));
              // Stock for this size across every dimension it is sold in.
              const stock = axisStock(variants, "sizeName", size);
              const selectable = exists && stock > 0;
              const caption = stockCaption(stock, active);

              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={active}
                  aria-disabled={!selectable}
                  disabled={!selectable}
                  title={stock === 0 ? copy.outOfStock : undefined}
                  onClick={() => pickSize(size)}
                  className={variantOptionClassName(active, selectable)}
                >
                  <span className={cn(stock === 0 && "line-through decoration-1")}>{size}</span>
                  {caption && (
                    <span className={cn("text-[0.58rem] uppercase tracking-[0.1em]", caption.tone)}>
                      {caption.text}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {dimensions.length > 0 && (
        <fieldset>
          <legend className="eyebrow text-xs">{copy.dimension}</legend>
          <p className="mt-1 text-[0.68rem] text-muted-foreground">{copy.dimensionHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {dimensions.map((dimension) => {
              const active = isActive(selection.dimension, dimension);
              const exists = variants.some((variant) => isActive(variant.dimension, dimension));
              // Stock for this dimension across every size it is sold in.
              const stock = axisStock(variants, "dimension", dimension);
              const selectable = exists && stock > 0;
              const caption = stockCaption(stock, active);

              return (
                <button
                  key={dimension}
                  type="button"
                  aria-pressed={active}
                  aria-disabled={!selectable}
                  disabled={!selectable}
                  title={stock === 0 ? copy.outOfStock : undefined}
                  onClick={() => pickDimension(dimension)}
                  className={variantOptionClassName(active, selectable)}
                >
                  <span className={cn(stock === 0 && "line-through decoration-1")}>
                    {dimension}
                  </span>
                  {caption && (
                    <span className={cn("text-[0.58rem] uppercase tracking-[0.1em]", caption.tone)}>
                      {caption.text}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {sizes.length === 0 && dimensions.length === 0 && (
        <p className="text-sm text-muted-foreground">{copy.unavailable}</p>
      )}
    </div>
  );
}

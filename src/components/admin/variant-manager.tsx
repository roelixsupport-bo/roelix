import { Plus, Trash2, Wand2 } from "lucide-react";

import {
  createEmptyVariant,
  lowestVariantPrice,
  slugSku,
  totalVariantStock,
  type ProductVariant,
} from "@/lib/product-variants";
import { EGP_PER_USD } from "@/lib/store";

const COPY = {
  en: {
    title: "Variants, pricing & stock",
    hint: "Each row is a size or dimension with its own SKU, price and stock. The shop advertises the lowest variant price and limits orders by total variant stock.",
    sizeName: "Size name",
    dimension: "Dimensions",
    sku: "SKU",
    price: "Price (EGP)",
    compareAt: "Compare at (EGP)",
    stock: "Stock",
    add: "Add variant",
    generate: "Generate from sizes",
    remove: "Remove variant",
    empty: "No variants yet. Add a row, or generate rows from the sizes above.",
    totalStock: "Total stock",
    priceRange: "Price range",
    skuRequired: "SKU required",
  },
  ar: {
    title: "المتغيرات والأسعار والمخزون",
    hint: "كل صف يمثل مقاساً أو أبعاداً برمز منتج وسعر ومخزون مستقل. يعرض المتجر أقل سعر متغير ويحدّ الطلب بإجمالي مخزون المتغيرات.",
    sizeName: "اسم المقاس",
    dimension: "الأبعاد",
    sku: "رمز المنتج (SKU)",
    price: "السعر (جنيه مصري)",
    compareAt: "السعر قبل الخصم (جنيه مصري)",
    stock: "المخزون",
    add: "إضافة متغير",
    generate: "توليد من المقاسات",
    remove: "حذف المتغير",
    empty: "لا توجد متغيرات بعد. أضف صفاً أو ولّد صفوفاً من المقاسات أعلاه.",
    totalStock: "إجمالي المخزون",
    priceRange: "نطاق السعر",
    skuRequired: "رمز المنتج مطلوب",
  },
} as const;

const inputClass = "w-full border bg-background px-3 py-2 text-sm outline-none focus:border-gold";

function toEgp(value: number): number {
  return Math.round(value * EGP_PER_USD);
}

export type VariantManagerProps = {
  variants: ProductVariant[];
  /** Product headline price in the base currency (USD), used to seed new rows. */
  defaultPrice: number;
  /** Product size list, used by "Generate from sizes". */
  sizeSuggestions: string[];
  /** Prefix for auto-generated SKUs, usually the product name. */
  skuPrefix: string;
  isArabic: boolean;
  onChange: (variants: ProductVariant[]) => void;
};

export function VariantManager({
  variants,
  defaultPrice,
  sizeSuggestions,
  skuPrefix,
  isArabic,
  onChange,
}: VariantManagerProps) {
  const text = COPY[isArabic ? "ar" : "en"];

  const update = (index: number, patch: Partial<ProductVariant>) => {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));
  };

  const addVariant = () => {
    const position = variants.length + 1;
    onChange([...variants, createEmptyVariant(slugSku(skuPrefix, String(position)))]);
  };

  const generateFromSizes = () => {
    const covered = new Set(variants.map((variant) => variant.sizeName.trim().toLowerCase()));
    const pending = sizeSuggestions.filter(
      (size) => size.trim() !== "" && !covered.has(size.trim().toLowerCase()),
    );
    const generated = pending.map((size) => createEmptyVariant(slugSku(skuPrefix, size)));
    const seeded = generated.map((variant, index) => ({
      ...variant,
      sizeName: pending[index] ?? "",
      price: defaultPrice > 0 ? defaultPrice : 0,
    }));
    if (seeded.length === 0 && variants.length === 0) {
      onChange([createEmptyVariant(slugSku(skuPrefix, "1"))]);
      return;
    }
    onChange([...variants, ...seeded]);
  };

  const totalStock = totalVariantStock(variants);
  const low = lowestVariantPrice(variants);

  return (
    <section className="space-y-3 border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl">{text.title}</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{text.hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateFromSizes}
            className="inline-flex items-center gap-2 border px-3 py-2 text-xs uppercase tracking-[0.12em] hover:border-gold"
          >
            <Wand2 size={14} aria-hidden="true" />
            {text.generate}
          </button>
          <button
            type="button"
            onClick={addVariant}
            className="inline-flex items-center gap-2 border px-3 py-2 text-xs uppercase tracking-[0.12em] hover:border-gold"
          >
            <Plus size={14} aria-hidden="true" />
            {text.add}
          </button>
        </div>
      </div>

      {variants.length === 0 ? (
        <p className="border border-dashed p-4 text-sm text-muted-foreground">{text.empty}</p>
      ) : (
        <ul className="space-y-3">
          {variants.map((variant, index) => {
            const key = variant.id ?? `${variant.sku}-${index}`;
            return (
              <li key={key} className="border p-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  <label className="space-y-1">
                    <span className="eyebrow text-[0.6rem] text-muted-foreground">
                      {text.sizeName}
                    </span>
                    <input
                      className={inputClass}
                      dir="auto"
                      value={variant.sizeName}
                      onChange={(event) => update(index, { sizeName: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="eyebrow text-[0.6rem] text-muted-foreground">
                      {text.dimension}
                    </span>
                    <input
                      className={inputClass}
                      dir="auto"
                      placeholder="200 × 220 cm"
                      value={variant.dimension}
                      onChange={(event) => update(index, { dimension: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="eyebrow text-[0.6rem] text-muted-foreground">{text.sku}</span>
                    <input
                      className={inputClass}
                      dir="ltr"
                      value={variant.sku}
                      aria-invalid={variant.sku.trim() === ""}
                      onChange={(event) => update(index, { sku: event.target.value })}
                    />
                    {variant.sku.trim() === "" && (
                      <span className="block text-[0.65rem] text-destructive">
                        {text.skuRequired}
                      </span>
                    )}
                  </label>
                  <label className="space-y-1">
                    <span className="eyebrow text-[0.6rem] text-muted-foreground">
                      {text.price}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={inputClass}
                      value={toEgp(variant.price)}
                      onChange={(event) => {
                        const egp = event.currentTarget.valueAsNumber;
                        update(index, {
                          price: Number.isFinite(egp) ? Math.max(0, egp) / EGP_PER_USD : 0,
                        });
                      }}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="eyebrow text-[0.6rem] text-muted-foreground">
                      {text.compareAt}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={inputClass}
                      value={variant.compareAtPrice === null ? "" : toEgp(variant.compareAtPrice)}
                      onChange={(event) => {
                        const raw = event.currentTarget.value;
                        const egp = event.currentTarget.valueAsNumber;
                        update(index, {
                          compareAtPrice:
                            raw.trim() === "" || !Number.isFinite(egp)
                              ? null
                              : Math.max(0, egp) / EGP_PER_USD,
                        });
                      }}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="eyebrow text-[0.6rem] text-muted-foreground">
                      {text.stock}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={inputClass}
                      value={variant.stock}
                      onChange={(event) => {
                        const stock = event.currentTarget.valueAsNumber;
                        update(index, {
                          stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0,
                        });
                      }}
                    />
                  </label>
                </div>
                <div className="mt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onChange(variants.filter((_, i) => i !== index))}
                    aria-label={`${text.remove}: ${variant.sizeName || variant.sku}`}
                    className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {text.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {variants.length > 0 && (
        <dl className="flex flex-wrap gap-x-8 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <div className="flex items-baseline gap-2">
            <dt>{text.totalStock}</dt>
            <dd className="font-semibold text-foreground">{totalStock}</dd>
          </div>
          {low !== null && (
            <div className="flex items-baseline gap-2">
              <dt>{text.priceRange}</dt>
              <dd className="font-semibold text-foreground">
                {new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(toEgp(low))} –{" "}
                {new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(
                  toEgp(Math.max(...variants.map((variant) => variant.price))),
                )}{" "}
                EGP
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

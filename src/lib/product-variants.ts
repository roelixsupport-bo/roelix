import type { Product } from "@/lib/store";

/**
 * Product variant model shared by the storefront and the admin dashboard.
 *
 * Prices are kept in the same base unit as `Product.price` (USD) so that
 * `useStore().fmt()` can convert them to EGP at render time. The admin UI
 * converts to EGP for display and back to the base unit on save.
 */
export type ProductVariant = {
  /** Database uuid once persisted, `null` for rows the admin has not saved yet. */
  id: string | null;
  sku: string;
  sizeName: string;
  dimension: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
};

type CloudRow = Record<string, unknown>;

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Maps one `product_variants` row. Returns null for unusable rows instead of throwing. */
export function variantFromCloud(value: unknown): ProductVariant | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as CloudRow;

  const sku = toText(row["sku"]);
  const price = toNumber(row["price"]);
  const stock = toNumber(row["stock"]);
  if (!sku || price === null || stock === null || price < 0) return null;

  return {
    id: typeof row["id"] === "string" ? row["id"] : null,
    sku,
    sizeName: toText(row["size_name"]),
    dimension: toText(row["dimension"]),
    price,
    compareAtPrice: toNumber(row["compare_at_price"]),
    stock: Math.max(0, Math.floor(stock)),
  };
}

export function variantsFromCloud(value: unknown): ProductVariant[] {
  if (!Array.isArray(value)) return [];
  return normalizeVariants(
    value.map(variantFromCloud).filter((variant): variant is ProductVariant => variant !== null),
  );
}

export function variantToCloud(
  variant: ProductVariant,
  productId: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    product_id: productId,
    sku: variant.sku.trim(),
    size_name: variant.sizeName.trim() || null,
    dimension: variant.dimension.trim() || null,
    price: variant.price,
    compare_at_price: variant.compareAtPrice,
    stock: Math.max(0, Math.floor(variant.stock)),
  };
  if (variant.id) row["id"] = variant.id;
  return row;
}

/**
 * Drops duplicate SKUs (case-insensitive) so the admin can never send a row set
 * that the unique index would reject. Order is preserved so the admin table does
 * not jump around while typing.
 */
export function normalizeVariants(variants: ProductVariant[]): ProductVariant[] {
  const seen = new Set<string>();
  const unique: ProductVariant[] = [];
  for (const variant of variants) {
    const key = variant.sku.trim().toLowerCase();
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    unique.push(variant);
  }
  return unique;
}

/** What the storefront shows on a size button, e.g. "King" or "50 × 70 cm". */
export function variantLabel(variant: ProductVariant): string {
  return variant.sizeName || variant.dimension || variant.sku;
}

export function findVariant(variants: ProductVariant[], id: string | null): ProductVariant | null {
  if (!id) return null;
  return variants.find((variant) => variant.id === id) ?? null;
}

/** The variant a PDP should open with: the first one that can actually be bought. */
export function firstPurchasableVariant(variants: ProductVariant[]): ProductVariant | null {
  return variants.find((variant) => variant.stock > 0) ?? variants[0] ?? null;
}

export function totalVariantStock(variants: ProductVariant[]): number {
  return variants.reduce((total, variant) => total + Math.max(0, variant.stock), 0);
}

export function lowestVariantPrice(variants: ProductVariant[]): number | null {
  if (variants.length === 0) return null;
  return Math.min(...variants.map((variant) => variant.price));
}

/**
 * What the storefront currently has picked out of the matrix.
 *
 * Size and dimension are chosen independently (two button groups), and the pair
 * resolves to exactly one variant — which is what makes the price, SKU and stock
 * readout update on a single click.
 */
export type VariantSelection = { sizeName: string; dimension: string };

/** Distinct non-empty values for one axis, in first-seen order (so buttons do not jump). */
export function distinctVariantValues(
  variants: ProductVariant[],
  key: "sizeName" | "dimension",
): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const variant of variants) {
    const value = variant[key].trim();
    if (!value) continue;
    const token = value.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    values.push(value);
  }
  return values;
}

/** True when a variant satisfies every axis that has been chosen so far. */
export function variantMatchesSelection(
  variant: ProductVariant,
  selection: Partial<VariantSelection>,
): boolean {
  const size = selection.sizeName?.trim().toLowerCase();
  const dimension = selection.dimension?.trim().toLowerCase();
  if (size && variant.sizeName.trim().toLowerCase() !== size) return false;
  if (dimension && variant.dimension.trim().toLowerCase() !== dimension) return false;
  return true;
}

/** Can this (partial) selection be bought at all? Drives the disabled state of a button. */
export function hasStockFor(
  variants: ProductVariant[],
  selection: Partial<VariantSelection>,
): boolean {
  return variants.some(
    (variant) => variant.stock > 0 && variantMatchesSelection(variant, selection),
  );
}

/**
 * Units in stock for one axis value, summed across the other axis.
 *
 * A single size button stands for every dimension that size is sold in, so its
 * own stock is the total the shopper could still buy in that size. Zero means the
 * option is genuinely unavailable and its button is disabled; a small number is
 * shown as "N left" so the shopper can see the same figure the PDP reports.
 */
export function axisStock(
  variants: ProductVariant[],
  key: "sizeName" | "dimension",
  value: string,
): number {
  const token = value.trim().toLowerCase();
  return variants.reduce(
    (total, variant) =>
      variant[key].trim().toLowerCase() === token ? total + Math.max(0, variant.stock) : total,
    0,
  );
}

/** Below this, a variant option advertises its remaining count. */
export const LOW_STOCK_THRESHOLD = 5;

/** The variant a (partial) selection resolves to, preferring one that can be bought. */
export function bestVariantFor(
  variants: ProductVariant[],
  selection: Partial<VariantSelection>,
): ProductVariant | null {
  const matches = variants.filter((variant) => variantMatchesSelection(variant, selection));
  if (matches.length === 0) return null;
  return firstPurchasableVariant(matches) ?? matches[0] ?? null;
}

/** Resolves a fully chosen size/dimension pair. Null means "that combination is not sold". */
export function resolveVariant(
  variants: ProductVariant[],
  selection: VariantSelection,
): ProductVariant | null {
  return bestVariantFor(variants, selection);
}

export function slugSku(base: string, suffix: string): string {
  const prefix = base
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);
  const tail = suffix
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 16);
  return [prefix || "ROELIX", tail].filter(Boolean).join("-");
}

export function createEmptyVariant(sku = ""): ProductVariant {
  return {
    id: null,
    sku,
    sizeName: "",
    dimension: "",
    price: 0,
    compareAtPrice: null,
    stock: 0,
  };
}

/**
 * Keeps the product row consistent with its variants so shop cards, cart limits
 * and the PDP never disagree:
 *
 * - price = cheapest variant price (what the shop grid advertises)
 * - stock = sum of variant stock (what the cart limits against)
 * - sizes = variant size names (so bundle and cross-sell flows stay valid)
 */
export function syncProductWithVariants(product: Product): Product {
  const variants = normalizeVariants(product.variants ?? []);
  if (variants.length === 0) return product;

  const cheapest = lowestVariantPrice(variants) ?? product.price;
  const sizes = [...new Set(variants.map((variant) => variant.sizeName.trim()).filter(Boolean))];

  return {
    ...product,
    price: cheapest,
    stock: totalVariantStock(variants),
    sizes: sizes.length > 0 ? sizes : product.sizes,
    variants,
  };
}

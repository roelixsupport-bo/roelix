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

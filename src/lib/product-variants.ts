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

function isCloudRow(value: unknown): value is CloudRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads a number out of anything the admin form or PostgREST can hand over.
 *
 * Number inputs give `NaN` when empty, older rows come back as `"830.50"`, and an
 * admin can paste `"1,200"`. All of those are normalised here; anything that is
 * not a number stays `null` so the caller decides the fallback.
 */
function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\s,_]/g, "")
    .replace(/[^0-9.+-]/g, "")
    .trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "+" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `price` is `numeric(10, 2)`; anything finer is rounded away by Postgres anyway. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown): number | null {
  return toFiniteNumber(value);
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

/** Sends `price`/`stock` as real numbers, never as the strings form inputs hold. */
export function variantToCloud(
  variant: ProductVariant,
  productId: string,
): Record<string, unknown> {
  const price = toFiniteNumber(variant.price) ?? 0;
  const stock = toFiniteNumber(variant.stock) ?? 0;
  const compareAtPrice = toFiniteNumber(variant.compareAtPrice);
  const row: Record<string, unknown> = {
    product_id: productId,
    sku: variant.sku.trim(),
    size_name: variant.sizeName.trim() || null,
    dimension: variant.dimension.trim() || null,
    // numeric(10, 2) + integer columns: PostgREST rejects "" and "1 200".
    price: Math.max(0, roundMoney(price)),
    compare_at_price:
      compareAtPrice !== null && compareAtPrice > 0 ? roundMoney(compareAtPrice) : null,
    stock: Math.max(0, Math.floor(stock)),
  };
  if (variant.id) row["id"] = variant.id;
  return row;
}

/**
 * Drops duplicate SKUs (case-insensitive). Reads use this so a legacy row set can
 * never render two buttons for one SKU; writes go through `ensureUniqueSkus`
 * instead, which renames the clash rather than throwing a row away.
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

/**
 * SKUs an admin types when they mean "let the app decide".
 *
 * `sku` is `not null` and unique across the whole catalogue, so a second row with
 * `0` (or an empty string) is rejected by Postgres with 23505. Those values are
 * treated as "generate one for me" everywhere instead of being sent as-is.
 */
const PLACEHOLDER_SKUS = new Set(["", "-", "0", "00", "000", "auto", "n/a", "na", "sku"]);

export function isPlaceholderSku(sku: string | null | undefined): boolean {
  if (typeof sku !== "string") return true;
  return PLACEHOLDER_SKUS.has(sku.trim().toLowerCase());
}

/**
 * Builds a readable, catalogue-unique SKU such as `AURELIA-SATEEN-KING-2`.
 *
 * `taken` is the set of SKUs already used in this save; collisions get a numeric
 * tail so a repeated size name or two rows for one dimension still save.
 */
export function generateSku(prefix: string, suffix: string, taken: Iterable<string> = []): string {
  const base = slugSku(prefix, suffix);
  const used = new Set<string>();
  for (const value of taken) {
    if (typeof value === "string" && value.trim() !== "") used.add(value.trim().toLowerCase());
  }
  if (!used.has(base.toLowerCase())) return base;
  for (let counter = 2; counter <= 500; counter += 1) {
    const candidate = `${base}-${counter}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

/**
 * Normalises the rows the editor holds into what the `product_variants` table
 * accepts, before anything is sent to Supabase:
 *
 * - `price` / `stock` / `compareAtPrice` become real numbers, empty fields become
 *   0 (or null for `compare_at_price`) instead of `""`, which PostgREST rejects
 *   with `invalid input syntax for type numeric` (22P02)
 * - stock is floored at 0, price rounded to 2 decimals (`numeric(10, 2)`)
 * - rows the admin added but never touched are dropped rather than saved blank
 */
export function sanitizeVariants(input: readonly ProductVariant[]): ProductVariant[] {
  const rows = Array.isArray(input) ? input : [];
  const clean: ProductVariant[] = [];

  for (const raw of rows) {
    if (!isCloudRow(raw)) continue;
    const row = raw as unknown as CloudRow;

    const sizeName = toText(row["sizeName"]);
    const dimension = toText(row["dimension"]);
    const sku = toText(row["sku"]);
    const price = toFiniteNumber(row["price"]);
    const stock = toFiniteNumber(row["stock"]);
    const compareAtPrice = toFiniteNumber(row["compareAtPrice"]);
    const id = typeof row["id"] === "string" && row["id"] !== "" ? row["id"] : null;

    // "Add variant" that was never filled in: nothing to sell, so nothing to save.
    const touched =
      sizeName !== "" ||
      dimension !== "" ||
      id !== null ||
      (price ?? 0) !== 0 ||
      (stock ?? 0) !== 0;
    if (!touched) continue;

    clean.push({
      id,
      sku,
      sizeName,
      dimension,
      price: Math.max(0, roundMoney(price ?? 0)),
      compareAtPrice:
        compareAtPrice !== null && compareAtPrice > 0 ? roundMoney(compareAtPrice) : null,
      stock: Math.max(0, Math.floor(stock ?? 0)),
    });
  }

  return clean;
}

/**
 * Makes every SKU in a save unique and non-placeholder.
 *
 * This is the guard that keeps `product_variants_sku_key` from rejecting a save:
 * blank / `0` SKUs are generated from the product name plus the row's size or
 * dimension, and a repeated SKU gets a numeric tail.
 */
export function ensureUniqueSkus(
  variants: ProductVariant[],
  productName = "ROELIX",
): ProductVariant[] {
  const taken = new Set<string>();

  return variants.map((variant, index) => {
    const typed = typeof variant.sku === "string" ? variant.sku.trim() : "";
    const seed = variant.sizeName.trim() || variant.dimension.trim() || String(index + 1);
    const clashes = typed !== "" && taken.has(typed.toLowerCase());
    const sku = isPlaceholderSku(typed) || clashes ? generateSku(productName, seed, taken) : typed;
    taken.add(sku.toLowerCase());
    return { ...variant, sku };
  });
}

/** SKUs that appear more than once in a list, lowercased. Drives the editor warning. */
export function duplicateSkus(variants: ProductVariant[]): Set<string> {
  const counts = new Map<string, number>();
  for (const variant of variants) {
    const key = variant.sku.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
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

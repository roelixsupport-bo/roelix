import { productToCloud } from "@/lib/cloud-catalog";
import { describeError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import {
  ensureUniqueSkus,
  sanitizeVariants,
  syncProductWithVariants,
  variantToCloud,
  type ProductVariant,
} from "@/lib/product-variants";
import type { Product } from "@/lib/store";

export type SaveProductResult = {
  /** The row that was actually written (derived price/stock/sizes applied). */
  product: Product;
  insertedVariants: number;
  updatedVariants: number;
  removedVariants: number;
  /** True when `product_details` / `product_care` could not be written. */
  detailsSkipped: boolean;
};

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const UNIQUE_VIOLATION = "23505";

/**
 * The column Postgres blamed in a "column ... does not exist" error, if any.
 */
function missingColumnName(error: { message?: string }): string | null {
  const match = /column "([^"]+)" of relation "[^"]+" does not exist/i.exec(error.message ?? "");
  return match?.[1] ?? null;
}

/** Upserts the row, omitting columns the table does not have yet. Returns the dropped names. */
async function upsertProductRow(product: Product): Promise<Set<string>> {
  const row = productToCloud(product);
  const dropped = new Set<string>();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await supabase.from("products").upsert(row);
    if (!error) return dropped;

    const column = missingColumnName(error);
    if (!column || column === "id" || !(column in row)) throw error;

    delete row[column];
    dropped.add(column);
  }

  throw new Error(
    "The products table is missing several expected columns. Apply the ROELIX migrations, then save again.",
  );
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? "");
}

/** `Key (sku)=(AURELIA-KING) already exists.` → `sku = AURELIA-KING`. */
function duplicateKeySummary(error: DatabaseError): string {
  const match = /Key \(([^)]+)\)=\(([^)]*)\) already exists/i.exec(error.message ?? "");
  if (!match) return "";
  if (match[1]?.toLowerCase() !== "sku") return `${match[1]} = ${match[2]}`;
  return `SKU ${match[2]}`;
}

/**
 * Turns the PostgREST error for a variant write into something the admin can act
 * on, keeping the raw message, details, hint and code underneath so nothing is
 * hidden behind a generic "failed".
 */
export function describeVariantRejection(error: unknown): string {
  const shape = (error ?? {}) as DatabaseError;
  const detail = describeError(error);

  switch (shape.code) {
    case UNIQUE_VIOLATION: {
      const key = duplicateKeySummary(shape);
      return `Duplicate value${key ? `: ${key}` : ""} — SKUs must be unique across the whole catalogue. Change the SKU, or leave it empty so it is generated for you.\n${detail}`;
    }
    case "23502":
      return `A required variant column was empty (SKU, price or stock).\n${detail}`;
    case "22P02":
      return `A price or stock value could not be read as a number. Empty fields must be 0.\n${detail}`;
    case "23514":
      return `A variant value is outside what the table allows (price and stock must be 0 or more).\n${detail}`;
    case "23503":
      return `The variants point at a product that does not exist — the product row was not saved.\n${detail}`;
    case "42501":
      return `Supabase refused the write. Sign in with a ROELIX administrator account.\n${detail}`;
    default:
      return detail;
  }
}

/** Last-resort token so a retried insert cannot collide again. */
function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

/**
 * Writes the variant matrix for one product.
 *
 * Rows that already exist are upserted on `id`; rows added in the editor are
 * inserted. Auto-generated SKUs can still collide with a SKU another product
 * already owns, so an insert that hits the unique index is retried once with a
 * short suffix — and the SKUs that were actually stored are returned so the
 * editor does not keep showing a name the database does not have.
 */
async function saveVariants(
  productId: string,
  next: ProductVariant[],
  previous: ProductVariant[],
): Promise<{
  inserted: number;
  updated: number;
  removed: number;
  variants: ProductVariant[];
}> {
  const written = next.map((variant) => ({ ...variant }));

  const previousIds = new Set(
    previous.map((variant) => variant.id).filter((id): id is string => Boolean(id)),
  );
  const keptIds = new Set(written.map((variant) => variant.id).filter((id): id is string => !!id));
  const removedIds = [...previousIds].filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase.from("product_variants").delete().in("id", removedIds);
    if (error) throw error;
  }

  const updateIndexes: number[] = [];
  const insertIndexes: number[] = [];
  written.forEach((variant, index) => {
    if (variant.id) updateIndexes.push(index);
    else insertIndexes.push(index);
  });

  if (updateIndexes.length > 0) {
    const { error } = await supabase.from("product_variants").upsert(
      updateIndexes.map((index) => variantToCloud(written[index]!, productId)),
      { onConflict: "id" },
    );
    if (error) throw error;
  }

  if (insertIndexes.length > 0) {
    const rows = insertIndexes.map((index) => variantToCloud(written[index]!, productId));
    const attempt = await supabase.from("product_variants").insert(rows);
    if (attempt.error && attempt.error.code !== UNIQUE_VIOLATION) throw attempt.error;

    if (attempt.error) {
      // An auto-generated SKU can still belong to another product: rename once.
      const suffix = uniqueSuffix();
      const retryRows = rows.map((row) => ({
        ...row,
        sku: `${typeof row["sku"] === "string" && row["sku"] !== "" ? row["sku"] : "ROELIX"}-${suffix}`,
      }));
      const retry = await supabase.from("product_variants").insert(retryRows);
      if (retry.error) throw retry.error;
      insertIndexes.forEach((target, position) => {
        const stored = retryRows[position]?.["sku"];
        if (typeof stored === "string") written[target] = { ...written[target]!, sku: stored };
      });
    }
  }

  return {
    inserted: insertIndexes.length,
    updated: updateIndexes.length,
    removed: removedIds.length,
    variants: written,
  };
}

/**
 * Writes a product and its variant matrix to Supabase.
 *
 * Everything the admin typed is normalised first: `price` and `stock` are real
 * numbers (empty → 0), and every SKU is resolved to a unique, non-placeholder
 * value before it reaches the unique index.
 */
export async function saveCloudProduct(
  input: Product,
  previousVariants: ProductVariant[],
): Promise<SaveProductResult> {
  const variants = ensureUniqueSkus(sanitizeVariants(input.variants ?? []), input.name || "ROELIX");
  const product = syncProductWithVariants({ ...input, variants });

  let droppedColumns: Set<string>;
  try {
    droppedColumns = await upsertProductRow(product);
  } catch (error) {
    throw new Error(`Supabase rejected the product row.\n${describeError(error)}`);
  }

  // Copy columns the table could not accept; the rest of the edit was saved.
  const detailsSkipped =
    droppedColumns.has("product_details") || droppedColumns.has("product_care");

  let result: Awaited<ReturnType<typeof saveVariants>>;
  try {
    result = await saveVariants(product.id, product.variants ?? [], previousVariants);
  } catch (error) {
    const shape = error as DatabaseError;
    if (isMissingTableError(shape)) {
      throw new Error(
        "Product saved, but the product_variants table is missing. Run supabase/migrations/20261027130000_fix_variants_schema_and_product_images.sql in the Supabase SQL editor, then save again.",
      );
    }
    // The product row itself is already written; only the variant matrix failed.
    throw new Error(
      `Product saved, but Supabase rejected the variants.\n${describeVariantRejection(error)}`,
    );
  }

  return {
    product: syncProductWithVariants({ ...product, variants: result.variants }),
    insertedVariants: result.inserted,
    updatedVariants: result.updated,
    removedVariants: result.removed,
    detailsSkipped,
  };
}

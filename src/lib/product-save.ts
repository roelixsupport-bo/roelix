import { productToCloud } from "@/lib/cloud-catalog";
import { supabase } from "@/lib/supabase";
import {
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

/**
 * The column Postgres blamed in a "column ... does not exist" error, if any.
 *
 * Letting the save drop one missing column at a time means the dashboard keeps
 * working on a project that has only some of the ROELIX migrations applied,
 * instead of guessing the migration level and sending a payload that fails.
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

async function saveVariants(
  productId: string,
  next: ProductVariant[],
  previous: ProductVariant[],
): Promise<{ inserted: number; updated: number; removed: number }> {
  const previousIds = new Set(
    previous.map((variant) => variant.id).filter((id): id is string => Boolean(id)),
  );
  const nextIds = new Set(next.map((variant) => variant.id).filter((id): id is string => !!id));
  const removedIds = [...previousIds].filter((id) => !nextIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await supabase.from("product_variants").delete().in("id", removedIds);
    if (error) throw error;
  }

  const updates = next.filter((variant) => variant.id !== null);
  const inserts = next.filter((variant) => variant.id === null);

  if (updates.length > 0) {
    const { error } = await supabase.from("product_variants").upsert(
      updates.map((variant) => variantToCloud(variant, productId)),
      { onConflict: "id" },
    );
    if (error) throw error;
  }
  if (inserts.length > 0) {
    const { error } = await supabase
      .from("product_variants")
      .insert(inserts.map((variant) => variantToCloud(variant, productId)));
    if (error) throw error;
  }

  return { inserted: inserts.length, updated: updates.length, removed: removedIds.length };
}

/**
 * Writes a product and its variant matrix to Supabase.
 *
 * `previous` is the variant list as loaded into the editor, used to work out
 * which rows the admin deleted. Variant rows are never deleted implicitly: only
 * variants the admin removed explicitly are deleted.
 */
export async function saveCloudProduct(
  input: Product,
  previousVariants: ProductVariant[],
): Promise<SaveProductResult> {
  const product = syncProductWithVariants(input);

  const droppedColumns = await upsertProductRow(product);
  // Copy columns the table could not accept; the rest of the edit was saved.
  const detailsSkipped =
    droppedColumns.has("product_details") || droppedColumns.has("product_care");

  let inserted = 0;
  let updated = 0;
  let removed = 0;
  try {
    const result = await saveVariants(product.id, product.variants ?? [], previousVariants);
    inserted = result.inserted;
    updated = result.updated;
    removed = result.removed;
  } catch (error) {
    const shape = error as { code?: string; message?: string };
    if (isMissingTableError(shape)) {
      throw new Error(
        "Product saved, but the product_variants table is missing. Run supabase/migrations/20261027130000_fix_variants_schema_and_product_images.sql in the Supabase SQL editor, then save again.",
      );
    }
    if (shape.code === "23505" || /duplicate key/i.test(shape.message ?? "")) {
      throw new Error(
        "Two variants share the same SKU. Give every variant a unique SKU and save again.",
      );
    }
    throw error;
  }

  return {
    product,
    insertedVariants: inserted,
    updatedVariants: updated,
    removedVariants: removed,
    detailsSkipped,
  };
}

import { describe, expect, it } from "vitest";

import {
  axisStock,
  bestVariantFor,
  distinctVariantValues,
  hasStockFor,
  resolveVariant,
  variantMatchesSelection,
  type ProductVariant,
} from "@/lib/product-variants";

const row = (patch: Partial<ProductVariant> & { id: string }): ProductVariant => ({
  sku: patch.id.toUpperCase(),
  sizeName: "",
  dimension: "",
  price: 100,
  compareAtPrice: null,
  stock: 1,
  ...patch,
});

/** Two pillow sizes crossed with two dimensions, one combination sold out. */
const matrix: ProductVariant[] = [
  row({
    id: "soft-5070",
    sizeName: "Soft Pillow",
    dimension: "50 × 70 cm",
    price: 100,
    stock: 5,
  }),
  row({
    id: "soft-7070",
    sizeName: "Soft Pillow",
    dimension: "70 × 70 cm",
    price: 120,
    compareAtPrice: 160,
    stock: 0,
  }),
  row({
    id: "medium-5070",
    sizeName: "Medium Pillow",
    dimension: "50 × 70 cm",
    price: 140,
    stock: 2,
  }),
];

describe("variant selection", () => {
  it("lists each axis once, in matrix order", () => {
    expect(distinctVariantValues(matrix, "sizeName")).toEqual(["Soft Pillow", "Medium Pillow"]);
    expect(distinctVariantValues(matrix, "dimension")).toEqual(["50 × 70 cm", "70 × 70 cm"]);
  });

  it("resolves an exact size and dimension pair to one variant", () => {
    expect(resolveVariant(matrix, { sizeName: "Medium Pillow", dimension: "50 × 70 cm" })?.id).toBe(
      "medium-5070",
    );
    // A sold-out row still resolves: the page must show "out of stock", not a wrong variant.
    expect(resolveVariant(matrix, { sizeName: "Soft Pillow", dimension: "70 × 70 cm" })?.id).toBe(
      "soft-7070",
    );
  });

  it("matches axes case-insensitively", () => {
    expect(resolveVariant(matrix, { sizeName: "soft pillow", dimension: "50 × 70 cm" })?.id).toBe(
      "soft-5070",
    );
    expect(variantMatchesSelection(matrix[0]!, { sizeName: "SOFT PILLOW" })).toBe(true);
  });

  it("returns null when the combination is not sold", () => {
    expect(resolveVariant(matrix, { sizeName: "Medium Pillow", dimension: "70 × 70 cm" })).toBe(
      null,
    );
  });

  it("reports stock per axis so buttons can be disabled or flagged", () => {
    expect(hasStockFor(matrix, { sizeName: "Soft Pillow" })).toBe(true);
    expect(hasStockFor(matrix, { dimension: "70 × 70 cm" })).toBe(false);
    expect(hasStockFor(matrix, { sizeName: "Medium Pillow", dimension: "70 × 70 cm" })).toBe(false);
  });

  it("sums each option's own stock across the other axis", () => {
    // Soft Pillow: 5 (50 × 70) + 0 (70 × 70); Medium Pillow: 2.
    expect(axisStock(matrix, "sizeName", "Soft Pillow")).toBe(5);
    expect(axisStock(matrix, "sizeName", "Medium Pillow")).toBe(2);
    expect(axisStock(matrix, "dimension", "50 × 70 cm")).toBe(7);
    expect(axisStock(matrix, "dimension", "70 × 70 cm")).toBe(0);
    expect(axisStock(matrix, "sizeName", "Does not exist")).toBe(0);
  });

  it("falls back to the first purchasable row for an empty selection", () => {
    expect(bestVariantFor(matrix, {})?.id).toBe("soft-5070");
  });

  it("keeps the size when the requested dimension pair has no stock", () => {
    // What VariantPicker does after a size click that cannot honour the current dimension.
    const fallback = bestVariantFor(matrix, { sizeName: "Medium Pillow" });
    expect(fallback?.dimension).toBe("50 × 70 cm");
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { STATIC_PRODUCTS } from "@/lib/store";

const MIGRATION = "supabase/migrations/20261028130000_seed_catalogue_variants.sql";
const GRID_MIGRATION = "supabase/migrations/20261028150000_pillow_dimension_grid.sql";

type SeedRow = {
  productId: string;
  sku: string;
  sizeName: string;
  dimension: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
};

/**
 * Reads the seed rows straight out of the migration.
 *
 * There is no local Postgres in CI, so the SQL itself cannot be executed here.
 * Parsing the VALUES list still catches the failures that matter: a typo'd
 * product id (the join silently skips it), a duplicate SKU (unique index
 * aborts the migration), a duplicated size name (ambiguous inventory
 * matching), or numbers that would change what the shop already advertises.
 */
function readSeedRows(file: string): SeedRow[] {
  const sql = readFileSync(path.resolve(process.cwd(), file), "utf8");
  const rowPattern =
    /^\s*\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([\d.]+),\s*(null|[\d.]+),\s*(\d+)\)/gm;

  return [...sql.matchAll(rowPattern)].map((match) => ({
    productId: match[1] ?? "",
    sku: match[2] ?? "",
    sizeName: match[3] ?? "",
    dimension: match[4] ?? "",
    price: Number(match[5]),
    compareAtPrice: match[6] === "null" ? null : Number(match[6]),
    stock: Number(match[7]),
  }));
}

const rows = readSeedRows(MIGRATION);
const productIds = new Set(rows.map((row) => row.productId));

describe("catalogue variant seed", () => {
  it("parses every seeded row", () => {
    expect(rows.length).toBeGreaterThanOrEqual(13);
    expect(rows.every((row) => row.productId && row.sku && row.sizeName)).toBe(true);
  });

  it("only targets products that exist in the catalogue", () => {
    const known = new Set(STATIC_PRODUCTS.map((product) => product.id));
    for (const id of productIds) expect(known.has(id)).toBe(true);
  });

  it("uses SKUs the unique index will accept", () => {
    const skus = rows.map((row) => row.sku.trim().toLowerCase());
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("keeps size names unique per product so stock decrements match one row", () => {
    for (const id of productIds) {
      const sizes = rows
        .filter((row) => row.productId === id)
        .map((row) => row.sizeName.trim().toLowerCase());
      expect(new Set(sizes).size).toBe(sizes.length);
    }
  });

  it("does not change the advertised price or stock of any product", () => {
    for (const id of productIds) {
      const product = STATIC_PRODUCTS.find((candidate) => candidate.id === id);
      const own = rows.filter((row) => row.productId === id);

      expect(own.reduce((total, row) => total + row.stock, 0)).toBe(product?.stock);
      expect(Math.min(...own.map((row) => row.price))).toBeCloseTo(product?.price ?? 0, 2);
    }
  });

  it("gives every variant a dimension and a discount so the PDP has something to show", () => {
    for (const row of rows) {
      expect(row.dimension.length).toBeGreaterThan(0);
      expect(row.price).toBeGreaterThan(0);
      expect(Number.isInteger(row.stock)).toBe(true);
      expect(row.stock).toBeGreaterThanOrEqual(0);
      expect(row.compareAtPrice).not.toBeNull();
      expect(row.compareAtPrice ?? 0).toBeGreaterThan(row.price);
    }
  });
});

describe("pillow dimension grid", () => {
  const grid = readSeedRows(GRID_MIGRATION);
  const seedPillow = rows.filter((row) => row.productId === "cloud-pillow");
  const combined = [...seedPillow, ...grid];

  it("only touches the pillow", () => {
    expect(grid.length).toBeGreaterThan(0);
    expect(grid.every((row) => row.productId === "cloud-pillow")).toBe(true);
  });

  it("fills in the missing size and dimension combinations", () => {
    const sizes = new Set(combined.map((row) => row.sizeName));
    const dimensions = new Set(combined.map((row) => row.dimension));
    expect(combined).toHaveLength(sizes.size * dimensions.size);
    expect(sizes.size).toBeGreaterThan(1);
    expect(dimensions.size).toBeGreaterThan(1);
  });

  it("never repeats a size and dimension pair", () => {
    const pairs = combined.map((row) => `${row.sizeName}|${row.dimension}`.toLowerCase());
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("adds the new combinations as sold out so availability does not move", () => {
    expect(grid.every((row) => row.stock === 0)).toBe(true);
    expect(grid.every((row) => (row.compareAtPrice ?? 0) > row.price)).toBe(true);
  });

  it("leaves the pillow's advertised price and total stock untouched", () => {
    const product = STATIC_PRODUCTS.find((candidate) => candidate.id === "cloud-pillow");
    expect(combined.reduce((total, row) => total + row.stock, 0)).toBe(product?.stock);
    expect(Math.min(...combined.map((row) => row.price))).toBeCloseTo(product?.price ?? 0, 2);
  });
});

import { describe, expect, it } from "vitest";

import { productFromCloud } from "@/lib/cloud-catalog";
import {
  duplicateSkus,
  ensureUniqueSkus,
  firstPurchasableVariant,
  generateSku,
  isPlaceholderSku,
  normalizeVariants,
  sanitizeVariants,
  syncProductWithVariants,
  variantFromCloud,
  variantToCloud,
  variantsFromCloud,
  type ProductVariant,
} from "@/lib/product-variants";
import type { Product } from "@/lib/store";

const baseProduct: Product = {
  id: "aurelia-sateen",
  name: "Aurelia Sateen Bedding Set",
  nameAr: "طقم أوريليا ساتان",
  category: "Bedding Sets",
  price: 690,
  images: [],
  description: "",
  origin: "Giza, Egypt",
  stock: 12,
  colors: [{ name: "Ivory", hex: "#f3ead8" }],
  sizes: ["Queen"],
  isPublished: true,
};

const variant = (patch: Partial<ProductVariant> = {}): ProductVariant => ({
  id: null,
  sku: "AUR-QUEEN",
  sizeName: "Queen",
  dimension: "",
  price: 690,
  compareAtPrice: null,
  stock: 4,
  ...patch,
});

describe("variant cloud mapping", () => {
  it("parses a complete row, including Postgres numeric strings", () => {
    const parsed = variantFromCloud({
      id: "1f2c",
      sku: "AUR-KING",
      size_name: "King",
      dimension: "200 × 220 cm",
      price: "830.50",
      compare_at_price: "950.00",
      stock: "6",
    });

    expect(parsed).toEqual({
      id: "1f2c",
      sku: "AUR-KING",
      sizeName: "King",
      dimension: "200 × 220 cm",
      price: 830.5,
      compareAtPrice: 950,
      stock: 6,
    });
  });

  it("drops rows that cannot be trusted instead of throwing", () => {
    expect(variantFromCloud({ sku: "", price: 10, stock: 1 })).toBeNull();
    expect(variantFromCloud({ sku: "A", price: null, stock: 1 })).toBeNull();
    expect(variantFromCloud(null)).toBeNull();
    expect(variantsFromCloud("nope")).toEqual([]);
  });

  it("keeps one row per SKU, ignoring case", () => {
    const variants = normalizeVariants([
      variant({ sku: "aur-queen", sizeName: "Queen" }),
      variant({ sku: "AUR-QUEEN", sizeName: "Queen duplicate" }),
      variant({ sku: "AUR-KING", sizeName: "King" }),
    ]);

    expect(variants.map((item) => item.sizeName)).toEqual(["Queen", "King"]);
  });

  it("only sends an id when the row already exists", () => {
    const created = variantToCloud(variant(), "aurelia-sateen");
    expect(created["id"]).toBeUndefined();
    expect(created["product_id"]).toBe("aurelia-sateen");
    expect(created["dimension"]).toBeNull();

    const existing = variantToCloud(variant({ id: "1f2c" }), "aurelia-sateen");
    expect(existing["id"]).toBe("1f2c");
  });
});

describe("product and variant reconciliation", () => {
  it("derives the advertised price, total stock and size list", () => {
    const synced = syncProductWithVariants({
      ...baseProduct,
      variants: [
        variant({ id: "a", sku: "AUR-QUEEN", sizeName: "Queen", price: 690, stock: 3 }),
        variant({ id: "b", sku: "AUR-KING", sizeName: "King", price: 830, stock: 5 }),
        variant({ id: "c", sku: "AUR-SKING", sizeName: "Super King", price: 980, stock: 0 }),
      ],
    });

    expect(synced.price).toBe(690);
    expect(synced.stock).toBe(8);
    expect(synced.sizes).toEqual(["Queen", "King", "Super King"]);
  });

  it("leaves a variant-free product untouched", () => {
    expect(syncProductWithVariants(baseProduct)).toBe(baseProduct);
  });

  it("opens on a purchasable size, falling back to the first row", () => {
    const soldOut = variant({ id: "a", sku: "A", sizeName: "Queen", stock: 0 });
    const available = variant({ id: "b", sku: "B", sizeName: "King", stock: 2 });

    expect(firstPurchasableVariant([soldOut, available])?.sizeName).toBe("King");
    expect(firstPurchasableVariant([soldOut])?.sizeName).toBe("Queen");
    expect(firstPurchasableVariant([])).toBeNull();
  });
});

describe("productFromCloud", () => {
  it("maps detail copy and the nested variant relation", () => {
    const product = productFromCloud({
      id: "aurelia-sateen",
      name: "Aurelia Sateen Bedding Set",
      name_ar: "طقم أوريليا ساتان",
      category: "Bedding Sets",
      price: 690,
      images: ["https://example.com/a.jpg"],
      description: "Long-staple Giza cotton.",
      thread_count: 1000,
      gsm: null,
      origin: "Giza, Egypt",
      stock: 4,
      colors: [{ name: "Ivory", hex: "#f3ead8" }],
      sizes: ["Queen"],
      frequently_bought_ids: [],
      is_published: true,
      product_details: "  Woven in a 1000 thread count sateen.  ",
      product_care: "",
      product_variants: [
        {
          id: "1f2c",
          sku: "AUR-QUEEN",
          size_name: "Queen",
          dimension: "200 × 220 cm",
          price: 690,
          compare_at_price: null,
          stock: 4,
        },
      ],
    });

    expect(product.productDetails).toBe("Woven in a 1000 thread count sateen.");
    // An empty care column means "not written yet", not an empty accordion body.
    expect(product.productCare).toBeUndefined();
    expect(product.variants).toHaveLength(1);
    expect(product.variants?.[0]?.sku).toBe("AUR-QUEEN");
  });
});

describe("variant sanitising before a Supabase write", () => {
  it("coerces string and empty price/stock into numbers", () => {
    const [row] = sanitizeVariants([
      {
        ...variant(),
        // The editor can hand over strings and blanks: these used to reach the
        // numeric/integer columns as "" and fail with 22P02.
        price: "830.5" as unknown as number,
        stock: "" as unknown as number,
        compareAtPrice: "" as unknown as number | null,
      },
    ]);

    expect(row?.price).toBe(830.5);
    expect(row?.stock).toBe(0);
    expect(row?.compareAtPrice).toBeNull();
  });

  it("floors stock, clamps negatives and rounds money to cents", () => {
    const [row] = sanitizeVariants([
      variant({ price: 830.4567, stock: 3.9, compareAtPrice: 950.129 }),
    ]);

    expect(row?.price).toBe(830.46);
    expect(row?.stock).toBe(3);
    expect(row?.compareAtPrice).toBe(950.13);
  });

  it("drops a row the admin added but never filled in", () => {
    expect(
      sanitizeVariants([variant({ sku: "", sizeName: "", dimension: "", price: 0, stock: 0 })]),
    ).toEqual([]);
  });

  it("sends no empty string or NaN through variantToCloud", () => {
    const row = variantToCloud(
      variant({ price: Number.NaN, stock: Number.NaN, compareAtPrice: Number.NaN }),
      "aurelia-sateen",
    );

    expect(row["price"]).toBe(0);
    expect(row["stock"]).toBe(0);
    expect(row["compare_at_price"]).toBeNull();
  });
});

describe("SKU generation", () => {
  it("treats blank, 0 and AUTO as placeholders", () => {
    for (const sku of ["", "  ", "0", "00", "auto", "AUTO"]) {
      expect(isPlaceholderSku(sku)).toBe(true);
    }
    expect(isPlaceholderSku("AUR-QUEEN")).toBe(false);
    expect(isPlaceholderSku(null)).toBe(true);
  });

  it("builds a readable SKU and numbers collisions", () => {
    expect(generateSku("Aurelia Sateen", "Queen")).toBe("AURELIA-SATEEN-QUEEN");
    expect(generateSku("Aurelia Sateen", "Queen", ["aurelia-sateen-queen"])).toBe(
      "AURELIA-SATEEN-QUEEN-2",
    );
  });

  it("replaces repeated 0 SKUs with unique generated values", () => {
    const rows = ensureUniqueSkus(
      [
        variant({ sku: "0", sizeName: "Queen" }),
        variant({ sku: "0", sizeName: "King" }),
        variant({ sku: "", sizeName: "", dimension: "200 × 220 cm" }),
      ],
      "Aurelia Sateen",
    );

    expect(rows.map((row) => row.sku)).toEqual([
      "AURELIA-SATEEN-QUEEN",
      "AURELIA-SATEEN-KING",
      "AURELIA-SATEEN-200-220-CM",
    ]);
  });

  it("renames a duplicated typed SKU instead of letting the unique index reject it", () => {
    const rows = ensureUniqueSkus(
      [
        variant({ sku: "AUR-KING", sizeName: "King" }),
        variant({ sku: "aur-king", sizeName: "King" }),
      ],
      "Aurelia",
    );

    expect(rows[0]?.sku).toBe("AUR-KING");
    expect(rows[1]?.sku).toBe("AURELIA-KING");
    expect(duplicateSkus(rows).size).toBe(0);
  });

  it("reports duplicates so the editor can warn before saving", () => {
    expect([
      ...duplicateSkus([variant({ sku: "DUP" }), variant({ sku: "dup" }), variant({ sku: "OK" })]),
    ]).toEqual(["dup"]);
  });
});

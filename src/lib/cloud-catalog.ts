import type { Product } from "@/lib/store";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Cloud product has invalid ${field}`);
  }
  return value;
}

function isProductColor(value: unknown): value is { name: string; hex: string } {
  return isRecord(value) && typeof value["name"] === "string" && typeof value["hex"] === "string";
}

export function productFromCloud(value: unknown): Product {
  if (
    !isRecord(value) ||
    typeof value["id"] !== "string" ||
    typeof value["name"] !== "string" ||
    typeof value["name_ar"] !== "string" ||
    typeof value["category"] !== "string" ||
    typeof value["price"] !== "number" ||
    typeof value["description"] !== "string" ||
    (value["thread_count"] !== null &&
      value["thread_count"] !== undefined &&
      typeof value["thread_count"] !== "number") ||
    (value["gsm"] !== null && value["gsm"] !== undefined && typeof value["gsm"] !== "number") ||
    typeof value["origin"] !== "string" ||
    typeof value["stock"] !== "number" ||
    typeof value["is_published"] !== "boolean"
  ) {
    throw new Error("Cloud product has an invalid schema");
  }

  const colors = value["colors"];
  if (!Array.isArray(colors) || !colors.every(isProductColor)) {
    throw new Error("Cloud product has invalid colors");
  }

  return {
    id: value["id"],
    name: value["name"],
    nameAr: value["name_ar"],
    category: value["category"],
    price: value["price"],
    images: stringArray(value["images"], "images"),
    description: value["description"],
    ...(typeof value["thread_count"] === "number" ? { threadCount: value["thread_count"] } : {}),
    ...(typeof value["gsm"] === "number" ? { gsm: value["gsm"] } : {}),
    origin: value["origin"],
    stock: value["stock"],
    colors: colors.map(({ name, hex }) => ({ name, hex })),
    sizes: stringArray(value["sizes"], "sizes"),
    frequently_bought_ids: stringArray(value["frequently_bought_ids"], "frequently_bought_ids"),
    isPublished: value["is_published"],
  };
}

export function productToCloud(product: Product): Record<string, unknown> {
  return {
    id: product.id,
    name: product.name,
    name_ar: product.nameAr,
    category: product.category,
    price: product.price,
    images: product.images,
    description: product.description,
    thread_count: product.threadCount ?? null,
    gsm: product.gsm ?? null,
    origin: product.origin,
    stock: product.stock,
    colors: product.colors,
    sizes: product.sizes,
    frequently_bought_ids: product.frequently_bought_ids ?? product.relatedProductIds ?? [],
    is_published: product.isPublished,
    updated_at: new Date().toISOString(),
  };
}

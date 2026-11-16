import { firstPurchasableVariant } from "@/lib/product-variants";
import { productFromCloud } from "@/lib/cloud-catalog";
import type { Product } from "@/lib/store";
import { supabase } from "@/lib/supabase";

const SITE_URL = "https://roelix.com";

export type ProductSeoData = {
  product: Product;
  rating: { average: number; count: number } | null;
  url: string;
};

export type CategorySeoData = {
  name: string;
  description: string;
  image: string;
  url: string;
  noindex: boolean;
};

type SeoProductRow = {
  id: string;
  category: string;
  description: string;
  images: string[];
  updated_at?: string;
};

function parseProducts(rows: unknown[]): Product[] {
  return rows.flatMap((row) => {
    try {
      const product = productFromCloud(row);
      return product.isPublished ? [product] : [];
    } catch (error) {
      console.error("ROELIX SEO: skipping an unreadable product row", error);
      return [];
    }
  });
}

export async function loadProductSeo(productId: string): Promise<ProductSeoData | null> {
  const { data: row, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("id", productId)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !row) return null;

  let product: Product;
  try {
    product = productFromCloud(row);
  } catch (parseError) {
    console.error("ROELIX SEO: could not read product metadata", parseError);
    return null;
  }

  const { data: reviewRows, error: reviewError } = await supabase
    .from("product_reviews")
    .select("rating")
    .eq("product_id", productId)
    .eq("status", "published");
  const ratings = reviewError
    ? []
    : (reviewRows ?? [])
        .map((review) => (typeof review.rating === "number" ? review.rating : Number.NaN))
        .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5);
  const rating = ratings.length
    ? {
        count: ratings.length,
        average: ratings.reduce((sum, value) => sum + value, 0) / ratings.length,
      }
    : null;

  return { product, rating, url: `${SITE_URL}/product/${encodeURIComponent(product.id)}` };
}

export async function loadCategorySeo(
  category: string | undefined,
  noindex = false,
): Promise<CategorySeoData | null> {
  if (noindex) {
    return {
      name: "Your Wishlist",
      description: "Your saved ROELIX collection.",
      image: "",
      url: `${SITE_URL}/shop`,
      noindex: true,
    };
  }
  if (!category) return null;

  const { data, error } = await supabase
    .from("products")
    .select("id, category, description, images, updated_at")
    .eq("category", category)
    .eq("is_published", true)
    .order("name");
  if (error) return null;

  const products = (data ?? []) as SeoProductRow[];
  if (products.length === 0) {
    return {
      name: category,
      description: `Explore ${category} from ROELIX.`,
      image: "",
      url: `${SITE_URL}/shop?c=${encodeURIComponent(category)}`,
      noindex: true,
    };
  }
  const image = products.flatMap((product) => product.images ?? []).find(Boolean) ?? "";
  const description =
    products.find((product) => product.description.trim())?.description ??
    `Explore ${category} from ROELIX.`;

  return {
    name: category,
    description,
    image,
    url: `${SITE_URL}/shop?c=${encodeURIComponent(category)}`,
    noindex: false,
  };
}

export function seoProductOffer(product: Product): { priceEgp: number; inStock: boolean } {
  const variant = firstPurchasableVariant(product.variants ?? []);
  const price = variant?.price ?? product.price;
  const stock = variant?.stock ?? product.stock;
  return { priceEgp: Math.round(price * 48), inStock: stock > 0 };
}

export async function loadSitemapProducts(): Promise<SeoProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, category, description, images, updated_at")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SeoProductRow[];
}
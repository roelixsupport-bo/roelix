import { supabase } from "@/lib/supabase";

export type PromoSlide = {
  id: string;
  message_en: string;
  message_ar: string;
  target_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type PromoSlideInput = Pick<
  PromoSlide,
  "message_en" | "message_ar" | "target_url" | "sort_order" | "is_active"
>;

const PROMO_COLUMNS = "id, message_en, message_ar, target_url, sort_order, is_active, created_at";

export function isAllowedPromoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchPromoSlides(activeOnly = false): Promise<PromoSlide[]> {
  let query = supabase.from("promo_slides").select(PROMO_COLUMNS);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPromoSlide(input: Omit<PromoSlideInput, "sort_order">): Promise<void> {
  const { data: lastSlide, error: orderError } = await supabase
    .from("promo_slides")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) throw orderError;

  const { error } = await supabase.from("promo_slides").insert({
    ...input,
    sort_order: (lastSlide?.sort_order ?? -1) + 1,
  });
  if (error) throw error;
}

export async function updatePromoSlide(id: string, changes: Partial<PromoSlideInput>): Promise<void> {
  const { error } = await supabase.from("promo_slides").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deletePromoSlide(id: string): Promise<void> {
  const { error } = await supabase.from("promo_slides").delete().eq("id", id);
  if (error) throw error;
}

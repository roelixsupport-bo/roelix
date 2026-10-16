import { BOSTA_SHIPPING_RATES, type EgyptGovernorate } from "@/lib/shipping";
import type { Product } from "@/lib/store";
import { productFromCloud } from "@/lib/cloud-catalog";
import { supabase } from "@/lib/supabase";

export type AssistantShippingRates = Partial<Record<EgyptGovernorate, number>>;

export type CloudOrderStatus = {
  orderNumber: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  total: number;
};

export async function loadAssistantCatalog(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_published", true)
    .gt("stock", 0)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(productFromCloud);
}

export async function loadAssistantShippingRates(): Promise<AssistantShippingRates> {
  const { data, error } = await supabase.from("shipping_rates").select("governorate, cost_egp");
  if (error) throw error;

  const rates: AssistantShippingRates = {};
  for (const row of data ?? []) {
    if (
      typeof row.governorate !== "string" ||
      !(row.governorate in BOSTA_SHIPPING_RATES) ||
      typeof row.cost_egp !== "number" ||
      !Number.isFinite(row.cost_egp) ||
      row.cost_egp < 0
    ) {
      throw new Error("Supabase returned an invalid shipping rate");
    }
    rates[row.governorate as EgyptGovernorate] = row.cost_egp;
  }
  return rates;
}

export async function lookupCloudOrderStatus(
  orderNumber: string,
  phone: string,
): Promise<CloudOrderStatus | null> {
  const { data, error } = await supabase.rpc("lookup_roelix_order_status", {
    p_order_number: orderNumber,
    p_phone: phone,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : undefined;
  if (row === undefined || row === null) return null;
  if (
    typeof row.order_number !== "string" ||
    !["pending", "processing", "shipped", "delivered", "cancelled"].includes(row.status) ||
    typeof row.total_amount !== "number"
  ) {
    throw new Error("Supabase returned an invalid order status");
  }
  return {
    orderNumber: row.order_number,
    status: row.status as CloudOrderStatus["status"],
    total: row.total_amount,
  };
}

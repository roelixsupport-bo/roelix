import { supabase } from "@/lib/supabase";

export const PAYMENT_RECEIPT_BUCKET = "payment-receipts";
export const PAYMENT_RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
export const PAYMENT_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PaymentMethodKey = "vodafone_cash" | "instapay";

export type PaymentSetting = {
  id: number;
  method_key: PaymentMethodKey;
  method_name: string;
  account_info: string;
  is_active: boolean;
  icon_url: string | null;
};

const RECEIPT_EXTENSION: Record<(typeof PAYMENT_RECEIPT_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function fetchPaymentSettings(): Promise<PaymentSetting[]> {
  const { data, error } = await supabase
    .from("payment_settings")
    .select("id, method_key, method_name, account_info, is_active, icon_url")
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActivePaymentSettings(): Promise<PaymentSetting[]> {
  const { data, error } = await supabase
    .from("payment_settings")
    .select("id, method_key, method_name, account_info, is_active, icon_url")
    .eq("is_active", true)
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updatePaymentSetting(
  id: number,
  changes: Partial<Pick<PaymentSetting, "account_info" | "is_active">>,
): Promise<void> {
  const { error } = await supabase.from("payment_settings").update(changes).eq("id", id);
  if (error) throw error;
}

export function paymentReceiptError(file: File): string | null {
  if (!(PAYMENT_RECEIPT_TYPES as readonly string[]).includes(file.type))
    return "Choose a JPG, PNG or WebP receipt image.";
  if (file.size === 0) return "The selected receipt image is empty.";
  if (file.size > PAYMENT_RECEIPT_MAX_BYTES) return "Choose a receipt image smaller than 8 MB.";
  return null;
}

export async function uploadPaymentReceipt(file: File): Promise<string> {
  const validationError = paymentReceiptError(file);
  if (validationError) throw new Error(validationError);

  const extension = RECEIPT_EXTENSION[file.type as keyof typeof RECEIPT_EXTENSION];
  if (!extension) throw new Error("The selected receipt image format is not supported.");
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(PAYMENT_RECEIPT_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function deletePaymentReceipt(path: string): Promise<void> {
  const { error } = await supabase.storage.from(PAYMENT_RECEIPT_BUCKET).remove([path]);
  if (error) throw error;
}

export async function createPaymentReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PAYMENT_RECEIPT_BUCKET)
    .createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

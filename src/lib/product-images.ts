import { supabase } from "@/lib/supabase";

export const PRODUCT_IMAGE_BUCKET = "product-images";

const MAX_DIMENSION = 1400;
const JPEG_QUALITY = 0.82;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "product"
  );
}

/** Downsizes a photo to a web-friendly JPEG so uploads stay quick on mobile networks. */
export async function compressImage(file: File, maxDimension = MAX_DIMENSION): Promise<Blob> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB. Use an image under 15MB.`);
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the image for upload");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress the image"))),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
  } finally {
    bitmap.close?.();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Could not read the image"));
    };
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(blob);
  });
}

export type UploadedProductImage = {
  url: string;
  /** `storage` = public Supabase URL, `inline` = compressed data URL fallback. */
  stored: "storage" | "inline";
};

/**
 * Uploads one product photo to the public `product-images` bucket.
 *
 * If the bucket or its policies are missing the upload fails; we then fall back
 * to the compressed data URL so the admin can still save the product instead of
 * losing the edit.
 */
export async function uploadProductImage(options: {
  file: File;
  productId: string;
  index: number;
}): Promise<UploadedProductImage> {
  const { file, productId, index } = options;
  const blob = await compressImage(file);
  const path = `${slug(productId)}/${Date.now()}-${index}-${slug(
    file.name.replace(/\.[^.]+$/, ""),
  )}.jpg`;

  try {
    const { error } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) throw new Error("Supabase did not return a public URL for the upload");

    return { url: data.publicUrl, stored: "storage" };
  } catch (error) {
    console.warn(
      `Could not upload ${file.name} to the ${PRODUCT_IMAGE_BUCKET} bucket. Falling back to an inline image.`,
      error,
    );
    return { url: await blobToDataUrl(blob), stored: "inline" };
  }
}

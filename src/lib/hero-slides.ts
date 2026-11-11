export const HERO_SLIDE_BUCKET = "hero-slides";
export const HERO_SLIDE_MAX_BYTES = 15 * 1024 * 1024;
export const HERO_SLIDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type HeroSlide = {
  id: string;
  image_url: string;
  storage_path: string | null;
  alt_text: string;
  sort_order: number;
  is_active: boolean;
};

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

async function getSupabase() {
  return (await import("@/lib/supabase")).supabase;
}

export function heroSlideImageError(file: { type: string; size: number }): string | null {
  if (!(HERO_SLIDE_IMAGE_TYPES as readonly string[]).includes(file.type))
    return "Choose a JPG, PNG, WebP or AVIF image.";
  if (file.size === 0) return "The selected image is empty.";
  if (file.size > HERO_SLIDE_MAX_BYTES) return "Choose an image smaller than 15 MB.";
  return null;
}

export async function fetchHeroSlides(): Promise<HeroSlide[]> {
  const supabase = await getSupabase();
  const query = supabase
    .from("hero_slides")
    .select("id, image_url, storage_path, alt_text, sort_order, is_active");

  const { data, error } = await query.order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function uploadHeroSlideImage(file: File): Promise<{ imageUrl: string; path: string }> {
  const validationError = heroSlideImageError(file);
  if (validationError) throw new Error(validationError);

  const extension = EXTENSION_BY_TYPE[file.type];
  if (!extension) throw new Error("The selected image format is not supported.");
  const key =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${key}.${extension}`;
  const supabase = await getSupabase();
  const bucket = supabase.storage.from(HERO_SLIDE_BUCKET);
  const { error } = await bucket.upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = bucket.getPublicUrl(path);
  if (!data.publicUrl) {
    const { error: cleanupError } = await bucket.remove([path]);
    if (cleanupError) {
      throw new Error(
        `Supabase did not return a public URL for the uploaded image, and cleanup failed: ${cleanupError.message}`,
      );
    }
    throw new Error("Supabase did not return a public URL for the uploaded image.");
  }
  return { imageUrl: data.publicUrl, path };
}

export async function createHeroSlide(input: {
  file: File;
  altText: string;
  sortOrder: number;
}): Promise<void> {
  const supabase = await getSupabase();
  const { imageUrl, path } = await uploadHeroSlideImage(input.file);
  const { error } = await supabase.from("hero_slides").insert({
    image_url: imageUrl,
    storage_path: path,
    alt_text: input.altText.trim(),
    sort_order: input.sortOrder,
    is_active: true,
  });

  if (!error) return;
  const { error: cleanupError } = await supabase.storage.from(HERO_SLIDE_BUCKET).remove([path]);
  if (cleanupError) {
    throw new Error(`${error.message}. The uploaded image also could not be cleaned up: ${cleanupError.message}`);
  }
  throw error;
}

export async function updateHeroSlide(
  id: string,
  changes: Partial<Pick<HeroSlide, "alt_text" | "sort_order" | "is_active">>,
): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from("hero_slides").update(changes).eq("id", id);
  if (error) throw error;
}

export async function replaceHeroSlideImage(slide: HeroSlide, file: File): Promise<void> {
  const supabase = await getSupabase();
  const { imageUrl, path } = await uploadHeroSlideImage(file);
  const { error } = await supabase
    .from("hero_slides")
    .update({ image_url: imageUrl, storage_path: path })
    .eq("id", slide.id);

  if (error) {
    const { error: cleanupError } = await supabase.storage.from(HERO_SLIDE_BUCKET).remove([path]);
    if (cleanupError) {
      throw new Error(`${error.message}. The replacement image also could not be cleaned up: ${cleanupError.message}`);
    }
    throw error;
  }

  if (slide.storage_path) {
    const { error: cleanupError } = await supabase.storage
      .from(HERO_SLIDE_BUCKET)
      .remove([slide.storage_path]);
    if (cleanupError) {
      throw new Error(`The slide image was changed, but the previous image could not be removed: ${cleanupError.message}`);
    }
  }
}

export async function deleteHeroSlide(slide: HeroSlide): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from("hero_slides").delete().eq("id", slide.id);
  if (error) throw error;

  if (slide.storage_path) {
    const { error: cleanupError } = await supabase.storage
      .from(HERO_SLIDE_BUCKET)
      .remove([slide.storage_path]);
    if (cleanupError) {
      throw new Error(`The slide was deleted, but its image could not be removed: ${cleanupError.message}`);
    }
  }
}

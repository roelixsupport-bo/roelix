export const HERO_SLIDE_BUCKET = "hero-slides";
export const HERO_SLIDE_MAX_BYTES = 15 * 1024 * 1024;
export const HERO_SLIDE_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const HERO_SLIDE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
export const HERO_SLIDE_VIDEO_TYPE = "video/mp4";

export type HeroSlideButtonPosition = "bottom-left" | "bottom-center" | "bottom-right";
export type HeroSlideMediaType = "image" | "video";

export type HeroSlideButtonSettings = {
  show_button: boolean;
  button_text_ar: string;
  button_text_en: string;
  button_url: string;
  button_position: HeroSlideButtonPosition;
};

export type HeroSlide = {
  id: string;
  media_type: HeroSlideMediaType;
  image_url: string | null;
  video_url: string | null;
  storage_path: string | null;
  alt_text: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  sort_order: number;
  is_active: boolean;
} & HeroSlideButtonSettings;

const IMAGE_EXTENSION_BY_TYPE: Record<string, string> = {
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

export function heroSlideVideoError(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (file.type !== HERO_SLIDE_VIDEO_TYPE || !file.name.toLocaleLowerCase().endsWith(".mp4"))
    return "Choose an MP4 video.";
  if (file.size === 0) return "The selected video is empty.";
  if (file.size > HERO_SLIDE_VIDEO_MAX_BYTES) return "Choose a video smaller than 50 MB.";
  return null;
}

function createStoragePath(extension: string): string {
  const key =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${key}.${extension}`;
}

async function uploadHeroSlideAsset(
  file: File,
  contentType: string,
  extension: string,
): Promise<{ mediaUrl: string; path: string }> {
  const path = createStoragePath(extension);
  const supabase = await getSupabase();
  const bucket = supabase.storage.from(HERO_SLIDE_BUCKET);
  const { error } = await bucket.upload(path, file, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = bucket.getPublicUrl(path);
  if (!data.publicUrl) {
    const { error: cleanupError } = await bucket.remove([path]);
    if (cleanupError) {
      throw new Error(
        `Supabase did not return a public URL for the uploaded media, and cleanup failed: ${cleanupError.message}`,
      );
    }
    throw new Error("Supabase did not return a public URL for the uploaded media.");
  }
  return { mediaUrl: data.publicUrl, path };
}

export async function fetchHeroSlides(): Promise<HeroSlide[]> {
  const supabase = await getSupabase();
  const query = supabase
    .from("hero_slides")
    .select(
      "id, media_type, image_url, video_url, storage_path, alt_text, title_ar, title_en, description_ar, description_en, sort_order, is_active, show_button, button_text_ar, button_text_en, button_url, button_position",
    );

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function uploadHeroSlideImage(
  file: File,
): Promise<{ imageUrl: string; path: string }> {
  const validationError = heroSlideImageError(file);
  if (validationError) throw new Error(validationError);

  const extension = IMAGE_EXTENSION_BY_TYPE[file.type];
  if (!extension) throw new Error("The selected image format is not supported.");
  const result = await uploadHeroSlideAsset(file, file.type, extension);
  return { imageUrl: result.mediaUrl, path: result.path };
}

export async function uploadHeroSlideVideo(
  file: File,
): Promise<{ videoUrl: string; path: string }> {
  const validationError = heroSlideVideoError(file);
  if (validationError) throw new Error(validationError);
  const result = await uploadHeroSlideAsset(file, HERO_SLIDE_VIDEO_TYPE, "mp4");
  return { videoUrl: result.mediaUrl, path: result.path };
}

export async function createHeroSlide(input: {
  mediaType: HeroSlideMediaType;
  file: File | null;
  videoUrl: string;
  altText: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  sortOrder: number;
  button: HeroSlideButtonSettings;
}): Promise<void> {
  const supabase = await getSupabase();
  let imageUrl: string | null = null;
  let videoUrl: string | null = null;
  let path: string | null = null;
  if (input.mediaType === "image") {
    if (!input.file) throw new Error("Choose an image before adding a slide.");
    const uploaded = await uploadHeroSlideImage(input.file);
    imageUrl = uploaded.imageUrl;
    path = uploaded.path;
  } else if (input.file) {
    const uploaded = await uploadHeroSlideVideo(input.file);
    videoUrl = uploaded.videoUrl;
    path = uploaded.path;
  } else {
    videoUrl = input.videoUrl.trim();
  }

  const { error } = await supabase.from("hero_slides").insert({
    media_type: input.mediaType,
    image_url: imageUrl,
    video_url: videoUrl,
    storage_path: path,
    alt_text: input.altText.trim(),
    title_ar: input.titleAr.trim(),
    title_en: input.titleEn.trim(),
    description_ar: input.descriptionAr.trim(),
    description_en: input.descriptionEn.trim(),
    sort_order: input.sortOrder,
    is_active: true,
    ...input.button,
  });

  if (!error) return;
  if (path) {
    const { error: cleanupError } = await supabase.storage.from(HERO_SLIDE_BUCKET).remove([path]);
    if (cleanupError) {
      throw new Error(
        `${error.message}. The uploaded media also could not be cleaned up: ${cleanupError.message}`,
      );
    }
  }
  throw error;
}

export async function updateHeroSlide(
  id: string,
  changes: Partial<
    Pick<
      HeroSlide,
      | "alt_text"
      | "media_type"
      | "image_url"
      | "video_url"
      | "title_ar"
      | "title_en"
      | "description_ar"
      | "description_en"
      | "sort_order"
      | "is_active"
      | "show_button"
      | "button_text_ar"
      | "button_text_en"
      | "button_url"
      | "button_position"
    >
  >,
): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from("hero_slides").update(changes).eq("id", id);
  if (error) throw error;
}

export async function replaceHeroSlideMedia(
  slide: HeroSlide,
  mediaType: HeroSlideMediaType,
  file: File,
): Promise<void> {
  const supabase = await getSupabase();
  let uploadedPath: string;
  let changes: {
    media_type: HeroSlideMediaType;
    image_url: string | null;
    video_url: string | null;
    storage_path: string;
  };
  if (mediaType === "image") {
    const imageUpload = await uploadHeroSlideImage(file);
    uploadedPath = imageUpload.path;
    changes = {
      media_type: mediaType,
      image_url: imageUpload.imageUrl,
      video_url: null,
      storage_path: imageUpload.path,
    };
  } else {
    const videoUpload = await uploadHeroSlideVideo(file);
    uploadedPath = videoUpload.path;
    changes = {
      media_type: mediaType,
      image_url: null,
      video_url: videoUpload.videoUrl,
      storage_path: videoUpload.path,
    };
  }
  const { error } = await supabase.from("hero_slides").update(changes).eq("id", slide.id);

  if (error) {
    const { error: cleanupError } = await supabase.storage
      .from(HERO_SLIDE_BUCKET)
      .remove([uploadedPath]);
    if (cleanupError) {
      throw new Error(
        `${error.message}. The replacement media also could not be cleaned up: ${cleanupError.message}`,
      );
    }
    throw error;
  }

  await removePreviousHeroSlideAsset(slide.storage_path, `The slide ${mediaType}`);
}

export async function setHeroSlideVideoUrl(
  slide: HeroSlide,
  videoUrl: string,
  changes: Partial<
    Pick<
      HeroSlide,
      | "alt_text"
      | "title_ar"
      | "title_en"
      | "description_ar"
      | "description_en"
      | "sort_order"
      | "is_active"
      | keyof HeroSlideButtonSettings
    >
  > = {},
): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("hero_slides")
    .update({
      ...changes,
      media_type: "video",
      image_url: null,
      video_url: videoUrl.trim(),
      storage_path: null,
    })
    .eq("id", slide.id);
  if (error) throw error;

  await removePreviousHeroSlideAsset(slide.storage_path, "The slide video");
}

async function removePreviousHeroSlideAsset(
  path: string | null,
  description: string,
): Promise<void> {
  if (!path) return;
  const supabase = await getSupabase();
  const { error } = await supabase.storage.from(HERO_SLIDE_BUCKET).remove([path]);
  if (error) {
    throw new Error(
      `${description} was changed, but its previous media could not be removed: ${error.message}`,
    );
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
      throw new Error(
        `The slide was deleted, but its media could not be removed: ${cleanupError.message}`,
      );
    }
  }
}

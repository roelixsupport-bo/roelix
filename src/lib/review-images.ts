/**
 * Customer photos for reviews.
 *
 * The rules live here rather than in the form so the same limits apply to a
 * dragged file, a pasted one and anything the browser reports oddly. Validation
 * is pure and unit tested; only `uploadReviewImage` touches the network.
 */

export const REVIEW_BUCKET = "review-images";
export const REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Formats every browser can display without a conversion step. */
export const REVIEW_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const REVIEW_IMAGE_LIMIT_KEYS = ["tooLarge", "wrongType"] as const;

export type ReviewImageLimit = (typeof REVIEW_IMAGE_LIMIT_KEYS)[number];

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Which limit the file breaks, or null when it can be uploaded. */
export function reviewImageLimit(file: { type: string; size: number }): ReviewImageLimit | null {
  if (!(REVIEW_IMAGE_TYPES as readonly string[]).includes(file.type)) return "wrongType";
  if (file.size > REVIEW_IMAGE_MAX_BYTES) return "tooLarge";
  if (file.size === 0) return "wrongType";
  return null;
}

/** File extension for the storage key; falls back to the file name, then jpg. */
export function reviewImageExtension(file: { type?: string; name?: string }): string {
  const byType = EXTENSION_BY_TYPE[(file.type ?? "").toLowerCase()];
  if (byType) return byType;

  const byName = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";
  return byName === "png" || byName === "webp" || byName === "jpg" || byName === "jpeg"
    ? byName === "jpeg"
      ? "jpg"
      : byName
    : "jpg";
}

/**
 * `<user-id>/<key>.<ext>` — the storage policy reads the first segment and
 * rejects anything that is not the uploader's own id.
 */
export function reviewImagePath(userId: string, key: string, extension: string): string {
  return `${userId}/${key}.${extension}`;
}

export type SupabaseStorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File,
        options?: { cacheControl?: string; upsert?: boolean; contentType?: string },
      ) => Promise<{ error: { message?: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

/**
 * How long an upload may take before the form gives up on the photo.
 *
 * Review images may be uploaded over a slow mobile connection, so give the
 * Storage request enough time while still preventing the form from hanging.
 */
export const REVIEW_UPLOAD_TIMEOUT_MS = 60_000;

/** Rejects with `message` when `work` has not settled within `ms`. */
export async function withDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Uploads one review photo and returns its public URL.
 *
 * Throws with a sentence the form can show, and never hangs: the caller treats a
 * failure as "send the review without the photo" rather than as a dead end.
 */
export async function uploadReviewImage(
  file: File,
  userId: string,
  { timeoutMs = REVIEW_UPLOAD_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<string> {
  const limit = reviewImageLimit(file);
  if (limit)
    throw new Error(
      limit === "tooLarge" ? "The photo is larger than 5 MB." : "Choose a JPG, PNG or WebP photo.",
    );
  if (!userId) throw new Error("Sign in again to add a photo.");

  const { supabase } = await import("@/lib/supabase");
  const client = supabase as unknown as SupabaseStorageClient;
  const bucket = client.storage.from(REVIEW_BUCKET);

  const key =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const path = reviewImagePath(userId, key, reviewImageExtension(file));

  const { error } = await withDeadline(
    bucket.upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    }),
    timeoutMs,
    "The photo upload timed out.",
  );
  if (error) {
    throw new Error(
      error.message
        ? `The photo could not be uploaded: ${error.message}`
        : "The photo could not be uploaded. Try a smaller file.",
    );
  }

  const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
  if (!/^https?:\/\//i.test(publicUrl)) {
    throw new Error("The uploaded photo did not return a valid public URL.");
  }
  return publicUrl;
}

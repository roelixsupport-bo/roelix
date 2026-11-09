import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  REVIEW_UPLOAD_TIMEOUT_MS,
  reviewImageExtension,
  reviewImageLimit,
  reviewImagePath,
  uploadReviewImage,
  withDeadline,
} from "@/lib/review-images";

/**
 * Storage has no default deadline, which is exactly how a photo upload used to
 * hang the review form: the customer waited on "Sending…" and the review never
 * left the page. These tests pin the timeout and the shape of the failure.
 */
let uploadResult: { error: { message?: string } | null } = { error: null };
let uploadCalls: Array<{ path: string; options?: unknown }> = [];
let uploadBehaviour: "resolve" | "hang" = "resolve";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string, _file: File, options?: unknown) => {
          uploadCalls.push({ path, options });
          if (uploadBehaviour === "hang") return new Promise<never>(() => {});
          return Promise.resolve(uploadResult);
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.example.test/review-images/${path}` },
        }),
      }),
    },
  },
  healStaleSession: async () => false,
}));

const photo = () => new File([new Uint8Array(64)], "piece.jpg", { type: "image/jpeg" });

beforeEach(() => {
  uploadCalls = [];
  uploadResult = { error: null };
  uploadBehaviour = "resolve";
});

describe("review photo rules", () => {
  it("accepts the three formats the browser can display", () => {
    expect(reviewImageLimit({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(reviewImageLimit({ type: "image/png", size: 1024 })).toBeNull();
    expect(reviewImageLimit({ type: "image/webp", size: 1024 })).toBeNull();
  });

  it("rejects oversized, unsupported and empty files", () => {
    expect(reviewImageLimit({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toBe("tooLarge");
    expect(reviewImageLimit({ type: "image/gif", size: 1024 })).toBe("wrongType");
    expect(reviewImageLimit({ type: "image/png", size: 0 })).toBe("wrongType");
  });

  it("names the storage object after the uploader", () => {
    expect(reviewImagePath("user-1", "abc", "png")).toBe("user-1/abc.png");
    expect(reviewImageExtension({ type: "image/webp" })).toBe("webp");
    expect(reviewImageExtension({ name: "piece.JPEG" })).toBe("jpg");
  });
});

describe("photo upload", () => {
  it("allows enough time for a slow mobile upload", () => {
    expect(REVIEW_UPLOAD_TIMEOUT_MS).toBe(60_000);
  });

  it("returns the public URL of the uploaded file", async () => {
    await expect(uploadReviewImage(photo(), "user-1")).resolves.toMatch(
      /^https:\/\/cdn\.example\.test\/review-images\/user-1\/.+\.jpg$/,
    );
    expect(uploadCalls).toHaveLength(1);
  });

  it("gives up instead of hanging when storage never answers", async () => {
    uploadBehaviour = "hang";

    await expect(uploadReviewImage(photo(), "user-1", { timeoutMs: 30 })).rejects.toThrow(
      /timed out/i,
    );
  });

  it("surfaces a storage refusal with a readable sentence", async () => {
    uploadResult = { error: { message: "new row violates row-level security policy" } };

    await expect(uploadReviewImage(photo(), "user-1")).rejects.toThrow(
      /could not be uploaded: new row violates/i,
    );
  });

  it("refuses before touching the network when the file is invalid", async () => {
    const huge = new File([new Uint8Array(8)], "big.png", { type: "image/png" });
    Object.defineProperty(huge, "size", { value: 9 * 1024 * 1024 });

    await expect(uploadReviewImage(huge, "user-1")).rejects.toThrow(/larger than 5 MB/i);
    expect(uploadCalls).toHaveLength(0);
  });
});

describe("withDeadline", () => {
  it("passes a settled value straight through", async () => {
    await expect(withDeadline(Promise.resolve("ok"), 50, "timed out")).resolves.toBe("ok");
  });

  it("rejects with the supplied message when the work is still running", async () => {
    await expect(withDeadline(new Promise(() => {}), 25, "The upload timed out.")).rejects.toThrow(
      "The upload timed out.",
    );
  });
});

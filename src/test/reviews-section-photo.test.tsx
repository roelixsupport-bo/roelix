import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewsSection, type ReviewSubmission } from "@/components/product/reviews-section";
import { summarizeReviews, type ProductReview } from "@/lib/reviews";
import { uploadReviewImage } from "@/lib/review-images";

/**
 * The reported bug: attaching a photo stopped the review from being sent while
 * the upload sat there. The photo is now optional — a failed or stalled upload
 * must still save the review, with a note explaining the missing photo.
 */
vi.mock("@/lib/review-images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/review-images")>();
  return {
    ...actual,
    uploadReviewImage: vi.fn(async () => {
      throw new Error("The photo upload timed out.");
    }),
  };
});

const stored: ProductReview[] = [
  {
    id: "r1",
    productId: "aurelia-sateen",
    authorName: "Nour",
    rating: 4,
    body: "Cool and weighty.",
    status: "published",
    createdAt: "2026-10-01T10:00:00.000Z",
    authorId: null,
    imageUrl: null,
  },
];

const VIEWER = { id: "user-1", name: "Nour" };

function typeInto(element: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("review form with a broken photo upload", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    root = undefined;
  });

  it("still sends the review, without the photo, and says so", async () => {
    const onSubmit = vi.fn(async (_input: ReviewSubmission) => stored[0] ?? null);

    root = createRoot(container);
    await act(async () => {
      root?.render(
        <ReviewsSection
          isArabic={false}
          reviews={stored}
          summary={summarizeReviews(stored)}
          loading={false}
          submitting={false}
          viewer={VIEWER}
          onRequestSignIn={() => {}}
          onSubmit={onSubmit}
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input).not.toBeNull();
    const photo = new File([new Uint8Array(8)], "piece.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [photo], configurable: true });

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const body = container.querySelector<HTMLTextAreaElement>("#review-body")!;
    const stars = Array.from(container.querySelectorAll('[role="radio"]'));
    await act(async () => {
      typeInto(body, "The sateen is cool to the touch.");
      (stars[4] as HTMLButtonElement).click();
    });

    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      rating: 5,
      imageUrl: null,
      authorId: "user-1",
    });
    expect(container.textContent).toContain("Your review was sent without the photo");
    // The draft is cleared, so the customer is not left re-sending it.
    expect(body.value).toBe("");
  });
});

describe("review form with a successful photo upload", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    vi.mocked(uploadReviewImage).mockResolvedValue(
      "https://cdn.example.test/review-images/user-1/photo.jpg",
    );
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    root = undefined;
    vi.mocked(uploadReviewImage).mockReset();
  });

  it("waits for the upload and submits its public URL with the review", async () => {
    const onSubmit = vi.fn(async (_input: ReviewSubmission) => stored[0] ?? null);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <ReviewsSection
          isArabic={false}
          reviews={stored}
          summary={summarizeReviews(stored)}
          loading={false}
          submitting={false}
          viewer={VIEWER}
          onRequestSignIn={() => {}}
          onSubmit={onSubmit}
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const photo = new File([new Uint8Array(8)], "piece.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [photo], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const body = container.querySelector<HTMLTextAreaElement>("#review-body")!;
    const stars = Array.from(container.querySelectorAll('[role="radio"]'));
    await act(async () => {
      typeInto(body, "The sateen is cool to the touch.");
      (stars[4] as HTMLButtonElement).click();
    });

    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(uploadReviewImage).toHaveBeenCalledWith(photo, VIEWER.id);
    expect(onSubmit).toHaveBeenCalledWith({
      authorName: VIEWER.name,
      rating: 5,
      body: "The sateen is cool to the touch.",
      authorId: VIEWER.id,
      imageUrl: "https://cdn.example.test/review-images/user-1/photo.jpg",
    });
    expect(uploadReviewImage.mock.invocationCallOrder[0]).toBeLessThan(
      onSubmit.mock.invocationCallOrder[0]!,
    );
  });
});

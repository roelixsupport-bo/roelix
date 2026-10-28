import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewsSection } from "@/components/product/reviews-section";
import { summarizeReviews, type ProductReview } from "@/lib/reviews";

const stored: ProductReview[] = [
  {
    id: "r1",
    productId: "aurelia-sateen",
    authorName: "Nour",
    rating: 4,
    body: "Cool and weighty, exactly as described.",
    status: "published",
    createdAt: "2026-10-01T10:00:00.000Z",
  },
];

/** React tracks its own value, so set it through the native setter before dispatching. */
function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("reviews section", () => {
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

  async function render(onSubmit = vi.fn(async () => stored[0] ?? null)) {
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <ReviewsSection
          isArabic={false}
          reviews={stored}
          summary={summarizeReviews(stored)}
          loading={false}
          submitting={false}
          onSubmit={onSubmit}
        />,
      );
    });
    return onSubmit;
  }

  const form = () => container.querySelector("form") as HTMLFormElement;
  const submit = async () =>
    act(async () => {
      form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

  it("renders the average, the count and existing reviews", async () => {
    await render();

    expect(container.textContent).toContain("4.0");
    expect(container.textContent).toContain("1 review");
    expect(container.textContent).toContain("Nour");
    expect(container.textContent).toContain("Cool and weighty, exactly as described.");
  });

  it("blocks a submission with no rating and no name", async () => {
    const onSubmit = await render();

    await submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Enter a name between 2 and 60 characters.",
    );
  });

  it("submits a complete review and clears the form", async () => {
    const onSubmit = await render();
    const name = container.querySelector<HTMLInputElement>("#review-author")!;
    const body = container.querySelector<HTMLTextAreaElement>("#review-body")!;
    const stars = Array.from(container.querySelectorAll('[role="radio"]'));

    await act(async () => {
      typeInto(name, "Hana");
      typeInto(body, "The sateen is genuinely cool to the touch.");
      (stars[4] as HTMLButtonElement).click();
    });

    await submit();

    expect(onSubmit).toHaveBeenCalledWith({
      authorName: "Hana",
      rating: 5,
      body: "The sateen is genuinely cool to the touch.",
    });
    expect(name.value).toBe("");
    expect(body.value).toBe("");
  });
});

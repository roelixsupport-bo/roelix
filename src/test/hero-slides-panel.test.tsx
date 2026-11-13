import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeroSlidesPanel } from "@/components/admin/hero-slides-panel";
import { createHeroSlide, fetchHeroSlides } from "@/lib/hero-slides";

vi.mock("@/lib/hero-slides", () => ({
  createHeroSlide: vi.fn().mockResolvedValue(undefined),
  deleteHeroSlide: vi.fn().mockResolvedValue(undefined),
  fetchHeroSlides: vi.fn().mockResolvedValue([]),
  replaceHeroSlideImage: vi.fn().mockResolvedValue(undefined),
  updateHeroSlide: vi.fn().mockResolvedValue(undefined),
}));

describe("hero slides admin panel", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.clearAllMocks();
  });

  it("hydrates with the same loading markup when the browser language differs", async () => {
    vi.mocked(fetchHeroSlides).mockResolvedValue([]);
    container = document.createElement("div");
    container.innerHTML = renderToString(<HeroSlidesPanel isArabic={false} />);
    document.body.append(container);
    const recoverableErrors: unknown[] = [];

    await act(async () => {
      root = hydrateRoot(container!, <HeroSlidesPanel isArabic />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    expect(recoverableErrors).toEqual([]);
    expect(container).toHaveTextContent("سلايدر الواجهة الرئيسية");
  });

  it("creates a slide after loading and selecting an image", async () => {
    vi.mocked(fetchHeroSlides).mockResolvedValue([]);
    container = document.createElement("div");
    container.innerHTML = renderToString(<HeroSlidesPanel isArabic={false} />);
    document.body.append(container);
    root = hydrateRoot(container, <HeroSlidesPanel isArabic={false} />);

    await act(async () => {});

    const file = new File(["image"], "hero.webp", { type: "image/webp" });
    const fileInput = container.querySelector('input[type="file"]');
    const altInput = container.querySelector('input[type="text"]');
    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Add slide"),
    );

    expect(fileInput).not.toBeNull();
    expect(altInput).not.toBeNull();
    expect(addButton).not.toBeNull();

    await act(async () => {
      fireEvent.change(fileInput!, { target: { files: [file] } });
      fireEvent.change(altInput!, { target: { value: "A hero image" } });
    });

    await act(async () => {
      addButton?.click();
    });

    expect(createHeroSlide).toHaveBeenCalledWith({
      file,
      altText: "A hero image",
      sortOrder: 0,
    });
  });
});

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
  replaceHeroSlideMedia: vi.fn().mockResolvedValue(undefined),
  setHeroSlideVideoUrl: vi.fn().mockResolvedValue(undefined),
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
    const showButtonInput = getLabeledInput(container, "Show button", 'input[type="checkbox"]');
    const buttonTextEnInput = getLabeledInput(
      container,
      "Button text (English)",
      'input[type="text"]',
    );
    const buttonTextArInput = getLabeledInput(
      container,
      "Button text (Arabic)",
      'input[type="text"]',
    );
    const buttonUrlInput = getLabeledInput(
      container,
      "Button destination URL",
      'input[type="url"]',
    );
    const positionInput = getLabeledInput(container, "Button position", "select");
    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Add slide"),
    );

    expect(fileInput).not.toBeNull();
    expect(altInput).not.toBeNull();
    expect(addButton).not.toBeNull();

    await act(async () => {
      fireEvent.change(fileInput!, { target: { files: [file] } });
      fireEvent.change(altInput!, { target: { value: "A hero image" } });
      fireEvent.click(showButtonInput!);
      fireEvent.change(buttonTextEnInput, { target: { value: "Shop now" } });
      fireEvent.change(buttonTextArInput, { target: { value: "تسوقي الآن" } });
      fireEvent.change(buttonUrlInput!, { target: { value: "/shop" } });
      fireEvent.change(positionInput!, { target: { value: "bottom-right" } });
    });

    await act(async () => {
      addButton?.click();
    });

    expect(createHeroSlide).toHaveBeenCalledWith({
      mediaType: "image",
      file,
      videoUrl: "",
      altText: "A hero image",
      titleAr: "",
      titleEn: "",
      descriptionAr: "",
      descriptionEn: "",
      sortOrder: 0,
      button: {
        show_button: true,
        button_text_en: "Shop now",
        button_text_ar: "تسوقي الآن",
        button_url: "/shop",
        button_position: "bottom-right",
      },
    });
  });

  it("adds a video slide from an MP4 URL with independent text and CTA", async () => {
    vi.mocked(fetchHeroSlides).mockResolvedValue([]);
    container = document.createElement("div");
    container.innerHTML = renderToString(<HeroSlidesPanel isArabic={false} />);
    document.body.append(container);
    root = hydrateRoot(container, <HeroSlidesPanel isArabic={false} />);

    await act(async () => {});

    const mediaTypeInput = getLabeledInput(container, "Slide media", "select");
    await act(async () => {
      fireEvent.change(mediaTypeInput, { target: { value: "video" } });
    });

    const videoUrlInput = getLabeledInput(container, "Video URL (HTTPS)", 'input[type="url"]');
    const altInput = getLabeledInput(container, "Image description", 'input[type="text"]');
    const titleEnInput = getLabeledInput(container, "Title (English)", 'input[type="text"]');
    const titleArInput = getLabeledInput(container, "Title (Arabic)", 'input[type="text"]');
    const descriptionEnInput = getLabeledInput(container, "Description (English)", "textarea");
    const descriptionArInput = getLabeledInput(container, "Description (Arabic)", "textarea");
    const buttonTextEnInput = getLabeledInput(
      container,
      "Button text (English)",
      'input[type="text"]',
    );
    const buttonTextArInput = getLabeledInput(
      container,
      "Button text (Arabic)",
      'input[type="text"]',
    );
    const buttonUrlInput = getLabeledInput(
      container,
      "Button destination URL",
      'input[type="url"]',
    );
    const showButtonInput = getLabeledInput(container, "Show button", 'input[type="checkbox"]');
    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Add slide"),
    );

    await act(async () => {
      fireEvent.change(videoUrlInput, {
        target: { value: "https://cdn.example.com/hero.mp4" },
      });
      fireEvent.change(altInput, { target: { value: "A short hero video" } });
      fireEvent.change(titleEnInput, { target: { value: "Sleep better" } });
      fireEvent.change(titleArInput, { target: { value: "نوم أفضل" } });
      fireEvent.change(descriptionEnInput, { target: { value: "Discover our collection" } });
      fireEvent.change(descriptionArInput, { target: { value: "اكتشف مجموعتنا" } });
      fireEvent.click(showButtonInput);
      fireEvent.change(buttonTextEnInput, { target: { value: "Shop now" } });
      fireEvent.change(buttonTextArInput, { target: { value: "تسوق الآن" } });
      fireEvent.change(buttonUrlInput, { target: { value: "/collections/bedding" } });
      addButton?.click();
    });

    expect(createHeroSlide).toHaveBeenCalledWith({
      mediaType: "video",
      file: null,
      videoUrl: "https://cdn.example.com/hero.mp4",
      altText: "A short hero video",
      titleAr: "نوم أفضل",
      titleEn: "Sleep better",
      descriptionAr: "اكتشف مجموعتنا",
      descriptionEn: "Discover our collection",
      sortOrder: 0,
      button: {
        show_button: true,
        button_text_ar: "تسوق الآن",
        button_text_en: "Shop now",
        button_url: "/collections/bedding",
        button_position: "bottom-center",
      },
    });
  });
});

function getLabeledInput(
  root: HTMLElement,
  labelText: string,
  selector: string,
): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const label = Array.from(root.querySelectorAll("label")).find((item) =>
    item.textContent?.includes(labelText),
  );
  const field = label?.querySelector(selector);
  if (!field) throw new Error(`Could not find ${labelText} field`);
  return field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
}

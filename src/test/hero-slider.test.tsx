import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HeroSlider } from "@/components/site/hero-slider";
import { fetchHeroSlides } from "@/lib/hero-slides";

vi.mock("@/lib/hero-slides", () => ({
  fetchHeroSlides: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/store", () => ({
  CATEGORIES: [],
  useStore: vi.fn(() => ({ lang: "en" })),
}));

describe("hero image slider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fetchHeroSlides).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("fades to the next image every four and a half seconds", async () => {
    const { container } = render(<HeroSlider />);
    const [firstSlide, secondSlide] = container.querySelectorAll(".hero-slide");
    expect(firstSlide).toHaveAttribute("aria-hidden", "false");
    expect(secondSlide).toHaveAttribute("aria-hidden", "true");

    await act(async () => {
      vi.advanceTimersByTime(4_500);
    });

    expect(firstSlide).toHaveAttribute("aria-hidden", "true");
    expect(secondSlide).toHaveAttribute("aria-hidden", "false");
  });

  it("lets visitors select a slide directly", () => {
    render(<HeroSlider />);

    const thirdSlideButton = screen.getByRole("button", {
      name: "Show image 3: A plush pillow crafted for a restful night's sleep",
    });
    fireEvent.click(thirdSlideButton);

    expect(thirdSlideButton).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("img", { name: "A plush pillow crafted for a restful night's sleep" }),
    ).toHaveAttribute("aria-hidden", "false");
  });

  it("uses active slides managed from the dashboard", async () => {
    vi.useRealTimers();
    vi.mocked(fetchHeroSlides).mockResolvedValue([
      {
        id: "managed-slide",
        media_type: "image",
        image_url: "https://example.supabase.co/storage/hero.jpg",
        video_url: null,
        storage_path: "hero.jpg",
        alt_text: "A managed hero image",
        title_ar: "صورة مميزة",
        title_en: "Featured image",
        description_ar: "وصف الصورة",
        description_en: "Image description",
        sort_order: 0,
        is_active: true,
        show_button: true,
        button_text_ar: "تسوقي الآن",
        button_text_en: "Shop this collection",
        button_url: "/shop",
        button_position: "bottom-right",
      },
    ]);

    render(<HeroSlider />);

    expect(await screen.findByRole("img", { name: "A managed hero image" })).toHaveAttribute(
      "src",
      "https://example.supabase.co/storage/hero.jpg",
    );
    expect(screen.getByRole("heading", { name: "Featured image" })).toBeInTheDocument();
    expect(screen.getByText("Image description")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    const button = screen.getByRole("link", { name: "Shop this collection" });
    expect(button).toHaveAttribute("href", "/shop");
    expect(button).toHaveClass("luxury-rounded", "rounded-full");
  });

  it("shows the button only for the currently selected slide", async () => {
    vi.useRealTimers();
    vi.mocked(fetchHeroSlides).mockResolvedValue([
      {
        id: "with-button",
        media_type: "image",
        image_url: "https://example.supabase.co/storage/hero-one.jpg",
        video_url: null,
        storage_path: "hero-one.jpg",
        alt_text: "Slide with a button",
        title_ar: "",
        title_en: "",
        description_ar: "",
        description_en: "",
        sort_order: 0,
        is_active: true,
        show_button: true,
        button_text_ar: "تسوقي",
        button_text_en: "Shop now",
        button_url: "/shop",
        button_position: "bottom-left",
      },
      {
        id: "without-button",
        media_type: "image",
        image_url: "https://example.supabase.co/storage/hero-two.jpg",
        video_url: null,
        storage_path: "hero-two.jpg",
        alt_text: "Slide without a button",
        title_ar: "",
        title_en: "",
        description_ar: "",
        description_en: "",
        sort_order: 1,
        is_active: true,
        show_button: false,
        button_text_ar: "",
        button_text_en: "",
        button_url: "",
        button_position: "bottom-center",
      },
    ]);

    render(<HeroSlider />);
    expect(await screen.findByRole("link", { name: "Shop now" })).toHaveAttribute("href", "/shop");

    fireEvent.click(screen.getByRole("button", { name: "Show image 2: Slide without a button" }));
    expect(screen.queryByRole("link", { name: "Shop now" })).not.toBeInTheDocument();
  });

  it("autoplays a managed video with its own bilingual copy and CTA", async () => {
    vi.useRealTimers();
    vi.mocked(fetchHeroSlides).mockResolvedValue([
      {
        id: "video-slide",
        media_type: "video",
        image_url: null,
        video_url: "https://example.supabase.co/storage/hero.mp4",
        storage_path: "hero.mp4",
        alt_text: "Video preview",
        title_ar: "راحة متحركة",
        title_en: "Comfort in motion",
        description_ar: "فيديو تعريفي",
        description_en: "A short introduction",
        sort_order: 0,
        is_active: true,
        show_button: true,
        button_text_ar: "تسوق الآن",
        button_text_en: "Shop now",
        button_url: "/collections/bedding",
        button_position: "bottom-center",
      },
    ]);

    const { container } = render(<HeroSlider />);

    const video = await screen.findByLabelText("Video preview");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", "https://example.supabase.co/storage/hero.mp4");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(screen.getByRole("heading", { name: "Comfort in motion" })).toBeInTheDocument();
    expect(screen.getByText("A short introduction")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop now" })).toHaveAttribute(
      "href",
      "/collections/bedding",
    );
    expect(container.querySelector(".hero-slide-active")).toBe(video);
  });

  it("uses the editable storefront heading and button on built-in slides", () => {
    render(
      <HeroSlider
        content={{
          visible: true,
          title_en: "Rest, refined",
          title_ar: "راحة راقية",
          description_en: "A considered layer of comfort.",
          description_ar: "راحة صُممت بعناية.",
          cta_text_en: "Explore bedding",
          cta_text_ar: "اكتشف المفروشات",
          cta_url: "/shop",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Rest, refined" })).toBeInTheDocument();
    expect(screen.getByText("A considered layer of comfort.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore bedding" })).toHaveAttribute("href", "/shop");
  });
});

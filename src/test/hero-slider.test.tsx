import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HeroSlider } from "@/components/site/hero-slider";
import { fetchHeroSlides } from "@/lib/hero-slides";

vi.mock("@/lib/hero-slides", () => ({
  fetchHeroSlides: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/store", () => ({
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

  it("uses active images managed from the dashboard", async () => {
    vi.useRealTimers();
    vi.mocked(fetchHeroSlides).mockResolvedValue([
      {
        id: "managed-slide",
        image_url: "https://example.supabase.co/storage/hero.jpg",
        storage_path: "hero.jpg",
        alt_text: "A managed hero image",
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
    expect(screen.getAllByRole("img")).toHaveLength(1);
    const button = screen.getByRole("link", { name: "Shop this collection" });
    expect(button).toHaveAttribute("href", "/shop");
    expect(button).toHaveClass("right-4", "sm:right-8");
  });

  it("shows the button only for the currently selected slide", async () => {
    vi.useRealTimers();
    vi.mocked(fetchHeroSlides).mockResolvedValue([
      {
        id: "with-button",
        image_url: "https://example.supabase.co/storage/hero-one.jpg",
        storage_path: "hero-one.jpg",
        alt_text: "Slide with a button",
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
        image_url: "https://example.supabase.co/storage/hero-two.jpg",
        storage_path: "hero-two.jpg",
        alt_text: "Slide without a button",
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
});

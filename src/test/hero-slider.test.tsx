import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { HeroSlider } from "@/components/site/hero-slider";
import { fetchHeroSlides } from "@/lib/hero-slides";

const mocks = vi.hoisted(() => ({
  settings: null as {
    cta_enabled: boolean;
    cta_label_en: string;
    cta_label_ar: string;
    cta_url: string;
  } | null,
}));

vi.mock("@/lib/hero-slides", () => ({
  fetchHeroSlides: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/site-settings", () => ({
  useSiteSettings: vi.fn(() => ({ settings: mocks.settings })),
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
    mocks.settings = null;
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
      },
    ]);

    render(<HeroSlider />);

    expect(await screen.findByRole("img", { name: "A managed hero image" })).toHaveAttribute(
      "src",
      "https://example.supabase.co/storage/hero.jpg",
    );
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("shows a configured hero call-to-action only when enabled", () => {
    mocks.settings = {
      cta_enabled: true,
      cta_label_en: "Build a set",
      cta_label_ar: "صمم طقماً",
      cta_url: "/custom-set",
    };

    render(<HeroSlider />);

    expect(screen.getByRole("link", { name: "Build a set" })).toHaveAttribute(
      "href",
      "/custom-set",
    );
  });
});

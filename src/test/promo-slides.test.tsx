import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PromoSlidesPanel } from "@/components/admin/promo-slides-panel";
import { PromoBanner } from "@/components/site/promo-banner";
import {
  createPromoSlide,
  deletePromoSlide,
  fetchPromoSlides,
  isAllowedPromoUrl,
  updatePromoSlide,
} from "@/lib/promo-slides";

const mocks = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  rows: [
    {
      id: "promo-1",
      message_en: "Free delivery this week",
      message_ar: "توصيل مجاني هذا الأسبوع",
      target_url: "/shop",
      sort_order: 0,
      is_active: true,
      created_at: "2026-11-13T00:00:00Z",
    },
  ],
}));

vi.mock("@/lib/promo-slides", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/promo-slides")>();
  return {
    ...actual,
    createPromoSlide: vi.fn().mockResolvedValue(undefined),
    deletePromoSlide: vi.fn().mockResolvedValue(undefined),
    fetchPromoSlides: vi.fn(async () => mocks.rows),
    updatePromoSlide: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/store", () => ({
  useStore: vi.fn(() => ({
    lang: mocks.lang,
    t: { announce: "Premium nationwide delivery" },
  })),
}));

describe("promotional slides", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("only accepts HTTPS or same-site paths for promotions and the hero CTA", () => {
    expect(isAllowedPromoUrl("https://example.test/sale")).toBe(true);
    expect(isAllowedPromoUrl("/shop")).toBe(true);
    expect(isAllowedPromoUrl("//example.test/sale")).toBe(false);
    expect(isAllowedPromoUrl("javascript:alert(1)")).toBe(false);
  });

  it("shows a bilingual active promotion as a clickable top banner", async () => {
    mocks.lang = "ar";
    render(<PromoBanner />);

    const promotion = await screen.findByRole("link", { name: "توصيل مجاني هذا الأسبوع" });
    expect(promotion).toHaveAttribute("href", "/shop");
    expect(promotion.querySelector("span")).toHaveClass("promo-banner-message");
    expect(fetchPromoSlides).toHaveBeenCalledWith(true);
  });

  it("keeps navigation arrows beside the announcement text", async () => {
    const originalRows = mocks.rows;
    mocks.lang = "en";
    mocks.rows = [
      ...originalRows,
      {
        ...originalRows[0]!,
        id: "promo-2",
        message_en: "Second promotion",
        message_ar: "الإعلان الثاني",
        sort_order: 1,
      },
    ];
    render(<PromoBanner />);

    const previous = await screen.findByRole("button", { name: "Previous announcement" });
    const promotion = screen.getByRole("link", { name: "Free delivery this week" });
    const next = screen.getByRole("button", { name: "Next announcement" });

    expect(previous.parentElement).toBe(promotion.parentElement);
    expect(next.parentElement).toBe(promotion.parentElement);
    expect(previous.nextElementSibling).toBe(promotion);
    expect(promotion.nextElementSibling).toBe(next);
    expect(previous).not.toHaveClass("absolute");
    expect(next).not.toHaveClass("absolute");

    mocks.rows = originalRows;
  });

  it("creates and edits promotions through the admin panel", async () => {
    mocks.lang = "en";
    vi.mocked(fetchPromoSlides).mockResolvedValue([]);
    render(<PromoSlidesPanel isArabic={false} />);

    fireEvent.change(await screen.findByLabelText("English text"), {
      target: { value: "Free delivery" },
    });
    fireEvent.change(screen.getByLabelText("Arabic text"), {
      target: { value: "توصيل مجاني" },
    });
    fireEvent.change(screen.getByLabelText("Destination URL"), {
      target: { value: "/shop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add promotion" }));

    await waitFor(() =>
      expect(createPromoSlide).toHaveBeenCalledWith({
        message_en: "Free delivery",
        message_ar: "توصيل مجاني",
        target_url: "/shop",
        is_active: true,
      }),
    );

    vi.mocked(fetchPromoSlides).mockResolvedValue(mocks.rows);
    render(<PromoSlidesPanel isArabic={false} />);
    const englishInput = await screen.findByDisplayValue("Free delivery this week");
    fireEvent.change(englishInput, { target: { value: "Updated promotion" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updatePromoSlide).toHaveBeenCalledWith(
        "promo-1",
        expect.objectContaining({ message_en: "Updated promotion" }),
      ),
    );

    fireEvent.click(screen.getByRole("switch", { name: "Deactivate promotion" }));
    await waitFor(() =>
      expect(updatePromoSlide).toHaveBeenCalledWith("promo-1", { is_active: false }),
    );

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete promotion" }));
    await waitFor(() => expect(deletePromoSlide).toHaveBeenCalledWith("promo-1"));
  });
});

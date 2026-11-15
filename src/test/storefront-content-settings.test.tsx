import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StorefrontContent } from "@/lib/site-settings";

const mocks = vi.hoisted(() => ({
  reload: vi.fn().mockResolvedValue(undefined),
  save: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

vi.mock("@/lib/site-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/site-settings")>();
  const settings = {
    logo_url: null,
    favicon_url: null,
    storefront_content: actual.DEFAULT_STOREFRONT_CONTENT,
    updated_at: "",
  };
  return {
    ...actual,
    saveStorefrontContent: mocks.save,
    useSiteSettings: () => ({
      settings,
      reload: mocks.reload,
    }),
  };
});

import { StorefrontContentSettings } from "@/components/admin/storefront-content-settings";

describe("storefront content settings", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hides a collection and saves a new subheading", async () => {
    render(<StorefrontContentSettings isArabic={false} />);

    const categoryInput = screen.getByRole("textbox", {
      name: "Collection headings: Lighting & Ambiance",
    });
    const categoryRow = categoryInput.closest("div");
    fireEvent.click(within(categoryRow!).getByRole("button", { name: "Hide" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Collection title" }), {
      target: { value: "Bedside Lamps" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Add under a collection" }), {
      target: { value: "lighting-ambiance" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add subheading" }));

    expect(
      within(
        screen
          .getByRole("textbox", {
            name: "Collection headings: Lighting & Ambiance",
          })
          .closest("div")!,
      ).getByRole("button", { name: "Show" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save homepage content" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const saved: StorefrontContent | undefined = mocks.save.mock.calls[0]?.[0];
    expect(saved).toBeDefined();
    const content = saved!;
    expect(
      content.categories.find((category) => category.id === "lighting-ambiance")?.visible,
    ).toBe(false);
    expect(content.categories).toContainEqual(
      expect.objectContaining({
        name: "Bedside Lamps",
        label: "Bedside Lamps",
        parentId: "lighting-ambiance",
        visible: true,
      }),
    );
    expect(mocks.reload).toHaveBeenCalledTimes(1);
  });

  it("removes a deleted collection from settings and stores its name as a tombstone", async () => {
    render(<StorefrontContentSettings isArabic={false} />);

    const categoryInput = screen.getByRole("textbox", {
      name: "Collection headings: Luxury Towels",
    });
    fireEvent.click(within(categoryInput.closest("div")!).getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Save homepage content" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const saved: StorefrontContent | undefined = mocks.save.mock.calls[0]?.[0];
    expect(saved).toBeDefined();
    expect(saved!.categories.some((category) => category.name === "Luxury Towels")).toBe(false);
    expect(saved!.deletedCategoryNames).toContain("Luxury Towels");
  });

  it("adds a bilingual homepage product list linked to a collection", async () => {
    render(<StorefrontContentSettings isArabic={false} />);

    fireEvent.change(screen.getByRole("textbox", { name: "List title (English)" }), {
      target: { value: "Bedding Bestsellers" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "List title (Arabic)" }), {
      target: { value: "الأكثر مبيعًا من أغطية السرير" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Product collection" }), {
      target: { value: "bedding-sets" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add product list" }));
    fireEvent.click(screen.getByRole("button", { name: "Save homepage content" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const saved: StorefrontContent | undefined = mocks.save.mock.calls[0]?.[0];
    expect(saved?.productSections).toContainEqual(
      expect.objectContaining({
        title_en: "Bedding Bestsellers",
        title_ar: "الأكثر مبيعًا من أغطية السرير",
        categoryId: "bedding-sets",
        visible: true,
      }),
    );
  });
});

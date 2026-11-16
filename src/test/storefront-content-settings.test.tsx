import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StorefrontContent } from "@/lib/site-settings";

const mocks = vi.hoisted(() => ({
  reload: vi.fn().mockResolvedValue(undefined),
  save: vi.fn().mockResolvedValue(undefined),
  uploadImage: vi.fn().mockResolvedValue({
    imageUrl: "https://cdn.example.test/marquee.png",
    path: "marquee.png",
  }),
  uploadVideo: vi.fn().mockResolvedValue({
    videoUrl: "https://cdn.example.test/marquee.mp4",
    path: "marquee.mp4",
  }),
}));

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/hero-slides", () => ({
  uploadHeroSlideImage: mocks.uploadImage,
  uploadHeroSlideVideo: mocks.uploadVideo,
}));

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

  it("saves the storefront design and section visibility switches", async () => {
    render(<StorefrontContentSettings isArabic={false} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Enable the luxury storefront design" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show the rotating announcement bar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Hero banner" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bundle banner" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Shop by category" }));
    fireEvent.click(screen.getByRole("button", { name: "Save homepage content" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const saved: StorefrontContent | undefined = mocks.save.mock.calls[0]?.[0];
    expect(saved).toMatchObject({
      luxuryDesignEnabled: false,
      promoBannerVisible: false,
      hero: { visible: false },
      bundleBanner: { visible: false },
      categoryShowcase: { visible: false },
    });
  });

  it("adds a bilingual scrolling-strip item with an optional destination", async () => {
    render(<StorefrontContentSettings isArabic={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Add strip item" }));
    const englishText = screen.getAllByRole("textbox", { name: "Text (English)" });
    const arabicText = screen.getAllByRole("textbox", { name: "Text (Arabic)" });
    const destinations = screen.getAllByRole("textbox", {
      name: "Click destination (optional)",
    });
    fireEvent.change(englishText.at(-1)!, { target: { value: "New collection" } });
    fireEvent.change(arabicText.at(-1)!, { target: { value: "مجموعة جديدة" } });
    fireEvent.change(destinations.at(-1)!, { target: { value: "/shop" } });
    fireEvent.click(screen.getByRole("button", { name: "Save homepage content" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const saved: StorefrontContent | undefined = mocks.save.mock.calls[0]?.[0];
    expect(saved?.marquee.items).toContainEqual(
      expect.objectContaining({
        type: "text",
        text_en: "New collection",
        text_ar: "مجموعة جديدة",
        link_url: "/shop",
        visible: true,
      }),
    );
  });

  it("does not save a scrolling-strip item with an unsafe destination", () => {
    render(<StorefrontContentSettings isArabic={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Add strip item" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Text (English)" }), {
      target: { value: "Unsafe link" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Click destination (optional)" }), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save homepage content" }));

    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("uploads a selected local image instead of asking for a media URL", async () => {
    render(<StorefrontContentSettings isArabic={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Add strip item" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Item type: 1" }), {
      target: { value: "image" },
    });
    const file = new File(["image"], "banner.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Choose an image from this device/), {
      target: { files: [file] },
    });

    await waitFor(() => expect(mocks.uploadImage).toHaveBeenCalledWith(file));
    expect(await screen.findByText("Media uploaded. Select another file to replace it.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Media URL" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save homepage content" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const saved: StorefrontContent | undefined = mocks.save.mock.calls[0]?.[0];
    expect(saved?.marquee.items[0]?.image_url).toBe("https://cdn.example.test/marquee.png");
  });
});

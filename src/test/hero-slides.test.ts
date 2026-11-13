import { afterEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: { from },
}));

import { fetchHeroSlides } from "@/lib/hero-slides";

describe("hero slide database binding", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads the migrated hero_slides columns in a stable order", async () => {
    const rows = [
      {
        id: "slide-1",
        image_url: "https://example.supabase.co/hero.jpg",
        storage_path: "hero.jpg",
        alt_text: "Hero image",
        sort_order: 0,
        is_active: true,
      },
    ];
    const order = vi.fn();
    const queryBuilder = {
      order,
      then: (resolve: (result: { data: typeof rows; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    order.mockReturnValue(queryBuilder);
    from.mockReturnValue({
      select: vi.fn().mockReturnValue(queryBuilder),
    });

    await expect(fetchHeroSlides()).resolves.toEqual(rows);

    expect(from).toHaveBeenCalledWith("hero_slides");
    expect(order.mock.calls).toEqual([
      ["sort_order", { ascending: true }],
      ["created_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
  });
});

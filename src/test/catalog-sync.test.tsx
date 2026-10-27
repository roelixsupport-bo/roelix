import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STATIC_PRODUCTS, StoreProvider, useStore } from "@/lib/store";

// The store imports the client lazily, so a mocked module stands in for Supabase.
let catalogResponse: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null,
};

vi.mock("@/lib/supabase", () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: () => ({
        select: () => ({ order: async () => catalogResponse }),
      }),
      channel: () => channel,
      removeChannel: async () => {},
    },
  };
});

function Probe() {
  const store = useStore();
  return <output data-testid="count">{store.products.length}</output>;
}

describe("live catalogue synchronisation", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    // Pretend we are in a real browser build with Supabase configured.
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (root) act(() => root?.unmount());
    container.remove();
    root = undefined;
  });

  async function renderStore() {
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <StoreProvider>
          <Probe />
        </StoreProvider>,
      );
    });
    // Let the lazy Supabase import and the fetch settle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  const renderedCount = () => Number(container.querySelector("output")?.textContent ?? -1);

  it("treats an empty cloud table as authoritative instead of keeping the cache", async () => {
    localStorage.setItem("roelix_products", JSON.stringify(STATIC_PRODUCTS));
    catalogResponse = { data: [], error: null };

    await renderStore();

    expect(STATIC_PRODUCTS.length).toBeGreaterThan(0);
    expect(renderedCount()).toBe(0);
  });

  it("keeps the last known catalogue when the live read fails", async () => {
    localStorage.setItem("roelix_products", JSON.stringify(STATIC_PRODUCTS));
    catalogResponse = { data: null, error: { message: "network unreachable" } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await renderStore();

    expect(renderedCount()).toBe(STATIC_PRODUCTS.length);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});

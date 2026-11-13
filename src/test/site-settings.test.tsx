import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import { updateFaviconLinks } from "@/lib/site-settings";

describe("dynamic site branding", () => {
  afterEach(() => {
    cleanup();
    document.head
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .forEach((link) => link.remove());
  });

  it("updates browser and Apple icons with a cache-busting settings version", () => {
    updateFaviconLinks("https://cdn.example.test/site/favicon.webp", "2026-11-13T15:00:00Z");

    const links = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
      ),
    );
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.href).toContain("v=2026-11-13T15%3A00%3A00Z");
    }
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')?.type).toBe(
      "image/webp",
    );
  });

  it("updates existing favicon links instead of leaving a stale hard-coded href", () => {
    const existing = document.createElement("link");
    existing.rel = "icon";
    existing.href = "/old-favicon.png";
    document.head.append(existing);

    updateFaviconLinks("https://cdn.example.test/new-favicon.png", "42");

    expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
    expect(existing.href).toBe("https://cdn.example.test/new-favicon.png?v=42");
  });
});

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LanguageSwitcher } from "@/components/site/language-switcher";
import { StoreProvider, useStore } from "@/lib/store";

function LanguageProbe() {
  const s = useStore();
  return (
    <div>
      <output data-testid="lang">{s.lang}</output>
      <output data-testid="cart-label">{s.t.cart}</output>
    </div>
  );
}

describe("language switcher", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    root = undefined;
  });

  async function render() {
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <StoreProvider>
          <LanguageSwitcher />
          <LanguageProbe />
        </StoreProvider>,
      );
    });
  }

  const option = (label: string) =>
    Array.from(container.querySelectorAll("button")).find((button) => button.textContent === label);

  const text = (testId: string) =>
    container.querySelector(`[data-testid="${testId}"]`)?.textContent;

  it("starts in English, left to right", async () => {
    await render();

    expect(text("lang")).toBe("en");
    expect(text("cart-label")).toBe("Shopping bag");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("switches to Arabic and right-to-left when the Arabic option is clicked", async () => {
    await render();

    await act(async () => option("العربية")?.click());

    expect(text("lang")).toBe("ar");
    expect(text("cart-label")).toBe("حقيبة التسوق");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(localStorage.getItem("roelix_language")).toBe(JSON.stringify("ar"));
  });

  it("switches back to English and left-to-right when the English option is clicked", async () => {
    localStorage.setItem("roelix_language", JSON.stringify("ar"));
    await render();

    // Persisted Arabic is applied on load, not on the next interaction.
    expect(text("lang")).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");

    await act(async () => option("English")?.click());

    expect(text("lang")).toBe("en");
    expect(text("cart-label")).toBe("Shopping bag");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(localStorage.getItem("roelix_language")).toBe(JSON.stringify("en"));
  });

  it("keeps both options visible and marks the active one", async () => {
    await render();

    expect(option("English")?.getAttribute("aria-pressed")).toBe("true");
    expect(option("العربية")?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => option("العربية")?.click());

    // Neither label flips: each option keeps naming its own language.
    expect(option("English")?.getAttribute("aria-pressed")).toBe("false");
    expect(option("العربية")?.getAttribute("aria-pressed")).toBe("true");
    expect(option("English")).not.toBeUndefined();
  });
});

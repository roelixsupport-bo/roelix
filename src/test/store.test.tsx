import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EGP_PER_USD,
  formatEgp,
  getMaxOrderQuantity,
  shippingFor,
  STATIC_PRODUCTS,
  StoreProvider,
  useStore,
} from "@/lib/store";

function StoreProbe() {
  const store = useStore();
  const product = store.find("aurelia-sateen");
  return (
    <div>
      <output>{store.fmt(10)}</output>
      <output data-testid="cart-quantity">
        {store.lines.reduce((total, line) => total + line.qty, 0)}
      </output>
      <output data-testid="cart-count">{store.count}</output>
      <output data-testid="cart-lines">{store.lines.length}</output>
      <output data-testid="subtotal">{store.subtotal}</output>
      <output data-testid="cart-open">{String(store.cartOpen)}</output>
      <button
        onClick={() => store.addToCart({ id: "aurelia-sateen", size: "Queen", color: "Ivory" }, 12)}
      >
        Add maximum
      </button>
      <button
        onClick={() => store.addToCart({ id: "aurelia-sateen", size: "King", color: "Ivory" }, 1)}
      >
        Add another
      </button>
      <button
        onClick={() => {
          const line = store.lines[0];
          if (line) store.setQty(line, 13);
        }}
      >
        Set over limit
      </button>
      <button
        onClick={() => {
          const line = store.lines[0];
          if (line) store.setQty(line, 0);
        }}
      >
        Set below minimum
      </button>
      <button
        onClick={() =>
          store.addBundleToCart([
            {
              id: "aurelia-sateen",
              size: "Queen",
              color: "Ivory",
              qty: 1,
              unitPrice: 621,
            },
            {
              id: "palais-duvet",
              size: "Queen",
              color: "Royal Navy",
              qty: 1,
              unitPrice: 432,
            },
          ])
        }
      >
        Add discounted bundle
      </button>
      <button
        onClick={() =>
          store.addBundleToCart([
            {
              id: "aurelia-sateen",
              size: "Queen",
              color: "Ivory",
              qty: 12,
              unitPrice: 621,
            },
          ])
        }
      >
        Add invalid bundle
      </button>
      <button
        onClick={() =>
          store.addBundleToCart([{ id: "", size: "Queen", color: "Ivory", qty: 1, unitPrice: 621 }])
        }
      >
        Add malformed bundle
      </button>
      <button
        onClick={() => {
          const line = store.lines[0];
          if (line) store.removeLine(line);
        }}
      >
        Remove first
      </button>
      <button
        onClick={() => {
          const line = store.lines[0];
          if (line) store.setQty(line, line.qty + 1);
        }}
      >
        Increase first
      </button>
      <button
        onClick={() => {
          const base = { id: "aurelia-sateen", size: "Queen", color: "Ivory", unitPrice: 690 };
          store.addToCart({ ...base, dimension: "200 × 200 cm" }, 1);
          store.addToCart({ ...base, dimension: "220 × 220 cm" }, 1);
        }}
      >
        Add two dimensions
      </button>
      <button onClick={() => store.setLang("ar")}>العربية</button>
      <output>{product?.stock ?? 0}</output>
    </div>
  );
}

describe("store currency and locale", () => {
  let root: Root | undefined;
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    root = undefined;
  });

  async function renderStore() {
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <StoreProvider>
          <StoreProbe />
        </StoreProvider>,
      );
    });
  }

  it("formats every base price in Egyptian pounds by default", async () => {
    await renderStore();

    expect(EGP_PER_USD).toBe(48);
    expect(container.querySelector("output")?.textContent).toBe("EGP 480");
    expect(formatEgp(50)).toBe("EGP 50");
  });

  it("uses Arabic currency notation and applies RTL document direction", async () => {
    await renderStore();
    const button = Array.from(container.querySelectorAll("button")).find(
      (item) => item.textContent === "العربية",
    );
    expect(button).not.toBeNull();
    act(() => button?.click());

    expect(container.querySelector("output")?.textContent).toBe("480 ج.م");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });

  it("returns the Bosta rate for each Egyptian governorate", () => {
    expect(shippingFor("القاهرة")).toBe(50);
    expect(shippingFor("الجيزة")).toBe(50);
    expect(shippingFor("القليوبية")).toBe(50);
    expect(shippingFor("الإسكندرية")).toBe(65);
    expect(shippingFor("البحيرة")).toBe(65);
    expect(shippingFor("الشرقية")).toBe(75);
    expect(shippingFor("الدقهلية")).toBe(75);
    expect(shippingFor("الغربية")).toBe(75);
    expect(shippingFor("المنوفية")).toBe(75);
    expect(shippingFor("كفر الشيخ")).toBe(75);
    expect(shippingFor("دمياط")).toBe(75);
    expect(shippingFor("بورسعيد")).toBe(75);
    expect(shippingFor("الإسماعيلية")).toBe(75);
    expect(shippingFor("السويس")).toBe(75);
    expect(shippingFor("الفيوم")).toBe(95);
    expect(shippingFor("بني سويف")).toBe(95);
    expect(shippingFor("المنيا")).toBe(95);
    expect(shippingFor("أسيوط")).toBe(95);
    expect(shippingFor("سوهاج")).toBe(95);
    expect(shippingFor("قنا")).toBe(95);
    expect(shippingFor("الأقصر")).toBe(95);
    expect(shippingFor("أسوان")).toBe(95);
    expect(shippingFor("مطروح")).toBe(120);
    expect(shippingFor("البحر الأحمر")).toBe(120);
    expect(shippingFor("الوادي الجديد")).toBe(120);
    expect(shippingFor("شمال سيناء")).toBe(120);
    expect(shippingFor("جنوب سيناء")).toBe(120);
  });

  it("uses available stock as the order quantity limit", () => {
    expect(getMaxOrderQuantity(12)).toBe(12);
    expect(getMaxOrderQuantity(10)).toBe(10);
    expect(getMaxOrderQuantity(3)).toBe(3);
    expect(getMaxOrderQuantity(0)).toBe(0);
    expect(getMaxOrderQuantity(-2)).toBe(0);
  });

  it("enforces stock limits across cart variants and removes a line set to zero", async () => {
    await renderStore();

    const buttons = Array.from(container.querySelectorAll("button"));
    await act(async () => buttons.find((button) => button.textContent === "Add maximum")?.click());
    await act(async () => buttons.find((button) => button.textContent === "Add another")?.click());
    expect(container.querySelector('[data-testid="cart-quantity"]')?.textContent).toBe("12");

    await act(async () =>
      buttons.find((button) => button.textContent === "Set over limit")?.click(),
    );
    expect(container.querySelector('[data-testid="cart-quantity"]')?.textContent).toBe("12");
    expect(STATIC_PRODUCTS[0]?.stock).toBe(12);

    // A quantity of zero is a delete, not a clamped one unit.
    await act(async () =>
      buttons.find((button) => button.textContent === "Set below minimum")?.click(),
    );
    expect(container.querySelector('[data-testid="cart-quantity"]')?.textContent).toBe("0");
    expect(container.querySelector('[data-testid="cart-lines"]')?.textContent).toBe("0");
    expect(localStorage.getItem("roelix_cart")).toBe("[]");
  });

  it("deletes only the targeted line and keeps sibling variants in the bag", async () => {
    await renderStore();
    const buttons = Array.from(container.querySelectorAll("button"));

    await act(async () =>
      buttons.find((button) => button.textContent === "Add discounted bundle")?.click(),
    );
    expect(container.querySelector('[data-testid="cart-lines"]')?.textContent).toBe("2");
    expect(container.querySelector('[data-testid="subtotal"]')?.textContent).toBe("1053");

    await act(async () => buttons.find((button) => button.textContent === "Remove first")?.click());

    expect(container.querySelector('[data-testid="cart-lines"]')?.textContent).toBe("1");
    expect(container.querySelector('[data-testid="cart-quantity"]')?.textContent).toBe("1");
    expect(container.querySelector('[data-testid="cart-count"]')?.textContent).toBe("1");
    expect(container.querySelector('[data-testid="subtotal"]')?.textContent).toBe("432");
  });

  it("persists deletions and quantity edits to local storage and the count badge", async () => {
    await renderStore();
    const buttons = Array.from(container.querySelectorAll("button"));

    await act(async () =>
      buttons.find((button) => button.textContent === "Add discounted bundle")?.click(),
    );
    await act(async () =>
      buttons.find((button) => button.textContent === "Increase first")?.click(),
    );

    expect(container.querySelector('[data-testid="cart-count"]')?.textContent).toBe("3");
    const grown = JSON.parse(localStorage.getItem("roelix_cart") ?? "[]") as Array<
      Record<string, unknown>
    >;
    expect(grown.find((line) => line["id"] === "aurelia-sateen")?.["qty"]).toBe(2);

    await act(async () =>
      buttons.find((button) => button.textContent === "Set below minimum")?.click(),
    );

    expect(container.querySelector('[data-testid="cart-count"]')?.textContent).toBe("1");
    const saved = JSON.parse(localStorage.getItem("roelix_cart") ?? "[]") as Array<
      Record<string, unknown>
    >;
    expect(saved).toHaveLength(1);
    expect(saved[0]?.["id"]).toBe("palais-duvet");
  });

  it("adopts a bag written by another tab", async () => {
    await renderStore();

    await act(async () => {
      localStorage.setItem(
        "roelix_cart",
        JSON.stringify([{ id: "cloud-pillow", size: "Standard", color: "White", qty: 2 }]),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "roelix_cart" }));
    });

    expect(container.querySelector('[data-testid="cart-count"]')?.textContent).toBe("2");
    expect(container.querySelector('[data-testid="cart-lines"]')?.textContent).toBe("1");
  });

  it("keeps two dimensions of the same size as separate bag lines", async () => {
    await renderStore();
    const buttons = Array.from(container.querySelectorAll("button"));

    await act(async () =>
      buttons.find((button) => button.textContent === "Add two dimensions")?.click(),
    );

    expect(container.querySelector('[data-testid="cart-lines"]')?.textContent).toBe("2");
    expect(container.querySelector('[data-testid="cart-count"]')?.textContent).toBe("2");

    const saved = JSON.parse(localStorage.getItem("roelix_cart") ?? "[]") as Array<
      Record<string, unknown>
    >;
    expect(saved.map((line) => line["dimension"])).toEqual(["200 × 200 cm", "220 × 220 cm"]);

    // Removing one dimension must leave the other in place.
    await act(async () => buttons.find((button) => button.textContent === "Remove first")?.click());

    expect(container.querySelector('[data-testid="cart-lines"]')?.textContent).toBe("1");
    const remaining = JSON.parse(localStorage.getItem("roelix_cart") ?? "[]") as Array<
      Record<string, unknown>
    >;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.["dimension"]).toBe("220 × 220 cm");
  });

  it("restores a saved bag whose lines carry dimensions", async () => {
    localStorage.setItem(
      "roelix_cart",
      JSON.stringify([
        {
          id: "aurelia-sateen",
          size: "Queen",
          color: "Ivory",
          qty: 1,
          dimension: "200 × 200 cm",
        },
        {
          id: "aurelia-sateen",
          size: "Queen",
          color: "Ivory",
          qty: 2,
          dimension: "220 × 220 cm",
        },
      ]),
    );
    await renderStore();

    expect(container.querySelector('[data-testid="cart-lines"]')?.textContent).toBe("2");
    expect(container.querySelector('[data-testid="cart-count"]')?.textContent).toBe("3");
  });

  it("adds discounted bundles at their configured prices and rejects stock overflow atomically", async () => {
    await renderStore();
    const buttons = Array.from(container.querySelectorAll("button"));
    await act(async () =>
      buttons.find((button) => button.textContent === "Add discounted bundle")?.click(),
    );

    expect(container.querySelector('[data-testid="cart-quantity"]')?.textContent).toBe("2");
    expect(container.querySelector('[data-testid="subtotal"]')?.textContent).toBe("1053");
    expect(container.querySelector('[data-testid="cart-open"]')?.textContent).toBe("true");

    await act(async () =>
      buttons.find((button) => button.textContent === "Add invalid bundle")?.click(),
    );
    expect(container.querySelector('[data-testid="cart-quantity"]')?.textContent).toBe("2");
    expect(container.querySelector('[data-testid="subtotal"]')?.textContent).toBe("1053");

    await act(async () =>
      buttons.find((button) => button.textContent === "Add malformed bundle")?.click(),
    );
    expect(container.querySelector('[data-testid="cart-quantity"]')?.textContent).toBe("2");
    expect(container.querySelector('[data-testid="subtotal"]')?.textContent).toBe("1053");
  });

  it("uses available product stock when it is lower than the order cap", async () => {
    localStorage.setItem(
      "roelix_products",
      JSON.stringify(
        STATIC_PRODUCTS.map((product) =>
          product.id === "aurelia-sateen" ? { ...product, stock: 3 } : product,
        ),
      ),
    );
    await renderStore();

    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Add maximum",
    );
    await act(async () => addButton?.click());

    expect(container.querySelector('[data-testid="cart-quantity"]')?.textContent).toBe("3");
  });

  it("reduces saved cart quantities when current stock is lower", async () => {
    localStorage.setItem(
      "roelix_products",
      JSON.stringify(
        STATIC_PRODUCTS.map((product) =>
          product.id === "aurelia-sateen" ? { ...product, stock: 3 } : product,
        ),
      ),
    );
    localStorage.setItem(
      "roelix_cart",
      JSON.stringify([{ id: "aurelia-sateen", size: "Queen", color: "Ivory", qty: 8 }]),
    );
    await renderStore();

    expect(container.querySelector('[data-testid="cart-quantity"]')?.textContent).toBe("3");
  });
});

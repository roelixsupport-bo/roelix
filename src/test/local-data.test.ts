import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { askAssistant } from "@/lib/assistant.functions";
import {
  findLocalOrder,
  placeLocalOrder,
  readOrders,
  readLocalEmailPreferences,
  readLocalAnalyticsEvents,
  readProducts,
  recordAIQuery,
  recordProductInteraction,
  recordSearchQuery,
  clearLocalAnalyticsEvents,
  readCustomBundleSettings,
  removeLocalEmailPreference,
  saveLocalProduct,
  saveLocalEmailPreferences,
  saveCustomBundleSettings,
  updateLocalOrderStatus,
} from "@/lib/local-data";
import { EGP_PER_USD, shippingFor, STATIC_PRODUCTS } from "@/lib/store";

describe("standalone local store", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("persists checkout orders and decrements the shared local inventory", () => {
    const product = STATIC_PRODUCTS[0]!;
    const id = placeLocalOrder(
      {
        customer: {
          name: "Local Customer",
          email: "customer@example.test",
          phone: "123",
          address: "1 Local Street",
          city: "Giza",
          governorate: "الجيزة",
          country: "Egypt",
        },
        items: [{ id: product.id, qty: 2, size: "Queen", color: "Ivory" }],
        payment: "cod",
      },
      STATIC_PRODUCTS,
      shippingFor,
      EGP_PER_USD,
    );

    expect(id).toMatch(/^RX-[A-Z0-9]{6}$/);
    expect(findLocalOrder(id)).toMatchObject({
      id,
      status: "Pending",
      shipping: 50,
      subtotal: product.price * 2 * EGP_PER_USD,
      total: product.price * 2 * EGP_PER_USD + 50,
      customer: { governorate: "الجيزة" },
      items: [{ id: product.id, qty: 2, name: product.name }],
    });
    expect(readOrders()).toHaveLength(1);
    expect(readProducts(STATIC_PRODUCTS).find((item) => item.id === product.id)?.stock).toBe(
      product.stock - 2,
    );
    expect(product.stock).toBe(STATIC_PRODUCTS[0]!.stock);
  });

  it("preserves the custom bundle discount in a placed order", () => {
    const product = STATIC_PRODUCTS[0]!;
    const id = placeLocalOrder(
      {
        customer: {
          name: "Bundle Customer",
          email: "bundle@example.test",
          phone: "123",
          address: "1 Local Street",
          city: "Giza",
          governorate: "الجيزة",
          country: "Egypt",
        },
        items: [
          {
            id: product.id,
            qty: 1,
            size: "Queen",
            color: "Ivory",
            unitPrice: product.price * 0.9,
          },
        ],
        payment: "cod",
      },
      STATIC_PRODUCTS,
      shippingFor,
      EGP_PER_USD,
    );

    expect(findLocalOrder(id)).toMatchObject({
      subtotal: product.price * 0.9 * EGP_PER_USD,
      shipping: 50,
      total: product.price * 0.9 * EGP_PER_USD + 50,
      items: [{ id: product.id, price: product.price * 0.9 * EGP_PER_USD }],
    });
  });

  it("persists editable product colors, sizes, and curated complements", () => {
    const product = {
      ...STATIC_PRODUCTS[0]!,
      colors: [{ name: "Pearl", hex: "#f5f0e8" }],
      sizes: ["Queen", "Custom 240 × 260 cm"],
      frequently_bought_ids: ["palais-duvet"],
    };

    saveLocalProduct(product, STATIC_PRODUCTS);

    expect(readProducts(STATIC_PRODUCTS).find((item) => item.id === product.id)).toMatchObject({
      colors: product.colors,
      sizes: product.sizes,
      frequently_bought_ids: product.frequently_bought_ids,
    });
  });

  it("migrates existing related product selections to the admin-managed field", () => {
    localStorage.setItem(
      "roelix_products",
      JSON.stringify([
        {
          ...STATIC_PRODUCTS[0],
          frequently_bought_ids: undefined,
          relatedProductIds: ["palais-duvet"],
        },
      ]),
    );

    expect(readProducts(STATIC_PRODUCTS)[0]?.frequently_bought_ids).toEqual(["palais-duvet"]);
  });

  it("records and clears bounded storefront analytics events", () => {
    recordSearchQuery("  Egyptian   cotton ");
    recordSearchQuery("x");
    recordProductInteraction("product_click", "aurelia-sateen", "Aurelia Sateen");
    recordProductInteraction("product_view", "aurelia-sateen", "Aurelia Sateen");
    recordAIQuery("How should I care for Egyptian cotton?");

    expect(readLocalAnalyticsEvents()).toMatchObject([
      { type: "search", value: "Egyptian cotton" },
      { type: "product_click", productId: "aurelia-sateen" },
      { type: "product_view", productId: "aurelia-sateen" },
      { type: "ai_query", value: "How should I care for Egyptian cotton?" },
    ]);
    expect(readLocalAnalyticsEvents().every((event) => Boolean(event.createdAt))).toBe(true);

    clearLocalAnalyticsEvents();
    expect(readLocalAnalyticsEvents()).toEqual([]);
  });

  it("stores custom bedding bundle enablement and validates its discount", () => {
    expect(readCustomBundleSettings()).toEqual({ enabled: true, discountPercent: 10 });
    saveCustomBundleSettings({ enabled: false, discountPercent: 25 });
    expect(readCustomBundleSettings()).toEqual({ enabled: false, discountPercent: 25 });
    expect(() => saveCustomBundleSettings({ enabled: true, discountPercent: 51 })).toThrow(
      "Bundle discount must be between 0% and 50%",
    );
  });

  it("requires private order details instead of exposing locally stored order status", () => {
    const id = placeLocalOrder(
      {
        customer: {
          name: "Local Customer",
          email: "customer@example.test",
          phone: "123",
          address: "1 Local Street",
          city: "Giza",
          governorate: "الجيزة",
          country: "Egypt",
        },
        items: [{ id: STATIC_PRODUCTS[0]!.id, qty: 1, size: "King", color: "Ivory" }],
        payment: "cod",
      },
      STATIC_PRODUCTS,
      shippingFor,
      EGP_PER_USD,
    );

    updateLocalOrderStatus(id, "Shipped");
    const reply = askAssistant([{ role: "user", content: `Track order ${id}` }], STATIC_PRODUCTS);

    expect(reply.text).toContain("phone number used at checkout");
    expect(reply.text).not.toContain("Shipped");
    expect(findLocalOrder(id)?.status).toBe("Shipped");
  });

  it("answers governorate shipping questions from the supplied live rates", () => {
    const reply = askAssistant([{ role: "user", content: "What is shipping to Cairo?" }], [], {
      القاهرة: 50,
    });

    expect(reply.text).toContain("EGP 50");
    expect(reply.text).toContain("القاهرة");
  });

  it("answers product requests from the local catalogue", () => {
    const reply = askAssistant([{ role: "user", content: "Recommend bedding" }], STATIC_PRODUCTS);

    expect(reply.productIds).toContain("aurelia-sateen");
    expect(reply.text).toContain("EGP");
  });

  it("recommends coordinated bedding and explains the listed quality details", () => {
    const reply = askAssistant(
      [{ role: "user", content: "Can you match sheets with a duvet cover?" }],
      STATIC_PRODUCTS,
    );

    expect(reply.productIds).toContain("aurelia-sateen");
    expect(reply.productIds).toContain("palais-duvet");
    expect(reply.text).toContain("1000 thread count");
    expect(reply.text).toContain("complementary tone");
  });

  it("offers helpful textile care, decor, and general price guidance", () => {
    const care = askAssistant(
      [{ role: "user", content: "How do I care for Egyptian cotton?" }],
      STATIC_PRODUCTS,
    );
    const decor = askAssistant(
      [{ role: "user", content: "Any ideas for luxury bedroom decor?" }],
      STATIC_PRODUCTS,
    );
    const prices = askAssistant(
      [{ role: "user", content: "What are your prices?" }],
      STATIC_PRODUCTS,
    );

    expect(care.text).toContain("care label");
    expect(decor.text).toContain("complementary tones");
    expect(prices.text).toContain("Current catalogue prices");
    expect(prices.productIds.length).toBeGreaterThan(0);
  });

  it("stores explicit email opt-ins locally, merges consent, and supports removal", () => {
    saveLocalEmailPreferences("  Guest@Example.test ", {
      source: "footer",
      newsletterOptIn: true,
      orderTrackingOptIn: false,
    });
    saveLocalEmailPreferences("guest@example.test", {
      source: "checkout",
      newsletterOptIn: false,
      orderTrackingOptIn: true,
    });
    saveLocalEmailPreferences("not-an-email", {
      source: "checkout",
      newsletterOptIn: false,
      orderTrackingOptIn: false,
    });
    expect(() =>
      saveLocalEmailPreferences("not-an-email", {
        source: "checkout",
        newsletterOptIn: true,
        orderTrackingOptIn: false,
      }),
    ).toThrow("Enter a valid email address");

    expect(readLocalEmailPreferences()).toMatchObject([
      {
        email: "guest@example.test",
        source: "footer",
        newsletterOptIn: true,
        orderTrackingOptIn: true,
      },
    ]);
    removeLocalEmailPreference("GUEST@example.test");
    expect(readLocalEmailPreferences()).toEqual([]);
  });
});

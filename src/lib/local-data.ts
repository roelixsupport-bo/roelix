import type { Order, Product } from "@/lib/store";
import type { EgyptGovernorate } from "@/lib/shipping";

export const LOCAL_DATA_EVENT = "roelix-local-data-change";
export const LOCAL_ANALYTICS_EVENT = "roelix-local-analytics-change";
const PRODUCTS_KEY = "roelix_products";
const ORDERS_KEY = "roelix_orders";
const SUBSCRIBERS_KEY = "roelix_email_preferences";
const ANALYTICS_KEY = "roelix_analytics_events";
const CUSTOM_BUNDLE_SETTINGS_KEY = "roelix_custom_bundle_settings";
const MAX_ANALYTICS_EVENTS = 2000;
const isString = (value: unknown): value is string => typeof value === "string";

export type LocalEmailPreference = {
  email: string;
  createdAt: string;
  source: "footer" | "checkout";
  newsletterOptIn: boolean;
  orderTrackingOptIn: boolean;
};

export type LocalAnalyticsEvent = {
  type: "search" | "product_click" | "product_view" | "ai_query";
  value: string;
  productId?: string;
  createdAt: string;
};

export type CustomBundleSettings = {
  enabled: boolean;
  discountPercent: number;
};

export const DEFAULT_CUSTOM_BUNDLE_SETTINGS: CustomBundleSettings = {
  enabled: true,
  discountPercent: 10,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["nameAr"] === "string" &&
    typeof value["category"] === "string" &&
    typeof value["price"] === "number" &&
    Array.isArray(value["images"]) &&
    typeof value["description"] === "string" &&
    typeof value["origin"] === "string" &&
    typeof value["stock"] === "number" &&
    Array.isArray(value["colors"]) &&
    value["colors"].every(
      (color) =>
        isRecord(color) && typeof color["name"] === "string" && typeof color["hex"] === "string",
    ) &&
    Array.isArray(value["sizes"]) &&
    value["sizes"].every((size) => typeof size === "string") &&
    (value["frequently_bought_ids"] === undefined ||
      (Array.isArray(value["frequently_bought_ids"]) &&
        value["frequently_bought_ids"].every((id) => typeof id === "string"))) &&
    (value["relatedProductIds"] === undefined ||
      (Array.isArray(value["relatedProductIds"]) &&
        value["relatedProductIds"].every((id) => typeof id === "string"))) &&
    typeof value["isPublished"] === "boolean"
  );
}

function isAnalyticsEvent(value: unknown): value is LocalAnalyticsEvent {
  return (
    isRecord(value) &&
    ["search", "product_click", "product_view", "ai_query"].includes(String(value["type"])) &&
    isString(value["value"]) &&
    (value["productId"] === undefined || isString(value["productId"])) &&
    isString(value["createdAt"])
  );
}

function cloneProducts(products: Product[]): Product[] {
  return products.map((product) => {
    const { relatedProductIds, ...canonicalProduct } = product;
    return {
      ...canonicalProduct,
      images: [...product.images],
      colors: product.colors.map((color) => ({ ...color })),
      sizes: [...product.sizes],
      frequently_bought_ids: [...(product.frequently_bought_ids ?? relatedProductIds ?? [])],
    };
  });
}

function readValue<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return isValid(value) ? value : fallback;
  } catch (error) {
    console.error(`Could not read local ROELIX data from ${key}`, error);
    return fallback;
  }
}

function saveValue(key: string, value: unknown, eventName = LOCAL_DATA_EVENT): void {
  if (typeof window === "undefined") throw new Error("Local store is only available in a browser");
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(eventName));
}

export function readProducts(defaults: Product[]): Product[] {
  return cloneProducts(
    readValue(
      PRODUCTS_KEY,
      cloneProducts(defaults),
      (value): value is Product[] => Array.isArray(value) && value.every(isProduct),
    ),
  );
}

export function writeProducts(products: Product[]): void {
  saveValue(PRODUCTS_KEY, cloneProducts(products));
}

export function readOrders(): Order[] {
  return readValue(
    ORDERS_KEY,
    [],
    (value): value is Order[] =>
      Array.isArray(value) &&
      value.every(
        (order) =>
          isRecord(order) &&
          isString(order["id"]) &&
          isString(order["createdAt"]) &&
          isRecord(order["customer"]) &&
          Array.isArray(order["items"]) &&
          typeof order["subtotal"] === "number" &&
          typeof order["shipping"] === "number" &&
          typeof order["total"] === "number" &&
          (order["payment"] === "card" || order["payment"] === "cod") &&
          ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"].includes(
            String(order["status"]),
          ),
      ),
  );
}

export function writeOrders(orders: Order[]): void {
  saveValue(ORDERS_KEY, orders);
}

export function readLocalAnalyticsEvents(): LocalAnalyticsEvent[] {
  return readValue(
    ANALYTICS_KEY,
    [],
    (value): value is LocalAnalyticsEvent[] =>
      Array.isArray(value) && value.every(isAnalyticsEvent),
  );
}

function recordAnalyticsEvent(event: Omit<LocalAnalyticsEvent, "createdAt">): void {
  if (typeof window === "undefined") return;
  try {
    const events = readLocalAnalyticsEvents();
    saveValue(
      ANALYTICS_KEY,
      [...events, { ...event, createdAt: new Date().toISOString() }].slice(-MAX_ANALYTICS_EVENTS),
      LOCAL_ANALYTICS_EVENT,
    );
  } catch (error) {
    console.error("Could not save local ROELIX analytics event", error);
  }
}

export function recordSearchQuery(query: string): void {
  const value = query.trim().replace(/\s+/g, " ").slice(0, 200);
  if (value.length < 2) return;
  recordAnalyticsEvent({ type: "search", value });
}

export function recordProductInteraction(
  type: "product_click" | "product_view",
  productId: string,
  productName: string,
): void {
  if (!productId.trim()) return;
  recordAnalyticsEvent({
    type,
    productId: productId.trim(),
    value: productName.trim().slice(0, 200),
  });
}

export function recordAIQuery(query: string): void {
  const value = query.trim().replace(/\s+/g, " ").slice(0, 500);
  if (value) recordAnalyticsEvent({ type: "ai_query", value });
}

export function clearLocalAnalyticsEvents(): void {
  saveValue(ANALYTICS_KEY, [], LOCAL_ANALYTICS_EVENT);
}

export function readCustomBundleSettings(): CustomBundleSettings {
  if (typeof window === "undefined") return DEFAULT_CUSTOM_BUNDLE_SETTINGS;
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(CUSTOM_BUNDLE_SETTINGS_KEY) ?? "null",
    );
    if (
      isRecord(value) &&
      typeof value["enabled"] === "boolean" &&
      typeof value["discountPercent"] === "number" &&
      Number.isFinite(value["discountPercent"]) &&
      value["discountPercent"] >= 0 &&
      value["discountPercent"] <= 50
    ) {
      return { enabled: value["enabled"], discountPercent: value["discountPercent"] };
    }
  } catch (error) {
    console.error("Could not read ROELIX custom bundle settings", error);
  }
  return DEFAULT_CUSTOM_BUNDLE_SETTINGS;
}

export function saveCustomBundleSettings(settings: CustomBundleSettings): void {
  if (
    !Number.isFinite(settings.discountPercent) ||
    settings.discountPercent < 0 ||
    settings.discountPercent > 50
  ) {
    throw new Error("Bundle discount must be between 0% and 50%");
  }
  saveValue(CUSTOM_BUNDLE_SETTINGS_KEY, {
    enabled: settings.enabled,
    discountPercent: settings.discountPercent,
  });
}

function isEmailPreference(value: unknown): value is LocalEmailPreference {
  return (
    isRecord(value) &&
    isString(value["email"]) &&
    isString(value["createdAt"]) &&
    (value["source"] === "footer" || value["source"] === "checkout") &&
    typeof value["newsletterOptIn"] === "boolean" &&
    typeof value["orderTrackingOptIn"] === "boolean"
  );
}

export function readLocalEmailPreferences(): LocalEmailPreference[] {
  return readValue(
    SUBSCRIBERS_KEY,
    [],
    (value): value is LocalEmailPreference[] =>
      Array.isArray(value) && value.every(isEmailPreference),
  );
}

export function saveLocalEmailPreferences(
  email: string,
  preferences: {
    source: LocalEmailPreference["source"];
    newsletterOptIn: boolean;
    orderTrackingOptIn: boolean;
  },
): void {
  if (!preferences.newsletterOptIn && !preferences.orderTrackingOptIn) return;
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address");
  }

  const entries = readLocalEmailPreferences();
  const existing = entries.find((entry) => entry.email === normalizedEmail);
  const nextEntry: LocalEmailPreference = {
    email: normalizedEmail,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    source: existing?.source ?? preferences.source,
    newsletterOptIn: Boolean(existing?.newsletterOptIn || preferences.newsletterOptIn),
    orderTrackingOptIn: Boolean(existing?.orderTrackingOptIn || preferences.orderTrackingOptIn),
  };
  writeLocalEmailPreferences([
    nextEntry,
    ...entries.filter((entry) => entry.email !== normalizedEmail),
  ]);
}

function writeLocalEmailPreferences(preferences: LocalEmailPreference[]): void {
  saveValue(SUBSCRIBERS_KEY, preferences);
}

export function removeLocalEmailPreference(email: string): void {
  const normalizedEmail = email.trim().toLowerCase();
  writeLocalEmailPreferences(
    readLocalEmailPreferences().filter((entry) => entry.email !== normalizedEmail),
  );
}

export function saveLocalProduct(product: Product, defaults: Product[]): void {
  const products = readProducts(defaults);
  const index = products.findIndex((item) => item.id === product.id);
  if (index === -1) products.push(product);
  else products[index] = product;
  writeProducts(products);
}

export function deleteLocalProduct(id: string, defaults: Product[]): void {
  writeProducts(readProducts(defaults).filter((product) => product.id !== id));
}

export function updateLocalOrderStatus(id: string, status: Order["status"]): void {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === id);
  if (index === -1) throw new Error(`Order ${id} was not found in the local store`);
  orders[index] = { ...orders[index]!, status };
  writeOrders(orders);
}

export function findLocalOrder(id: string): Order | undefined {
  return readOrders().find((order) => order.id === id);
}

export function placeLocalOrder(
  order: Omit<
    Order,
    "id" | "createdAt" | "status" | "subtotal" | "shipping" | "total" | "items"
  > & {
    customer: Order["customer"] & { governorate: EgyptGovernorate };
    items: Array<{
      id: string;
      qty: number;
      size: string;
      color: string;
      unitPrice?: number;
    }>;
  },
  defaults: Product[],
  shippingFor: (governorate: EgyptGovernorate) => number,
  currencyMultiplier: number,
): string {
  if (!Number.isFinite(currencyMultiplier) || currencyMultiplier <= 0) {
    throw new Error("Currency multiplier must be a positive number");
  }
  const governorate = order.customer.governorate;
  if (!governorate) throw new Error("Select a governorate to calculate Bosta shipping");
  const products = readProducts(defaults);
  const lines: Order["items"] = [];
  let subtotal = 0;

  for (const item of order.items) {
    const product = products.find((candidate) => candidate.id === item.id && candidate.isPublished);
    if (!product || product.stock < item.qty) {
      throw new Error(
        `${product?.name ?? "A selected product"} is unavailable in the requested quantity`,
      );
    }
    const unitPrice = item.unitPrice ?? product.price;
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > product.price) {
      throw new Error(`Invalid unit price for ${product.name}`);
    }
    const priceInEgp = unitPrice * currencyMultiplier;
    subtotal += priceInEgp * item.qty;
    lines.push({
      id: product.id,
      qty: item.qty,
      size: item.size,
      color: item.color,
      name: product.name,
      price: priceInEgp,
    });
    product.stock -= item.qty;
  }

  const shipping = shippingFor(governorate);
  const existingOrders = readOrders();
  let id: string;
  do {
    id = `RX-${Math.random().toString(36).slice(2, 8).padEnd(6, "0").toUpperCase()}`;
  } while (existingOrders.some((existing) => existing.id === id));
  const savedOrder: Order = {
    ...order,
    id,
    createdAt: new Date().toISOString(),
    items: lines,
    subtotal,
    shipping,
    total: subtotal + shipping,
    status: "Pending",
  };

  writeProducts(products);
  writeOrders([savedOrder, ...existingOrders]);
  return id;
}

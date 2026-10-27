import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import beddingImage from "@/assets/p_pedding.jpg";
import pillowImage from "@/assets/p_pillow.jpg";
import towelImage from "@/assets/p_towel.jpg";
import heroImage from "@/assets/hero.jpg";
import { productFromCloud } from "@/lib/cloud-catalog";
import { LOCAL_DATA_EVENT, readProducts } from "@/lib/local-data";
import type { ProductVariant } from "@/lib/product-variants";
import type { EgyptGovernorate } from "@/lib/shipping";
import { shippingFor } from "@/lib/shipping";

export type { ProductVariant } from "@/lib/product-variants";

export { BOSTA_SHIPPING_RATES, shippingFor } from "@/lib/shipping";

export const EGP_PER_USD = 48;
export const STORE_SUPPORT_EMAIL = "roelix.support@gmail.com";

export function formatEgp(amount: number, language: "en" | "ar" = "en"): string {
  const value = new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", {
    maximumFractionDigits: 0,
  }).format(amount);
  return language === "ar" ? `${value} ج.م` : `EGP ${value}`;
}
const CART_KEY = "roelix_cart";
const WISHLIST_KEY = "roelix_wishlist";
const LANGUAGE_KEY = "roelix_language";

export const CATEGORIES = [
  "Lighting & Ambiance",
  "Luxury Towels",
  "Hotel Pillows",
  "Mattress Protectors",
  "Bedding Sets",
] as const;

export type Category = string;
export type ProductColor = { name: string; hex: string };
export type Product = {
  id: string;
  name: string;
  nameAr: string;
  category: Category;
  price: number;
  images: string[];
  description: string;
  threadCount?: number | null;
  gsm?: number | null;
  origin: string;
  stock: number;
  colors: ProductColor[];
  sizes: string[];
  frequently_bought_ids?: string[];
  relatedProductIds?: string[];
  isPublished: boolean;
  /** Long-form copy shown in the PDP "Product Details" accordion. */
  productDetails?: string;
  /** Fabric care copy shown in the PDP "Care Instructions" accordion. */
  productCare?: string;
  /** Size/dimension matrix mirrored from the `product_variants` table. */
  variants?: ProductVariant[];
};

export type Order = {
  id: string;
  createdAt: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    governorate?: EgyptGovernorate;
    country: string;
  };
  items: Array<{
    id: string;
    qty: number;
    size: string;
    color: string;
    name?: string;
    price?: number;
    /** Stable per-line id stamped by the database, used for partial returns. */
    lineId?: string;
    /** Units of this line already returned to stock. */
    restockedQuantity?: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  payment?: "card" | "cod";
  status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
  /** Set by the database when a cancellation returned the items to stock. */
  restockedAt?: string;
  /** Set when the order's inventory was deducted — without it, stock cannot be returned. */
  inventoryAppliedAt?: string;
};

type SavedCartLine = {
  id: string;
  size: string;
  color: string;
  qty: number;
  unitPrice?: number;
};
export type CartLine = SavedCartLine & { product: Product };
export type CartAddition = {
  id: string;
  size: string;
  color: string;
  qty: number;
  unitPrice?: number;
};

export type CartLineKey = Pick<SavedCartLine, "id" | "size" | "color" | "unitPrice">;

/**
 * Identity of a cart line: product + size + colour + unit price.
 *
 * The same product can sit in the bag twice at different prices (a bundle
 * discount versus the list price), so every add / update / remove path has to
 * compare all four fields. The bag UI uses this helper too, so identity can
 * never drift between the store and the drawer.
 */
export function isSameCartLine(a: CartLineKey, b: CartLineKey): boolean {
  return a.id === b.id && a.size === b.size && a.color === b.color && a.unitPrice === b.unitPrice;
}
type Language = "en" | "ar";

export function getMaxOrderQuantity(stock: number): number {
  return Math.max(0, Math.floor(stock));
}

const copy = {
  en: {
    announce: "Premium nationwide delivery · ROELIX Personal Concierge Service",
    shop: "Collections",
    search: "Search the collection",
    wishlist: "Wishlist",
    cart: "Shopping bag",
    add: "Add to bag",
    empty: "Your bag is waiting to be discovered.",
    subtotal: "Subtotal",
    checkout: "Proceed to checkout",
  },
  ar: {
    announce: "توصيل فاخر إلى جميع أنحاء مصر · خدمة ROELIX للمساعد الشخصي",
    shop: "المجموعات",
    search: "ابحث في المجموعة",
    wishlist: "قائمة الأمنيات",
    cart: "حقيبة التسوق",
    add: "أضف إلى الحقيبة",
    empty: "حقيبتك بانتظار اكتشافاتك.",
    subtotal: "المجموع الفرعي",
    checkout: "إتمام الشراء",
  },
} satisfies Record<Language, Record<string, string>>;

export const STATIC_PRODUCTS: Product[] = [
  {
    id: "aurelia-sateen",
    name: "Aurelia Sateen Bedding Set",
    nameAr: "طقم أوريليا ساتان",
    category: "Bedding Sets",
    price: 690,
    images: [beddingImage, heroImage],
    description:
      "Woven from long-staple Giza cotton in a 1000 thread count sateen, with a lustrous drape and a cool, silken hand.",
    threadCount: 1000,
    origin: "Giza, Egypt",
    stock: 12,
    colors: [
      { name: "Ivory", hex: "#f3ead8" },
      { name: "Royal Navy", hex: "#1a252f" },
    ],
    sizes: ["Queen", "King", "Super King"],
    frequently_bought_ids: ["palais-duvet", "cloud-pillow"],
    isPublished: true,
  },
  {
    id: "palais-duvet",
    name: "Palais Navy Duvet Cover",
    nameAr: "غطاء لحاف باليه",
    category: "Bedding Sets",
    price: 480,
    images: [heroImage, beddingImage],
    description: "A tailored duvet cover framed with a hand-finished gold piping border.",
    threadCount: 800,
    origin: "Egypt",
    stock: 4,
    colors: [
      { name: "Royal Navy", hex: "#1a252f" },
      { name: "Cream", hex: "#fdfbf7" },
    ],
    sizes: ["Queen", "King", "Super King"],
    frequently_bought_ids: ["aurelia-sateen", "sanctuary-protector"],
    isPublished: true,
  },
  {
    id: "sanctuary-protector",
    name: "Sanctuary Hotel Mattress Protector",
    nameAr: "واقي مرتبة سانكتشواري",
    category: "Mattress Protectors",
    price: 220,
    images: [beddingImage],
    description: "A breathable, silent waterproof barrier used in five-star suites worldwide.",
    gsm: 300,
    origin: "Portugal",
    stock: 30,
    colors: [{ name: "White", hex: "#ffffff" }],
    sizes: ["Queen", "King", "Super King"],
    isPublished: true,
  },
  {
    id: "cloud-pillow",
    name: "Cloud Hotel Microfiber Pillow",
    nameAr: "وسادة كلاود الفندقية",
    category: "Hotel Pillows",
    price: 140,
    images: [pillowImage],
    description: "Down-alternative microfiber cluster fill for weightless, sculpted support.",
    gsm: 1200,
    origin: "Egypt",
    stock: 50,
    colors: [{ name: "White", hex: "#ffffff" }],
    sizes: ["Standard", "King"],
    isPublished: true,
  },
  {
    id: "riviera-towels",
    name: "Riviera Gold-Band Towel Set",
    nameAr: "طقم مناشف ريفييرا",
    category: "Luxury Towels",
    price: 260,
    images: [towelImage],
    description: "Zero-twist Egyptian cotton terry, 700 GSM, finished with a woven gold band.",
    gsm: 700,
    origin: "Egypt",
    stock: 8,
    colors: [
      { name: "Cream", hex: "#f3ead8" },
      { name: "Charcoal", hex: "#111827" },
    ],
    sizes: ["4 Piece", "6 Piece"],
    isPublished: true,
  },
];

function readStorage<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return isValid(stored) ? stored : fallback;
  } catch (error) {
    console.error(`Could not read ${key} from local storage`, error);
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save ${key} to local storage`, error);
  }
}

const isSavedCart = (value: unknown): value is SavedCartLine[] =>
  Array.isArray(value) &&
  value.every(
    (line) =>
      typeof line === "object" &&
      line !== null &&
      !Array.isArray(line) &&
      typeof line["id"] === "string" &&
      typeof line["size"] === "string" &&
      typeof line["color"] === "string" &&
      Number.isInteger(line["qty"]) &&
      Number(line["qty"]) > 0 &&
      (line["unitPrice"] === undefined ||
        (typeof line["unitPrice"] === "number" &&
          Number.isFinite(line["unitPrice"]) &&
          line["unitPrice"] >= 0)),
  );
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const isLanguage = (value: unknown): value is Language => value === "en" || value === "ar";

type StoreContextValue = {
  products: Product[];
  productsLoaded: boolean;
  lang: Language;
  t: typeof copy.en;
  lines: CartLine[];
  subtotal: number;
  count: number;
  cartOpen: boolean;
  wishlist: string[];
  fmt: (price: number) => string;
  fmtEgp: (amount: number) => string;
  find: (id: string) => Product | undefined;
  addToCart: (
    selection: { id: string; size: string; color: string; unitPrice?: number },
    qty?: number,
  ) => boolean;
  addBundleToCart: (additions: CartAddition[]) => boolean;
  setQty: (line: CartLine, qty: number) => boolean;
  /** Deletes one line from the bag. Returns false when it was already gone. */
  removeLine: (line: CartLine) => boolean;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  toggleWish: (id: string) => void;
  setLang: (lang: Language) => void;
  reloadProducts: () => Promise<void>;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function hasSupabaseConfig(): boolean {
  // Unit tests render the provider without a network: never open sockets there.
  if (import.meta.env["MODE"] === "test") return false;
  return Boolean(import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_ANON_KEY"]);
}

/**
 * Reads the live catalogue. Prefers the variant relation, and degrades to a
 * plain select when `product_variants` is not provisioned yet.
 */
async function fetchCloudCatalog(supabase: SupabaseClient): Promise<unknown[]> {
  const withVariants = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .order("name");
  if (!withVariants.error) return withVariants.data ?? [];

  const plain = await supabase.from("products").select("*").order("name");
  if (plain.error) throw plain.error;
  return plain.data ?? [];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState(() => readProducts(STATIC_PRODUCTS));
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [cart, setCart] = useState(() => readStorage(CART_KEY, [] as SavedCartLine[], isSavedCart));
  const [wishlist, setWishlist] = useState(() =>
    readStorage(WISHLIST_KEY, [] as string[], isStringArray),
  );
  const [lang, setLang] = useState<Language>(() =>
    readStorage(LANGUAGE_KEY, "en" as Language, isLanguage),
  );
  const [cartOpen, setCartOpen] = useState(false);

  // Until the first successful cloud read, the cached catalogue is used so the
  // shop can paint immediately. After that, Supabase owns the truth.
  const catalogFromCloud = useRef(false);

  const reloadProducts = useCallback(async () => {
    if (!catalogFromCloud.current) {
      setProducts(readProducts(STATIC_PRODUCTS));
      setProductsLoaded(true);
    }

    if (typeof window === "undefined" || !hasSupabaseConfig()) {
      setProductsLoaded(true);
      return;
    }

    try {
      const { supabase } = await import("@/lib/supabase");
      const rows = await fetchCloudCatalog(supabase);

      catalogFromCloud.current = true;
      // Cloud is authoritative: an empty table means an empty shop, not a stale
      // cache. One malformed row must not blank the whole catalogue.
      setProducts(
        rows.flatMap((row) => {
          try {
            return [productFromCloud(row)];
          } catch (error) {
            console.error("ROELIX catalog: skipping an unreadable product row", error);
            return [];
          }
        }),
      );
    } catch (error) {
      // Network/RLS failure: keep whatever we already have on screen.
      console.warn("ROELIX catalog: live fetch failed, keeping the current catalogue", error);
    } finally {
      setProductsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reloadProducts();
    const syncProducts = () => void reloadProducts();
    window.addEventListener(LOCAL_DATA_EVENT, syncProducts);
    window.addEventListener("storage", syncProducts);
    return () => {
      window.removeEventListener(LOCAL_DATA_EVENT, syncProducts);
      window.removeEventListener("storage", syncProducts);
    };
  }, [reloadProducts]);

  /**
   * Keeps every device on the live catalogue.
   *
   * Phones freeze timers and sockets when the tab is backgrounded, so a
   * Realtime socket alone is not enough: we also re-read when the page becomes
   * visible again, regains focus or reconnects, and poll slowly as a fallback
   * for projects where Realtime replication is not enabled.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !hasSupabaseConfig()) return;

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let removeChannel: (() => void) | undefined;
    let disposed = false;

    const refreshSoon = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void reloadProducts(), 300);
    };
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") refreshSoon();
    };

    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);

    void (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const channel = supabase
          .channel(`roelix-catalog-${Math.random().toString(36).slice(2, 10)}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refreshSoon)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "product_variants" },
            refreshSoon,
          )
          .subscribe();

        if (disposed) {
          void supabase.removeChannel(channel);
          return;
        }
        removeChannel = () => void supabase.removeChannel(channel);
      } catch (error) {
        console.warn("ROELIX catalogue: realtime unavailable, using focus refresh", error);
      }
    })();

    const pollTimer = window.setInterval(refreshIfVisible, 45_000);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      window.clearInterval(pollTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      removeChannel?.();
    };
  }, [reloadProducts]);
  useEffect(() => {
    setCart((current) => {
      const totals = new Map<string, number>();
      let changed = false;
      const normalized = current.flatMap((line) => {
        const product = products.find((item) => item.id === line.id);
        if (!product) return [line];
        const previousQuantity = totals.get(line.id) ?? 0;
        const quantity = Math.min(
          line.qty,
          Math.max(0, getMaxOrderQuantity(product.stock) - previousQuantity),
        );
        totals.set(line.id, previousQuantity + quantity);
        if (quantity !== line.qty) changed = true;
        return quantity > 0 ? [{ ...line, qty: quantity }] : [];
      });
      return changed ? normalized : current;
    });
  }, [products]);
  useEffect(() => writeStorage(CART_KEY, cart), [cart]);
  useEffect(() => writeStorage(WISHLIST_KEY, wishlist), [wishlist]);

  /**
   * Keeps two open tabs in agreement: a deletion or quantity change made in one
   * tab re-reads the saved cart here, so the drawer and the header badge follow.
   * The `storage` event only fires in the *other* tabs, so this never fights the
   * tab that made the change.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncCart = (event: StorageEvent) => {
      if (event.key !== CART_KEY) return;
      setCart(readStorage(CART_KEY, [] as SavedCartLine[], isSavedCart));
    };
    window.addEventListener("storage", syncCart);
    return () => window.removeEventListener("storage", syncCart);
  }, []);
  useEffect(() => {
    writeStorage(LANGUAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const find = useCallback(
    (id: string) => products.find((product) => product.id === id),
    [products],
  );
  const lines = useMemo(
    () =>
      cart.flatMap((line) => {
        const product = products.find((item) => item.id === line.id);
        return product ? [{ ...line, product }] : [];
      }),
    [cart, products],
  );
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + (line.unitPrice ?? line.product.price) * line.qty, 0),
    [lines],
  );
  const count = useMemo(() => lines.reduce((sum, line) => sum + line.qty, 0), [lines]);

  const addToCart = useCallback(
    (selection: { id: string; size: string; color: string; unitPrice?: number }, qty = 1) => {
      const product = products.find((item) => item.id === selection.id);
      if (!product || product.stock < 1) {
        console.warn(`Cannot add unavailable product ${selection.id} to the bag`);
        return false;
      }
      const { unitPrice } = selection;
      // A variant may be priced above the advertised (cheapest) product price.
      const priceCeiling = Math.max(
        product.price,
        ...(product.variants ?? []).map((variant) => variant.price),
      );
      if (
        unitPrice !== undefined &&
        (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > priceCeiling)
      ) {
        console.warn(`Cannot add ${selection.id} at an invalid price of ${unitPrice}`);
        return false;
      }
      const requestedQuantity = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
      const alreadyInCart = cart
        .filter((line) => line.id === product.id)
        .reduce((total, line) => total + line.qty, 0);
      const quantity = Math.min(
        requestedQuantity,
        Math.max(0, getMaxOrderQuantity(product.stock) - alreadyInCart),
      );
      if (quantity === 0) return false;
      setCart((current) => {
        const currentProductQuantity = current
          .filter((line) => line.id === product.id)
          .reduce((total, line) => total + line.qty, 0);
        const addition = Math.min(
          requestedQuantity,
          Math.max(0, getMaxOrderQuantity(product.stock) - currentProductQuantity),
        );
        if (addition === 0) return current;
        const existing = current.find((line) => isSameCartLine(line, selection));
        if (!existing)
          return [
            ...current,
            {
              id: selection.id,
              size: selection.size,
              color: selection.color,
              qty: addition,
              ...(unitPrice === undefined ? {} : { unitPrice }),
            },
          ];
        return current.map((line) =>
          line === existing ? { ...line, qty: line.qty + addition } : line,
        );
      });
      setCartOpen(true);
      return quantity === requestedQuantity;
    },
    [cart, products],
  );

  const addBundleToCart = useCallback(
    (additions: CartAddition[]) => {
      if (!additions.length) return false;
      const additionsByProduct = new Map<string, { product: Product; quantity: number }>();
      const normalized: Array<CartAddition & { unitPrice: number }> = [];
      for (const addition of additions) {
        if (
          !addition ||
          typeof addition.id !== "string" ||
          !addition.id.trim() ||
          typeof addition.size !== "string" ||
          typeof addition.color !== "string"
        ) {
          return false;
        }
        const product = products.find(
          (candidate) => candidate.id === addition.id && candidate.isPublished,
        );
        if (
          !product ||
          (product.sizes.length > 0 && !product.sizes.includes(addition.size)) ||
          (product.colors.length > 0 &&
            !product.colors.some((color) => color.name === addition.color)) ||
          !Number.isFinite(product.stock) ||
          product.stock < 1 ||
          !Number.isFinite(product.price) ||
          !Number.isInteger(addition.qty) ||
          addition.qty < 1 ||
          typeof addition.unitPrice !== "number" ||
          !Number.isFinite(addition.unitPrice) ||
          addition.unitPrice < 0 ||
          addition.unitPrice > product.price
        ) {
          return false;
        }
        const previous = additionsByProduct.get(product.id);
        additionsByProduct.set(product.id, {
          product,
          quantity: (previous?.quantity ?? 0) + addition.qty,
        });
        normalized.push({ ...addition, unitPrice: addition.unitPrice });
      }
      for (const [productId, addition] of additionsByProduct) {
        const inCart = cart
          .filter((line) => line.id === productId)
          .reduce((total, line) => total + line.qty, 0);
        if (inCart + addition.quantity > getMaxOrderQuantity(addition.product.stock)) return false;
      }
      const next = [...cart];
      for (const addition of normalized) {
        const existingIndex = next.findIndex((line) => isSameCartLine(line, addition));
        if (existingIndex === -1) {
          next.push({
            id: addition.id,
            size: addition.size,
            color: addition.color,
            qty: addition.qty,
            unitPrice: addition.unitPrice,
          });
        } else {
          const existing = next[existingIndex];
          if (!existing) return false;
          next[existingIndex] = { ...existing, qty: existing.qty + addition.qty };
        }
      }
      setCart(next);
      setCartOpen(true);
      return true;
    },
    [cart, products],
  );

  /**
   * Deletes exactly one line from the bag.
   *
   * The filter runs inside the state updater so it always sees the freshest
   * cart, and the boolean result lets the caller confirm that a row was really
   * there (and show a confirmation toast only in that case).
   */
  const removeLine = useCallback(
    (target: CartLine) => {
      const exists = cart.some((line) => isSameCartLine(line, target));
      // The filter is applied unconditionally: `exists` is only used for UI
      // feedback, so a stale render can never swallow a genuine delete.
      setCart((current) => {
        const next = current.filter((line) => !isSameCartLine(line, target));
        return next.length === current.length ? current : next;
      });
      return exists;
    },
    [cart],
  );

  /**
   * Sets the quantity of one line. Anything below 1 removes the line.
   *
   * The old version forced `Math.max(1, qty)`, which turned the drawer's
   * `setQty(line, 0)` delete into a no-op that silently reset the row to 1.
   */
  const setQty = useCallback(
    (target: CartLine, qty: number) => {
      const requestedQuantity = Number.isFinite(qty) ? Math.floor(qty) : 1;
      if (requestedQuantity < 1) {
        removeLine(target);
        return true;
      }

      const otherQuantity = cart
        .filter((line) => line.id === target.id && !isSameCartLine(line, target))
        .reduce((total, line) => total + line.qty, 0);
      const maxForLine = Math.max(0, getMaxOrderQuantity(target.product.stock) - otherQuantity);

      setCart((current) => {
        const currentOtherQuantity = current
          .filter((line) => line.id === target.id && !isSameCartLine(line, target))
          .reduce((total, line) => total + line.qty, 0);
        const currentMaxForLine = Math.max(
          0,
          getMaxOrderQuantity(target.product.stock) - currentOtherQuantity,
        );
        return current.flatMap((line) => {
          if (!isSameCartLine(line, target)) return [line];
          // A line that can no longer hold any stock is dropped rather than
          // pinned at 1, so the bag never advertises an unbuyable quantity.
          const nextQuantity = Math.min(requestedQuantity, currentMaxForLine);
          return nextQuantity > 0 ? [{ ...line, qty: nextQuantity }] : [];
        });
      });
      return requestedQuantity <= maxForLine;
    },
    [cart, removeLine],
  );

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWish = useCallback((id: string) => {
    setWishlist((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const fmt = useCallback(
    (price: number) => {
      const value = Math.round(price * EGP_PER_USD);
      const formatted = new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(value);
      return lang === "ar" ? `${formatted} ج.م` : `EGP ${formatted}`;
    },
    [lang],
  );
  const fmtEgp = useCallback((amount: number) => formatEgp(amount, lang), [lang]);

  const value = useMemo<StoreContextValue>(
    () => ({
      products,
      productsLoaded,
      lang,
      t: copy[lang],
      lines,
      subtotal,
      count,
      cartOpen,
      wishlist,
      fmt,
      fmtEgp,
      find,
      addToCart,
      addBundleToCart,
      setQty,
      removeLine,
      clearCart,
      setCartOpen,
      toggleWish,
      setLang,
      reloadProducts,
    }),
    [
      products,
      productsLoaded,
      lang,
      lines,
      subtotal,
      count,
      cartOpen,
      wishlist,
      fmt,
      fmtEgp,
      find,
      addToCart,
      addBundleToCart,
      setQty,
      removeLine,
      clearCart,
      toggleWish,
      reloadProducts,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used within StoreProvider");
  return value;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import beddingImage from "@/assets/p_pedding.jpg";
import pillowImage from "@/assets/p_pillow.jpg";
import towelImage from "@/assets/p_towel.jpg";
import heroImage from "@/assets/hero.jpg";
import { LOCAL_DATA_EVENT, readProducts } from "@/lib/local-data";
import type { EgyptGovernorate } from "@/lib/shipping";
import { shippingFor } from "@/lib/shipping";

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
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  payment?: "card" | "cod";
  status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
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
  addToCart: (selection: { id: string; size: string; color: string }, qty?: number) => boolean;
  addBundleToCart: (additions: CartAddition[]) => boolean;
  setQty: (line: CartLine, qty: number) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  toggleWish: (id: string) => void;
  setLang: (lang: Language) => void;
  reloadProducts: () => Promise<void>;
};

const StoreContext = createContext<StoreContextValue | null>(null);

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

  const reloadProducts = useCallback(async () => {
    setProducts(readProducts(STATIC_PRODUCTS));
    setProductsLoaded(true);
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
    (selection: { id: string; size: string; color: string }, qty = 1) => {
      const product = products.find((item) => item.id === selection.id);
      if (!product || product.stock < 1) {
        console.warn(`Cannot add unavailable product ${selection.id} to the bag`);
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
        const existing = current.find(
          (line) =>
            line.id === selection.id &&
            line.size === selection.size &&
            line.color === selection.color &&
            line.unitPrice === undefined,
        );
        if (!existing) return [...current, { ...selection, qty: addition }];
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
        const existingIndex = next.findIndex(
          (line) =>
            line.id === addition.id &&
            line.size === addition.size &&
            line.color === addition.color &&
            line.unitPrice === addition.unitPrice,
        );
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

  const setQty = useCallback(
    (target: CartLine, qty: number) => {
      const requestedQuantity = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
      const maxForLine = Math.max(
        0,
        getMaxOrderQuantity(target.product.stock) -
          cart
            .filter(
              (line) =>
                line.id === target.id &&
                !(
                  line.size === target.size &&
                  line.color === target.color &&
                  line.unitPrice === target.unitPrice
                ),
            )
            .reduce((total, line) => total + line.qty, 0),
      );
      setCart((current) => {
        const currentOtherQuantity = current
          .filter(
            (line) =>
              line.id === target.id &&
              !(
                line.size === target.size &&
                line.color === target.color &&
                line.unitPrice === target.unitPrice
              ),
          )
          .reduce((total, line) => total + line.qty, 0);
        const currentMaxForLine = Math.max(
          0,
          getMaxOrderQuantity(target.product.stock) - currentOtherQuantity,
        );
        return current.flatMap((line) => {
          if (
            line.id !== target.id ||
            line.size !== target.size ||
            line.color !== target.color ||
            line.unitPrice !== target.unitPrice
          )
            return [line];
          const currentQuantity = Math.min(requestedQuantity, currentMaxForLine);
          return currentQuantity > 0 ? [{ ...line, qty: currentQuantity }] : [];
        });
      });
      return requestedQuantity <= maxForLine;
    },
    [cart],
  );

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
      clearCart: () => setCart([]),
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

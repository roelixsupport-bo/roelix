import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, Plus, Search, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import {
  clearLocalAnalyticsEvents,
  readCustomBundleSettings,
  saveCustomBundleSettings,
  LOCAL_ANALYTICS_EVENT,
  LOCAL_DATA_EVENT,
  readLocalAnalyticsEvents,
  readProducts,
  readLocalEmailPreferences,
  removeLocalEmailPreference,
  saveLocalProduct,
  type LocalEmailPreference,
  type LocalAnalyticsEvent,
  type CustomBundleSettings,
} from "@/lib/local-data";
import {
  CATEGORIES,
  EGP_PER_USD,
  useStore,
  STATIC_PRODUCTS,
  STORE_SUPPORT_EMAIL,
  type Order,
  type Product,
} from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { BOSTA_SHIPPING_RATES, type EgyptGovernorate } from "@/lib/shipping";
import { productFromCloud, productToCloud } from "@/lib/cloud-catalog";
import { OrderLineRestock } from "@/components/admin/order-line-restock";
import { ProductActions } from "@/components/admin/product-actions";
import { ReviewsPanel } from "@/components/admin/reviews-panel";
import { VariantManager } from "@/components/admin/variant-manager";
import { uploadProductImage } from "@/lib/product-images";
import { saveCloudProduct } from "@/lib/product-save";
import { describeError } from "@/lib/errors";
import { ensureUniqueSkus, sanitizeVariants, type ProductVariant } from "@/lib/product-variants";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — ROELIX" },
      { name: "description", content: "Manage ROELIX products, inventory and orders." },
      { property: "og:title", content: "Admin Dashboard — ROELIX" },
      { property: "og:description", content: "Manage ROELIX products, inventory and orders." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const STATUSES: Order["status"][] = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

const ADMIN_COPY = {
  en: {
    loading: "Loading…",
    restrictedTitle: "Access restricted",
    restrictedBody:
      "This account has no ROELIX dashboard role. Ask the primary administrator to provision your account.",
    atelier: "Atelier",
    dashboard: "Admin Dashboard",
    primaryAdmin: "Primary admin",
    roleAdmin: "Admin",
    roleStaff: "Staff",
    accountRole: "Dashboard role",
    signOut: "Sign out",
    revenue: "Revenue",
    orders: "Orders",
    products: "Products",
    reviews: "Customer reviews",
    subscribers: "Email opt-ins",
    analytics: "Analytics & AI Insights",
    settings: "Settings",
    saveBundleSettings: "Save bundle settings",
    bundleSettingsTitle: "Custom Bedding Bundler",
    bundleEnabled: "Enable the custom bedding bundler",
    bundleDiscount: "Complete bundle discount (%)",
    bundleSettingsSaved: "Custom bundle settings saved",
    analyticsDescription:
      "Locally stored storefront searches, product activity and advisor questions.",
    totalSearches: "Search queries",
    totalViews: "Product views",
    totalClicks: "Product clicks",
    totalAIQueries: "Advisor questions",
    topSearches: "Top searched keywords",
    topProducts: "Most viewed products",
    topQuestions: "Frequently asked advisor questions",
    searchTerms: "Most searched keywords and products",
    clicks: "Clicks",
    views: "Views",
    noAnalytics: "No storefront activity has been recorded yet.",
    clearAnalytics: "Clear analytics",
    clearAnalyticsConfirm: "Clear all locally stored storefront analytics?",
    clearAnalyticsSuccess: "Analytics cleared",
    noSubscribers: "No optional email opt-ins have been saved.",
    email: "Email",
    joined: "Saved",
    newsletter: "Newsletter",
    orderTracking: "Order tracking",
    removeEmail: "Remove email",
    footerSource: "Footer newsletter",
    checkoutSource: "Checkout",
    lowStock: "Low stock",
    addProduct: "Add product",
    product: "Product",
    category: "Category",
    price: "Price",
    stock: "Stock",
    actions: "Actions",
    hidden: "Hidden",
    hiddenFromShop: "Product hidden from shop",
    visibleInShopSuccess: "Product visible in shop",
    productDeleted: "Product deleted",
    newOrder: "New order received",
    stockRestored: "Stock restored",
    restocked: "Returned to stock",
    noOrders: "No orders yet.",
    customer: "Customer",
    items: "Items",
    cashOnDelivery: "Cash on delivery",
    card: "Card",
    editProduct: "Edit product",
    newProduct: "New product",
    name: "Name",
    arabicName: "Arabic name",
    priceEgp: "Price (EGP)",
    sku: "Product SKU",
    compareAtEgp: "Compare-at price (EGP)",
    categoryPlaceholder: "Choose or enter a category",
    colors: "Available colors",
    colorName: "Color name",
    colorHex: "Hex code",
    addColor: "Add color",
    sizes: "Available sizes (comma separated)",
    complements: "Frequently Bought Together Products",
    allCategories: "All categories",
    searchProducts: "Search products…",
    noMatchingProducts: "No products match these filters.",
    selectedProducts: "Selected",
    noProducts: "No other products are available.",
    description: "Description",
    images: "Images",
    visibleInShop: "Visible in shop",
    cancel: "Cancel",
    save: "Save",
    variantLabel: "Variants",
    detailsSection: "Product details",
    careSection: "Care instructions",
    accordionHint: "Displayed in the product page accordions.",
    derivedHint: "Price and stock are recalculated from the variants when you save.",
    variantValidation:
      "Every variant needs a unique SKU, a size name or dimension, a price above 0 and a whole-number stock.",
    detailsColumnsMissing:
      "Saved. Product details and care instructions need the ROELIX migration before they can be stored.",
    imagesUploading: "Uploading",
    imageInlineWarning:
      "Stored inline because the Supabase product-images bucket is unavailable. Run the ROELIX migration to enable Storage uploads.",
    addImage: "Add image",
    statuses: {
      Pending: "Pending",
      Processing: "Processing",
      Shipped: "Shipped",
      Delivered: "Delivered",
      Cancelled: "Cancelled",
    },
  },
  ar: {
    loading: "جارٍ التحميل…",
    restrictedTitle: "الوصول مقيّد",
    restrictedBody:
      "لا يملك هذا الحساب صلاحية للوحة ROELIX. اطلب من مدير المتجر الأساسي تفعيل حسابك.",
    atelier: "أتيليه",
    dashboard: "لوحة إدارة ROELIX",
    primaryAdmin: "مدير المتجر",
    roleAdmin: "مدير",
    roleStaff: "موظف",
    accountRole: "صلاحية الحساب",
    signOut: "تسجيل الخروج",
    revenue: "الإيرادات",
    orders: "الطلبات",
    products: "المنتجات",
    reviews: "تقييمات العملاء",
    subscribers: "اشتراكات البريد",
    analytics: "تحليلات الذكاء الاصطناعي وسلوك العملاء",
    settings: "الإعدادات",
    saveBundleSettings: "حفظ إعدادات المجموعة",
    bundleSettingsTitle: "منشئ مجموعات المفروشات",
    bundleEnabled: "تفعيل منشئ مجموعات المفروشات",
    bundleDiscount: "نسبة خصم المجموعة الكاملة (%)",
    bundleSettingsSaved: "تم حفظ إعدادات المجموعة المخصصة",
    analyticsDescription: "عمليات البحث وتفاعل المنتجات وأسئلة المساعد المحفوظة محليًا.",
    totalSearches: "عمليات البحث",
    totalViews: "مشاهدات المنتجات",
    totalClicks: "نقرات المنتجات",
    totalAIQueries: "أسئلة المساعد",
    topSearches: "أكثر الكلمات بحثًا",
    topProducts: "المنتجات الأكثر مشاهدة",
    topQuestions: "الأسئلة الأكثر تكرارًا للمساعد",
    searchTerms: "أكثر الكلمات والمنتجات بحثًا",
    clicks: "النقرات",
    views: "المشاهدات",
    noAnalytics: "لم يتم تسجيل أي تفاعل في المتجر حتى الآن.",
    clearAnalytics: "مسح التحليلات",
    clearAnalyticsConfirm: "هل تريد مسح جميع تحليلات المتجر المحفوظة محليًا؟",
    clearAnalyticsSuccess: "تم مسح التحليلات",
    noSubscribers: "لا توجد اشتراكات أو موافقات بريدية محفوظة.",
    email: "البريد الإلكتروني",
    joined: "تاريخ الحفظ",
    newsletter: "النشرة البريدية",
    orderTracking: "تتبع الطلبات",
    removeEmail: "حذف البريد",
    footerSource: "نشرة الموقع",
    checkoutSource: "إتمام الطلب",
    lowStock: "مخزون منخفض",
    addProduct: "إضافة منتج",
    product: "المنتج",
    category: "الفئة",
    price: "السعر",
    stock: "المخزون",
    actions: "الإجراءات",
    hidden: "مخفي",
    hiddenFromShop: "تم إخفاء المنتج من المتجر",
    visibleInShopSuccess: "تم إظهار المنتج في المتجر",
    productDeleted: "تم حذف المنتج",
    newOrder: "تم استلام طلب جديد",
    stockRestored: "تم إرجاع المخزون",
    restocked: "المرتجع إلى المخزون",
    noOrders: "لا توجد طلبات حتى الآن.",
    customer: "العميل",
    items: "المنتجات",
    cashOnDelivery: "الدفع عند الاستلام",
    card: "بطاقة",
    editProduct: "تعديل المنتج",
    newProduct: "منتج جديد",
    name: "الاسم",
    arabicName: "الاسم بالعربية",
    priceEgp: "السعر (جنيه مصري)",
    sku: "رمز المنتج (SKU)",
    compareAtEgp: "السعر قبل الخصم (جنيه مصري)",
    categoryPlaceholder: "اختر فئة أو أدخل فئة جديدة",
    colors: "الألوان المتاحة",
    colorName: "اسم اللون",
    colorHex: "رمز اللون",
    addColor: "إضافة لون",
    sizes: "المقاسات المتاحة (مفصولة بفواصل)",
    complements: "المنتجات المكملة المقترحة",
    allCategories: "كل الفئات",
    searchProducts: "ابحث عن المنتجات…",
    noMatchingProducts: "لا توجد منتجات تطابق عوامل التصفية.",
    selectedProducts: "المحدد",
    noProducts: "لا توجد منتجات أخرى متاحة.",
    description: "الوصف",
    images: "الصور",
    visibleInShop: "ظاهر في المتجر",
    cancel: "إلغاء",
    save: "حفظ",
    variantLabel: "المتغيرات",
    detailsSection: "تفاصيل المنتج",
    careSection: "تعليمات العناية",
    accordionHint: "تظهر في أقسام صفحة المنتج.",
    derivedHint: "يُعاد حساب السعر والمخزون من المتغيرات عند الحفظ.",
    variantValidation:
      "كل متغير يحتاج رمزاً فريداً، واسماً أو أبعاداً، وسعراً أكبر من صفر، ومخزوناً صحيحاً.",
    detailsColumnsMissing:
      "تم الحفظ. تحتاج تفاصيل المنتج وتعليمات العناية إلى تشغيل تحديث ROELIX قبل تخزينها.",
    imagesUploading: "جارٍ الرفع",
    imageInlineWarning:
      "تم تخزين الصورة داخل السجل لأن حاوية product-images غير متاحة. شغّل تحديث ROELIX لتفعيل الرفع إلى Storage.",
    addImage: "إضافة صورة",
    statuses: {
      Pending: "قيد الانتظار",
      Processing: "قيد المعالجة",
      Shipped: "تم الشحن",
      Delivered: "تم التوصيل",
      Cancelled: "ملغي",
    },
  },
} as const;

const blank = (): Product => ({
  id: "",
  name: "",
  nameAr: "",
  category: "Bedding Sets",
  price: 0,
  images: [],
  description: "",
  origin: "Egypt",
  stock: 0,
  colors: [{ name: "White", hex: "#ffffff" }],
  sizes: ["Queen", "King"],
  frequently_bought_ids: [],
  isPublished: true,
  variants: [],
});

type AdminTab = "products" | "orders" | "reviews" | "subscribers" | "analytics" | "settings";
type DashboardRole = "admin" | "staff";

function mapCloudOrder(value: unknown): Order | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;

  // Fallback defaults for missing/optional fields
  const governorate = (row["governorate"] as string) || "Other";
  const statusStr = (row["status"] as string) || "Pending";
  const status = statusStr.toLowerCase();

  const statuses: Record<string, Order["status"]> = {
    pending: "Pending",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  // Ensure mandatory fields for display exist, or use defaults
  const id = String(row["id"] ?? "unknown");
  const customerName = String(row["customer_name"] ?? "Guest");
  const phone = String(row["phone"] ?? "");
  const address = String(row["address"] ?? "No address provided");
  const items = Array.isArray(row["items"]) ? row["items"] : [];

  return {
    id,
    createdAt: typeof row["created_at"] === "string" ? row["created_at"] : new Date().toISOString(),
    customer: {
      name: customerName,
      email: "",
      phone,
      address,
      city: "",
      governorate: governorate as EgyptGovernorate,
      country: "Egypt",
    },
    items: items.map((value) => {
      const item =
        typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
      return {
        id: String(item["id"] ?? "unknown"),
        qty: Number(item["qty"] ?? 0),
        size: String(item["size"] ?? "N/A"),
        color: String(item["color"] ?? "N/A"),
        ...(typeof item["dimension"] === "string" ? { dimension: item["dimension"] } : {}),
        name: String(item["name"] ?? "Unknown item"),
        price: Number(item["price"] ?? 0),
        ...(typeof item["line_id"] === "string" ? { lineId: item["line_id"] } : {}),
        restockedQuantity: Number(item["restocked_quantity"] ?? 0),
      };
    }),
    subtotal: Number(row["subtotal"] ?? 0),
    shipping: Number(row["shipping_cost"] ?? 0),
    total: Number(row["total_amount"] ?? 0),
    status: statuses[status] || "Pending",
    ...(typeof row["restocked_at"] === "string" ? { restockedAt: row["restocked_at"] } : {}),
    ...(typeof row["inventory_applied_at"] === "string"
      ? { inventoryAppliedAt: row["inventory_applied_at"] }
      : {}),
  };
}

function Admin() {
  const s = useStore();
  const reloadProducts = s.reloadProducts;
  const [tab, setTab] = useState<AdminTab>("products");
  const [editing, setEditing] = useState<Product | null>(null);
  /** Last Supabase rejection, shown inside the editor instead of only as a toast. */
  const [saveError, setSaveError] = useState<string | null>(null);
  const [role, setRole] = useState<DashboardRole | null | undefined>(undefined);
  const [dashboardEmail, setDashboardEmail] = useState("");
  const [all, setAll] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscribers, setSubscribers] = useState<LocalEmailPreference[]>([]);
  const [analytics, setAnalytics] = useState<LocalAnalyticsEvent[]>([]);
  const [bundleSettings, setBundleSettings] = useState<CustomBundleSettings>(() =>
    readCustomBundleSettings(),
  );
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const isArabic = s.lang === "ar";
  const text = ADMIN_COPY[isArabic ? "ar" : "en"];

  /** Orders only — used by the realtime subscription so a new checkout does not
   * trigger a full dashboard reload. */
  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setOrders((data ?? []).map(mapCloudOrder).filter((order): order is Order => !!order));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        setRole(null);
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();
      if (profileError) throw profileError;
      if (profile.role !== "admin" && profile.role !== "staff") {
        setRole(null);
        return;
      }
      setRole(profile.role);
      setDashboardEmail(authData.user.email ?? "");
      await loadOrders();

      if (profile.role === "admin") {
        await reloadProducts();
        // Join the variant matrix so the product editor opens with its sizes.
        const withVariants = await supabase
          .from("products")
          .select("*, product_variants(*)")
          .order("name");
        let cloudProducts = withVariants.data;
        if (withVariants.error) {
          const plain = await supabase.from("products").select("*").order("name");
          if (plain.error) throw plain.error;
          cloudProducts = plain.data;
        }
        if (!cloudProducts?.length) {
          const { data: seededProducts, error: seedError } = await supabase
            .from("products")
            .upsert(readProducts(STATIC_PRODUCTS).map(productToCloud))
            .select("*")
            .order("name");
          if (seedError) throw seedError;
          cloudProducts = seededProducts;
        }
        setAll((cloudProducts ?? []).map(productFromCloud));
        setSubscribers(readLocalEmailPreferences());
        setAnalytics(readLocalAnalyticsEvents());
        setBundleSettings(readCustomBundleSettings());
      } else {
        setAll([]);
        setSubscribers([]);
        setAnalytics([]);
      }
    } catch (error) {
      console.error("Could not load admin dashboard data", error);
      setRole(null);
      toast.error(error instanceof Error ? error.message : "Could not load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [loadOrders, reloadProducts]);

  useEffect(() => {
    const onLocalChange = () => {
      if (role !== "admin") return;
      setSubscribers(readLocalEmailPreferences());
      setAnalytics(readLocalAnalyticsEvents());
      setBundleSettings(readCustomBundleSettings());
    };
    const onAnalyticsChange = () => {
      if (role === "admin") setAnalytics(readLocalAnalyticsEvents());
    };
    window.addEventListener(LOCAL_DATA_EVENT, onLocalChange);
    window.addEventListener(LOCAL_ANALYTICS_EVENT, onAnalyticsChange);
    window.addEventListener("storage", onLocalChange);
    void load();
    return () => {
      window.removeEventListener(LOCAL_DATA_EVENT, onLocalChange);
      window.removeEventListener(LOCAL_ANALYTICS_EVENT, onAnalyticsChange);
      window.removeEventListener("storage", onLocalChange);
    };
  }, [load, role]);

  /**
   * The dashboard is often parked in a background tab on a phone, where timers
   * and sockets are frozen. Re-read orders and inventory as soon as it is looked
   * at again so the numbers are never a snapshot from hours ago.
   */
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [load]);

  /**
   * Live orders: a checkout on any device appears here within a second, and a
   * status change made by another staff member lands immediately. Requires the
   * orders table to be published to supabase_realtime (see
   * 20261027160000_enable_orders_realtime.sql).
   */
  useEffect(() => {
    if (role !== "admin" && role !== "staff") return;

    const copy = ADMIN_COPY[isArabic ? "ar" : "en"];
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshSoon = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void loadOrders().catch((error) => {
          console.error("Could not refresh orders after a realtime event", error);
        });
      }, 250);
    };

    const channel = supabase
      .channel(`roelix-orders-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        refreshSoon();
        if (payload.eventType === "INSERT") {
          const row = payload.new as Record<string, unknown>;
          const orderNumber = typeof row["order_number"] === "string" ? row["order_number"] : null;
          toast.success(copy.newOrder, orderNumber ? { description: orderNumber } : {});
        }
      })
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [isArabic, loadOrders, role]);

  async function run(action: () => void | Promise<void>, ok: string) {
    try {
      await action();
      toast.success(ok);
      await load();
      return true;
    } catch (error) {
      console.error("ROELIX admin action failed", error);
      toast.error(error instanceof Error ? error.message : "The requested action failed");
      return false;
    }
  }
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Could not sign out of the ROELIX dashboard", error);
      toast.error(error.message);
      return;
    }
    nav({ to: "/auth", search: { redirect: "/admin" } });
  };

  async function updateCloudOrderStatus(id: string, status: Order["status"]) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: status.toLowerCase() })
        .eq("id", id);
      if (error) throw error;
      toast.success(isArabic ? "تم تحديث الحالة" : "Status updated");
      await load();
    } catch (error) {
      console.error("Could not update cloud order status", error);
      toast.error(error instanceof Error ? error.message : "Could not update order status");
    }
  }

  if (role === undefined)
    return <div className="py-40 text-center text-muted-foreground">{text.loading}</div>;
  if (role === null)
    return (
      <div dir={isArabic ? "rtl" : "ltr"} className="mx-auto max-w-md py-32 text-center">
        <h1 className="font-serif text-4xl">{text.restrictedTitle}</h1>
        <p className="mt-4 text-muted-foreground">{text.restrictedBody}</p>
        <button onClick={signOut} className="btn-lux mt-8">
          {text.signOut}
        </button>
      </div>
    );

  const visibleTabs: AdminTab[] =
    role === "admin"
      ? ["products", "orders", "reviews", "subscribers", "analytics", "settings"]
      : ["orders"];
  const activeTab: AdminTab = role === "staff" ? "orders" : tab;

  const revenue = orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((total, order) => {
      const amount = order.customer.governorate ? order.total : order.total * EGP_PER_USD;
      return total + amount;
    }, 0);
  const analyticsCount = (type: LocalAnalyticsEvent["type"]) =>
    analytics.filter((event) => event.type === type).length;
  const rankValues = (events: LocalAnalyticsEvent[]) => {
    const counts = new Map<string, { label: string; count: number }>();
    events.forEach((event) => {
      const key = event.value.trim().toLocaleLowerCase();
      if (!key) return;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { label: event.value, count: 1 });
    });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  };
  const topSearches = rankValues(analytics.filter((event) => event.type === "search"));
  const topQuestions = rankValues(analytics.filter((event) => event.type === "ai_query"));
  const productActivity = new Map<string, { label: string; clicks: number; views: number }>();
  analytics
    .filter((event) => event.type === "product_click" || event.type === "product_view")
    .forEach((event) => {
      if (!event.productId) return;
      const product = all.find((item) => item.id === event.productId);
      const activity = productActivity.get(event.productId) ?? {
        label: product?.name ?? event.value,
        clicks: 0,
        views: 0,
      };
      if (event.type === "product_click") activity.clicks += 1;
      else activity.views += 1;
      productActivity.set(event.productId, activity);
    });
  const topProducts = [...productActivity.values()]
    .sort((a, b) => b.views + b.clicks - (a.views + a.clicks))
    .slice(0, 10);

  async function save(p: Product, previousVariants: ProductVariant[]) {
    setSaveError(null);
    const fail = (message: string) => {
      setSaveError(message);
      toast.error(message, { duration: 12000 });
    };

    // Normalise before validating: numbers become numbers, SKUs become unique.
    const variants = sanitizeVariants(p.variants ?? []);
    const normalized = ensureUniqueSkus(variants, p.name || "PRODUCT");
    const withSkus =
      normalized.length > 0 ? { ...p, variants: normalized } : { ...p, variants: [] };
    const hasVariants = normalized.length > 0;

    if (!p.name.trim() || !p.category.trim()) {
      fail(isArabic ? "الاسم والفئة مطلوبان" : "Name and category are required");
      return;
    }
    // With variants, the headline price is derived from the matrix on save.
    if (!hasVariants && (!Number.isFinite(p.price) || p.price <= 0)) {
      fail(isArabic ? "أدخل سعراً أكبر من صفر" : "A price above 0 is required");
      return;
    }
    if (!Number.isInteger(p.stock) || p.stock < 0) {
      fail(
        isArabic
          ? "يجب أن يكون المخزون عددًا صحيحًا لا يقل عن صفر"
          : "Stock must be a whole number of 0 or more",
      );
      return;
    }
    if (!p.images.length) {
      fail(isArabic ? "أضف صورة واحدة على الأقل" : "Add at least one image");
      return;
    }

    if (hasVariants) {
      const badIndex = normalized.findIndex(
        (variant) => (!variant.sizeName.trim() && !variant.dimension.trim()) || variant.price <= 0,
      );
      if (badIndex !== -1) {
        const bad = normalized[badIndex]!;
        fail(
          `${text.variantValidation}\n#${badIndex + 1} (${bad.sku}): ${bad.price <= 0 ? (isArabic ? "السعر مطلوب" : "price must be above 0") : isArabic ? "أدخل اسم المقاس أو الأبعاد" : "enter a size name or dimension"}`,
        );
        return;
      }
    }

    const id =
      p.id ||
      (p.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "product") +
        "-" +
        Date.now().toString(36).slice(-4);
    const product = { ...withSkus, id };

    try {
      const result = await saveCloudProduct(product, previousVariants);
      // Cache the synced row (derived price/stock/sizes) for offline first paint.
      saveLocalProduct(result.product, STATIC_PRODUCTS);
      if (result.detailsSkipped) {
        toast.warning(text.detailsColumnsMissing, { duration: 9000 });
      }
      toast.success(isArabic ? "تم حفظ المنتج" : "Product saved");
      setEditing(null);
      setSaveError(null);
      await load();
    } catch (error) {
      console.error("ROELIX product save failed", error);
      // The exact Postgres message (plus code/details/hint) stays on screen.
      fail(describeError(error));
    }
  }

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      lang={isArabic ? "ar" : "en"}
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12"
    >
      <p className="eyebrow text-gold">{text.atelier}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 sm:items-end">
        <h1 className="font-serif text-3xl leading-tight sm:text-5xl">{text.dashboard}</h1>
        <button onClick={signOut} className="eyebrow text-muted-foreground hover:text-gold">
          {text.signOut}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span className="border border-gold/50 px-3 py-1">
          {text.accountRole}: {role === "admin" ? text.roleAdmin : text.roleStaff}
        </span>
        <span>{dashboardEmail}</span>
      </div>
      {role === "admin" && (
        <p className="mt-2 text-sm text-muted-foreground">
          {text.primaryAdmin}:{" "}
          <a href={`mailto:${STORE_SUPPORT_EMAIL}`} className="hover:text-gold">
            {STORE_SUPPORT_EMAIL}
          </a>
        </p>
      )}

      <div
        className={`mt-6 grid gap-3 sm:mt-8 sm:gap-4 ${role === "admin" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1"}`}
      >
        {(role === "admin"
          ? [
              [text.revenue, s.fmtEgp(revenue)],
              [text.orders, orders.length],
              [text.products, all.length],
              [text.lowStock, all.filter((p) => p.stock < 5).length],
            ]
          : [[text.orders, orders.length]]
        ).map(([k, v]) => (
          <div key={k} className="border p-4 sm:p-5">
            <p className="eyebrow text-[0.6rem] text-muted-foreground sm:text-[0.7rem]">{k}</p>
            <p className="mt-1.5 font-serif text-2xl sm:mt-2 sm:text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <div
        className="-mx-4 mt-8 flex gap-5 overflow-x-auto border-b px-4 pb-0 eyebrow sm:mx-0 sm:mt-10 sm:gap-6 sm:px-0"
        role="tablist"
        aria-label={text.dashboard}
      >
        {visibleTabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => setTab(t)}
            className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 ${activeTab === t ? "border-b-2 border-gold text-gold" : "text-muted-foreground"}`}
          >
            {t === "analytics" && <BarChart3 size={16} aria-hidden="true" />}
            {t === "settings" && <Settings2 size={16} aria-hidden="true" />}
            {text[t]}
          </button>
        ))}
      </div>

      {activeTab === "products" ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setEditing(blank())}
            className="mb-4 inline-flex w-full items-center justify-center gap-2 bg-navy px-5 py-3 eyebrow text-navy-foreground hover:opacity-90 sm:w-auto sm:justify-start"
          >
            <Plus size={14} /> {text.addProduct}
          </button>
          {loading && (
            <p role="status" className="mb-4 text-sm text-muted-foreground">
              {text.loading}
            </p>
          )}
          {/* Mobile: cards instead of a horizontally scrolling table */}
          <ul className="space-y-3 sm:hidden">
            {all.map((p) => (
              <li key={p.id} className="border p-3">
                <div className="flex gap-3">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt="" className="h-20 w-16 shrink-0 object-cover" />
                  ) : (
                    <div className="h-20 w-16 shrink-0 bg-muted" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-base leading-tight">{p.name}</p>
                    {isArabic && p.nameAr && (
                      <p dir="rtl" className="text-xs text-muted-foreground">
                        {p.nameAr}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{p.category}</span>
                      <span className={p.stock < 5 ? "text-destructive" : ""}>
                        {text.stock}: {p.stock}
                      </span>
                      <span className="font-medium text-foreground">{s.fmt(p.price)}</span>
                    </div>
                    {((p.variants?.length ?? 0) > 0 || !p.isPublished) && (
                      <div className="mt-1 flex flex-wrap gap-x-2 text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
                        {(p.variants?.length ?? 0) > 0 && (
                          <span>
                            {p.variants?.length} {text.variantLabel}
                          </span>
                        )}
                        {!p.isPublished && <span>{text.hidden}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex justify-end border-t pt-2">
                  <ProductActions product={p} isArabic={isArabic} onEdit={setEditing} onRun={run} />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto border sm:block">
            <table className="w-full text-sm">
              <thead className="bg-muted text-start eyebrow">
                <tr>
                  <th className="p-3 text-start">{text.product}</th>
                  <th className="p-3 text-start">{text.category}</th>
                  <th className="p-3 text-start">{text.price}</th>
                  <th className="p-3 text-start">{text.stock}</th>
                  <th className="p-3 text-end">{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {all.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {p.images[0] ? (
                          <img src={p.images[0]} alt="" className="h-14 w-12 object-cover" />
                        ) : (
                          <div className="h-14 w-12 bg-muted" aria-hidden="true" />
                        )}
                        <div>
                          <p className="font-serif text-lg">{p.name}</p>
                          {isArabic && p.nameAr && (
                            <p dir="rtl" className="text-sm text-muted-foreground">
                              {p.nameAr}
                            </p>
                          )}
                          {p.variants && p.variants.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {p.variants.length} {text.variantLabel}
                            </p>
                          )}
                          {!p.isPublished && (
                            <p className="text-xs text-muted-foreground">{text.hidden}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3">{s.fmt(p.price)}</td>
                    <td className={`p-3 ${p.stock < 5 ? "text-destructive" : ""}`}>{p.stock}</td>
                    <td className="p-3">
                      <ProductActions
                        product={p}
                        isArabic={isArabic}
                        onEdit={setEditing}
                        onRun={run}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "orders" ? (
        <div className="mt-6 space-y-4">
          {loading && (
            <p role="status" className="text-sm text-muted-foreground">
              {text.loading}
            </p>
          )}
          {!loading && orders.length === 0 && (
            <p className="text-muted-foreground">{text.noOrders}</p>
          )}
          {orders.map((o) => (
            <div key={o.id} className="border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-serif text-2xl">{o.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString(isArabic ? "ar-EG" : undefined)}
                    {o.payment && ` · ${o.payment === "cod" ? text.cashOnDelivery : text.card}`}
                  </p>
                  {(o.restockedAt || o.items.some((item) => (item.restockedQuantity ?? 0) > 0)) && (
                    <p className="mt-1 inline-block border border-emerald/40 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-emerald">
                      {text.stockRestored}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-serif text-xl">
                    {o.customer.governorate ? s.fmtEgp(o.total) : s.fmt(o.total)}
                  </span>
                  <select
                    aria-label={isArabic ? "حالة الطلب" : "Order status"}
                    value={o.status}
                    onChange={(e) =>
                      void updateCloudOrderStatus(o.id, e.target.value as Order["status"])
                    }
                    className="border bg-background px-3 py-2 text-sm"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {text.statuses[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                <div>
                  <p className="eyebrow mb-1 text-muted-foreground">{text.customer}</p>
                  <p>
                    {o.customer.name}
                    {o.customer.email && ` · ${o.customer.email}`} · {o.customer.phone}
                  </p>
                  <p className="text-muted-foreground">
                    {[
                      o.customer.address,
                      o.customer.city,
                      o.customer.governorate,
                      o.customer.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {o.customer.governorate && (
                    <p className="text-muted-foreground">
                      الشحن عبر شركة بوستا (Bosta): {s.fmtEgp(o.shipping)}
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="eyebrow mb-1 text-muted-foreground">{text.items}</p>
                  {o.items.map((item, index) => {
                    const restocked = item.restockedQuantity ?? 0;
                    const remaining = Math.max(0, item.qty - restocked);
                    const canRestock =
                      role === "admin" && Boolean(o.inventoryAppliedAt) && Boolean(item.lineId);
                    return (
                      <div
                        key={item.lineId ?? `${item.id}-${index}`}
                        className="border-b border-border/40 pb-2 last:border-0 last:pb-0"
                      >
                        <p>
                          {item.qty} × {item.name} ({item.size}
                          {item.dimension ? `, ${item.dimension}` : ""}, {item.color})
                        </p>
                        {(restocked > 0 || remaining === 0) && (
                          <p className="text-[0.68rem] text-muted-foreground">
                            {text.restocked}: {restocked} / {item.qty}
                          </p>
                        )}
                        {canRestock && remaining > 0 && item.lineId && (
                          <OrderLineRestock
                            orderId={o.id}
                            lineId={item.lineId}
                            remaining={remaining}
                            isArabic={isArabic}
                            onRestocked={loadOrders}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === "subscribers" ? (
        <div className="mt-6 space-y-4">
          {loading && (
            <p role="status" className="text-sm text-muted-foreground">
              {text.loading}
            </p>
          )}
          {!loading && subscribers.length === 0 && (
            <p className="text-muted-foreground">{text.noSubscribers}</p>
          )}
          {subscribers.map((subscriber) => (
            <div
              key={subscriber.email}
              className="flex flex-wrap items-center justify-between gap-4 border p-5"
            >
              <div>
                <p className="font-serif text-lg">{subscriber.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(subscriber.createdAt).toLocaleString(isArabic ? "ar-EG" : undefined)} ·{" "}
                  {subscriber.source === "footer" ? text.footerSource : text.checkoutSource}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {subscriber.newsletterOptIn && (
                  <span className="border border-gold/50 px-3 py-1">{text.newsletter}</span>
                )}
                {subscriber.orderTrackingOptIn && (
                  <span className="border border-gold/50 px-3 py-1">{text.orderTracking}</span>
                )}
              </div>
              <button
                type="button"
                aria-label={`${text.removeEmail}: ${subscriber.email}`}
                onClick={() =>
                  run(
                    () => removeLocalEmailPreference(subscriber.email),
                    isArabic ? "تم حذف البريد المحفوظ" : "Saved email removed",
                  )
                }
                className="text-sm text-muted-foreground hover:text-destructive"
              >
                {text.removeEmail}
              </button>
            </div>
          ))}
        </div>
      ) : activeTab === "reviews" ? (
        <ReviewsPanel
          isArabic={isArabic}
          productName={(id) => all.find((product) => product.id === id)?.name ?? ""}
        />
      ) : activeTab === "analytics" ? (
        <section className="mt-6 space-y-8" aria-label={text.analytics}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl">{text.analytics}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text.analyticsDescription}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm(text.clearAnalyticsConfirm)) {
                  void run(clearLocalAnalyticsEvents, text.clearAnalyticsSuccess);
                }
              }}
              className="border px-4 py-2 text-sm text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              {text.clearAnalytics}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [text.totalSearches, analyticsCount("search")],
              [text.totalViews, analyticsCount("product_view")],
              [text.totalClicks, analyticsCount("product_click")],
              [text.totalAIQueries, analyticsCount("ai_query")],
            ].map(([label, value]) => (
              <div key={label} className="border p-5">
                <p className="eyebrow text-muted-foreground">{label}</p>
                <p className="mt-2 font-serif text-3xl">{value}</p>
              </div>
            ))}
          </div>
          {analytics.length === 0 ? (
            <p className="border p-6 text-muted-foreground">{text.noAnalytics}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <RankedList title={text.searchTerms} items={topSearches} />
              <div className="border p-5">
                <h3 className="font-serif text-2xl">{text.topProducts}</h3>
                <ol className="mt-4 space-y-3">
                  {topProducts.map((product, index) => (
                    <li
                      key={product.label}
                      className="flex items-center justify-between gap-4 border-t pt-3 text-sm"
                    >
                      <span>
                        <span className="me-3 text-muted-foreground">{index + 1}.</span>
                        {product.label}
                      </span>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {text.views}: {product.views} · {text.clicks}: {product.clicks}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <RankedList title={text.topQuestions} items={topQuestions} />
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6 max-w-2xl space-y-5 border p-6" aria-label={text.settings}>
          <div className="space-y-5 border-t pt-6">
            <div>
              <h3 className="font-serif text-2xl">{text.bundleSettingsTitle}</h3>
            </div>
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={bundleSettings.enabled}
                onChange={(event) =>
                  setBundleSettings((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
                className="accent-[var(--gold)]"
              />
              {text.bundleEnabled}
            </label>
            <label className="block max-w-xs space-y-2">
              <span className="eyebrow">{text.bundleDiscount}</span>
              <input
                type="number"
                min="0"
                max="50"
                step="1"
                value={bundleSettings.discountPercent}
                onChange={(event) =>
                  setBundleSettings((current) => ({
                    ...current,
                    discountPercent: Number(event.target.value),
                  }))
                }
                className="w-full border bg-background px-3 py-3 text-sm outline-none focus:border-gold"
              />
            </label>
            <button
              type="button"
              className="btn-lux"
              onClick={() => {
                try {
                  saveCustomBundleSettings(bundleSettings);
                  toast.success(text.bundleSettingsSaved);
                } catch (error) {
                  console.error("Could not save custom bundle settings", error);
                  toast.error(error instanceof Error ? error.message : "Could not save settings");
                }
              }}
            >
              {text.saveBundleSettings}
            </button>
          </div>
        </section>
      )}

      {editing && (
        <Editor
          initial={editing}
          categories={[...new Set([...CATEGORIES, ...all.map((product) => product.category)])]}
          products={all}
          isArabic={isArabic}
          error={saveError}
          onClose={() => {
            setSaveError(null);
            setEditing(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}

function RankedList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
}) {
  return (
    <div className="border p-5">
      <h3 className="font-serif text-2xl">{title}</h3>
      <ol className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-4 border-t pt-3 text-sm"
          >
            <span>
              <span className="me-3 text-muted-foreground">{index + 1}.</span>
              {item.label}
            </span>
            <span className="text-muted-foreground">{item.count}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Editor({
  initial,
  categories,
  products,
  isArabic,
  error,
  onClose,
  onSave,
}: {
  initial: Product;
  categories: string[];
  products: Product[];
  isArabic: boolean;
  /** Exact Supabase rejection shown at the top of the form, not just a toast. */
  error: string | null;
  onClose: () => void;
  onSave: (p: Product, previousVariants: ProductVariant[]) => void;
}) {
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const text = ADMIN_COPY[isArabic ? "ar" : "en"];
  const [p, setP] = useState<Product>(initial);
  const [relatedCategory, setRelatedCategory] = useState("");
  const [relatedSearch, setRelatedSearch] = useState("");
  const [uploading, setUploading] = useState(0);
  // Storage folder is fixed for the editing session, even before the first save.
  const [imageFolder] = useState(() => initial.id || `draft-${Date.now().toString(36)}`);
  const variants = p.variants ?? [];
  const previousVariants = initial.variants ?? [];
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const inp = "w-full border bg-background px-3 py-2 text-sm outline-none focus:border-gold";
  const availableRelatedProducts = products.filter((product) => {
    if (product.id === p.id) return false;
    if (relatedCategory && product.category !== relatedCategory) return false;
    const query = relatedSearch.trim().toLocaleLowerCase();
    return (
      !query ||
      `${product.name} ${product.nameAr} ${product.category}`.toLocaleLowerCase().includes(query)
    );
  });

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading((count) => count + list.length);

    for (const [index, file] of list.entries()) {
      try {
        const uploaded = await uploadProductImage({
          file,
          productId: imageFolder,
          index,
        });
        setP((current) => ({ ...current, images: [...current.images, uploaded.url] }));
        if (uploaded.stored === "inline") {
          toast.warning(text.imageInlineWarning, { duration: 8000 });
        }
      } catch (error) {
        console.error(`Could not process product image ${file.name}`, error);
        toast.error(error instanceof Error ? error.message : `Couldn't read ${file.name}`);
      } finally {
        setUploading((count) => Math.max(0, count - 1));
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        dir={isArabic ? "rtl" : "ltr"}
        lang={isArabic ? "ar" : "en"}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain bg-background p-4 shadow-lux sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-3xl">{initial.id ? text.editProduct : text.newProduct}</h2>
          <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            ref={errorRef}
            role="alert"
            dir="ltr"
            className="mt-4 space-y-1 border border-destructive/60 bg-destructive/5 p-3 text-start text-sm text-destructive"
          >
            <p className="font-semibold">
              {isArabic ? "رفض Supabase الحفظ:" : "Save failed — Supabase said:"}
            </p>
            <p className="whitespace-pre-line break-words font-mono text-xs leading-relaxed">
              {error}
            </p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(error)}
              className="eyebrow text-[0.6rem] underline underline-offset-4"
            >
              {isArabic ? "نسخ الخطأ" : "Copy error"}
            </button>
          </div>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="eyebrow">{text.name}</span>
            <input
              dir="auto"
              className={inp}
              value={p.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="eyebrow">{text.arabicName}</span>
            <input
              dir="rtl"
              className={inp}
              value={p.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="eyebrow">{text.category}</span>
            <input
              dir="auto"
              className={inp}
              list="roelix-admin-categories"
              value={p.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder={text.categoryPlaceholder}
            />
            <datalist id="roelix-admin-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1">
            <span className="eyebrow">{text.priceEgp}</span>
            <input
              type="number"
              min="0"
              step="1"
              className={inp}
              value={Math.round(p.price * EGP_PER_USD)}
              onChange={(e) => set("price", Number(e.target.value) / EGP_PER_USD)}
              disabled={variants.length > 0}
            />
            {variants.length > 0 && (
              <span className="block text-[0.65rem] leading-relaxed text-muted-foreground">
                {text.derivedHint}
              </span>
            )}
          </label>
          <label className="space-y-1">
            <span className="eyebrow">{text.stock}</span>
            <input
              type="number"
              min="0"
              step="1"
              className={inp}
              value={p.stock}
              onChange={(e) => set("stock", Number(e.target.value))}
              disabled={variants.length > 0}
            />
          </label>
          <label className="space-y-1">
            <span className="eyebrow">{text.sku}</span>
            <input
              dir="ltr"
              className={inp}
              value={p.sku ?? ""}
              placeholder="ROELIX-SKU"
              onChange={(e) => set("sku", e.target.value)}
              disabled={variants.length > 0}
            />
            {variants.length > 0 && (
              <span className="block text-[0.65rem] leading-relaxed text-muted-foreground">
                {text.derivedHint}
              </span>
            )}
          </label>
          <label className="space-y-1">
            <span className="eyebrow">{text.compareAtEgp}</span>
            <input
              type="number"
              min="0"
              step="1"
              className={inp}
              value={
                p.compareAtPrice === undefined ? "" : Math.round(p.compareAtPrice * EGP_PER_USD)
              }
              onChange={(e) => {
                const raw = e.currentTarget.value.trim();
                const egp = e.currentTarget.valueAsNumber;
                set(
                  "compareAtPrice",
                  raw === "" || !Number.isFinite(egp) ? undefined : Math.max(0, egp) / EGP_PER_USD,
                );
              }}
              disabled={variants.length > 0}
            />
            {variants.length > 0 && (
              <span className="block text-[0.65rem] leading-relaxed text-muted-foreground">
                {text.derivedHint}
              </span>
            )}
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="eyebrow">{text.sizes}</span>
            <input
              className={inp}
              value={p.sizes.join(", ")}
              onChange={(e) =>
                set(
                  "sizes",
                  e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
          <div className="sm:col-span-2">
            <VariantManager
              variants={variants}
              defaultPrice={p.price}
              sizeSuggestions={p.sizes}
              skuPrefix={p.name || "ROELIX"}
              isArabic={isArabic}
              onChange={(next) => set("variants", next)}
            />
          </div>
          <fieldset className="space-y-3 sm:col-span-2">
            <legend className="eyebrow">{text.colors}</legend>
            {p.colors.map((color, index) => (
              <div key={`${color.name}-${index}`} className="grid grid-cols-[1fr_8rem_auto] gap-2">
                <label className="sr-only" htmlFor={`product-color-name-${index}`}>
                  {text.colorName}
                </label>
                <input
                  id={`product-color-name-${index}`}
                  className={inp}
                  value={color.name}
                  placeholder={text.colorName}
                  onChange={(event) =>
                    set(
                      "colors",
                      p.colors.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                />
                <label className="sr-only" htmlFor={`product-color-hex-${index}`}>
                  {text.colorHex}
                </label>
                <input
                  type="color"
                  id={`product-color-hex-${index}`}
                  className={inp}
                  value={color.hex}
                  aria-label={`${text.colorHex} ${color.name}`}
                  onChange={(event) =>
                    set(
                      "colors",
                      p.colors.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, hex: event.target.value } : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="border px-3 text-muted-foreground hover:text-destructive"
                  aria-label={isArabic ? `حذف اللون ${color.name}` : `Remove ${color.name}`}
                  onClick={() =>
                    set(
                      "colors",
                      p.colors.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="border px-3 py-2 text-sm hover:border-gold"
              onClick={() => set("colors", [...p.colors, { name: "", hex: "#ffffff" }])}
            >
              <Plus size={14} className="me-2 inline" />
              {text.addColor}
            </button>
          </fieldset>
          <fieldset className="space-y-3 sm:col-span-2">
            <legend className="eyebrow">{text.complements}</legend>
            {products.filter((product) => product.id !== p.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">{text.noProducts}</p>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                  <label className="space-y-1">
                    <span className="eyebrow">{text.category}</span>
                    <select
                      value={relatedCategory}
                      onChange={(event) => setRelatedCategory(event.target.value)}
                      className={inp}
                    >
                      <option value="">{text.allCategories}</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="eyebrow">{text.product}</span>
                    <span className="flex items-center border px-3 focus-within:border-gold">
                      <Search size={15} className="shrink-0 text-muted-foreground" />
                      <input
                        type="search"
                        value={relatedSearch}
                        onChange={(event) => setRelatedSearch(event.target.value)}
                        placeholder={text.searchProducts}
                        className="w-full bg-transparent px-2 py-2 text-sm outline-none"
                      />
                    </span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {text.selectedProducts}: {p.frequently_bought_ids?.length ?? 0}
                </p>
                {availableRelatedProducts.length === 0 ? (
                  <p className="border p-4 text-sm text-muted-foreground">
                    {text.noMatchingProducts}
                  </p>
                ) : (
                  <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                    {availableRelatedProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex cursor-pointer items-center gap-3 border p-3 text-sm hover:border-gold"
                      >
                        <input
                          type="checkbox"
                          checked={p.frequently_bought_ids?.includes(product.id) ?? false}
                          onChange={(event) => {
                            const selected = new Set(p.frequently_bought_ids ?? []);
                            if (event.target.checked) selected.add(product.id);
                            else selected.delete(product.id);
                            set("frequently_bought_ids", [...selected]);
                          }}
                          className="accent-[var(--gold)]"
                        />
                        <img src={product.images[0]} alt="" className="h-12 w-10 object-cover" />
                        <span>{isArabic && product.nameAr ? product.nameAr : product.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </fieldset>
          <label className="space-y-1 sm:col-span-2">
            <span className="eyebrow">{text.description}</span>
            <textarea
              dir="auto"
              rows={3}
              className={inp}
              value={p.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="eyebrow">{text.detailsSection}</span>
            <textarea
              dir="auto"
              rows={4}
              className={inp}
              placeholder={text.accordionHint}
              value={p.productDetails ?? ""}
              onChange={(e) => set("productDetails", e.target.value)}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="eyebrow">{text.careSection}</span>
            <textarea
              dir="auto"
              rows={3}
              className={inp}
              placeholder={text.accordionHint}
              value={p.productCare ?? ""}
              onChange={(e) => set("productCare", e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4">
          <span className="eyebrow">{text.images}</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {p.images.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt="" className="h-24 w-20 object-cover" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() =>
                    setP((x) => ({
                      ...x,
                      images: x.images.filter((_, k) => k !== i),
                    }))
                  }
                  className="absolute -end-2 -top-2 rounded-full bg-background p-1 shadow"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed text-muted-foreground hover:text-gold">
              {uploading > 0 ? (
                <span className="px-1 text-center text-[0.6rem] uppercase tracking-[0.1em]">
                  {text.imagesUploading}
                </span>
              ) : (
                <>
                  <Plus size={18} aria-hidden="true" />
                  <span className="text-[0.55rem] uppercase tracking-[0.1em]">{text.addImage}</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  void onFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.isPublished}
            onChange={(e) => set("isPublished", e.target.checked)}
          />{" "}
          {text.visibleInShop}
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="border px-5 py-3 eyebrow">
            {text.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSave(p, previousVariants)}
            disabled={uploading > 0}
            className="bg-navy px-5 py-3 eyebrow text-navy-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {text.save}
          </button>
        </div>
      </div>
    </div>
  );
}

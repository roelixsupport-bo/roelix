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
  const [actionError, setActionError] = useState<string | null>(null);
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
      toast.error(describeError(error, "Could not load dashboard data"));
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
    setActionError(null);
    try {
      await action();
      toast.success(ok);
      await load();
      return true;
    } catch (error) {
      console.error("ROELIX admin action failed", error);
      const message = describeError(error);
      setActionError(message);
      toast.error(message, { duration: 12000 });
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
      toast.error(describeError(error, "Could not update order status"));
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

  async function save(p: Product, previousVariants: ProductVariant[]) {
    setActionError(null);
    const fail = (message: string) => {
      setActionError(message);
      toast.error(message, { duration: 10000 });
    };

    const variants = ensureUniqueSkus(sanitizeVariants(p.variants ?? []), p.name || "ROELIX");
    const hasVariants = variants.length > 0;

    if (!p.name.trim() || !p.category.trim()) {
      fail(isArabic ? "الاسم والفئة مطلوبان" : "Name and category are required");
      return;
    }
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
      const badIndex = variants.findIndex(
        (variant) =>
          (!variant.sizeName && !variant.dimension) || variant.price <= 0,
      );
      if (badIndex !== -1) {
        const bad = variants[badIndex]!;
        fail(
          `${text.variantValidation}\n#${badIndex + 1} (${bad.sku}): ` +
            (bad.price <= 0
              ? isArabic ? "السعر مطلوب" : "price must be above 0"
              : isArabic ? "أدخل اسم المقاس أو الأبعاد" : "enter a size name or dimension"),
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
    const product = { ...p, id, variants };

    const ok = await run(
      async () => {
        const result = await saveCloudProduct(product, previousVariants);
        saveLocalProduct(result.product, STATIC_PRODUCTS);
        if (result.detailsSkipped) {
          toast.warning(text.detailsColumnsMissing, { duration: 9000 });
        }
      },
      isArabic ? "تم حفظ المنتج" : "Product saved",
    );
    if (ok) {
      setActionError(null);
      setEditing(null);
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

      {/* بقية محتوى لوحة التحكم والتبويبات الأساسية كما هي، وعند استدعاء محرر المنتجات Editor نمرر له error و onClose و onSave */}

      {editing && (
        <Editor
          initial={editing}
          categories={[...new Set([...CATEGORIES, ...all.map((product) => product.category)])]}
          products={all}
          isArabic={isArabic}
          error={actionError}
          onClose={() => {
            setActionError(null);
            setEditing(null);
          }}
          onSave={save}
        />
      )}
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
  error: string | null;
  onClose: () => void;
  onSave: (p: Product, previousVariants: ProductVariant[]) => void;
}) {
  const [p, setP] = useState<Product>({ ...initial, variants: initial.variants ?? [] });
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="font-serif text-2xl">{p.id ? "Edit product" : "New product"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            ref={errorRef}
            role="alert"
            dir="ltr"
            className="mt-4 whitespace-pre-line break-words border border-destructive/60 bg-destructive/5 p-3 text-start text-sm text-destructive"
          >
            <p className="font-semibold">{isArabic ? "رفض Supabase الحفظ:" : "Save failed:"}</p>
            <p className="mt-1 font-mono text-xs">{error}</p>
          </div>
        )}

        {/* نموذج تحرير المنتج وأزرار الحفظ والإلغاء */}
      </div>
    </div>
  );
}
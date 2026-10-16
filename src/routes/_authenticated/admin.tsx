import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BarChart3, Pencil, Plus, Search, Settings2, Trash2, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import {
  deleteLocalProduct,
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
});

type AdminTab = "products" | "orders" | "subscribers" | "analytics" | "settings";
type DashboardRole = "admin" | "staff";

function mapCloudOrder(value: unknown): Order | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const governorate = row["governorate"];
  const status = String(row["status"]).toLowerCase();
  const statuses: Record<string, Order["status"]> = {
    pending: "Pending",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  if (
    typeof row["id"] !== "string" ||
    typeof row["customer_name"] !== "string" ||
    typeof row["phone"] !== "string" ||
    typeof row["address"] !== "string" ||
    typeof governorate !== "string" ||
    !Object.hasOwn(BOSTA_SHIPPING_RATES, governorate) ||
    !Array.isArray(row["items"]) ||
    !statuses[status]
  ) {
    return null;
  }
  const items = row["items"].flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
    const line = item as Record<string, unknown>;
    if (
      typeof line["id"] !== "string" ||
      typeof line["qty"] !== "number" ||
      typeof line["size"] !== "string" ||
      typeof line["color"] !== "string"
    ) {
      return [];
    }
    return [
      {
        id: line["id"],
        qty: line["qty"],
        size: line["size"],
        color: line["color"],
        ...(typeof line["name"] === "string" ? { name: line["name"] } : {}),
        ...(typeof line["price"] === "number" ? { price: line["price"] } : {}),
      },
    ];
  });
  return {
    id: row["id"],
    createdAt: typeof row["created_at"] === "string" ? row["created_at"] : "",
    customer: {
      name: row["customer_name"],
      email: "",
      phone: row["phone"],
      address: row["address"],
      city: "",
      governorate: governorate as EgyptGovernorate,
      country: "Egypt",
    },
    items,
    subtotal: Number(row["subtotal"]),
    shipping: Number(row["shipping_cost"]),
    total: Number(row["total_amount"]),
    status: statuses[status]!,
  };
}

function Admin() {
  const s = useStore();
  const reloadProducts = s.reloadProducts;
  const [tab, setTab] = useState<AdminTab>("products");
  const [editing, setEditing] = useState<Product | null>(null);
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
      const { data: cloudOrders, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (ordersError) throw ordersError;
      setOrders((cloudOrders ?? []).map(mapCloudOrder).filter((order): order is Order => !!order));

      if (profile.role === "admin") {
        await reloadProducts();
        const { data: initialProducts, error: productsError } = await supabase
          .from("products")
          .select("*")
          .order("name");
        if (productsError) throw productsError;
        let cloudProducts = initialProducts;
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
  }, [reloadProducts]);

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
    role === "admin" ? ["products", "orders", "subscribers", "analytics", "settings"] : ["orders"];
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

  async function save(p: Product) {
    if (!p.name.trim() || !p.category.trim() || !Number.isFinite(p.price) || p.price <= 0) {
      toast.error(
        isArabic
          ? "الاسم والفئة وسعر أكبر من صفر مطلوبة"
          : "Name, category and a price above 0 are required",
      );
      return;
    }
    if (!Number.isInteger(p.stock) || p.stock < 0) {
      toast.error(
        isArabic
          ? "يجب أن يكون المخزون عددًا صحيحًا لا يقل عن صفر"
          : "Stock must be a whole number of 0 or more",
      );
      return;
    }
    if (!p.images.length) {
      toast.error(isArabic ? "أضف صورة واحدة على الأقل" : "Add at least one image");
      return;
    }
    const id =
      p.id ||
      (p.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "product") +
        "-" +
        Date.now().toString(36).slice(-4);
    const product = { ...p, id };
    const ok = await run(
      async () => {
        const { error } = await supabase.from("products").upsert(productToCloud(product));
        if (error) throw error;
        saveLocalProduct(product, STATIC_PRODUCTS);
      },
      isArabic ? "تم حفظ المنتج" : "Product saved",
    );
    if (ok) setEditing(null);
  }

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      lang={isArabic ? "ar" : "en"}
      className="mx-auto max-w-7xl px-6 py-12"
    >
      <p className="eyebrow text-gold">{text.atelier}</p>
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-5xl">{text.dashboard}</h1>
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

      <div className={`mt-8 grid gap-4 ${role === "admin" ? "sm:grid-cols-4" : "sm:grid-cols-1"}`}>
        {(role === "admin"
          ? [
              [text.revenue, s.fmtEgp(revenue)],
              [text.orders, orders.length],
              [text.products, all.length],
              [text.lowStock, all.filter((p) => p.stock < 5).length],
            ]
          : [[text.orders, orders.length]]
        ).map(([k, v]) => (
          <div key={k} className="border p-5">
            <p className="eyebrow text-muted-foreground">{k}</p>
            <p className="mt-2 font-serif text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <div
        className="mt-10 flex flex-wrap gap-6 border-b eyebrow"
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
            className={`inline-flex items-center gap-2 pb-3 ${activeTab === t ? "border-b-2 border-gold text-gold" : "text-muted-foreground"}`}
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
            className="mb-4 inline-flex items-center gap-2 bg-navy px-5 py-3 eyebrow text-navy-foreground hover:opacity-90"
          >
            <Plus size={14} /> {text.addProduct}
          </button>
          {loading && (
            <p role="status" className="mb-4 text-sm text-muted-foreground">
              {text.loading}
            </p>
          )}
          <div className="overflow-x-auto border">
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
                        <img src={p.images[0]} alt="" className="h-14 w-12 object-cover" />
                        <div>
                          <p className="font-serif text-lg">{p.name}</p>
                          {isArabic && p.nameAr && (
                            <p dir="rtl" className="text-sm text-muted-foreground">
                              {p.nameAr}
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
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          aria-label={isArabic ? "تغيير الظهور" : "Toggle visibility"}
                          title={
                            p.isPublished
                              ? isArabic
                                ? "إخفاء المنتج"
                                : "Hide product"
                              : isArabic
                                ? "إظهار المنتج"
                                : "Show product"
                          }
                          onClick={() =>
                            run(
                              async () => {
                                const updated = { ...p, isPublished: !p.isPublished };
                                const { error } = await supabase
                                  .from("products")
                                  .upsert(productToCloud(updated));
                                if (error) throw error;
                                saveLocalProduct(updated, STATIC_PRODUCTS);
                              },
                              p.isPublished ? text.hiddenFromShop : text.visibleInShopSuccess,
                            )
                          }
                          className="hover:text-gold"
                        >
                          {p.isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          type="button"
                          aria-label={isArabic ? "تعديل المنتج" : "Edit product"}
                          title={isArabic ? "تعديل المنتج" : "Edit product"}
                          onClick={() => setEditing(p)}
                          className="hover:text-gold"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={isArabic ? "حذف المنتج" : "Delete product"}
                          title={isArabic ? "حذف المنتج" : "Delete product"}
                          onClick={() => {
                            const isBuiltIn = STATIC_PRODUCTS.some(
                              (product) => product.id === p.id,
                            );
                            const prompt = isBuiltIn
                              ? isArabic
                                ? `إخفاء ${p.name} من المتجر؟`
                                : `Hide ${p.name} from the shop?`
                              : isArabic
                                ? `حذف ${p.name}؟`
                                : `Delete ${p.name}?`;
                            if (!confirm(prompt)) return;
                            if (isBuiltIn) {
                              run(async () => {
                                const { error } = await supabase
                                  .from("products")
                                  .upsert(productToCloud({ ...p, isPublished: false }));
                                if (error) throw error;
                                saveLocalProduct({ ...p, isPublished: false }, STATIC_PRODUCTS);
                              }, text.hiddenFromShop);
                              return;
                            }
                            run(async () => {
                              const { error } = await supabase
                                .from("products")
                                .delete()
                                .eq("id", p.id);
                              if (error) throw error;
                              deleteLocalProduct(p.id, STATIC_PRODUCTS);
                            }, text.productDeleted);
                          }}
                          className="hover:text-destructive"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
                <div>
                  <p className="eyebrow mb-1 text-muted-foreground">{text.items}</p>
                  {o.items.map((i, k) => (
                    <p key={k}>
                      {i.qty} × {i.name} ({i.size}, {i.color})
                    </p>
                  ))}
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
          onClose={() => setEditing(null)}
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
  onClose,
  onSave,
}: {
  initial: Product;
  categories: string[];
  products: Product[];
  isArabic: boolean;
  onClose: () => void;
  onSave: (p: Product) => void;
}) {
  const text = ADMIN_COPY[isArabic ? "ar" : "en"];
  const [p, setP] = useState<Product>(initial);
  const [relatedCategory, setRelatedCategory] = useState("");
  const [relatedSearch, setRelatedSearch] = useState("");
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

  function onFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(async (f) => {
      if (f.size > 15 * 1024 * 1024) {
        toast.error(`${f.name} is over 15MB`);
        return;
      }
      try {
        const url = await compress(f);
        setP((x) => ({ ...x, images: [...x.images, url] }));
      } catch (error) {
        console.error(`Could not process product image ${f.name}`, error);
        toast.error(error instanceof Error ? error.message : `Couldn't read ${f.name}`);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        dir={isArabic ? "rtl" : "ltr"}
        lang={isArabic ? "ar" : "en"}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-background p-8 shadow-lux"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-3xl">{initial.id ? text.editProduct : text.newProduct}</h2>
          <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"}>
            <X size={18} />
          </button>
        </div>
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
            />
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
            />
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
            <label className="flex h-24 w-20 cursor-pointer items-center justify-center border border-dashed text-muted-foreground hover:text-gold">
              <Plus size={18} />
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => onFiles(e.target.files)}
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
            onClick={() => onSave(p)}
            className="bg-navy px-5 py-3 eyebrow text-navy-foreground"
          >
            {text.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shrinks photos to max 1400px JPEG so they store quickly online.
async function compress(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

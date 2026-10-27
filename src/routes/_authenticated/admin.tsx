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
    productDetails: "Product Details",
    productCare: "Product Care & Washing Instructions",
    images: "Images (comma separated URLs)",
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
    productDetails: "تفاصيل المنتج",
    productCare: "تعليمات العناية والغسيل",
    images: "الصور (روابط مفصولة بفواصل)",
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

const blank = (): Product & { product_details?: string; product_care?: string; variants?: any[] } => ({
  id: "",
  name: "",
  nameAr: "",
  category: "Bedding Sets",
  price: 0,
  images: [],
  description: "",
  product_details: "",
  product_care: "",
  origin: "Egypt",
  stock: 0,
  colors: [{ name: "White", hex: "#ffffff" }],
  sizes: ["Queen", "King"],
  frequently_bought_ids: [],
  isPublished: true,
  variants: [],
});

type AdminTab = "products" | "orders" | "subscribers" | "analytics" | "settings";
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
    items: items.map((item: any) => ({
        id: item?.id ?? "unknown",
        qty: item?.qty ?? 0,
        size: item?.size ?? "N/A",
        color: item?.color ?? "N/A",
        name: item?.name ?? "Unknown item",
        price: item?.price ?? 0
    })),
    subtotal: Number(row["subtotal"] ?? 0),
    shipping: Number(row["shipping_cost"] ?? 0),
    total: Number(row["total_amount"] ?? 0),
    status: statuses[status] || "Pending",
  };
}

function Admin() {
  const s = useStore();
  const reloadProducts = s.reloadProducts;
  const [tab, setTab] = useState<AdminTab>("products");
  const [editing, setEditing] = useState<(Product & { product_details?: string; product_care?: string; variants?: any[] }) | null>(null);
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
      
      const mappedOrders = (cloudOrders ?? []).map(mapCloudOrder).filter((order): order is Order => !!order);
      setOrders(mappedOrders);

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

  async function saveProduct(p: Product & { product_details?: string; product_care?: string; variants?: any[] }) {
    if (!p.name.trim() || !p.category.trim() || !Number.isFinite(p.price) || p.price <= 0) {
      toast.error(isArabic ? "الاسم والفئة وسعر أكبر من صفر مطلوبة" : "Name, category and a price above 0 are required");
      return;
    }
    const id =
      p.id ||
      (p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product") +
        "-" +
        Date.now().toString(36).slice(-4);
    
    const productToSave = { ...p, id };
    const ok = await run(
      async () => {
        // 1. حفظ المنتج الأساسي
        const { error } = await supabase.from("products").upsert({
          ...productToCloud(productToSave),
          product_details: productToSave.product_details,
          product_care: productToSave.product_care,
        });
        if (error) throw error;

        // 2. حفظ المتغيرات إن وجدت
        if (p.variants && p.variants.length > 0) {
          const variantsToSave = p.variants.map((v: any) => ({
            product_id: id,
            sku: v.sku || `${id}-${v.size_name || 'std'}`,
            size_name: v.size_name || "",
            dimension: v.dimension || "",
            price: Number(v.price) || p.price,
            compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
            stock: Number(v.stock) || p.stock,
          }));

          const { error: varError } = await supabase
            .from("product_variants")
            .upsert(variantsToSave, { onConflict: 'sku' });
          if (varError) console.error("Error saving variants:", varError);
        }

        saveLocalProduct(productToSave, STATIC_PRODUCTS);
      },
      isArabic ? "تم حفظ المنتج بنجاح" : "Product saved",
    );
    if (ok) setEditing(null);
  }

  return (
    <div dir={isArabic ? "rtl" : "ltr"} lang={isArabic ? "ar" : "en"} className="mx-auto max-w-7xl px-6 py-12">
      <p className="eyebrow text-gold">{text.atelier}</p>
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-5xl">{text.dashboard}</h1>
        <button onClick={signOut} className="eyebrow text-muted-foreground hover:text-gold">
          {text.signOut}
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          [text.revenue, s.fmtEgp(revenue)],
          [text.orders, orders.length],
          [text.products, all.length],
          [text.lowStock, all.filter((p) => p.stock < 5).length],
        ].map(([k, v]) => (
          <div key={k} className="border p-5">
            <p className="eyebrow text-muted-foreground">{k}</p>
            <p className="mt-2 font-serif text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-6 border-b eyebrow" role="tablist">
        {visibleTabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => setTab(t)}
            className={`inline-flex items-center gap-2 pb-3 ${activeTab === t ? "border-b-2 border-gold text-gold" : "text-muted-foreground"}`}
          >
            {text[t]}
          </button>
        ))}
      </div>

      {activeTab === "products" && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setEditing(blank())}
            className="mb-4 inline-flex items-center gap-2 bg-navy px-5 py-3 eyebrow text-navy-foreground hover:opacity-90"
          >
            <Plus size={14} /> {text.addProduct}
          </button>
          
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
                          {isArabic && p.nameAr && <p className="text-sm text-muted-foreground">{p.nameAr}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3">{s.fmt(p.price)}</td>
                    <td className={`p-3 ${p.stock < 5 ? "text-destructive" : ""}`}>{p.stock}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setEditing(p)} className="hover:text-gold" title="Edit">
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* نافذة تعديل / إضافة منتج (Modal) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-background border p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="font-serif text-2xl">{editing.id ? text.editProduct : text.newProduct}</h2>
              <button onClick={() => setEditing(null)}><X size={20} /></button>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="block text-xs uppercase mb-1">{text.name}</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full border p-2 bg-background"
                />
              </div>

              <div>
                <label className="block text-xs uppercase mb-1">{text.arabicName}</label>
                <input
                  type="text"
                  value={editing.nameAr || ""}
                  onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })}
                  className="w-full border p-2 bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase mb-1">{text.category}</label>
                  <input
                    type="text"
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="w-full border p-2 bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase mb-1">{text.priceEgp}</label>
                  <input
                    type="number"
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                    className="w-full border p-2 bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase mb-1">{text.stock}</label>
                <input
                  type="number"
                  value={editing.stock}
                  onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })}
                  className="w-full border p-2 bg-background"
                />
              </div>

              <div>
                <label className="block text-xs uppercase mb-1">{text.images}</label>
                <input
                  type="text"
                  value={editing.images.join(", ")}
                  onChange={(e) => setEditing({ ...editing, images: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  className="w-full border p-2 bg-background"
                  placeholder="https://... , https://..."
                />
              </div>

              <div>
                <label className="block text-xs uppercase mb-1">{text.description}</label>
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full border p-2 bg-background h-20"
                />
              </div>

              {/* حقول تفاصيل المنتج وتعليمات العناية */}
              <div>
                <label className="block text-xs uppercase mb-1">{text.productDetails}</label>
                <textarea
                  value={editing.product_details || ""}
                  onChange={(e) => setEditing({ ...editing, product_details: e.target.value })}
                  className="w-full border p-2 bg-background h-20"
                  placeholder="مواصفات الخامة والحشو..."
                />
              </div>

              <div>
                <label className="block text-xs uppercase mb-1">{text.productCare}</label>
                <textarea
                  value={editing.product_care || ""}
                  onChange={(e) => setEditing({ ...editing, product_care: e.target.value })}
                  className="w-full border p-2 bg-background h-20"
                  placeholder="تعليمات الغسيل والعناية..."
                />
              </div>

              {/* قسم إدارة المتغيرات والمقاسات (Variants Section) */}
              <div className="border-t pt-4 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-serif text-md text-[#0B132B]">المقاسات والخِيارَات المتغيرة (Variants & SKUs)</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const currentVariants = editing.variants || [];
                      setEditing({
                        ...editing,
                        variants: [...currentVariants, { sku: '', size_name: '', dimension: '', price: editing.price, compare_at_price: '', stock: editing.stock }]
                      });
                    }}
                    className="text-xs bg-navy text-white px-3 py-1.5 rounded"
                  >
                    + إضافة مقاس / خيار
                  </button>
                </div>

                <div className="space-y-3">
                  {(editing.variants || []).map((v: any, index: number) => (
                    <div key={index} className="grid grid-cols-6 gap-2 p-3 border bg-muted/30 rounded relative items-center">
                      <input
                        type="text"
                        placeholder="اسم المقاس (مثال: Medium)"
                        value={v.size_name || ''}
                        onChange={(e) => {
                          const updated = [...(editing.variants || [])];
                          updated[index].size_name = e.target.value;
                          setEditing({ ...editing, variants: updated });
                        }}
                        className="border p-1.5 text-xs bg-background col-span-2"
                      />
                      <input
                        type="text"
                        placeholder="الأبعاد (مثال: 50x70 cm)"
                        value={v.dimension || ''}
                        onChange={(e) => {
                          const updated = [...(editing.variants || [])];
                          updated[index].dimension = e.target.value;
                          setEditing({ ...editing, variants: updated });
                        }}
                        className="border p-1.5 text-xs bg-background col-span-2"
                      />
                      <input
                        type="number"
                        placeholder="السعر"
                        value={v.price || ''}
                        onChange={(e) => {
                          const updated = [...(editing.variants || [])];
                          updated[index].price = e.target.value;
                          setEditing({ ...editing, variants: updated });
                        }}
                        className="border p-1.5 text-xs bg-background"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (editing.variants || []).filter((_, i) => i !== index);
                          setEditing({ ...editing, variants: updated });
                        }}
                        className="text-destructive text-xs text-center font-bold"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border">{text.cancel}</button>
              <button onClick={() => saveProduct(editing)} className="px-5 py-2 bg-navy text-white">{text.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
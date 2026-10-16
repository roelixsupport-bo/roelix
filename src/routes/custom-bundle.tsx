import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_CUSTOM_BUNDLE_SETTINGS,
  readCustomBundleSettings,
  type CustomBundleSettings,
} from "@/lib/local-data";
import { useStore, type Product } from "@/lib/store";

export const Route = createFileRoute("/custom-bundle")({
  head: () => ({
    meta: [
      { title: "Custom Bedding Bundler — ROELIX" },
      {
        name: "description",
        content: "Create a bespoke ROELIX bedding set with coordinated linens and accessories.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: CustomBundle,
});

type Variant = { size: string; color: string };

function firstVariant(product: Product): Variant {
  return { size: product.sizes[0] ?? "", color: product.colors[0]?.name ?? "" };
}

function CustomBundle() {
  const store = useStore();
  const isArabic = store.lang === "ar";
  const [settings, setSettings] = useState<CustomBundleSettings>(DEFAULT_CUSTOM_BUNDLE_SETTINGS);
  const [sheetId, setSheetId] = useState("");
  const [duvetId, setDuvetId] = useState("");
  const [accessories, setAccessories] = useState<Record<string, Variant>>({});
  const [sheetVariant, setSheetVariant] = useState<Variant>({ size: "", color: "" });
  const [duvetVariant, setDuvetVariant] = useState<Variant>({ size: "", color: "" });

  useEffect(() => {
    const load = () => setSettings(readCustomBundleSettings());
    load();
    window.addEventListener("storage", load);
    window.addEventListener("roelix-local-data-change", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("roelix-local-data-change", load);
    };
  }, []);

  const available = store.products.filter((product) => product.isPublished && product.stock > 0);
  const sheetProducts = available.filter((product) => product.category === "Bedding Sets");
  const duvetProducts = sheetProducts.filter((product) => product.id !== sheetId);
  const accessoryProducts = available.filter((product) => product.category !== "Bedding Sets");
  const sheet = sheetProducts.find((product) => product.id === sheetId);
  const duvet = duvetProducts.find((product) => product.id === duvetId);
  const selectedAccessories = Object.entries(accessories)
    .map(([id, variant]) => ({
      product: accessoryProducts.find((product) => product.id === id),
      variant,
    }))
    .filter((entry): entry is { product: Product; variant: Variant } => Boolean(entry.product));
  const complete = Boolean(sheet && duvet && selectedAccessories.length > 0);
  const selections = useMemo(
    () => [
      ...(sheet ? [{ product: sheet, variant: sheetVariant }] : []),
      ...(duvet ? [{ product: duvet, variant: duvetVariant }] : []),
      ...selectedAccessories,
    ],
    [sheet, sheetVariant, duvet, duvetVariant, selectedAccessories],
  );
  const subtotal = selections.reduce((sum, entry) => sum + entry.product.price, 0);
  const discount = complete ? (subtotal * settings.discountPercent) / 100 : 0;
  const total = subtotal - discount;
  const text = isArabic
    ? {
        title: "مُنشئ المجموعات الفاخرة المخصص",
        intro: "نسّق طقم مفروشاتك الفاخر خطوة بخطوة واختر المقاسات والألوان المناسبة.",
        disabled: "منشئ المجموعات المخصصة غير متاح حاليًا.",
        step1: "١. اختر طقم الملاءات أو غطاء السرير",
        step2: "٢. اختر غطاء اللحاف أو اللحاف المتناسق",
        step3: "٣. أضف أغطية الوسائد والإكسسوارات",
        summary: "ملخص مجموعتك",
        choose: "اختر هذا المنتج",
        selected: "تم الاختيار",
        size: "المقاس",
        color: "اللون",
        noProducts: "لا توجد منتجات متاحة في هذه الخطوة حاليًا.",
        empty: "ستظهر اختياراتك هنا.",
        subtotal: "المجموع",
        discount: `خصم ${settings.discountPercent}% عند تجميع الطقم الكامل`,
        total: "الإجمالي بعد الخصم",
        add: "إضافة الطقم بالكامل للسلة",
        incomplete: "أكمل الخطوات الثلاث لتجميع الطقم وتطبيق الخصم.",
        added: "تمت إضافة الطقم المخصص إلى السلة بنجاح",
        stockError:
          "تعذر إضافة الطقم المخصص. تحقق من المنتجات والمقاسات والألوان والمخزون ثم حاول مرة أخرى.",
      }
    : {
        title: "Custom Luxury Bedding Bundler",
        intro: "Build a coordinated ROELIX set step by step, choosing the right sizes and colors.",
        disabled: "The custom bedding bundler is not available right now.",
        step1: "1. Choose a main sheet set or bed cover",
        step2: "2. Choose a matching duvet or quilt",
        step3: "3. Add pillowcases and accessories",
        summary: "Your bundle summary",
        choose: "Choose this product",
        selected: "Selected",
        size: "Size",
        color: "Color",
        noProducts: "No products are currently available for this step.",
        empty: "Your selections will appear here.",
        subtotal: "Subtotal",
        discount: `${settings.discountPercent}% off a complete set`,
        total: "Bundle total",
        add: "Add Complete Bundle to Cart",
        incomplete: "Complete all three steps to assemble your set and apply the discount.",
        added: "Your complete set was added to the bag",
        stockError:
          "The custom set could not be added. Check the products, sizes, colors, and stock, then try again.",
      };

  if (!settings.enabled) {
    return (
      <p className="mx-auto max-w-3xl px-6 py-32 text-center font-serif text-2xl">
        {text.disabled}
      </p>
    );
  }

  const chooseSheet = (product: Product) => {
    setSheetId(product.id);
    setSheetVariant(firstVariant(product));
    if (duvetId === product.id) {
      setDuvetId("");
      setDuvetVariant({ size: "", color: "" });
    }
  };

  const chooseDuvet = (product: Product) => {
    setDuvetId(product.id);
    setDuvetVariant(firstVariant(product));
  };

  const toggleAccessory = (product: Product) => {
    setAccessories((current) => {
      if (current[product.id]) {
        const next = { ...current };
        delete next[product.id];
        return next;
      }
      return { ...current, [product.id]: firstVariant(product) };
    });
  };

  const addBundle = () => {
    const hasValidSelections =
      complete &&
      selections.length >= 3 &&
      selections.every(
        ({ product, variant }) =>
          typeof product.id === "string" &&
          product.id.trim().length > 0 &&
          Number.isFinite(product.price) &&
          product.price >= 0 &&
          typeof variant.size === "string" &&
          typeof variant.color === "string" &&
          (product.sizes.length === 0 || product.sizes.includes(variant.size)) &&
          (product.colors.length === 0 ||
            product.colors.some((color) => color.name === variant.color)),
      );
    if (!hasValidSelections) {
      toast.error(text.stockError);
      return;
    }

    const succeeded = store.addBundleToCart(
      selections.map(({ product, variant }) => ({
        id: product.id,
        size: variant.size,
        color: variant.color,
        qty: 1,
        unitPrice: product.price * (1 - settings.discountPercent / 100),
      })),
    );
    if (succeeded) {
      store.setCartOpen(true);
      toast.success(text.added);
    } else toast.error(text.stockError);
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <header className="mx-auto max-w-3xl text-center">
        <p className="eyebrow text-gold">ROELIX · ATELIER</p>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl">{text.title}</h1>
        <p className="mt-4 text-muted-foreground">{text.intro}</p>
      </header>
      <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-10">
          <BundleStep
            number="01"
            title={text.step1}
            products={sheetProducts}
            selectedId={sheetId}
            variant={sheetVariant}
            text={text}
            onChoose={chooseSheet}
            onVariant={setSheetVariant}
            isArabic={isArabic}
          />
          <BundleStep
            number="02"
            title={text.step2}
            products={duvetProducts}
            selectedId={duvetId}
            variant={duvetVariant}
            text={text}
            onChoose={chooseDuvet}
            onVariant={setDuvetVariant}
            isArabic={isArabic}
          />
          <section className="border-t pt-8">
            <h2 className="font-serif text-2xl">{text.step3}</h2>
            {accessoryProducts.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{text["noProducts"]}</p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {accessoryProducts.map((product) => {
                  const variant = accessories[product.id];
                  return (
                    <article key={product.id} className="flex gap-3 border p-3">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(variant)}
                          onChange={() => toggleAccessory(product)}
                          className="accent-[var(--gold)]"
                        />
                        <img src={product.images[0]} alt="" className="h-20 w-16 object-cover" />
                        <span className="min-w-0">
                          <span className="block font-serif">
                            {isArabic && product.nameAr ? product.nameAr : product.name}
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {store.fmt(product.price)}
                          </span>
                        </span>
                      </label>
                      {variant && (
                        <VariantFields
                          product={product}
                          variant={variant}
                          onChange={(next) =>
                            setAccessories((current) => ({ ...current, [product.id]: next }))
                          }
                          text={text}
                        />
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        <aside className="sticky top-28 border bg-secondary p-6">
          <h2 className="font-serif text-2xl">{text.summary}</h2>
          <div className="mt-5 space-y-4">
            {selections.length === 0 ? (
              <p className="text-sm text-muted-foreground">{text.empty}</p>
            ) : (
              selections.map(({ product, variant }) => (
                <div key={`${product.id}-${variant.size}-${variant.color}`} className="flex gap-3">
                  <img src={product.images[0]} alt="" className="h-16 w-12 object-cover" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-serif">
                      {isArabic && product.nameAr ? product.nameAr : product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {variant.size} · {variant.color}
                    </p>
                  </div>
                  <span className="text-sm">{store.fmt(product.price)}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-5 space-y-2 border-t pt-4 text-sm">
            {complete && (
              <p className="inline-flex rounded-full border border-emerald/40 bg-emerald/10 px-3 py-1 text-xs text-emerald">
                {text.discount}
              </p>
            )}
            <div className="flex justify-between">
              <span>{text.subtotal}</span>
              <span>{store.fmt(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-emerald">
              <span>{isArabic ? "قيمة الخصم" : "Bundle savings"}</span>
              {discount > 0 && <span>−{store.fmt(discount)}</span>}
            </div>
            <div className="flex justify-between pt-2 font-serif text-xl">
              <span>{text.total}</span>
              <span>{store.fmt(total)}</span>
            </div>
          </div>
          {!complete && <p className="mt-4 text-xs text-muted-foreground">{text.incomplete}</p>}
          <button
            type="button"
            onClick={addBundle}
            disabled={!complete}
            className="btn-lux mt-5 flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingBag size={16} />
            {text.add}
          </button>
        </aside>
      </div>
    </main>
  );
}

function BundleStep({
  number,
  title,
  products,
  selectedId,
  variant,
  text,
  onChoose,
  onVariant,
  isArabic,
}: {
  number: string;
  title: string;
  products: Product[];
  selectedId: string;
  variant: Variant;
  text: Record<string, string>;
  onChoose: (product: Product) => void;
  onVariant: (variant: Variant) => void;
  isArabic: boolean;
}) {
  const store = useStore();
  const selectedProduct = products.find((product) => product.id === selectedId);
  return (
    <section className="border-t pt-8">
      <h2 className="font-serif text-2xl">
        <span className="me-3 text-gold">{number}</span>
        {title}
      </h2>
      {products.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{text["noProducts"]}</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {products.map((product) => {
            const selected = product.id === selectedId;
            return (
              <button
                type="button"
                key={product.id}
                aria-pressed={selected}
                onClick={() => onChoose(product)}
                className={`flex items-center gap-4 border p-3 text-start transition hover:border-gold ${selected ? "border-gold bg-gold/5" : ""}`}
              >
                <img src={product.images[0]} alt="" className="h-24 w-20 object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block font-serif">
                    {isArabic && product.nameAr ? product.nameAr : product.name}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {store.fmt(product.price)}
                  </span>
                </span>
                {selected && <Check size={18} className="text-gold" />}
              </button>
            );
          })}
        </div>
      )}
      {selectedProduct && (
        <div className="mt-4 border p-4">
          <VariantFields
            product={selectedProduct}
            variant={variant}
            onChange={onVariant}
            text={text}
          />
        </div>
      )}
    </section>
  );
}

function VariantFields({
  product,
  variant,
  onChange,
  text,
}: {
  product: Product;
  variant: Variant;
  onChange: (variant: Variant) => void;
  text: Record<string, string>;
}) {
  return (
    <div className="grid min-w-28 gap-2">
      <label className="text-xs">
        <span className="sr-only">{text["size"]}</span>
        <select
          aria-label={text["size"]}
          value={variant.size}
          onChange={(event) => onChange({ ...variant, size: event.target.value })}
          className="w-full border bg-background px-2 py-1.5"
        >
          {product.sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="sr-only">{text["color"]}</span>
        <select
          aria-label={text["color"]}
          value={variant.color}
          onChange={(event) => onChange({ ...variant, color: event.target.value })}
          className="w-full border bg-background px-2 py-1.5"
        >
          {product.colors.map((color) => (
            <option key={color.name} value={color.name}>
              {color.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

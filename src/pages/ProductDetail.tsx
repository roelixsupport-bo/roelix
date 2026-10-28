import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Minus, Plus, RotateCcw, Truck } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StarRating } from "@/components/product/star-rating";
import { VariantPicker, variantOptionClassName } from "@/components/product/variant-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductSchema } from "@/components/ProductSchema";
import { useProductReviews } from "@/hooks/use-product-reviews";
import { recordProductInteraction } from "@/lib/local-data";
import {
  firstPurchasableVariant,
  resolveVariant,
  variantLabel,
  type VariantSelection,
} from "@/lib/product-variants";
import { EGP_PER_USD, getMaxOrderQuantity, useStore, type Product } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Reviews sit below the fold and pull in their own form and storage helpers, so
 * they are split out of the route chunk: the gallery, price and buy bar have to
 * arrive first.
 */
const ReviewsSection = lazy(async () => {
  const module = await import("@/components/product/reviews-section");
  return { default: module.ReviewsSection };
});

type Language = "en" | "ar";

const COPY = {
  en: {
    loading: "Preparing this piece…",
    unavailable: "This piece is no longer available.",
    back: "Return to collections",
    size: "Size",
    sizeHint: "Choose a size to see its price and availability.",
    colour: "Colour",
    quantity: "Quantity",
    addToBag: "Add to bag",
    buyNow: "Buy it now",
    inStockCount: (count: number) => `Available in stock (${count})`,
    outOfStock: "Out of stock",
    soldOut: "Sold out",
    savePercent: (percent: number) => `Save ${percent}%`,
    details: "Product details",
    care: "Care instructions",
    shipping: "Shipping policy",
    origin: "Origin",
    construction: "Construction",
    sizes: "Sizes offered",
    colourways: "Colourways",
    threadCount: (count: number) => `${count} thread count`,
    gsm: (weight: number) => `${weight} GSM`,
    careUnpublished:
      "Care guidance for this piece has not been published yet. Our concierge will confirm the exact wash programme for the fabric you receive.",
    detailsFallback:
      "Written specification for this piece is being finalised. The details above are taken from the current product record.",
    shippingBody:
      "Delivered nationwide by Bosta. Fees are calculated at checkout from your governorate, starting at EGP 50, and orders arrive within 3–5 business days in ROELIX packaging.",
    crossSell: "Complete the set",
    setTotal: "Set total",
    addSet: "Add the set",
    addedToBag: "Added to your bag",
    limitReached: (max: number) => `Your bag already holds the full available quantity (${max}).`,
    noStock: "This option is currently unavailable.",
    sku: "SKU",
    ratingSummary: (count: number, average: string) =>
      `${count} ${count === 1 ? "review" : "reviews"}, ${average} out of 5`,
    combinationUnavailable: "This size and dimension are not sold together.",
    zoomHint: "Hover to inspect",
  },
  ar: {
    loading: "جارٍ تجهيز هذا المنتج…",
    unavailable: "هذا المنتج لم يعد متاحاً.",
    back: "العودة إلى المجموعات",
    size: "المقاس",
    sizeHint: "اختر المقاس لعرض سعره وتوفره.",
    colour: "اللون",
    quantity: "الكمية",
    addToBag: "أضف إلى الحقيبة",
    buyNow: "اشترِ الآن",
    inStockCount: (count: number) => `متوفر في المخزون (${count})`,
    outOfStock: "نفذت الكمية",
    soldOut: "نفذت",
    savePercent: (percent: number) => `وفّر ${percent}%`,
    details: "تفاصيل المنتج",
    care: "تعليمات العناية",
    shipping: "سياسة الشحن",
    origin: "بلد المنشأ",
    construction: "المواصفات",
    sizes: "المقاسات المتاحة",
    colourways: "الألوان المتاحة",
    threadCount: (count: number) => `${count} خيط`,
    gsm: (weight: number) => `${weight} جرام/م²`,
    careUnpublished:
      "لم تُنشر تعليمات العناية لهذا المنتج بعد. سيتواصل فريق ROELIX لتأكيد برنامج الغسيل المناسب للقماش.",
    detailsFallback:
      "يجري استكمال المواصفات المكتوبة لهذا المنتج. التفاصيل أعلاه مأخوذة من سجل المنتج الحالي.",
    shippingBody:
      "التوصيل لجميع المحافظات عبر بوستا. تُحسب الرسوم عند إتمام الطلب حسب المحافظة بدءاً من 50 ج.م، ويصل الطلب خلال 3 إلى 5 أيام عمل بتغليف ROELIX.",
    crossSell: "أكمل الطقم",
    setTotal: "إجمالي الطقم",
    addSet: "أضف الطقم",
    addedToBag: "تمت الإضافة إلى الحقيبة",
    limitReached: (max: number) => `حقيبتك تحتوي على الكمية القصوى المتاحة (${max}).`,
    noStock: "هذا الخيار غير متوفر حالياً.",
    sku: "رمز المنتج",
    ratingSummary: (count: number, average: string) => `${count} تقييم بمتوسط ${average} من 5`,
    combinationUnavailable: "هذا المقاس لا يُطرح بهذه الأبعاد.",
    zoomHint: "مرّر المؤشر للتكبير",
  },
} as const;

/** Sets the document title and social tags without pulling in a Helmet provider. */
function useProductMeta(product: Product | undefined, language: Language): void {
  useEffect(() => {
    if (typeof document === "undefined" || !product) return;

    const upsert = (attribute: "name" | "property", key: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attribute, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    const title = `${product.name} — ROELIX`;
    document.title = title;
    upsert("name", "description", product.description);
    upsert("property", "og:title", title);
    upsert("property", "og:description", product.description);
    upsert("property", "og:type", "product");
    if (product.images[0]) upsert("property", "og:image", product.images[0]);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/product/${product.id}`;
  }, [product, language]);
}

export function ProductDetail({ productId }: { productId: string }) {
  const s = useStore();
  const navigate = useNavigate();
  const copy = COPY[s.lang];

  const product = s.find(productId);
  const [selection, setSelection] = useState<VariantSelection | null>(null);
  const [sizeChoice, setSizeChoice] = useState("");
  const [colourName, setColourName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null);
  const recordedView = useRef<string | null>(null);

  useProductMeta(product, s.lang);

  // One live subscription for the page: the rating row under the title and the
  // reviews section below both read from it.
  const {
    reviews,
    summary: reviewSummary,
    loading: reviewsLoading,
    submitting: reviewsSubmitting,
    submit: submitReview,
  } = useProductReviews(product?.id);

  const variants = useMemo(() => product?.variants ?? [], [product]);

  const activeVariant = useMemo(() => {
    if (variants.length === 0) return null;
    // An explicit size/dimension pick wins; otherwise open on the first buyable row.
    return selection ? resolveVariant(variants, selection) : firstPurchasableVariant(variants);
  }, [variants, selection]);

  useEffect(() => {
    setSelection(null);
    setSizeChoice("");
    setColourName("");
    setImageIndex(0);
    setQuantity(1);
  }, [productId]);

  useEffect(() => {
    setQuantity(1);
  }, [activeVariant?.id]);

  useEffect(() => {
    if (!product?.isPublished || recordedView.current === product.id) return;
    recordedView.current = product.id;
    recordProductInteraction("product_view", product.id, product.name);
  }, [product?.id, product?.isPublished, product?.name]);

  // ---- Derived selection state ------------------------------------------------
  const colours = product?.colors ?? [];
  const colour = colours.some((swatch) => swatch.name === colourName)
    ? colourName
    : (colours[0]?.name ?? "");

  const sizes = product?.sizes ?? [];
  const sizeNames =
    sizes.length > 0 ? sizes : variants.map((variant) => variant.sizeName).filter(Boolean);
  const sizeValue = activeVariant
    ? variantLabel(activeVariant)
    : sizes.includes(sizeChoice)
      ? sizeChoice
      : (sizes[0] ?? "");

  /**
   * What the two variant groups show as selected.
   *
   * An explicit pick is echoed back verbatim — even when the pair has no variant
   * row — so the buttons never appear to move on their own. Before the shopper
   * touches anything, the groups open on the first buyable row.
   */
  const pickerSelection: VariantSelection = selection ?? {
    sizeName: activeVariant?.sizeName ?? "",
    dimension: activeVariant?.dimension ?? "",
  };

  const unitPrice = activeVariant?.price ?? product?.price ?? 0;
  // Variant pricing wins; the product-level values cover products with no matrix.
  const compareAt = activeVariant?.compareAtPrice ?? product?.compareAtPrice ?? null;
  /**
   * A size and a dimension can each be valid on their own and still not be sold
   * together. In that case no price or stock belongs to the pair, so the panel
   * says so instead of showing a neighbour's figures.
   */
  const combinationUnavailable =
    variants.length > 0 &&
    Boolean(selection?.sizeName) &&
    Boolean(selection?.dimension) &&
    !activeVariant;
  const availableStock = combinationUnavailable ? 0 : (activeVariant?.stock ?? product?.stock ?? 0);
  const sku = activeVariant?.sku ?? product?.sku ?? null;

  const inBagForSize = product
    ? s.lines
        .filter((line) => line.id === product.id && line.size === sizeValue)
        .reduce((total, line) => total + line.qty, 0)
    : 0;
  const maxAddable = Math.max(0, getMaxOrderQuantity(availableStock) - inBagForSize);
  const canBuy = availableStock > 0 && maxAvailableAdjustment(availableStock, inBagForSize) > 0;

  const bundle = (product?.frequently_bought_ids ?? [])
    .filter((id, index, ids) => id !== product?.id && ids.indexOf(id) === index)
    .map((id) => s.products.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Product => Boolean(candidate?.isPublished));

  const handleAdd = (mode: "bag" | "checkout") => {
    if (!product) return;
    if (!canBuy) {
      toast.warning(copy.noStock);
      return;
    }
    const added = s.addToCart(
      {
        id: product.id,
        size: sizeValue,
        color: colour,
        ...(activeVariant ? { unitPrice: activeVariant.price } : {}),
        // The dimension travels with the line so inventory can deduct this exact variant.
        ...(activeVariant?.dimension ? { dimension: activeVariant.dimension } : {}),
      },
      quantity,
    );
    if (!added) {
      toast.warning(copy.limitReached(getMaxOrderQuantity(availableStock)));
      return;
    }
    if (mode === "checkout") {
      s.setCartOpen(false);
      navigate({ to: "/checkout" });
    }
  };

  const changeQuantity = (next: number) => {
    if (!Number.isFinite(next)) return;
    if (next > maxAddable) {
      toast.warning(copy.limitReached(getMaxOrderQuantity(availableStock)));
      setQuantity(Math.max(1, maxAddable || 1));
      return;
    }
    setQuantity(Math.max(1, Math.min(next, maxAddable || 1)));
  };

  const addSetToBag = () => {
    let added = 0;
    for (const item of bundle) {
      const variant = firstPurchasableVariant(item.variants ?? []);
      const price = variant?.price ?? item.price;
      const size = variant ? variantLabel(variant) : (item.sizes[0] ?? "");
      const ok = s.addToCart(
        {
          id: item.id,
          size,
          color: item.colors[0]?.name ?? "",
          ...(variant ? { unitPrice: price } : {}),
          ...(variant?.dimension ? { dimension: variant.dimension } : {}),
        },
        1,
      );
      if (ok) added += 1;
    }
    if (added === 0) toast.warning(copy.noStock);
    else toast.success(copy.addedToBag);
  };

  // ---- Non-happy paths --------------------------------------------------------
  if (!product && !s.productsLoaded) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="aspect-[4/5] w-full animate-pulse rounded-sm bg-muted" />
          <div className="space-y-4 pt-4">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-9 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-24 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
        <p className="sr-only">{copy.loading}</p>
      </div>
    );
  }

  if (!product || !product.isPublished) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <h1 className="font-serif text-2xl sm:text-3xl">{copy.unavailable}</h1>
        <Link
          to="/shop"
          className="mt-6 inline-block border-b border-gold pb-1 eyebrow text-gold hover:text-foreground"
        >
          {copy.back}
        </Link>
      </div>
    );
  }

  const displayName = s.lang === "ar" && product.nameAr ? product.nameAr : product.name;
  const images = product.images.length > 0 ? product.images : [];
  const activeImage = images[imageIndex] ?? images[0];
  const discountPercent =
    compareAt !== null && compareAt > unitPrice
      ? Math.round(((compareAt - unitPrice) / compareAt) * 100)
      : 0;
  /**
   * One palette for the availability line: the dot, its pulse halo and the text
   * always agree, so the colour reads as a status rather than decoration.
   */
  const stockStatus =
    availableStock === 0
      ? {
          text: "text-destructive",
          dot: "bg-destructive",
          halo: "bg-destructive/60",
          glow: "ring-destructive/20",
        }
      : availableStock < 4
        ? { text: "text-gold", dot: "bg-gold", halo: "bg-gold/60", glow: "ring-gold/25" }
        : {
            // The theme emerald (oklch 0.5) is too muted to read as "in stock" at
            // this size, so availability uses the brighter Tailwind emerald.
            text: "text-emerald-600",
            dot: "bg-emerald-500",
            halo: "bg-emerald-500/60",
            glow: "ring-emerald-500/25",
          };
  // Always the exact figure for the selected variant, per the buying brief.
  const stockLabel = combinationUnavailable
    ? copy.combinationUnavailable
    : availableStock === 0
      ? copy.outOfStock
      : copy.inStockCount(availableStock);

  const detailSpecs: Array<{ label: string; value: string }> = [
    { label: copy.origin, value: product.origin },
    ...(product.threadCount
      ? [{ label: copy.construction, value: copy.threadCount(product.threadCount) }]
      : product.gsm
        ? [{ label: copy.construction, value: copy.gsm(product.gsm) }]
        : []),
    { label: copy.sizes, value: sizeNames.join(" / ") },
    { label: copy.colourways, value: colours.map((swatch) => swatch.name).join(" / ") },
  ].filter((spec) => spec.value);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-6 sm:px-6 sm:pt-10 lg:pb-20">
      <ProductSchema
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          image: activeImage ?? "",
          price: Math.round(unitPrice * EGP_PER_USD),
          currency: "EGP",
          inStock: availableStock > 0,
          ...(sku ? { sku } : {}),
          ...(reviewSummary.count > 0
            ? {
                aggregateRating: {
                  average: Number(reviewSummary.average.toFixed(1)),
                  count: reviewSummary.count,
                },
              }
            : {}),
        }}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        {/* ---------------------------------------------------------------- Gallery */}
        <section aria-label={displayName} className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
            {images.length > 1 && (
              <ul className="flex gap-2 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
                {images.map((image, index) => (
                  <li key={`${image}-${index}`}>
                    <button
                      type="button"
                      onClick={() => setImageIndex(index)}
                      aria-label={`${displayName}, image ${index + 1}`}
                      aria-current={imageIndex === index}
                      className={cn(
                        "h-20 w-16 shrink-0 overflow-hidden border bg-muted transition sm:h-24 sm:w-20",
                        imageIndex === index
                          ? "border-gold"
                          : "border-transparent hover:border-border",
                      )}
                    >
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="relative min-w-0 flex-1 overflow-hidden bg-muted">
              <div
                className={cn(
                  "relative aspect-[4/5] w-full overflow-hidden",
                  zoomLevel > 1 ? "cursor-zoom-out" : "cursor-zoom-in",
                )}
                onMouseMove={(event) => {
                  const bounds = event.currentTarget.getBoundingClientRect();
                  setZoomOrigin({
                    x: ((event.clientX - bounds.left) / bounds.width) * 100,
                    y: ((event.clientY - bounds.top) / bounds.height) * 100,
                  });
                }}
                onMouseLeave={() => {
                  setZoomOrigin(null);
                  setZoomLevel(1);
                }}
                onClick={() => setZoomLevel((level) => (level > 1 ? 1 : 2))}
              >
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={displayName}
                    // The gallery is the largest element on the page: fetch it in
                    // the first batch instead of behind the fold images.
                    fetchPriority="high"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300"
                    style={
                      zoomLevel > 1
                        ? {
                            transform: `scale(${zoomLevel})`,
                            // Touch devices never report a cursor position, so
                            // fall back to a centred zoom rather than doing nothing.
                            transformOrigin: zoomOrigin
                              ? `${zoomOrigin.x}% ${zoomOrigin.y}%`
                              : "50% 50%",
                          }
                        : undefined
                    }
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {displayName}
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <p className="pointer-events-none absolute bottom-3 start-3 bg-background/85 px-2 py-1 text-[0.62rem] tracking-[0.2em]">
                  {String(imageIndex + 1).padStart(2, "0")} /{" "}
                  {String(images.length).padStart(2, "0")}
                </p>
              )}
              <p className="pointer-events-none absolute bottom-3 end-3 hidden bg-background/85 px-2 py-1 text-[0.62rem] tracking-[0.2em] sm:block">
                {copy.zoomHint}
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- Buying panel */}
        <section className="min-w-0" aria-label={copy.details}>
          <p className="eyebrow text-gold">{product.category}</p>
          <h1 className="mt-2 font-serif text-3xl leading-tight sm:mt-3 sm:text-4xl lg:text-[2.9rem]">
            {displayName}
          </h1>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById("reviews")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            aria-label={copy.ratingSummary(reviewSummary.count, reviewSummary.average.toFixed(1))}
            className="group mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:ring-1 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-hidden"
          >
            <StarRating
              value={reviewSummary.average}
              size={16}
              label={copy.ratingSummary(reviewSummary.count, reviewSummary.average.toFixed(1))}
              className="transition-transform duration-200 motion-safe:group-hover:scale-105"
            />
            <span className="text-[0.8rem] font-semibold tabular-nums text-foreground">
              ({reviewSummary.count})
            </span>
          </button>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {product.description}
          </p>

          {/* Price is the highest-contrast element: it changes with the variant. */}
          <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2 sm:mt-7">
            <p aria-live="polite" className="font-serif text-3xl sm:text-4xl">
              {s.fmt(unitPrice)}
            </p>
            {compareAt !== null && compareAt > unitPrice && (
              <>
                <p className="text-base text-muted-foreground line-through">{s.fmt(compareAt)}</p>
                <span className="bg-gold/15 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-foreground">
                  {copy.savePercent(discountPercent)}
                </span>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <p
              role="status"
              className={cn(
                "flex items-center gap-2.5 text-[0.8rem] font-bold tracking-[0.01em]",
                stockStatus.text,
              )}
            >
              {/*
                A live-looking dot: a solid core with a soft ring for the glow and a
                ping halo that only runs while the piece can actually be bought.
                Both animations opt out under prefers-reduced-motion.
              */}
              <span
                aria-hidden="true"
                className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center"
              >
                {availableStock > 0 && (
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping",
                      stockStatus.halo,
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2.5 w-2.5 rounded-full ring-4",
                    stockStatus.dot,
                    stockStatus.glow,
                  )}
                />
              </span>
              {stockLabel}
            </p>
            {sku && (
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                {copy.sku} {sku}
              </p>
            )}
          </div>

          {/* ------------------------------------------------ Size & dimension pickers */}
          <div className="mt-7 border-t pt-6">
            {variants.length > 0 ? (
              <VariantPicker
                variants={variants}
                selection={pickerSelection}
                onSelect={setSelection}
                isArabic={s.lang === "ar"}
              />
            ) : sizes.length > 0 ? (
              <fieldset>
                <legend className="eyebrow text-xs">{copy.size}</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSizeChoice(size)}
                      aria-pressed={sizeValue === size}
                      className={variantOptionClassName(sizeValue === size, true)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </div>

          {/* ----------------------------------------------------------------- Colour */}
          {colours.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow text-xs">
                {copy.colour}
                <span className="ms-2 normal-case tracking-normal text-muted-foreground">
                  {colour}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {colours.map((swatch) => (
                  <button
                    key={swatch.name}
                    type="button"
                    onClick={() => setColourName(swatch.name)}
                    aria-label={swatch.name}
                    aria-pressed={colour === swatch.name}
                    title={swatch.name}
                    style={{ backgroundColor: swatch.hex }}
                    className={cn(
                      "h-9 w-9 rounded-full border ring-offset-2 ring-offset-background",
                      "transition-[transform,box-shadow,border-color] duration-200 ease-out",
                      "hover:shadow-md focus-visible:ring-1 focus-visible:ring-gold focus-visible:outline-hidden",
                      "motion-safe:hover:scale-105 motion-reduce:transform-none",
                      colour === swatch.name
                        ? "border-foreground ring-1 ring-gold"
                        : "border-border hover:border-gold",
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* -------------------------------------------------------------- Quantity */}
          <div className="mt-7 border-t pt-6">
            <p className="eyebrow text-xs">{copy.quantity}</p>
            <div className="mt-3 flex flex-wrap items-stretch gap-2 sm:flex-nowrap sm:gap-3">
              <div className="flex h-12 items-stretch border border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Decrease quantity"
                  onClick={() => changeQuantity(quantity - 1)}
                  disabled={quantity <= 1 || !canBuy}
                  className="h-full w-11 rounded-none"
                >
                  <Minus size={14} />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={Math.max(1, maxAddable)}
                  value={quantity}
                  aria-label={copy.quantity}
                  disabled={!canBuy}
                  onChange={(event) => changeQuantity(event.currentTarget.valueAsNumber)}
                  className="h-full w-14 rounded-none border-0 bg-transparent text-center text-sm shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Increase quantity"
                  onClick={() => changeQuantity(quantity + 1)}
                  disabled={!canBuy || quantity >= maxAddable}
                  className="h-full w-11 rounded-none"
                >
                  <Plus size={14} />
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => s.toggleWish(product.id)}
                aria-label="Wishlist"
                aria-pressed={s.wishlist.includes(product.id)}
                className="ms-auto h-12 w-12 shrink-0 rounded-none border-border sm:order-last sm:ms-0"
              >
                <Heart
                  size={16}
                  className={s.wishlist.includes(product.id) ? "fill-gold text-gold" : ""}
                />
              </Button>

              <Button
                type="button"
                onClick={() => handleAdd("bag")}
                disabled={!canBuy}
                className="h-12 basis-full rounded-none bg-foreground text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-background hover:bg-foreground/90 sm:order-2 sm:basis-0 sm:flex-1 sm:text-[0.72rem] sm:tracking-[0.22em]"
              >
                {copy.addToBag}
              </Button>
              <Button
                type="button"
                onClick={() => handleAdd("checkout")}
                disabled={!canBuy}
                variant="outline"
                className="h-12 basis-full rounded-none border-foreground/25 text-[0.7rem] font-semibold uppercase tracking-[0.18em] hover:border-gold hover:bg-transparent hover:text-gold sm:order-3 sm:basis-0 sm:flex-1 sm:text-[0.72rem] sm:tracking-[0.22em]"
              >
                {copy.buyNow}
              </Button>
            </div>

            {maxAddable === 0 && availableStock > 0 && (
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                {copy.limitReached(getMaxOrderQuantity(availableStock))}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Truck size={14} className="text-gold" aria-hidden="true" />
              Bosta delivery, 3–5 business days
            </p>
            <p className="flex items-center gap-2">
              <RotateCcw size={14} className="text-gold" aria-hidden="true" />
              100-night return window
            </p>
          </div>

          {/* ------------------------------------------------------------- Accordions */}
          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="details" className="border-t">
              <AccordionTrigger className="py-4 text-left font-serif text-base hover:no-underline">
                {copy.details}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                <p className="whitespace-pre-line">
                  {product.productDetails || copy.detailsFallback}
                </p>
                <dl className="mt-4 space-y-2">
                  {detailSpecs.map((spec) => (
                    <div
                      key={spec.label}
                      className="flex justify-between gap-4 border-b border-border/60 pb-2"
                    >
                      <dt className="eyebrow text-[0.62rem] text-foreground">{spec.label}</dt>
                      <dd className="text-end text-xs">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="care">
              <AccordionTrigger className="py-4 text-left font-serif text-base hover:no-underline">
                {copy.care}
              </AccordionTrigger>
              <AccordionContent className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {product.productCare || copy.careUnpublished}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="shipping" className="border-b">
              <AccordionTrigger className="py-4 text-left font-serif text-base hover:no-underline">
                {copy.shipping}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {copy.shippingBody}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </div>

      {/* ------------------------------------------------------- Frequently bought */}
      {bundle.length > 0 && (
        <section className="mt-16 border-t pt-10 sm:mt-24 sm:pt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-serif text-2xl sm:text-3xl">{copy.crossSell}</h2>
            <p className="text-sm text-muted-foreground">
              {copy.setTotal}{" "}
              <span className="ms-2 font-serif text-lg text-foreground">
                {s.fmt(bundle.reduce((total, item) => total + item.price, 0))}
              </span>
            </p>
          </div>

          <ul className="mt-6 flex flex-wrap items-stretch gap-4 sm:gap-6">
            {bundle.map((item) => {
              const variant = firstPurchasableVariant(item.variants ?? []);
              const price = variant?.price ?? item.price;
              return (
                <li key={item.id} className="w-32 sm:w-40">
                  <Link
                    to="/product/$id"
                    params={{ id: item.id }}
                    onClick={() => recordProductInteraction("product_click", item.id, item.name)}
                    className="group block"
                  >
                    <div className="overflow-hidden bg-muted">
                      {item.images[0] ? (
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="aspect-[4/5] w-full" />
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 font-serif text-sm leading-snug group-hover:text-gold">
                      {s.lang === "ar" && item.nameAr ? item.nameAr : item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.fmt(price)}</p>
                  </Link>
                </li>
              );
            })}
            <li className="flex items-center">
              <Button
                type="button"
                onClick={addSetToBag}
                variant="outline"
                className="h-12 rounded-none px-6 text-[0.7rem] font-semibold uppercase tracking-[0.2em] hover:border-gold hover:text-gold"
              >
                {copy.addSet}
              </Button>
            </li>
          </ul>
        </section>
      )}

      {/* --------------------------------------------------------- Customer reviews */}
      <Suspense
        fallback={
          <div className="mt-16 border-t pt-10" aria-hidden>
            <div className="h-4 w-40 animate-pulse bg-muted" />
            <div className="mt-6 h-24 w-full animate-pulse bg-muted" />
          </div>
        }
      >
        <ReviewsSection
          isArabic={s.lang === "ar"}
          reviews={reviews}
          summary={reviewSummary}
          loading={reviewsLoading}
          submitting={reviewsSubmitting}
          onSubmit={submitReview}
        />
      </Suspense>

      {/* ------------------------------------------------------------ Mobile buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="min-w-0">
          <p className="truncate font-serif text-sm">{displayName}</p>
          <p aria-live="polite" className="text-sm font-semibold">
            {s.fmt(unitPrice)}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => handleAdd("bag")}
          disabled={!canBuy}
          className="ms-auto h-11 shrink-0 rounded-none bg-foreground px-5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-background hover:bg-foreground/90"
        >
          {copy.addToBag}
        </Button>
      </div>
    </div>
  );
}

/** Small guard so `canBuy` reads clearly at the call site. */
function maxAvailableAdjustment(stock: number, inBag: number): number {
  return Math.max(0, getMaxOrderQuantity(stock) - inBag);
}

export default ProductDetail;

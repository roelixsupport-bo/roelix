import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Heart, Minus, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getMaxOrderQuantity, useStore } from "@/lib/store";
import { recordProductInteraction } from "@/lib/local-data";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "Product — ROELIX" },
      { name: "description", content: "Discover hotel-grade luxury textiles from ROELIX." },
      { property: "og:title", content: "Product — ROELIX" },
      { property: "og:description", content: "Hotel-grade luxury textiles from ROELIX." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const s = useStore();
  const p = s.find(id);
  const [img, setImg] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [level, setLevel] = useState(2);
  const [video, setVideo] = useState(false);
  const [size, setSize] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [qty, setQty] = useState(1);
  const recordedView = useRef<string | null>(null);
  useEffect(() => {
    if (!p?.isPublished || recordedView.current === p.id) return;
    recordedView.current = p.id;
    recordProductInteraction("product_view", p.id, p.name);
  }, [p?.id, p?.isPublished, p?.name]);
  useEffect(() => {
    if (!p) return;
    const alreadyInCart = s.lines
      .filter((line) => line.id === p.id)
      .reduce((total, line) => total + line.qty, 0);
    const maxAddQuantity = Math.max(0, getMaxOrderQuantity(p.stock) - alreadyInCart);
    setQty((current) => Math.max(1, Math.min(current, maxAddQuantity || 1)));
  }, [p?.id, p?.stock, s.lines]);

  if (!p && !s.productsLoaded)
    return <div className="py-40 text-center text-muted-foreground">Loading…</div>;
  if (!p || !p.isPublished)
    return (
      <div className="py-40 text-center font-serif text-3xl">
        This piece is no longer available.{" "}
        <Link to="/shop" className="text-gold underline">
          Return to collections
        </Link>
      </div>
    );
  const sz = p.sizes.includes(size) ? size : (p.sizes[0] ?? "");
  const col = p.colors.some((item) => item.name === color) ? color : (p.colors[0]?.name ?? "");
  const bundle = (p.frequently_bought_ids ?? [])
    .filter((relatedId, index, ids) => relatedId !== p.id && ids.indexOf(relatedId) === index)
    .map((relatedId) => s.products.find((product) => product.id === relatedId))
    .filter((product): product is (typeof s.products)[number] => Boolean(product?.isPublished));
  const bundleTotal = bundle.reduce((a, b) => a + b.price, 0);
  const maxOrderQty = getMaxOrderQuantity(p.stock);
  const alreadyInCart = s.lines
    .filter((line) => line.id === p.id)
    .reduce((total, line) => total + line.qty, 0);
  const maxAddQty = Math.max(0, maxOrderQty - alreadyInCart);

  const showQuantityWarning = () => {
    toast.warning(
      s.lang === "ar"
        ? `عذراً، الكمية المتاحة في المخزون هي ${p.stock} فقط`
        : `Sorry, only ${p.stock} units are available in stock`,
    );
  };
  const updateQuantity = (value: number) => {
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(1, Math.min(maxAddQty || 1, Math.floor(value)));
    if (value > maxAddQty) showQuantityWarning();
    setQty(clamped);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-14">
      <div className="grid gap-14 lg:grid-cols-2">
        <div className="flex gap-4">
          <div className="flex flex-col gap-3">
            {p.images.map((im, i) => (
              <button
                key={i}
                onClick={() => {
                  setImg(i);
                  setVideo(false);
                }}
                className={`h-24 w-20 overflow-hidden border ${img === i && !video ? "border-gold" : "border-transparent"}`}
              >
                <img src={im} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            <button
              onClick={() => setVideo(true)}
              className={`flex h-24 w-20 items-center justify-center border bg-navy text-gold ${video ? "border-gold" : ""}`}
              aria-label="Video preview"
            >
              <Play size={18} />
            </button>
          </div>
          <div className="relative flex-1">
            {video ? (
              <div className="relative aspect-[4/5] overflow-hidden bg-navy">
                <img
                  src={p.images[0]}
                  alt=""
                  className="h-full w-full object-cover opacity-80 motion-safe:animate-[pulse_6s_ease-in-out_infinite] scale-110"
                />
                <p className="absolute bottom-6 start-6 eyebrow text-gold">Fabric in motion</p>
              </div>
            ) : (
              <div
                className="relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-muted"
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoom({
                    x: ((e.clientX - r.left) / r.width) * 100,
                    y: ((e.clientY - r.top) / r.height) * 100,
                  });
                }}
                onMouseLeave={() => setZoom(null)}
                onClick={() => setLevel((l) => (l >= 4 ? 2 : l + 1))}
              >
                <img
                  src={p.images[img]}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform duration-200"
                  style={
                    zoom
                      ? { transform: `scale(${level})`, transformOrigin: `${zoom.x}% ${zoom.y}%` }
                      : undefined
                  }
                />
                <span className="absolute bottom-3 end-3 bg-background/80 px-2 py-1 text-[0.65rem] tracking-widest">
                  {level}× · click to change
                </span>
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="eyebrow text-gold">{p.category}</p>
          <h1 className="mt-3 text-5xl">{s.lang === "ar" ? p.nameAr : p.name}</h1>
          <p className="mt-4 text-2xl">{s.fmt(p.price)}</p>
          <p className="mt-6 leading-relaxed text-muted-foreground">{p.description}</p>
          <p className="eyebrow mt-8">Colour — {col}</p>
          <div className="mt-3 flex gap-3">
            {p.colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setColor(c.name)}
                aria-label={c.name}
                aria-pressed={col === c.name}
                title={c.name}
                style={{ background: c.hex }}
                className={`h-9 w-9 rounded-full border ring-offset-2 ring-offset-background ${col === c.name ? "ring-1 ring-gold" : ""}`}
              />
            ))}
          </div>
          <p className="eyebrow mt-8">Size</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.sizes.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setSize(x)}
                aria-pressed={sz === x}
                className={`border px-5 py-3 text-sm ${sz === x ? "border-navy bg-navy text-navy-foreground" : "hover:border-gold"}`}
              >
                {x}
              </button>
            ))}
          </div>
          <p
            className={`mt-6 text-sm ${p.stock === 0 ? "text-destructive" : p.stock < 10 ? "text-gold" : "text-emerald"}`}
          >
            {p.stock === 0
              ? s.lang === "ar"
                ? "نفذت الكمية"
                : "Out of Stock"
              : p.stock < 10
                ? `Only ${p.stock} remaining`
                : "In stock — ships within 24 hours"}
          </p>
          <div className="mt-6 flex gap-3">
            <div className="flex items-center border" aria-label="Quantity">
              <button
                type="button"
                className="p-3"
                aria-label="Decrease quantity"
                onClick={() => updateQuantity(qty - 1)}
                disabled={qty <= 1 || p.stock === 0 || maxAddQty === 0}
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={1}
                max={maxAddQty || 1}
                value={qty}
                aria-label="Quantity"
                onChange={(e) => updateQuantity(e.currentTarget.valueAsNumber)}
                disabled={p.stock === 0 || maxAddQty === 0}
                className="w-12 bg-transparent text-center text-sm outline-none disabled:opacity-50"
              />
              <button
                type="button"
                className="p-3"
                aria-label="Increase quantity"
                onClick={() => {
                  if (qty >= maxAddQty) showQuantityWarning();
                  else setQty(qty + 1);
                }}
                disabled={maxAddQty === 0}
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              disabled={p.stock === 0 || maxAddQty === 0}
              onClick={() => {
                const added = s.addToCart({ id: p.id, size: sz ?? "", color: col ?? "" }, qty);
                if (!added) showQuantityWarning();
              }}
              className="btn-lux flex-1"
            >
              {s.t.add}
            </button>
            <button
              onClick={() => s.toggleWish(p.id)}
              className="border px-4"
              aria-label="Wishlist"
            >
              <Heart size={16} className={s.wishlist.includes(p.id) ? "fill-gold text-gold" : ""} />
            </button>
          </div>
          {maxAddQty === 0 && p.stock > 0 && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              {s.lang === "ar"
                ? `وصلت إلى الحد الأقصى للطلب: ${maxOrderQty} قطع.`
                : `You’ve reached the maximum order quantity of ${maxOrderQty} pieces.`}
            </p>
          )}
          <Accordion type="single" collapsible className="mt-10">
            <AccordionItem value="care">
              <AccordionTrigger className="font-serif text-lg">Care Instructions</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Machine wash cool (30–40°C), gentle cycle. No bleach. Tumble dry low or line dry.
                Iron while slightly damp.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ship">
              <AccordionTrigger className="font-serif text-lg">
                {s.lang === "ar" ? "سياسة الشحن" : "Shipping Policy"}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {s.lang === "ar"
                  ? "توصيل لجميع المحافظات. تُحسب رسوم الشحن تلقائياً عند إتمام الطلب بناءً على محافظتك (تبدأ من 50 ج.م). يصلك الطلب خلال 3 إلى 5 أيام عمل بتغليف ROELIX الفاخر."
                  : "Nationwide delivery across Egypt. Shipping fees are calculated dynamically at checkout based on your governorate (starting from EGP 50). Orders arrive within 3–5 business days in signature ROELIX packaging."}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="guar">
              <AccordionTrigger className="font-serif text-lg">Luxury Guarantee</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sleep on it for 100 nights. If it is not the finest you have known, return it
                complimentary.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {bundle.length > 0 && (
        <section className="mt-28 border-t pt-16">
          <h2 className="text-center text-4xl">Frequently Bought Together</h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            {bundle.map((b, i) => (
              <div key={b.id} className="flex items-center gap-6">
                {i > 0 && <span className="font-serif text-3xl text-gold">+</span>}
                <Link
                  to="/product/$id"
                  params={{ id: b.id }}
                  onClick={() => recordProductInteraction("product_click", b.id, b.name)}
                  className="w-40 text-center hover:text-gold"
                >
                  <img
                    src={b.images[0]}
                    alt={s.lang === "ar" && b.nameAr ? b.nameAr : b.name}
                    className="aspect-[4/5] w-full object-cover"
                  />
                  <p className="mt-2 font-serif">
                    {s.lang === "ar" && b.nameAr ? b.nameAr : b.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{s.fmt(b.price)}</p>
                </Link>
              </div>
            ))}
            <div className="text-center md:ms-8">
              <p className="eyebrow text-muted-foreground">Total</p>
              <p className="font-serif text-3xl">{s.fmt(bundleTotal)}</p>
              <button
                onClick={() =>
                  bundle.forEach((b) => {
                    if (
                      !s.addToCart({
                        id: b.id,
                        size: b.sizes[0] ?? "",
                        color: b.colors[0]?.name ?? "",
                      })
                    ) {
                      toast.warning(
                        s.lang === "ar"
                          ? `عذراً، الكمية المتاحة في المخزون هي ${b.stock} فقط`
                          : `Sorry, only ${b.stock} units are available in stock`,
                      );
                    }
                  })
                }
                className="btn-lux mt-4"
              >
                Add All to Bag
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

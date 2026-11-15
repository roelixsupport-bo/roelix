import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readCustomBundleSettings } from "@/lib/local-data";
import { useStore } from "@/lib/store";
import { ProductCard } from "@/components/site/productcard";
import { HeroSlider } from "@/components/site/hero-slider";
import { DEFAULT_STOREFRONT_CONTENT, useSiteSettings } from "@/lib/site-settings";
import { isAllowedPromoUrl } from "@/lib/promo-slides";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ROELIX — Refined Elegance for Your Home" },
      {
        name: "description",
        content:
          "Hotel-grade Egyptian cotton bedding, pillows, mattress protectors and towels for the refined home.",
      },
      { property: "og:title", content: "ROELIX — Refined Elegance for Your Home" },
      {
        property: "og:description",
        content: "Hotel-grade Egyptian cotton bedding and linens for the refined home.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const s = useStore();
  const { settings } = useSiteSettings();
  const storefront = settings?.storefront_content ?? DEFAULT_STOREFRONT_CONTENT;
  const [cat, setCat] = useState<string>("All");
  const [bundleEnabled, setBundleEnabled] = useState(true);
  const categoryScroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const updateSettings = () => setBundleEnabled(readCustomBundleSettings().enabled);
    updateSettings();
    window.addEventListener("storage", updateSettings);
    window.addEventListener("roelix-local-data-change", updateSettings);
    return () => {
      window.removeEventListener("storage", updateSettings);
      window.removeEventListener("roelix-local-data-change", updateSettings);
    };
  }, []);
  const categories = storefront.categories.filter(
    (category) =>
      category.visible &&
      (!category.parentId ||
        storefront.categories.some((parent) => parent.id === category.parentId && parent.visible)),
  );
  const selectedCategory = categories.find((category) => category.id === cat);
  const selectedNames = selectedCategory
    ? [
        selectedCategory.name,
        ...categories
          .filter((category) => category.parentId === selectedCategory.id)
          .map((category) => category.name),
      ]
    : null;
  const list = s.products.filter(
    (product) =>
      product.isPublished && (!selectedNames || selectedNames.includes(product.category)),
  );
  return (
    <>
      {storefront.hero.visible && (
        <section aria-label="Featured collection">
          <HeroSlider content={storefront.hero} />
        </section>
      )}

      {bundleEnabled &&
        storefront.customBundle.visible &&
        storefront.bundleBanner.visible &&
        isAllowedPromoUrl(storefront.bundleBanner.cta_url) && (
          <section className="bg-[#70212c] text-white">
            <div className="mx-auto grid max-w-7xl items-center gap-4 px-5 py-7 text-center sm:px-6 md:grid-cols-[auto_1fr_auto] md:gap-10 md:py-8 md:text-start">
              <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
                {s.lang === "ar"
                  ? storefront.bundleBanner.title_ar
                  : storefront.bundleBanner.title_en}
              </h2>
              <p className="text-sm leading-relaxed text-white/90 sm:text-base">
                {s.lang === "ar"
                  ? storefront.bundleBanner.description_ar
                  : storefront.bundleBanner.description_en}
              </p>
              <a
                href={storefront.bundleBanner.cta_url}
                className="luxury-rounded inline-flex min-h-12 items-center justify-center rounded-none bg-white px-8 py-3 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
              >
                {s.lang === "ar"
                  ? storefront.bundleBanner.cta_text_ar
                  : storefront.bundleBanner.cta_text_en}
              </a>
            </div>
          </section>
        )}

      {storefront.categoryShowcase.visible && (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-serif text-2xl text-foreground sm:text-3xl">
              {s.lang === "ar"
                ? storefront.categoryShowcase.title_ar
                : storefront.categoryShowcase.title_en}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label={s.lang === "ar" ? "الأقسام السابقة" : "Previous categories"}
                onClick={() =>
                  categoryScroller.current?.scrollBy({ left: -320, behavior: "smooth" })
                }
                className="grid size-10 place-items-center rounded-full border border-border text-foreground transition hover:border-navy hover:bg-navy hover:text-white"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={s.lang === "ar" ? "الأقسام التالية" : "Next categories"}
                onClick={() =>
                  categoryScroller.current?.scrollBy({ left: 320, behavior: "smooth" })
                }
                className="grid size-10 place-items-center rounded-full border border-border text-foreground transition hover:border-navy hover:bg-navy hover:text-white"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            ref={categoryScroller}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3"
          >
            {categories
              .filter((category) => category.parentId === null)
              .map((category) => {
                const categoryNames = [
                  category.name,
                  ...categories
                    .filter((item) => item.parentId === category.id)
                    .map((item) => item.name),
                ];
                const categoryProducts = s.products.filter(
                  (product) => product.isPublished && categoryNames.includes(product.category),
                );
                const image = category.imageUrl || categoryProducts[0]?.images[0];
                return (
                  <Link
                    key={category.id}
                    to="/shop"
                    search={{ c: category.name }}
                    className="group relative aspect-[0.8] w-[68vw] max-w-64 shrink-0 snap-start overflow-hidden rounded-xl bg-secondary sm:w-56 md:w-60"
                  >
                    {image && (
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <span className="absolute inset-x-4 bottom-4 text-sm font-semibold text-white underline underline-offset-4 sm:text-base">
                      {category.label}
                    </span>
                  </Link>
                );
              })}
          </div>
        </section>
      )}

      {storefront.featured.visible && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20 lg:py-24">
          {(storefront.featured.eyebrowVisible || storefront.featured.titleVisible) && (
            <div className="text-center">
              {storefront.featured.eyebrowVisible && (
                <p className="eyebrow text-gold">{storefront.featured.eyebrow}</p>
              )}
              {storefront.featured.titleVisible && (
                <h2 className="mt-3 font-serif text-[clamp(1.75rem,4vw,3rem)]">
                  {storefront.featured.title}
                </h2>
              )}
            </div>
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-1.5 sm:mt-10 sm:gap-2">
            {storefront.featured.showAllFilter && (
              <button
                onClick={() => setCat("All")}
                className={`eyebrow rounded-full border px-3 py-2 text-[0.58rem] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm active:scale-95 sm:px-4 sm:text-[0.7rem] ${cat === "All" ? "border-navy bg-navy text-navy-foreground shadow-sm" : "hover:border-gold hover:bg-muted"}`}
              >
                All
              </button>
            )}
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setCat((current) => (current === category.id ? "All" : category.id))}
                className={`eyebrow rounded-full border px-3 py-2 text-[0.58rem] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm active:scale-95 sm:px-4 sm:text-[0.7rem] ${cat === category.id ? "border-navy bg-navy text-navy-foreground shadow-sm" : "hover:border-gold hover:bg-muted"} ${category.parentId ? "ms-2" : ""}`}
              >
                {category.label}
              </button>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 sm:mt-12 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-8">
            {list.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
            {list.length === 0 && (
              <p className="col-span-full text-center font-serif text-xl text-muted-foreground">
                This collection is arriving soon.
              </p>
            )}
          </div>
        </section>
      )}

      {storefront.productSections.map((section) => {
        if (!section.visible) return null;
        const category = categories.find((item) => item.id === section.categoryId);
        if (!category) return null;

        const categoryNames = [
          category.name,
          ...categories.filter((item) => item.parentId === category.id).map((item) => item.name),
        ];
        const products = s.products
          .filter((product) => product.isPublished && categoryNames.includes(product.category))
          .slice(0, 4);
        if (products.length === 0) return null;

        return (
          <section
            key={section.id}
            className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16"
            aria-label={s.lang === "ar" ? section.title_ar : section.title_en}
          >
            <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-4">
              <h2 className="font-serif text-[clamp(1.5rem,3vw,2.4rem)]">
                {s.lang === "ar" ? section.title_ar : section.title_en}
              </h2>
              <Link
                to="/shop"
                search={{ c: category.name }}
                className="shrink-0 text-xs font-medium text-foreground underline decoration-gold underline-offset-4 transition-colors hover:text-gold sm:text-sm"
              >
                {s.lang === "ar" ? "عرض الكل" : "Shop all"}
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:mt-8 sm:gap-x-6 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} p={product} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="bg-secondary">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 text-center md:grid-cols-3">
          {[
            ["1000", "Thread Count Sateen"],
            ["Giza", "Long-Staple Egyptian Cotton"],
            ["100", "Night Luxury Guarantee"],
          ].map(([n, l]) => (
            <div key={l}>
              <p className="font-serif text-6xl text-gold">{n}</p>
              <p className="eyebrow mt-3">{l}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

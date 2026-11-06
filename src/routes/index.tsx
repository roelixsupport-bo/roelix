import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { readCustomBundleSettings } from "@/lib/local-data";
import { CATEGORIES, useStore } from "@/lib/store";
import { ProductCard } from "@/components/site/productcard";

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
  const [cat, setCat] = useState<string>("All");
  const [bundleEnabled, setBundleEnabled] = useState(true);
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
  const categories = [
    ...new Set([...CATEGORIES, ...s.products.map((product) => product.category)]),
  ];
  const list = s.products.filter((p) => p.isPublished && (cat === "All" || p.category === cat));
  return (
    <>
      <section className="overflow-hidden border-b border-gold/20 bg-gradient-to-br from-secondary via-background to-accent/30">
        <div className="mx-auto flex min-h-[19rem] max-w-7xl items-center px-5 py-14 sm:min-h-[26rem] sm:px-8 sm:py-20 lg:min-h-[30rem]">
          <div className="max-w-3xl animate-rise">
            <h1 className="mt-5 max-w-2xl font-serif text-[clamp(2rem,5vw,3.75rem)] leading-[1.08] text-foreground">
              Refined Elegance for Your Home
            </h1>
            <div className="mt-7 flex flex-col items-start gap-3 sm:mt-9 sm:flex-row sm:flex-wrap">
              <Link to="/shop" className="btn-lux">
                Explore The Collection
              </Link>
              {bundleEnabled && (
                <Link
                  to="/custom-bundle"
                  className="inline-flex items-center justify-center border border-navy/35 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground transition-colors hover:border-gold hover:bg-gold/10"
                >
                  {s.lang === "ar" ? "أنشئ طقمك الفاخر" : "Build a Custom Set"}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20 lg:py-24">
        <div className="text-center">
          <p className="eyebrow text-gold">Curated</p>
          <h2 className="mt-3 font-serif text-[clamp(1.75rem,4vw,3rem)]">Featured Collections</h2>
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-1.5 sm:mt-10 sm:gap-2">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`eyebrow border px-2.5 py-2 text-[0.58rem] transition sm:px-4 sm:text-[0.7rem] ${cat === c ? "border-navy bg-navy text-navy-foreground" : "hover:border-gold"}`}
            >
              {c}
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

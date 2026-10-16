import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import hero from "@/assets/hero.jpg";
import { readCustomBundleSettings } from "@/lib/local-data";
import { CATEGORIES, useStore } from "@/lib/store";
import { ProductCard } from "@/components/site/productcard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ROELIX — Unmatched Sleep Luxury" },
      {
        name: "description",
        content:
          "Hotel-grade Egyptian cotton bedding, pillows, mattress protectors and towels for the refined home.",
      },
      { property: "og:title", content: "ROELIX — Unmatched Sleep Luxury" },
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
      <section className="relative h-[calc(100vh-110px)] min-h-[560px] overflow-hidden">
        <img
          src={hero}
          alt="ROELIX luxury bedroom"
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/70 via-navy/30 to-transparent rtl:bg-gradient-to-l" />
        <div className="relative mx-auto flex h-full max-w-7xl items-center px-6">
          <div className="max-w-xl text-navy-foreground animate-rise">
            <p className="eyebrow text-gold">Maison ROELIX · Est. Giza</p>
            <h1 className="mt-6 text-5xl leading-[1.05] md:text-7xl">
              Unmatched Sleep Luxury & Refined Elegance for Your Home
            </h1>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-ghost-lux">
                Explore The Collection
              </Link>
              {bundleEnabled && (
                <Link to="/custom-bundle" className="btn-lux">
                  {s.lang === "ar" ? "أنشئ طقمك الفاخر" : "Build a Custom Set"}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-28">
        <div className="text-center">
          <p className="eyebrow text-gold">Curated</p>
          <h2 className="mt-3 text-5xl">Featured Collections</h2>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`eyebrow border px-4 py-2 transition ${cat === c ? "border-navy bg-navy text-navy-foreground" : "hover:border-gold"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
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

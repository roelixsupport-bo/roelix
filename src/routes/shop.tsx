import { createFileRoute, Link } from "@tanstack/react-router";
import { CATEGORIES, useStore } from "@/lib/store";
import { ProductCard } from "@/components/site/productcard";

type Search = { c?: string | undefined; wish?: boolean | undefined };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    c: typeof s["c"] === "string" ? s["c"] : undefined,
    wish: s["wish"] === true || s["wish"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "The Collections — ROELIX" },
      {
        name: "description",
        content: "Shop luxury bedding sets, hotel pillows, mattress protectors and towels.",
      },
      { property: "og:title", content: "The Collections — ROELIX" },
      {
        property: "og:description",
        content: "Luxury bedding sets, hotel pillows, mattress protectors and towels.",
      },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { c, wish } = Route.useSearch();
  const s = useStore();
  const categories = [
    ...new Set([...CATEGORIES, ...s.products.map((product) => product.category)]),
  ];
  const list = s.products.filter(
    (p) => p.isPublished && (!c || p.category === c) && (!wish || s.wishlist.includes(p.id)),
  );
  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <p className="eyebrow text-center text-gold">{wish ? "Saved" : "ROELIX House"}</p>
      <h1 className="mt-3 text-center text-5xl">
        {wish ? "Your Wishlist" : (c ?? "All Collections")}
      </h1>
      {!wish && (
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {categories.map((x) => (
            <Link
              key={x}
              to="/shop"
              search={{ c: x }}
              className={`eyebrow border px-4 py-2 ${c === x ? "bg-navy text-navy-foreground" : "hover:border-gold"}`}
            >
              {x}
            </Link>
          ))}
          <Link
            to="/shop"
            className={`eyebrow border px-4 py-2 ${!c ? "bg-navy text-navy-foreground" : "hover:border-gold"}`}
          >
            All
          </Link>
        </div>
      )}
      <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
      {list.length === 0 && (
        <p className="mt-10 text-center font-serif text-xl text-muted-foreground">
          Nothing here yet.
        </p>
      )}
    </div>
  );
}

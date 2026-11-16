import { createFileRoute, Link } from "@tanstack/react-router";
import { DEFAULT_STOREFRONT_CONTENT, useSiteSettings } from "@/lib/site-settings";
import { useStore } from "@/lib/store";
import { ProductCard } from "@/components/site/productcard";
import { loadCategorySeo } from "@/lib/seo-data";

type Search = { c?: string | undefined; wish?: boolean | undefined };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    c: typeof s["c"] === "string" ? s["c"] : undefined,
    wish: s["wish"] === true || s["wish"] === "true" ? true : undefined,
  }),
  loaderDeps: ({ search: { c, wish } }) => ({ category: c, wishlist: wish }),
  loader: ({ deps }) => loadCategorySeo(deps.category, deps.wishlist),
  head: ({ loaderData }) => {
    const category = loaderData;
    const title = category ? `${category.name} — ROELIX` : "The Collections — ROELIX";
    const description =
      category?.description ??
      "Shop luxury bedding sets, hotel pillows, mattress protectors and towels from ROELIX.";
    const image = category?.image;
    const canonical = category
      ? `${category.url}`
      : "https://roelix.com/shop";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: Shop,
});

function Shop() {
  const { c, wish } = Route.useSearch();
  const s = useStore();
  const { settings } = useSiteSettings();
  const storefront = settings?.storefront_content ?? DEFAULT_STOREFRONT_CONTENT;
  const visibleCategories = storefront.categories.filter(
    (category) =>
      category.visible &&
      (!category.parentId ||
        storefront.categories.some((parent) => parent.id === category.parentId && parent.visible)),
  );
  const deletedCategoryNames = new Set(
    storefront.deletedCategoryNames.map((name) => name.toLocaleLowerCase()),
  );
  const unconfiguredCategories = [...new Set(s.products.map((product) => product.category))]
    .filter(
      (name) =>
        !storefront.categories.some((category) => category.name === name) &&
        !deletedCategoryNames.has(name.toLocaleLowerCase()),
    )
    .map((name) => ({ id: name, name, label: name, parentId: null }));
  const categories = [...visibleCategories, ...unconfiguredCategories];
  const selectedCategory = visibleCategories.find((category) => category.name === c);
  const selectedNames = selectedCategory
    ? [
        selectedCategory.name,
        ...visibleCategories
          .filter((category) => category.parentId === selectedCategory.id)
          .map((category) => category.name),
      ]
    : null;
  const list = s.products.filter(
    (p) =>
      p.isPublished &&
      (!c || (selectedNames ? selectedNames.includes(p.category) : p.category === c)) &&
      (!wish || s.wishlist.includes(p.id)),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-20">
      {/* عنوان الصفحة والعنوان الفرعي */}
      <p className="eyebrow text-center text-gold font-bold text-xs sm:text-sm">
        {wish ? (s.lang === "ar" ? "المفضلة" : "Saved") : "ROELIX House"}
      </p>

      <h1 className="mt-2 sm:mt-3 text-center font-serif text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
        {wish
          ? s.lang === "ar"
            ? "قائمة المفضلة"
            : "Your Wishlist"
          : (c ?? (s.lang === "ar" ? "جميع التشكيلات" : "All Collections"))}
      </h1>

      {/* تصنيفات التصفية (Scrollable Category Filters for Mobile) */}
      {!wish && (
        <div className="mt-6 sm:mt-10 flex items-center gap-2 overflow-x-auto pb-3 sm:pb-0 justify-start sm:justify-center scrollbar-none px-2">
          <Link
            to="/shop"
            className={`eyebrow border px-4 py-2 sm:py-2.5 text-xs sm:text-sm whitespace-nowrap rounded-xs transition-colors shrink-0 ${
              !c
                ? "bg-black text-white border-black font-bold shadow-xs"
                : "border-border text-foreground hover:border-gold"
            }`}
          >
            {s.lang === "ar" ? "الكل" : "All"}
          </Link>

          {categories.map((category) => (
            <Link
              key={category.id}
              to="/shop"
              search={{ c: category.name }}
              className={`eyebrow border px-4 py-2 sm:py-2.5 text-xs sm:text-sm whitespace-nowrap rounded-xs transition-colors shrink-0 ${
                c === category.name
                  ? "bg-black text-white border-black font-bold shadow-xs"
                  : "border-border text-foreground hover:border-gold"
              }`}
            >
              {category.label}
            </Link>
          ))}
        </div>
      )}

      {/* شبكة المنتجات (2 Columns on Mobile, 3 on Desktop) */}
      <div className="mt-8 sm:mt-14 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-8 sm:gap-y-14 lg:grid-cols-3">
        {list.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>

      {/* حالة لا توجد منتجات */}
      {list.length === 0 && (
        <div className="mt-16 sm:mt-24 text-center space-y-4">
          <p className="font-serif text-xl sm:text-2xl text-muted-foreground">
            {wish
              ? s.lang === "ar"
                ? "لم تقمي بإضافة أي منتجات للمفضلة بعد."
                : "Your wishlist is empty."
              : s.lang === "ar"
                ? "لا توجد منتجات متاحة في هذه التشكيلة حالياً."
                : "Nothing here yet."}
          </p>
          <Link
            to="/shop"
            className="inline-block bg-black hover:bg-zinc-800 text-white font-bold py-3 px-6 rounded text-xs uppercase tracking-wider transition shadow-md"
          >
            {s.lang === "ar" ? "عرض جميع المنتجات" : "Browse All Products"}
          </Link>
        </div>
      )}
    </div>
  );
}

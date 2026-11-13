import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/site/account-menu";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { PromoBanner } from "@/components/site/promo-banner";
import { recordProductInteraction, recordSearchQuery } from "@/lib/local-data";
import { CATEGORIES, useStore, type Product } from "@/lib/store";
import { useSiteSettings } from "@/lib/site-settings";

export function Header() {
  const s = useStore();
  const { settings } = useSiteSettings();
  const pathname = useLocation({ select: (location) => location.pathname });
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (pathname === "/admin" || query.length < 2) return;
    const timeout = window.setTimeout(() => recordSearchQuery(query), 450);
    return () => window.clearTimeout(timeout);
  }, [pathname, q]);

  const results =
    q.length > 1
      ? s.products
          .filter(
            (p) =>
              p.isPublished &&
              (p.name + p.nameAr + p.category).toLowerCase().includes(q.toLowerCase()),
          )
          .slice(0, 5)
      : [];

  const selectProduct = (product: Product) => {
    if (pathname !== "/admin") {
      recordProductInteraction("product_click", product.id, product.name);
    }
    setQ("");
    nav({ to: "/product/$id", params: { id: product.id } });
  };

  return (
    <header className="relative z-40 w-full overflow-x-clip border-b bg-background">
      <div className="relative">
        <PromoBanner />
        <div className="absolute start-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 sm:start-6 sm:gap-2">
          <span className="hidden text-[0.62rem] font-semibold text-gold sm:inline">
            {s.lang === "ar" ? "ج.م" : "EGP"}
          </span>
          <span aria-hidden="true" className="hidden text-gold/50 sm:inline">
            ·
          </span>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="bg-background">
        <div
          dir="ltr"
          className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-2 px-3 py-2.5 sm:px-6 md:grid-cols-[1fr_minmax(16rem,30rem)_1fr] md:gap-x-8 md:py-4"
        >
          <button
            type="button"
            className="col-start-1 row-start-1 grid size-9 place-items-center text-foreground transition-colors hover:text-gold md:hidden"
            onClick={() => setMobile(!mobile)}
            aria-label={mobile ? (s.lang === "ar" ? "إغلاق القائمة" : "Close menu") : s.t.menu}
            aria-expanded={mobile}
          >
            {mobile ? <X size={21} /> : <Menu size={21} />}
          </button>

          <Link
            to="/"
            aria-label="ROELIX home"
            className="col-start-2 row-start-1 whitespace-nowrap text-center font-serif text-[clamp(1.25rem,5vw,1.8rem)] font-bold tracking-[0.13em] text-foreground transition-colors hover:text-gold md:col-start-1 md:text-left md:text-[clamp(1.5rem,2.4vw,2rem)] md:tracking-[0.16em]"
          >
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt="ROELIX"
                className="mx-auto max-h-12 max-w-36 object-contain md:mx-0"
              />
            ) : (
              "ROELIX"
            )}
          </Link>

          <SearchField
            value={q}
            onChange={setQ}
            onSelect={selectProduct}
            results={results}
            placeholder={s.t.search}
            lang={s.lang}
            formatPrice={s.fmt}
          />

          <div className="col-start-3 row-start-1 flex items-center justify-self-end">
            <Link
              to="/shop"
              search={{ wish: true }}
              aria-label={s.t.wishlist}
              title={s.t.wishlist}
              className="relative grid size-9 place-items-center text-foreground transition-colors hover:text-gold"
            >
              <Heart size={19} strokeWidth={1.6} />
              {s.wishlist.length > 0 && <Badge n={s.wishlist.length} />}
            </Link>
            <AccountMenu />
            <button
              type="button"
              onClick={() => s.setCartOpen(true)}
              aria-label={s.t.cart}
              title={s.t.cart}
              className="relative grid size-9 place-items-center text-foreground transition-colors hover:text-gold"
            >
              <ShoppingBag size={19} strokeWidth={1.6} />
              {s.count > 0 && <Badge n={s.count} />}
            </button>
          </div>
        </div>

        <nav
          aria-label={s.lang === "ar" ? "تسوق حسب المجموعة" : "Shop by collection"}
          dir="ltr"
          className="border-t border-border/70"
        >
          <ul className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2.5 text-[0.68rem] font-medium uppercase tracking-[0.08em] sm:gap-8 sm:px-6 sm:text-xs md:justify-center md:gap-9 md:overflow-visible">
            {CATEGORIES.map((category, index) => {
              const products = s.products
                .filter((product) => product.isPublished && product.category === category)
                .slice(0, 5);

              return (
                <li key={category} className="group relative shrink-0">
                  <Link
                    to="/shop"
                    search={{ c: category }}
                    onClick={() => setMobile(false)}
                    dir="auto"
                    className="block border-b border-transparent py-1 text-foreground/85 transition-colors hover:border-gold hover:text-gold"
                  >
                    {category}
                  </Link>
                  <div
                    className={`absolute top-full z-50 hidden w-[min(22rem,calc(100vw-2rem))] border border-border bg-background p-3 text-start normal-case tracking-normal shadow-lux group-hover:block group-focus-within:block ${
                      index === CATEGORIES.length - 1 ? "right-0" : "left-0"
                    }`}
                  >
                    <ul className="divide-y divide-border/70">
                      {products.map((product) => (
                        <li key={product.id}>
                          <Link
                            to="/product/$id"
                            params={{ id: product.id }}
                            onClick={() => {
                              if (pathname !== "/admin") {
                                recordProductInteraction("product_click", product.id, product.name);
                              }
                            }}
                            dir="auto"
                            className="flex items-center gap-3 py-2 transition-colors hover:text-gold"
                          >
                            <img
                              src={product.images[0]}
                              alt=""
                              className="size-12 shrink-0 rounded-sm object-cover"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-serif text-sm font-semibold text-foreground">
                                {s.lang === "ar" ? product.nameAr : product.name}
                              </span>
                              <span className="mt-0.5 block text-xs text-gold">
                                {s.fmt(product.price)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/shop"
                      search={{ c: category }}
                      className="mt-2 block border-t border-border pt-3 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:text-gold"
                    >
                      {s.lang === "ar" ? "عرض كل المنتجات" : "View all products"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        {mobile && (
          <div className="border-t bg-background shadow-xl">
            <div className="mx-auto grid max-w-7xl gap-6 px-5 py-5 sm:grid-cols-2 md:grid-cols-4 md:px-6">
              <div>
                <p className="eyebrow mb-3 font-bold text-gold">The Collections</p>
                <ul className="space-y-2 font-serif text-base">
                  {CATEGORIES.map((category) => (
                    <li key={category}>
                      <Link
                        to="/shop"
                        search={{ c: category }}
                        onClick={() => setMobile(false)}
                        className="block text-foreground transition-colors hover:text-gold"
                      >
                        {category}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="eyebrow mb-3 font-bold text-foreground">By Fabric</p>
                <p>Egyptian Giza Cotton</p>
                <p>Sateen 1000 TC</p>
                <p>Percale 600 TC</p>
                <p>Hotel Microfiber</p>
              </div>
              {s.products
                .filter((product) => product.isPublished)
                .slice(0, 2)
                .map((product) => (
                  <Link
                    key={product.id}
                    to="/product/$id"
                    params={{ id: product.id }}
                    onClick={() => {
                      if (pathname !== "/admin") {
                        recordProductInteraction("product_click", product.id, product.name);
                      }
                      setMobile(false);
                    }}
                    className="group"
                  >
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-36 w-full rounded-sm object-cover transition duration-700 group-hover:scale-[1.02]"
                    />
                    <p className="mt-2 font-serif text-base font-semibold text-foreground transition-colors group-hover:text-gold">
                      {product.name}
                    </p>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function SearchField({
  value,
  onChange,
  onSelect,
  results,
  placeholder,
  lang,
  formatPrice,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: Product) => void;
  results: Product[];
  placeholder: string;
  lang: "en" | "ar";
  formatPrice: (price: number) => string;
}) {
  return (
    <div className="relative col-span-3 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
      <label className="flex items-center gap-2 border-b border-border px-2 py-2 text-muted-foreground transition-colors focus-within:border-foreground">
        <Search size={19} strokeWidth={1.6} aria-hidden="true" />
        <input
          dir="auto"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-[min(50dvh,24rem)] overflow-y-auto divide-y rounded-sm border bg-popover shadow-lux">
          {results.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelect(product)}
              className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-muted"
            >
              <img src={product.images[0]} alt="" className="h-12 w-10 rounded-sm object-cover" />
              <span dir="auto" className="min-w-0">
                <span className="block truncate font-serif text-sm font-semibold leading-tight text-foreground">
                  {lang === "ar" ? product.nameAr : product.name}
                </span>
                <span className="mt-0.5 block text-xs font-bold text-gold">
                  {formatPrice(product.price)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.65rem] font-bold text-gold-foreground shadow-sm">
      {n}
    </span>
  );
}

import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Heart, Search, ShoppingBag, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/site/account-menu";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { recordProductInteraction, recordSearchQuery } from "@/lib/local-data";
import { CATEGORIES, useStore } from "@/lib/store";

export function Header() {
  const s = useStore();
  const pathname = useLocation({ select: (location) => location.pathname });
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [mega, setMega] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [searchOpenMobile, setSearchOpenMobile] = useState(false);

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

  return (
    <header className="relative w-full z-40 bg-background border-b overflow-x-hidden">
      {/* Top Announcement Bar - شريط التنبيهات الفاخر */}
      <div className="bg-navy text-navy-foreground w-full border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 text-[0.68rem] tracking-wider uppercase sm:px-6">
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-semibold" title={s.lang === "ar" ? "العملة" : "Currency"}>
              {s.lang === "ar" ? "ج.م" : "EGP"}
            </span>
            <span aria-hidden="true" className="opacity-40">
              ·
            </span>
            <LanguageSwitcher />
          </div>
          <span
            dir="auto"
            className="min-w-0 flex-1 truncate px-2 text-center text-xs font-medium text-gold"
          >
            {s.t.announce}
          </span>
        </div>
      </div>

      {/* Main Navigation Bar - شريط التصفح الرئيسي */}
      <div className="bg-background/95 backdrop-blur" onMouseLeave={() => setMega(false)}>
        <div
          dir="ltr"
          className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-2 py-2.5 sm:px-6"
        >
          <div className="flex shrink-0 items-center gap-0">
            <button
              className="grid size-9 place-items-center text-foreground transition-colors hover:text-gold"
              onClick={() => setMobile(!mobile)}
              aria-label="Menu"
              aria-expanded={mobile}
            >
              {mobile ? <X size={21} /> : <Menu size={21} />}
            </button>

            <button
              onClick={() => s.setCartOpen(true)}
              aria-label={s.t.cart}
              className="relative grid size-9 place-items-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent hover:text-gold"
            >
              <ShoppingBag size={18} />
              {s.count > 0 && <Badge n={s.count} />}
            </button>

            {/* The account control sits directly beside the bag: one 22px outline
                glyph, which becomes the identity tile once signed in. */}
            <AccountMenu />

            <Link
              to="/shop"
              search={{ wish: true }}
              aria-label={s.t.wishlist}
              className="relative grid size-9 place-items-center text-foreground transition-colors hover:text-gold"
            >
              <Heart size={18} />
              {s.wishlist.length > 0 && <Badge n={s.wishlist.length} />}
            </Link>

            <button
              className="grid size-9 place-items-center text-foreground transition-colors hover:text-gold"
              onClick={() => setSearchOpenMobile(!searchOpenMobile)}
              aria-label="Search"
              aria-expanded={searchOpenMobile}
            >
              <Search size={18} />
            </button>
          </div>

          <Link
            to="/"
            className="shrink-0 text-center font-serif text-[clamp(0.9rem,2vw,1.25rem)] font-bold tracking-[clamp(0.06em,0.5vw,0.14em)] text-foreground transition-colors hover:text-gold"
          >
            ROELIX
          </Link>
        </div>

        {searchOpenMobile && (
          <div className="border-t bg-background p-3">
            <div className="flex items-center gap-2 border border-border rounded px-3 py-2 bg-muted/30">
              <Search size={18} className="text-muted-foreground" />
              <input
                dir="auto"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={s.t.search}
                className="min-w-0 w-full bg-transparent text-sm font-medium text-foreground outline-none"
                autoFocus
              />
              <button onClick={() => setSearchOpenMobile(false)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            {results.length > 0 && (
              <div className="mt-2 max-h-[min(50dvh,24rem)] overflow-y-auto divide-y rounded border bg-popover shadow-lux">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (pathname !== "/admin") {
                        recordProductInteraction("product_click", p.id, p.name);
                      }
                      setQ("");
                      setSearchOpenMobile(false);
                      nav({ to: "/product/$id", params: { id: p.id } });
                    }}
                    className="flex w-full items-center gap-3 p-3 text-start hover:bg-muted"
                  >
                    <img src={p.images[0]} alt="" className="h-12 w-10 object-cover rounded-sm" />
                    <div dir="auto">
                      <div className="font-serif text-sm font-semibold leading-tight text-foreground">
                        {s.lang === "ar" ? p.nameAr : p.name}
                      </div>
                      <div className="text-xs text-gold font-bold mt-0.5">{s.fmt(p.price)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* القائمة الجانبية (Mega Menu & Mobile Drawer) */}
        {(mega || mobile) && (
          <div className="border-t bg-background animate-in fade-in slide-in-from-top-2 shadow-2xl">
            <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 md:grid-cols-4">
              <div>
                <p className="eyebrow mb-4 text-gold font-bold">The Collections</p>
                <ul className="space-y-3 font-serif text-lg">
                  {CATEGORIES.map((category) => (
                    <li key={category}>
                      <Link
                        to="/shop"
                        search={{ c: category }}
                        onClick={() => {
                          setMega(false);
                          setMobile(false);
                        }}
                        className="hover:text-gold transition-colors block text-foreground font-medium"
                      >
                        {category}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="eyebrow mb-4 text-foreground font-bold">By Fabric</p>
                <p className="hover:text-foreground cursor-pointer transition">
                  Egyptian Giza Cotton
                </p>
                <p className="hover:text-foreground cursor-pointer transition">Sateen 1000 TC</p>
                <p className="hover:text-foreground cursor-pointer transition">Percale 600 TC</p>
                <p className="hover:text-foreground cursor-pointer transition">Hotel Microfiber</p>
              </div>
              {s.products
                .filter((p) => p.isPublished)
                .slice(0, 2)
                .map((p) => (
                  <Link
                    key={p.id}
                    to="/product/$id"
                    params={{ id: p.id }}
                    onClick={() => {
                      if (pathname !== "/admin") {
                        recordProductInteraction("product_click", p.id, p.name);
                      }
                      setMega(false);
                      setMobile(false);
                    }}
                    className="group"
                  >
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="h-48 w-full object-cover transition duration-700 group-hover:scale-[1.02] rounded-sm"
                    />
                    <p className="mt-3 font-serif text-lg font-semibold text-foreground group-hover:text-gold transition-colors">
                      {p.name}
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

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.65rem] font-bold text-gold-foreground shadow-sm">
      {n}
    </span>
  );
}

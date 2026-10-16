import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Heart, Search, ShoppingBag, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { recordProductInteraction, recordSearchQuery } from "@/lib/local-data";
import { CATEGORIES, useStore } from "@/lib/store";

export function Header() {
  const s = useStore();
  const pathname = useLocation({ select: (location) => location.pathname });
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [mega, setMega] = useState(false);
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

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-navy text-navy-foreground">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-6 py-2 text-[0.62rem] tracking-[0.16em] uppercase">
          <div className="flex items-center gap-3 justify-self-start whitespace-nowrap">
            <span aria-label="Currency">{s.lang === "ar" ? "ج.م" : "EGP"}</span>
            <span className="opacity-40">·</span>
            <button
              onClick={() => s.setLang(s.lang === "en" ? "ar" : "en")}
              className="hover:text-gold"
            >
              {s.lang === "en" ? "العربية" : "English"}
            </button>
          </div>
          <span dir="auto" className="text-center leading-tight text-gold">
            {s.t.announce}
          </span>
          <span className="hidden justify-self-end whitespace-nowrap opacity-60 sm:block">
            Concierge · +1 800 ROELIX
          </span>
        </div>
      </div>
      <div className="border-b bg-background/95 backdrop-blur" onMouseLeave={() => setMega(false)}>
        <div
          dir="ltr"
          className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-5"
        >
          <div className="flex items-center gap-5 justify-self-start">
            <button className="lg:hidden" onClick={() => setMobile(!mobile)} aria-label="Menu">
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </button>
            <button
              onClick={() => s.setCartOpen(true)}
              aria-label={s.t.cart}
              className="relative hover:text-gold"
            >
              <ShoppingBag size={18} />
              {s.count > 0 && <Badge n={s.count} />}
            </button>
            <Link
              to="/shop"
              search={{ wish: true }}
              aria-label={s.t.wishlist}
              className="relative hover:text-gold"
            >
              <Heart size={18} />
              {s.wishlist.length > 0 && <Badge n={s.wishlist.length} />}
            </Link>
            <div className="relative hidden md:block">
              <div className="flex items-center gap-2 border-b border-border pb-1">
                <Search size={14} className="text-muted-foreground" />
                <input
                  dir="auto"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={s.t.search}
                  className="w-44 bg-transparent text-sm outline-none"
                />
              </div>
              {results.length > 0 && (
                <div className="absolute start-0 top-full mt-3 w-80 border bg-popover shadow-lux">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (pathname !== "/admin") {
                          recordProductInteraction("product_click", p.id, p.name);
                        }
                        setQ("");
                        nav({ to: "/product/$id", params: { id: p.id } });
                      }}
                      className="flex w-full items-center gap-3 p-3 text-start hover:bg-muted"
                    >
                      <img src={p.images[0]} alt="" className="h-14 w-12 object-cover" />
                      <div dir="auto">
                        <div className="font-serif text-lg leading-tight">
                          {s.lang === "ar" ? p.nameAr : p.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.fmt(p.price)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Link
            to="/"
            className="justify-self-center whitespace-nowrap font-serif text-3xl tracking-[0.35em] ps-[0.35em]"
          >
            ROELIX
          </Link>
          <nav className="hidden items-center justify-self-end gap-8 eyebrow lg:flex">
            <Link to="/shop" search={{ c: "Luxury Towels" }} className="hover:text-gold">
              Bath
            </Link>
            <Link to="/shop" search={{ c: "Bedding Sets" }} className="hover:text-gold">
              Bedding
            </Link>
            <button
              onMouseEnter={() => setMega(true)}
              onClick={() => setMega(!mega)}
              className="hover:text-gold"
            >
              Groups
            </button>
          </nav>
        </div>
        {(mega || mobile) && (
          <div className="border-t bg-background animate-in fade-in slide-in-from-top-2">
            <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 md:grid-cols-4">
              <div>
                <p className="eyebrow mb-4 text-gold">The Collections</p>
                <ul className="space-y-3 font-serif text-xl">
                  {CATEGORIES.map((category) => (
                    <li key={category}>
                      <Link
                        to="/shop"
                        search={{ c: category }}
                        onClick={() => {
                          setMega(false);
                          setMobile(false);
                        }}
                        className="hover:text-gold"
                      >
                        {category}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="eyebrow mb-4 text-foreground">By Fabric</p>
                <p>Egyptian Giza Cotton</p>
                <p>Sateen 1000 TC</p>
                <p>Percale 600 TC</p>
                <p>Hotel Microfiber</p>
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
                    className="hidden group md:block"
                  >
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="h-48 w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                    />
                    <p className="mt-3 font-serif text-lg">{p.name}</p>
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
    <span className="absolute -top-2 -end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] text-gold-foreground">
      {n}
    </span>
  );
}

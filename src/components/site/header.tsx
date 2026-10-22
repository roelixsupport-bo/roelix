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
    /* تحويل الهيدر إلى relative ليبقى أعلى الصفحة دائماً ولا ينزل مع السكرول */
    <header className="relative w-full z-40 bg-background border-b overflow-x-hidden">
      {/* Top Announcement Bar */}
      <div className="bg-navy text-navy-foreground w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2 text-[0.62rem] tracking-[0.16em] uppercase">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span aria-label="Currency">{s.lang === "ar" ? "ج.م" : "EGP"}</span>
            <span className="opacity-40">·</span>
            <button
              onClick={() => s.setLang(s.lang === "en" ? "ar" : "en")}
              className="hover:text-gold transition-colors"
            >
              {s.lang === "en" ? "العربية" : "English"}
            </button>
          </div>
          <span dir="auto" className="text-center leading-tight text-gold truncate px-2">
            {s.t.announce}
          </span>
          <span className="hidden justify-self-end whitespace-nowrap opacity-60 sm:block shrink-0">
            Concierge · +1 800 ROELIX
          </span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="bg-background/95 backdrop-blur" onMouseLeave={() => setMega(false)}>
        <div
          dir="ltr"
          className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-4"
        >
          {/* Left Side: Mobile Menu + Action Icons */}
          <div className="flex items-center gap-3 sm:gap-5">
            <button 
              className="lg:hidden p-1 hover:text-gold transition-colors" 
              onClick={() => setMobile(!mobile)} 
              aria-label="Menu"
            >
              {mobile ? <X size={22} /> : <Menu size={22} />}
            </button>
            
            <button
              onClick={() => s.setCartOpen(true)}
              aria-label={s.t.cart}
              className="relative p-1 hover:text-gold transition-colors"
            >
              <ShoppingBag size={20} />
              {s.count > 0 && <Badge n={s.count} />}
            </button>
            
            <Link
              to="/shop"
              search={{ wish: true }}
              aria-label={s.t.wishlist}
              className="relative p-1 hover:text-gold transition-colors"
            >
              <Heart size={20} />
              {s.wishlist.length > 0 && <Badge n={s.wishlist.length} />}
            </Link>

            {/* Mobile Search Toggle Icon */}
            <button 
              className="md:hidden p-1 hover:text-gold transition-colors"
              onClick={() => setSearchOpenMobile(!searchOpenMobile)}
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {/* Desktop Search Input */}
            <div className="relative hidden md:block">
              <div className="flex items-center gap-2 border-b border-border pb-1">
                <Search size={14} className="text-muted-foreground" />
                <input
                  dir="auto"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={s.t.search}
                  className="w-36 lg:w-44 bg-transparent text-sm outline-none"
                />
              </div>
              {results.length > 0 && (
                <div className="absolute start-0 top-full mt-3 w-80 border bg-popover shadow-lux z-50">
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

          {/* Logo (Centered) */}
          <Link
            to="/"
            className="font-serif text-2xl sm:text-3xl tracking-[0.25em] sm:tracking-[0.35em] text-center"
          >
            ROELIX
          </Link>

          {/* Desktop Right Navigation */}
          <nav className="hidden items-center justify-end gap-6 lg:gap-8 eyebrow lg:flex">
            <Link to="/shop" search={{ c: "Luxury Towels" }} className="hover:text-gold transition-colors">
              Bath
            </Link>
            <Link to="/shop" search={{ c: "Bedding Sets" }} className="hover:text-gold transition-colors">
              Bedding
            </Link>
            <button
              onMouseEnter={() => setMega(true)}
              onClick={() => setMega(!mega)}
              className="hover:text-gold transition-colors"
            >
              Groups
            </button>
          </nav>
        </div>

        {/* Mobile Search Bar Expandable */}
        {searchOpenMobile && (
          <div className="p-3 border-t bg-background md:hidden">
            <div className="flex items-center gap-2 border rounded-md px-3 py-2">
              <Search size={16} className="text-muted-foreground" />
              <input
                dir="auto"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={s.t.search}
                className="w-full bg-transparent text-sm outline-none"
                autoFocus
              />
              <button onClick={() => setSearchOpenMobile(false)}>
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            {results.length > 0 && (
              <div className="mt-2 border bg-popover shadow-lux divide-y">
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
                    className="flex w-full items-center gap-3 p-2 text-start hover:bg-muted"
                  >
                    <img src={p.images[0]} alt="" className="h-12 w-10 object-cover" />
                    <div dir="auto">
                      <div className="font-serif text-sm leading-tight">
                        {s.lang === "ar" ? p.nameAr : p.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{s.fmt(p.price)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mega Menu / Mobile Navigation Drawer */}
        {(mega || mobile) && (
          <div className="border-t bg-background animate-in fade-in slide-in-from-top-2">
            <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 md:grid-cols-4">
              <div>
                <p className="eyebrow mb-4 text-gold">The Collections</p>
                <ul className="space-y-3 font-serif text-lg sm:text-xl">
                  {CATEGORIES.map((category) => (
                    <li key={category}>
                      <Link
                        to="/shop"
                        search={{ c: category }}
                        onClick={() => {
                          setMega(false);
                          setMobile(false);
                        }}
                        className="hover:text-gold transition-colors block"
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
    <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] text-gold-foreground">
      {n}
    </span>
  );
}
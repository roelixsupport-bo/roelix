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
    <header className="relative w-full z-40 bg-background border-b overflow-x-hidden">
      {/* Top Announcement Bar - شريط الإعلانات العلوي */}
      <div className="bg-navy text-navy-foreground w-full border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 py-2 text-[0.62rem] sm:text-[0.72rem] tracking-[0.15em] uppercase">
          {/* العملة واللغة */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <span className="font-semibold">{s.lang === "ar" ? "ج.م" : "EGP"}</span>
            <span className="opacity-40">·</span>
            <button
              onClick={() => s.setLang(s.lang === "en" ? "ar" : "en")}
              className="hover:text-gold transition-colors font-semibold"
            >
              {s.lang === "en" ? "العربية" : "English"}
            </button>
          </div>

          {/* نص الإعلان الذهبي في المنتصف */}
          <span dir="auto" className="text-center font-medium text-gold px-1 text-[0.65rem] sm:text-xs leading-tight">
            {s.t.announce}
          </span>

          {/* رقم الـ Concierge */}
          <span className="whitespace-nowrap opacity-80 shrink-0 text-[0.6rem] sm:text-xs">
            Concierge · +1 800 ROELIX
          </span>
        </div>
      </div>

      {/* Main Navigation Bar - الشريط الرئيسي */}
      <div className="bg-background/95 backdrop-blur" onMouseLeave={() => setMega(false)}>
        <div
          dir="ltr"
          className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-6 px-3 sm:px-6 py-3 sm:py-5"
        >
          {/* الأيقونات جهة اليسار */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              className="lg:hidden p-1 hover:text-gold transition-colors text-foreground" 
              onClick={() => setMobile(!mobile)} 
              aria-label="Menu"
            >
              {mobile ? <X size={22} /> : <Menu size={22} />}
            </button>
            
            <button
              onClick={() => s.setCartOpen(true)}
              aria-label={s.t.cart}
              className="relative p-1 hover:text-gold transition-colors text-foreground"
            >
              <ShoppingBag size={20} />
              {s.count > 0 && <Badge n={s.count} />}
            </button>
            
            <Link
              to="/shop"
              search={{ wish: true }}
              aria-label={s.t.wishlist}
              className="relative p-1 hover:text-gold transition-colors text-foreground"
            >
              <Heart size={20} />
              {s.wishlist.length > 0 && <Badge n={s.wishlist.length} />}
            </Link>

            {/* زر البحث للموبايل */}
            <button 
              className="md:hidden p-1 hover:text-gold transition-colors text-foreground"
              onClick={() => setSearchOpenMobile(!searchOpenMobile)}
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {/* مربع البحث للديسكتوب */}
            <div className="relative hidden md:block">
              <div className="flex items-center gap-2 border-b border-border pb-1">
                <Search size={15} className="text-muted-foreground" />
                <input
                  dir="auto"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={s.t.search}
                  className="w-36 lg:w-48 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>
              {results.length > 0 && (
                <div className="absolute start-0 top-full mt-3 w-80 border bg-popover shadow-lux z-50 rounded-sm">
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
                      className="flex w-full items-center gap-3 p-3 text-start hover:bg-muted transition"
                    >
                      <img src={p.images[0]} alt="" className="h-14 w-12 object-cover rounded-sm" />
                      <div dir="auto">
                        <div className="font-serif text-base font-semibold leading-tight text-foreground">
                          {s.lang === "ar" ? p.nameAr : p.name}
                        </div>
                        <div className="text-xs text-gold font-bold mt-1">{s.fmt(p.price)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* اللوجو بالمنتصف */}
          <Link
            to="/"
            className="font-serif text-xl sm:text-3xl font-bold tracking-[0.2em] sm:tracking-[0.3em] text-center text-foreground hover:text-gold transition-colors"
          >
            ROELIX
          </Link>

          {/* روابط المجموعات (للديسكتوب فقط) */}
          <nav className="hidden items-center justify-end gap-6 lg:gap-8 eyebrow lg:flex font-semibold text-xs sm:text-sm">
            <Link to="/shop" search={{ c: "Luxury Towels" }} className="hover:text-gold transition-colors text-foreground">
              BATH
            </Link>
            <Link to="/shop" search={{ c: "Bedding Sets" }} className="hover:text-gold transition-colors text-foreground">
              BEDDING
            </Link>
            <button
              onMouseEnter={() => setMega(true)}
              onClick={() => setMega(!mega)}
              className="hover:text-gold transition-colors text-foreground cursor-pointer"
            >
              GROUPS
            </button>
          </nav>
        </div>

        {/* حقل البحث الخاص بالهاتف عند النقر على الأيقونة */}
        {searchOpenMobile && (
          <div className="p-3 border-t bg-background md:hidden">
            <div className="flex items-center gap-2 border border-border rounded px-3 py-2 bg-muted/30">
              <Search size={18} className="text-muted-foreground" />
              <input
                dir="auto"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={s.t.search}
                className="w-full bg-transparent text-sm outline-none text-foreground font-medium"
                autoFocus
              />
              <button onClick={() => setSearchOpenMobile(false)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            {results.length > 0 && (
              <div className="mt-2 border bg-popover shadow-lux divide-y rounded">
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

        {/* القائمة الجانبية في الموبايل (Hamburger Menu) */}
        {(mega || mobile) && (
          <div className="border-t bg-background animate-in fade-in slide-in-from-top-2 shadow-2xl">
            <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:grid-cols-4">
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
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.65rem] font-bold text-gold-foreground shadow-xs">
      {n}
    </span>
  );
}
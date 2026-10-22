import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { recordProductInteraction } from "@/lib/local-data";
import { useStore, type Product } from "@/lib/store";

export function ProductCard({ p }: { p: Product }) {
  const s = useStore();
  const wished = s.wishlist.includes(p.id);

  return (
    <div className="group relative flex flex-col h-full w-full overflow-hidden">
      {/* Container للصورة ورابط المنتج */}
      <div className="relative w-full overflow-hidden bg-muted rounded-sm">
        <Link
          to="/product/$id"
          params={{ id: p.id }}
          onClick={() => recordProductInteraction("product_click", p.id, p.name)}
          className="block w-full"
        >
          <img
            src={p.images[0]}
            alt={p.name}
            loading="lazy"
            className="aspect-[4/5] w-full object-cover transition duration-[1.2s] group-hover:scale-105"
          />
        </Link>
        
        {/* زر المفضلة (Wishlist) */}
        <button
          onClick={() => s.toggleWish(p.id)}
          aria-label="Wishlist"
          className="absolute top-2.5 end-2.5 sm:top-4 sm:end-4 rounded-full bg-background/80 p-1.5 sm:p-2 backdrop-blur transition hover:text-gold z-10"
        >
          <Heart size={14} className={wished ? "fill-gold text-gold" : "text-foreground"} />
        </button>
      </div>

      {/* تفاصيل المنتج والنصوص المتجاوبة */}
      <div className="mt-2.5 sm:mt-4 flex flex-col items-center text-center flex-grow px-1">
        <p className="eyebrow text-[0.65rem] sm:text-xs text-muted-foreground uppercase tracking-wider line-clamp-1">
          {p.category}
        </p>
        
        <Link
          to="/product/$id"
          params={{ id: p.id }}
          onClick={() => recordProductInteraction("product_click", p.id, p.name)}
          className="mt-1 block font-serif text-sm sm:text-lg md:text-xl leading-snug hover:text-gold transition-colors line-clamp-2"
        >
          {s.lang === "ar" ? p.nameAr : p.name}
        </Link>
        
        <p className="mt-1 text-xs sm:text-sm font-medium text-foreground">
          {s.fmt(p.price)}
        </p>
      </div>
    </div>
  );
}
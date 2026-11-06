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
      <div className="relative w-full overflow-hidden rounded-sm bg-muted">
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
            className="aspect-square w-full object-cover transition duration-[1.2s] group-hover:scale-105 sm:aspect-[4/5]"
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
      <div className="mt-2.5 flex flex-grow flex-col items-center px-0.5 text-center sm:mt-4 sm:px-1">
        <p className="eyebrow line-clamp-1 text-[clamp(0.56rem,1vw,0.75rem)] uppercase tracking-[0.12em] text-muted-foreground">
          {p.category}
        </p>
        
        <Link
          to="/product/$id"
          params={{ id: p.id }}
          onClick={() => recordProductInteraction("product_click", p.id, p.name)}
          className="mt-1 block line-clamp-2 font-serif text-[clamp(0.75rem,1.3vw,1.125rem)] leading-snug transition-colors hover:text-gold"
        >
          {s.lang === "ar" ? p.nameAr : p.name}
        </Link>
        
        <p className="mt-1 text-[clamp(0.68rem,1vw,0.875rem)] font-medium text-foreground">
          {s.fmt(p.price)}
        </p>
      </div>
    </div>
  );
}
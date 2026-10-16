import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { recordProductInteraction } from "@/lib/local-data";
import { useStore, type Product } from "@/lib/store";

export function ProductCard({ p }: { p: Product }) {
  const s = useStore();
  const wished = s.wishlist.includes(p.id);
  return (
    <div className="group relative">
      <Link
        to="/product/$id"
        params={{ id: p.id }}
        onClick={() => recordProductInteraction("product_click", p.id, p.name)}
        className="block overflow-hidden bg-muted"
      >
        <img
          src={p.images[0]}
          alt={p.name}
          loading="lazy"
          className="aspect-[4/5] w-full object-cover transition duration-[1.2s] group-hover:scale-105"
        />
      </Link>
      <button
        onClick={() => s.toggleWish(p.id)}
        aria-label="Wishlist"
        className="absolute top-4 end-4 rounded-full bg-background/80 p-2 backdrop-blur transition hover:text-gold"
      >
        <Heart size={14} className={wished ? "fill-gold text-gold" : ""} />
      </button>
      <div className="mt-5 text-center">
        <p className="eyebrow text-muted-foreground">{p.category}</p>
        <Link
          to="/product/$id"
          params={{ id: p.id }}
          onClick={() => recordProductInteraction("product_click", p.id, p.name)}
          className="mt-2 block font-serif text-xl hover:text-gold"
        >
          {s.lang === "ar" ? p.nameAr : p.name}
        </Link>
        <p className="mt-1 text-sm">{s.fmt(p.price)}</p>
      </div>
    </div>
  );
}

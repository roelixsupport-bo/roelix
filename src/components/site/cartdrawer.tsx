import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { getMaxOrderQuantity, useStore } from "@/lib/store";

export function CartDrawer() {
  const s = useStore();
  if (!s.cartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* خلفية معتمة تتيح الإغلاق عند النقر */}
      <div
        className="absolute inset-0 bg-navy/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => s.setCartOpen(false)}
      />

      <aside className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-background shadow-2xl duration-300 animate-in slide-in-from-right rtl:slide-in-from-left">
        {/* رأس السلة */}
        <div className="flex items-center justify-between border-b border-border px-5 sm:px-8 py-5 sm:py-6">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold">{s.t.cart}</h2>
            <span className="text-xs font-sans font-bold bg-amber-500/10 text-gold px-2 py-0.5 rounded-full">
              {s.count}
            </span>
          </div>
          <button
            onClick={() => s.setCartOpen(false)}
            aria-label="Close"
            className="p-1.5 hover:bg-muted rounded-full transition text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* قائمة منتجات السلة */}
        <div className="flex-1 space-y-5 sm:space-y-6 overflow-y-auto px-5 sm:px-8 py-6">
          {s.lines.length === 0 && (
            <div className="mt-20 text-center space-y-4">
              <p className="font-serif text-xl sm:text-2xl text-muted-foreground">
                {s.t.empty}
              </p>
              <button
                onClick={() => s.setCartOpen(false)}
                className="text-xs uppercase tracking-widest text-gold underline font-semibold hover:text-foreground transition"
              >
                {s.lang === "ar" ? "تصفح المجموعات" : "Explore Collections"}
              </button>
            </div>
          )}
          {s.lines.map((l) => (
            <CartItem key={l.id + l.size + l.color} line={l} />
          ))}
        </div>

        {/* أسفل السلة (الإجمالي وزر الشراء) */}
        {s.lines.length > 0 && (
          <div className="space-y-4 border-t border-border px-5 sm:px-8 py-5 sm:py-6 bg-muted/20">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {s.lang === "ar"
                ? "تُحدَّد تكلفة الشحن عبر بوستا حسب المحافظة عند إتمام الطلب."
                : "Bosta shipping is calculated by governorate at checkout."}
            </p>

            <div className="flex justify-between items-center font-serif text-xl sm:text-2xl font-bold pt-1">
              <span>{s.t.subtotal}</span>
              <span className="text-gold">{s.fmt(s.subtotal)}</span>
            </div>

            <Link
              to="/checkout"
              onClick={() => s.setCartOpen(false)}
              className="flex items-center justify-center bg-black hover:bg-zinc-800 text-white font-bold py-4 px-6 rounded text-xs sm:text-sm uppercase tracking-wider transition shadow-md w-full text-center cursor-pointer"
            >
              {s.t.checkout || "CHECKOUT"}
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function CartItem({ line }: { line: ReturnType<typeof useStore>["lines"][number] }) {
  const s = useStore();
  const otherQuantity = s.lines
    .filter(
      (item) =>
        item.id === line.id &&
        !(
          item.size === line.size &&
          item.color === line.color &&
          item.unitPrice === line.unitPrice
        ),
    )
    .reduce((total, item) => total + item.qty, 0);

  const maxQuantity = Math.max(0, getMaxOrderQuantity(line.product.stock) - otherQuantity);

  const warnLimit = () => {
    toast.warning(
      s.lang === "ar"
        ? `عذراً، الكمية المتاحة في المخزون هي ${line.product.stock} فقط`
        : `Sorry, only ${line.product.stock} units are available in stock`,
    );
  };

  return (
    <div className="flex gap-4 border-b border-border/50 pb-5 last:border-0 last:pb-0">
      <img
        src={line.product.images[0]}
        alt={line.product.name}
        className="h-24 w-20 sm:h-28 sm:w-22 object-cover rounded-sm border border-border"
      />
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start gap-2">
            <p className="font-serif text-base sm:text-lg font-semibold leading-tight text-foreground">
              {s.lang === "ar" ? line.product.nameAr : line.product.name}
            </p>
            <button
              onClick={() => s.setQty(line, 0)}
              className="text-muted-foreground hover:text-destructive transition p-1"
              title="Remove item"
              aria-label="Remove item"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground font-medium">
            {line.size && `Size: ${line.size}`} {line.size && line.color && "·"} {line.color && `Color: ${line.color}`}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center border border-border rounded bg-background">
            <button
              className="p-1.5 sm:p-2 hover:bg-muted transition"
              onClick={() => s.setQty(line, line.qty - 1)}
              disabled={line.qty <= 1 || maxQuantity === 0}
              aria-label="Decrease"
            >
              <Minus size={12} />
            </button>
            <input
              type="number"
              min={1}
              max={maxQuantity || 1}
              value={line.qty}
              aria-label="Quantity"
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (!Number.isFinite(value)) return;
                if (value > maxQuantity) warnLimit();
                s.setQty(line, Math.max(1, Math.min(maxQuantity || 1, Math.floor(value))));
              }}
              disabled={maxQuantity === 0}
              className="w-9 bg-transparent text-center text-xs sm:text-sm font-bold outline-none disabled:opacity-50"
            />
            <button
              className="p-1.5 sm:p-2 hover:bg-muted transition"
              onClick={() => {
                if (line.qty >= maxQuantity) warnLimit();
                else s.setQty(line, line.qty + 1);
              }}
              disabled={maxQuantity === 0}
              aria-label="Increase"
            >
              <Plus size={12} />
            </button>
          </div>
          <span className="text-sm font-bold text-foreground">
            {s.fmt((line.unitPrice ?? line.product.price) * line.qty)}
          </span>
        </div>
      </div>
    </div>
  );
}
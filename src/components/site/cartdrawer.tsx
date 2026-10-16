import { Link } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { getMaxOrderQuantity, useStore } from "@/lib/store";

export function CartDrawer() {
  const s = useStore();
  if (!s.cartOpen) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 animate-in fade-in bg-navy/50"
        onClick={() => s.setCartOpen(false)}
      />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-background shadow-lux duration-500 animate-in slide-in-from-right rtl:slide-in-from-left">
        <div className="flex items-center justify-between border-b px-8 py-6">
          <h2 className="text-3xl">{s.t.cart}</h2>
          <button onClick={() => s.setCartOpen(false)} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
          {s.lines.length === 0 && (
            <p className="mt-20 text-center font-serif text-xl text-muted-foreground">
              {s.t.empty}
            </p>
          )}
          {s.lines.map((l) => (
            <CartItem key={l.id + l.size + l.color} line={l} />
          ))}
        </div>
        {s.lines.length > 0 && (
          <div className="space-y-4 border-t px-8 py-6">
            <p className="text-xs text-muted-foreground">
              {s.lang === "ar"
                ? "تُحدَّد تكلفة الشحن عبر بوستا حسب المحافظة عند إتمام الطلب."
                : "Bosta shipping is calculated by governorate at checkout."}
            </p>
            <div className="flex justify-between font-serif text-xl">
              <span>{s.t.subtotal}</span>
              <span>{s.fmt(s.subtotal)}</span>
            </div>
            <Link to="/checkout" onClick={() => s.setCartOpen(false)} className="btn-lux w-full">
              {s.t.checkout}
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
    <div className="flex gap-4">
      <img src={line.product.images[0]} alt="" className="h-28 w-22 object-cover" />
      <div className="flex-1">
        <p className="font-serif text-lg leading-tight">
          {s.lang === "ar" ? line.product.nameAr : line.product.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {line.size} · {line.color}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center border">
            <button
              className="p-2"
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
              className="w-10 bg-transparent text-center text-sm outline-none disabled:opacity-50"
            />
            <button
              className="p-2"
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
          <span className="text-sm">
            {s.fmt((line.unitPrice ?? line.product.price) * line.qty)}
          </span>
        </div>
      </div>
    </div>
  );
}

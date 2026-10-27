import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";

const COPY = {
  en: {
    quantity: "Quantity to return",
    action: "Return",
    working: "Returning…",
    done: (count: number) => `${count} returned to stock`,
    failed: "Could not return this item to stock",
  },
  ar: {
    quantity: "الكمية المرتجعة",
    action: "إرجاع",
    working: "جارٍ الإرجاع…",
    done: (count: number) => `تم إرجاع ${count} إلى المخزون`,
    failed: "تعذر إرجاع هذا العنصر إلى المخزون",
  },
} as const;

export type OrderLineRestockProps = {
  orderId: string;
  lineId: string;
  /** Units still outstanding on this line (qty minus what was already returned). */
  remaining: number;
  isArabic: boolean;
  onRestocked: () => Promise<void> | void;
};

/**
 * Returns part or all of a single order line to stock.
 *
 * The database caps the request at (qty - restocked_quantity) and re-derives the
 * product roll-up, so repeated clicks can never over-return.
 */
export function OrderLineRestock({
  orderId,
  lineId,
  remaining,
  isArabic,
  onRestocked,
}: OrderLineRestockProps) {
  const text = COPY[isArabic ? "ar" : "en"];
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = Math.min(Math.max(1, Math.floor(quantity)), remaining);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("restock_order_line", {
        p_order_id: orderId,
        p_line_id: lineId,
        p_quantity: value,
      });
      if (error) throw error;
      toast.success(text.done(Number(data) || value));
      setQuantity(1);
      await onRestocked();
    } catch (error) {
      console.error("Could not return an order line to stock", error);
      toast.error(error instanceof Error ? error.message : text.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={remaining}
        value={quantity}
        aria-label={text.quantity}
        disabled={busy}
        onChange={(event) => {
          const next = event.currentTarget.valueAsNumber;
          setQuantity(
            Number.isFinite(next) ? Math.max(1, Math.min(Math.floor(next), remaining)) : 1,
          );
        }}
        className="h-8 w-16 border bg-background px-2 text-xs outline-none focus:border-gold"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.12em] hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? text.working : text.action}
      </button>
    </div>
  );
}

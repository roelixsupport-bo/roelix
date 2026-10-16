import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { EGP_PER_USD, shippingFor, STATIC_PRODUCTS, useStore } from "@/lib/store";
import { BOSTA_SHIPPING_RATES } from "@/lib/shipping";
import { findLocalOrder, placeLocalOrder, saveLocalEmailPreferences } from "@/lib/local-data";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — ROELIX" },
      { name: "description", content: "Complete your ROELIX order securely." },
      { property: "og:title", content: "Checkout — ROELIX" },
      { property: "og:description", content: "Complete your ROELIX order securely." },
    ],
  }),
  component: Checkout,
});

const CITIES: Record<string, string> = {
  "11511": "Cairo",
  "12511": "Giza",
  "21500": "Alexandria",
  "31511": "Tanta",
  "81511": "Aswan",
};

function Checkout() {
  const s = useStore();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    postcode: "",
    city: "",
    governorate: "" as keyof typeof BOSTA_SHIPPING_RATES | "",
    country: "مصر",
  });
  const [placing, setPlacing] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [orderTrackingOptIn, setOrderTrackingOptIn] = useState(false);
  const [pay, setPay] = useState<"card" | "cod">("cod");
  const shipping = f.governorate ? shippingFor(f.governorate) : undefined;
  const total = s.subtotal * EGP_PER_USD + (shipping ?? 0);
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const addrOk =
    f.name &&
    /\S+@\S+/.test(f.email) &&
    f.phone &&
    f.address &&
    f.city &&
    f.governorate &&
    f.country;
  if (s.lines.length === 0)
    return (
      <div className="py-40 text-center">
        <p className="font-serif text-3xl">{s.t.empty}</p>
        <Link to="/shop" className="btn-lux mt-8">
          Explore The Collection
        </Link>
      </div>
    );

  async function place() {
    if (placing) return;
    if (!f.governorate) {
      toast.error("Please select a governorate to calculate Bosta shipping.");
      setStep(1);
      return;
    }
    setPlacing(true);
    let cloudSynced = false;
    try {
      const id = placeLocalOrder(
        {
          customer: {
            name: f.name,
            email: f.email,
            phone: f.phone,
            address: f.address,
            city: f.city,
            governorate: f.governorate,
            country: f.country,
          },
          items: s.lines.map((l) => ({
            id: l.id,
            qty: l.qty,
            size: l.size,
            color: l.color,
            ...(l.unitPrice === undefined ? {} : { unitPrice: l.unitPrice }),
          })),
          payment: pay,
        },
        STATIC_PRODUCTS,
        shippingFor,
        EGP_PER_USD,
      );
      const order = findLocalOrder(id);
      if (!order) throw new Error(`Placed order ${id} could not be loaded from local storage`);
      try {
        const { error } = await supabase.from("orders").insert({
          order_number: order.id,
          customer_name: order.customer.name,
          phone: order.customer.phone,
          address: order.customer.address,
          governorate: order.customer.governorate,
          items: order.items,
          subtotal: order.subtotal,
          shipping_cost: order.shipping,
          total_amount: order.total,
          status: "pending",
        });
        if (error) throw error;
        cloudSynced = true;
        toast.success("Your order was submitted successfully.");
      } catch (error) {
        const supabaseError =
          typeof error === "object" && error !== null
            ? {
                message: "message" in error ? String(error.message) : String(error),
                code: "code" in error ? error.code : undefined,
                details: "details" in error ? error.details : undefined,
                hint: "hint" in error ? error.hint : undefined,
                status: "status" in error ? error.status : undefined,
              }
            : { message: String(error) };
        console.error("Supabase order insert failed:", supabaseError);
        toast.warning(
          "Your order was saved on this device, but cloud sync failed. Please contact support before placing it again.",
          { duration: 8000 },
        );
      }
      if (newsletterOptIn || orderTrackingOptIn) {
        try {
          saveLocalEmailPreferences(f.email, {
            source: "checkout",
            newsletterOptIn,
            orderTrackingOptIn,
          });
        } catch (error) {
          console.error("Order placed, but could not save optional email preferences", error);
          toast.warning(
            "Your order was placed, but we couldn't save the optional email preferences.",
          );
        }
      }
      s.clearCart();
      void s.reloadProducts();
      nav({ to: "/success", search: { id, cloudSync: cloudSynced ? "synced" : "local" } });
    } catch (error) {
      console.error("Could not place the ROELIX order", error);
      toast.error("We couldn't place your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-6 py-16 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="mb-10 flex gap-8 eyebrow">
          {["Details", "Payment", "Review"].map((x, i) => (
            <span
              key={x}
              className={step === i + 1 ? "text-gold" : step > i + 1 ? "" : "text-muted-foreground"}
            >
              {i + 1}. {x}
            </span>
          ))}
        </div>
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className="input-lux sm:col-span-2"
              placeholder="Full name"
              value={f.name}
              onChange={(e) => up("name", e.target.value)}
            />
            <input
              className="input-lux"
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={f.email}
              onChange={(e) => up("email", e.target.value)}
            />
            <div className="space-y-3 sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={newsletterOptIn}
                  onChange={(event) => setNewsletterOptIn(event.target.checked)}
                  className="mt-1 accent-[var(--gold)]"
                />
                <span>
                  أرغب اختياريًا في الاشتراك بنشرة ROELIX لمعرفة جديد المفروشات الفاخرة والعروض.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={orderTrackingOptIn}
                  onChange={(event) => setOrderTrackingOptIn(event.target.checked)}
                  className="mt-1 accent-[var(--gold)]"
                />
                <span>
                  أوافق اختياريًا على حفظ بريدي الإلكتروني لتسهيل التواصل بشأن تتبع طلباتي مستقبلًا.
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                يمكنك إتمام الشراء كضيف دون تحديد أي خيار. يظل البريد الإلكتروني مطلوبًا لتفاصيل هذا
                الطلب.
              </p>
            </div>
            <input
              className="input-lux"
              placeholder="Phone"
              value={f.phone}
              onChange={(e) => up("phone", e.target.value)}
            />
            <input
              className="input-lux"
              placeholder="Postcode (lookup)"
              value={f.postcode}
              onChange={(e) => {
                up("postcode", e.target.value);
                const c = CITIES[e.target.value.toUpperCase()];
                if (c) up("city", c);
              }}
            />
            <input
              className="input-lux"
              placeholder="City"
              value={f.city}
              onChange={(e) => up("city", e.target.value)}
            />
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm">Governorate / المحافظة</span>
              <select
                className="input-lux w-full"
                value={f.governorate}
                onChange={(event) =>
                  setF((current) => ({
                    ...current,
                    governorate: event.target.value as typeof current.governorate,
                  }))
                }
                required
              >
                <option value="">اختاري المحافظة</option>
                {Object.keys(BOSTA_SHIPPING_RATES).map((governorate) => (
                  <option key={governorate} value={governorate}>
                    {governorate}
                  </option>
                ))}
              </select>
            </label>
            <input
              className="input-lux sm:col-span-2"
              placeholder="Street address"
              value={f.address}
              onChange={(e) => up("address", e.target.value)}
            />
            <input
              className="input-lux sm:col-span-2"
              placeholder="Country"
              value={f.country}
              onChange={(e) => up("country", e.target.value)}
            />
            <button
              disabled={!addrOk}
              onClick={() => setStep(2)}
              className="btn-lux sm:col-span-2 mt-4"
            >
              Continue to Payment
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            {(["card", "cod"] as const).map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-center gap-3 border p-5 ${pay === m ? "border-gold" : ""}`}
              >
                <input
                  type="radio"
                  checked={pay === m}
                  onChange={() => setPay(m)}
                  className="accent-[var(--gold)]"
                />
                <span className="font-serif text-xl">
                  {m === "card" ? "Credit Card" : "Cash on Delivery"}
                </span>
              </label>
            ))}
            <p className="text-sm text-muted-foreground">
              Local checkout records demonstration orders only; no payment is processed.
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="btn-ghost-lux">
                Back
              </button>
              <button onClick={() => setStep(3)} className="btn-lux flex-1">
                Review Order
              </button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border p-6 text-sm">
              <p className="eyebrow mb-2 text-gold">Deliver to</p>
              {f.name}
              <br />
              {f.address}, {f.city}, {f.governorate}, {f.country}
              <br />
              الشحن عبر شركة بوستا (Bosta): {s.fmtEgp(shipping ?? 0)}
              <br />
              الإجمالي النهائي: {s.fmtEgp(total)}
              <br />
              {f.email} · {f.phone}
            </div>
            <div className="border p-6 text-sm">
              <p className="eyebrow mb-2 text-gold">Payment</p>
              {pay === "card" ? "Card (not charged in local mode)" : "Cash on Delivery"}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-ghost-lux">
                Back
              </button>
              <button onClick={place} className="btn-lux flex-1">
                Place Order · {s.fmtEgp(total)}
              </button>
            </div>
          </div>
        )}
      </div>
      <aside className="h-fit bg-secondary p-8">
        <h2 className="text-2xl">Order Summary</h2>
        <div className="mt-6 space-y-4">
          {s.lines.map((l) => (
            <div key={l.id + l.size + l.color} className="flex justify-between gap-3 text-sm">
              <span>
                {l.product.name}{" "}
                <span className="text-muted-foreground">
                  × {l.qty} · {l.size}
                </span>
              </span>
              <span>{s.fmt((l.unitPrice ?? l.product.price) * l.qty)}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{s.fmt(s.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>الشحن عبر شركة بوستا (Bosta)</span>
            <span>{shipping === undefined ? "اختاري المحافظة" : s.fmtEgp(shipping)}</span>
          </div>
          <div className="flex justify-between pt-2 font-serif text-xl">
            <span>Total</span>
            <span>{s.fmtEgp(total)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

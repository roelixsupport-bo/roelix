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
    Boolean(f.name.trim()) &&
    /\S+@\S+/.test(f.email.trim()) &&
    Boolean(f.phone.trim()) &&
    Boolean(f.address.trim()) &&
    Boolean(f.city.trim()) &&
    Boolean(f.governorate) &&
    Boolean(f.country.trim());

  const handleContinueToPayment = () => {
    if (!f.name.trim()) {
      toast.error(s.lang === "ar" ? "يرجى إدخال الاسم بالكامل" : "Please enter your full name");
      return;
    }
    if (!/\S+@\S+/.test(f.email.trim())) {
      toast.error(s.lang === "ar" ? "يرجى إدخال بريد إلكتروني صحيح" : "Please enter a valid email address");
      return;
    }
    if (!f.phone.trim()) {
      toast.error(s.lang === "ar" ? "يرجى إدخال رقم الهاتف" : "Please enter your phone number");
      return;
    }
    if (!f.governorate) {
      toast.error(s.lang === "ar" ? "يرجى اختيار المحافظة لحساب الشحن" : "Please select a governorate");
      return;
    }
    if (!f.city.trim()) {
      toast.error(s.lang === "ar" ? "يرجى إدخال المدينة" : "Please enter your city");
      return;
    }
    if (!f.address.trim()) {
      toast.error(s.lang === "ar" ? "يرجى إدخال العنوان بالتفصيل" : "Please enter your street address");
      return;
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (s.lines.length === 0)
    return (
      <div className="py-28 sm:py-40 text-center px-4">
        <p className="font-serif text-2xl sm:text-3xl">{s.t.empty}</p>
        <Link to="/shop" className="bg-black hover:bg-zinc-800 text-white font-bold py-3.5 px-8 rounded text-sm uppercase inline-block mt-8 transition shadow-md">
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
    <div className="mx-auto grid max-w-6xl gap-8 lg:gap-16 px-4 sm:px-6 py-8 sm:py-16 lg:grid-cols-[1fr_380px]">
      <div>
        {/* مراحل الخطوات */}
        <div className="mb-8 flex gap-4 sm:gap-8 eyebrow text-xs sm:text-sm">
          {["Details", "Payment", "Review"].map((x, i) => (
            <span
              key={x}
              className={step === i + 1 ? "text-gold font-bold" : step > i + 1 ? "text-foreground" : "text-muted-foreground"}
            >
              {i + 1}. {x}
            </span>
          ))}
        </div>

        {/* الخطوة الأولى: البيانات */}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className="input-lux sm:col-span-2 text-sm p-3 border rounded"
              placeholder="Full name *"
              value={f.name}
              onChange={(e) => up("name", e.target.value)}
              required
            />
            <input
              className="input-lux text-sm p-3 border rounded"
              placeholder="Email *"
              type="email"
              autoComplete="email"
              value={f.email}
              onChange={(e) => up("email", e.target.value)}
              required
            />
            <input
              className="input-lux text-sm p-3 border rounded"
              placeholder="Phone *"
              type="tel"
              value={f.phone}
              onChange={(e) => up("phone", e.target.value)}
              required
            />

            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs sm:text-sm font-medium">Governorate / المحافظة *</span>
              <select
                className="input-lux w-full text-sm p-3 border rounded bg-background"
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
              className="input-lux text-sm p-3 border rounded"
              placeholder="City *"
              value={f.city}
              onChange={(e) => up("city", e.target.value)}
              required
            />
            <input
              className="input-lux text-sm p-3 border rounded"
              placeholder="Postcode (optional)"
              value={f.postcode}
              onChange={(e) => {
                up("postcode", e.target.value);
                const c = CITIES[e.target.value.toUpperCase()];
                if (c) up("city", c);
              }}
            />

            <input
              className="input-lux sm:col-span-2 text-sm p-3 border rounded"
              placeholder="Street address *"
              value={f.address}
              onChange={(e) => up("address", e.target.value)}
              required
            />
            <input
              className="input-lux sm:col-span-2 text-sm p-3 border rounded"
              placeholder="Country"
              value={f.country}
              onChange={(e) => up("country", e.target.value)}
            />

            <div className="space-y-3 sm:col-span-2 my-2">
              <label className="flex cursor-pointer items-start gap-3 text-xs sm:text-sm leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={newsletterOptIn}
                  onChange={(event) => setNewsletterOptIn(event.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <span>
                  أرغب اختياريًا في الاشتراك بنشرة ROELIX لمعرفة جديد المفروشات الفاخرة والعروض.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-xs sm:text-sm leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={orderTrackingOptIn}
                  onChange={(event) => setOrderTrackingOptIn(event.target.checked)}
                  className="mt-0.5 accent-amber-500"
                />
                <span>
                  أوافق اختياريًا على حفظ بريدي الإلكتروني لتسهيل التواصل بشأن تتبع طلباتي مستقبلًا.
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleContinueToPayment}
              className="bg-black hover:bg-zinc-800 text-white font-bold py-4 px-6 rounded text-sm uppercase tracking-wider transition shadow-md w-full sm:col-span-2 mt-4 cursor-pointer text-center"
            >
              Continue to Payment
            </button>
          </div>
        )}

        {/* الخطوة الثانية: الدفع */}
        {step === 2 && (
          <div className="space-y-4">
            {(["card", "cod"] as const).map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-center gap-3 border p-4 sm:p-5 rounded transition ${pay === m ? "border-amber-500 bg-amber-500/5" : "border-gray-200"}`}
              >
                <input
                  type="radio"
                  checked={pay === m}
                  onChange={() => setPay(m)}
                  className="accent-amber-500"
                />
                <span className="font-serif text-lg sm:text-xl">
                  {m === "card" ? "Credit Card" : "Cash on Delivery (الدفع عند الاستلام)"}
                </span>
              </label>
            ))}
            <p className="text-xs sm:text-sm text-muted-foreground">
              الدفع عند الاستلام متوفر لجميع المحافظات.
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setStep(1)} className="border border-gray-300 px-6 py-3 rounded text-sm hover:bg-gray-50">
                Back
              </button>
              <button onClick={() => { setStep(3); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="bg-black text-white font-bold py-3.5 px-6 rounded text-sm flex-1 uppercase tracking-wider hover:bg-zinc-800 transition">
                Review Order
              </button>
            </div>
          </div>
        )}

        {/* الخطوة الثالثة: المراجعة والتأكيد */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border p-4 sm:p-6 text-sm rounded space-y-1">
              <p className="eyebrow mb-2 text-gold font-bold">Deliver to</p>
              <p className="font-semibold">{f.name}</p>
              <p>{f.address}, {f.city}, {f.governorate}, {f.country}</p>
              <p className="text-xs text-muted-foreground mt-2">الشحن عبر شركة بوستا (Bosta): {s.fmtEgp(shipping ?? 0)}</p>
              <p className="text-xs font-semibold text-emerald-600">الإجمالي النهائي: {s.fmtEgp(total)}</p>
              <p className="text-xs text-muted-foreground">{f.email} · {f.phone}</p>
            </div>
            <div className="border p-4 sm:p-6 text-sm rounded">
              <p className="eyebrow mb-2 text-gold font-bold">Payment Method</p>
              {pay === "card" ? "Credit Card" : "Cash on Delivery (الدفع عند الاستلام)"}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="border border-gray-300 px-6 py-3 rounded text-sm hover:bg-gray-50">
                Back
              </button>
              <button 
                disabled={placing} 
                onClick={place} 
                className="bg-black hover:bg-zinc-800 text-white font-bold py-4 px-6 rounded text-sm uppercase tracking-wider flex-1 transition shadow-md disabled:opacity-50 cursor-pointer text-center"
              >
                {placing ? "Processing..." : `Place Order · ${s.fmtEgp(total)}`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ملخص الطلب */}
      <aside className="h-fit bg-secondary p-5 sm:p-8 rounded-lg border border-gray-200">
        <h2 className="text-xl sm:text-2xl font-serif border-b pb-3">Order Summary</h2>
        <div className="mt-4 space-y-3">
          {s.lines.map((l) => (
            <div key={l.id + l.size + l.color} className="flex justify-between gap-3 text-xs sm:text-sm">
              <span>
                {l.product.name}{" "}
                <span className="text-muted-foreground">
                  × {l.qty} · {l.size}
                </span>
              </span>
              <span className="font-medium">{s.fmt((l.unitPrice ?? l.product.price) * l.qty)}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2 border-t pt-4 text-xs sm:text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{s.fmt(s.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>الشحن عبر شركة بوستا (Bosta)</span>
            <span className="font-semibold text-emerald-600">{shipping === undefined ? "اختاري المحافظة" : s.fmtEgp(shipping)}</span>
          </div>
          <div className="flex justify-between pt-3 border-t font-serif text-lg sm:text-xl font-bold">
            <span>Total</span>
            <span className="text-amber-600">{s.fmtEgp(total)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
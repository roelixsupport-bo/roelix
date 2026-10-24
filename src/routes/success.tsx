import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import { findLocalOrder } from "@/lib/local-data";
import { formatEgp, useStore, type Order } from "@/lib/store";

export const Route = createFileRoute("/success")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s["id"] === "string" ? s["id"] : "",
    cloudSync:
      s["cloudSync"] === "synced" || s["cloudSync"] === "local"
        ? s["cloudSync"]
        : "unknown",
  }),
  head: () => ({
    meta: [
      { title: "Order Confirmed — ROELIX" },
      { name: "description", content: "Thank you for your ROELIX order." },
      { property: "og:title", content: "Order Confirmed — ROELIX" },
      { property: "og:description", content: "Thank you for your ROELIX order." },
    ],
  }),
  component: Success,
});

function Success() {
  const { id, cloudSync } = Route.useSearch();
  const s = useStore();
  const [order, setOrder] = useState<Order>();

  useEffect(() => {
    setOrder(findLocalOrder(id));
  }, [id]);

  const isAr = s.lang === "ar";

  const whatsappMessage = order?.customer.governorate
    ? [
        `طلب ROELIX رقم ${order.id}`,
        `الاسم: ${order.customer.name}`,
        `المحافظة: ${order.customer.governorate}`,
        `الشحن عبر شركة بوستا (Bosta): ${formatEgp(order.shipping, "ar")}`,
        `الإجمالي النهائي: ${formatEgp(order.total, "ar")}`,
      ].join("\n")
    : "";

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-24 text-center animate-rise">
      {/* أيقونة التأكيد الفاخرة */}
      <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 border-gold text-gold bg-gold/5 shadow-md">
        <Check className="w-8 h-8 sm:w-10 sm:h-10" />
      </div>

      <p className="eyebrow mt-6 sm:mt-8 text-gold font-bold text-xs sm:text-sm">
        {isAr ? "شكراً لثقتكم بـ ROELIX" : "Merci"}
      </p>

      <h1 className="mt-2 sm:mt-3 font-serif text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
        {cloudSync === "local"
          ? isAr
            ? "تم حفظ الطلب على هذا الجهاز"
            : "Order saved on this device"
          : isAr
            ? "تم تأكيد طلبكم بنجاح"
            : "Your order is confirmed"}
      </h1>

      <p className="mt-4 sm:mt-6 text-sm sm:text-base leading-relaxed text-muted-foreground max-w-lg mx-auto">
        {isAr ? "رقم الطلب الخاص بكم هو " : "Order "}
        <span className="font-bold text-foreground underline decoration-gold">{id}</span>{" "}
        {cloudSync === "local"
          ? isAr
            ? "تم حفظه محلياً على هذا الجهاز، ولكن تعذر تزامن السحابة. يرجى التواصل مع الدعم قبل إعادة الطلب."
            : "was saved locally, but cloud confirmation could not be completed. Please contact support before placing it again."
          : isAr
            ? "تم استلام الطلب بنجاح. يرجى الاحتفاظ برقم الطلب لتتبعه. يتواصل معكم ممثل خدمة العملاء قريباً."
            : "has been received. Keep this number to track your order. Your concierge will be in touch shortly."}
      </p>

      {/* تفاصيل ملخص الطلب والشحن */}
      {order?.customer.governorate && (
        <div dir="rtl" className="mt-8 border border-border bg-muted/20 p-5 sm:p-6 text-right rounded-lg space-y-2 text-xs sm:text-sm shadow-xs">
          <p className="eyebrow text-gold font-bold mb-3 border-b pb-2">تفاصيل الشحن والطلب</p>
          <p className="text-foreground"><span className="text-muted-foreground">اسم العميل:</span> {order.customer.name}</p>
          <p className="text-foreground"><span className="text-muted-foreground">المحافظة:</span> {order.customer.governorate}</p>
          <p className="text-foreground"><span className="text-muted-foreground">الشحن عبر شركة بوستا (Bosta):</span> {formatEgp(order.shipping, "ar")}</p>
          <div className="border-t pt-2 mt-2 flex justify-between items-center">
            <span className="font-bold text-sm sm:text-base">الإجمالي النهائي:</span>
            <span className="font-serif text-base sm:text-lg font-bold text-amber-600">{formatEgp(order.total, "ar")}</span>
          </div>
        </div>
      )}

      {/* أزرار المشاركة والتصفح */}
      <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        {order?.customer.governorate && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold py-3.5 px-6 rounded text-xs sm:text-sm uppercase tracking-wider transition shadow-sm"
          >
            <MessageCircle size={18} />
            {isAr ? "مشاركة التفاصيل عبر واتساب" : "Share via WhatsApp"}
          </a>
        )}

        <Link
          to="/shop"
          className="w-full sm:w-auto inline-flex items-center justify-center bg-black hover:bg-zinc-800 text-white font-bold py-3.5 px-8 rounded text-xs sm:text-sm uppercase tracking-wider transition shadow-md"
        >
          {isAr ? "متابعة التسوق" : "Continue Exploring"}
        </Link>
      </div>
    </div>
  );
}
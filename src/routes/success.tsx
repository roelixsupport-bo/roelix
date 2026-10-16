import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { findLocalOrder } from "@/lib/local-data";
import { formatEgp, type Order } from "@/lib/store";

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
  const [order, setOrder] = useState<Order>();
  useEffect(() => {
    setOrder(findLocalOrder(id));
  }, [id]);

  const whatsappMessage = order?.customer.governorate
    ? [
        `طلب ROELIX رقم ${order.id}`,
        `المحافظة: ${order.customer.governorate}`,
        `الشحن عبر شركة بوستا (Bosta): ${formatEgp(order.shipping, "ar")}`,
        `الإجمالي النهائي: ${formatEgp(order.total, "ar")}`,
      ].join("\n")
    : "";
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="mx-auto max-w-xl px-6 py-32 text-center animate-rise">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold text-gold"><Check /></div>
      <p className="eyebrow mt-8 text-gold">Merci</p>
      <h1 className="mt-3 text-5xl">
        {cloudSync === "local" ? "Order saved on this device" : "Your order is confirmed"}
      </h1>
      <p className="mt-6 text-muted-foreground">
        Order <span className="text-foreground">{id}</span>{" "}
        {cloudSync === "local"
          ? "was saved locally, but cloud confirmation could not be completed. Please contact support before placing it again."
          : "has been received. Keep this number to track your order with our assistant. Your concierge will be in touch shortly."}
      </p>
      {order?.customer.governorate && (
        <div className="mt-8 space-y-2 border p-6 text-start">
          <p>المحافظة: {order.customer.governorate}</p>
          <p>الشحن عبر شركة بوستا (Bosta): {formatEgp(order.shipping, "ar")}</p>
          <p className="font-semibold">الإجمالي النهائي: {formatEgp(order.total, "ar")}</p>
        </div>
      )}
      {order?.customer.governorate && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost-lux mt-8"
        >
          مشاركة تفاصيل الطلب عبر واتساب
        </a>
      )}
      <Link to="/shop" className="btn-lux mt-10">Continue Exploring</Link>
    </div>
  );
}

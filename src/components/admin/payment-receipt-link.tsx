import { useState } from "react";
import { toast } from "sonner";

import { createPaymentReceiptUrl } from "@/lib/manual-payments";

export function PaymentReceiptLink({ path, isArabic }: { path: string; isArabic: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadReceipt() {
    setLoading(true);
    try {
      setUrl(await createPaymentReceiptUrl(path));
    } catch (error) {
      console.error("Could not create a payment receipt link", error);
      toast.error(error instanceof Error ? error.message : "Could not open payment receipt.");
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-gold underline underline-offset-2"
      >
        {isArabic ? "فتح إيصال التحويل" : "Open transfer receipt"}
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void loadReceipt()}
      className="text-sm text-gold underline underline-offset-2 disabled:opacity-50"
    >
      {loading
        ? isArabic
          ? "جارٍ التحميل…"
          : "Loading…"
        : isArabic
          ? "عرض إيصال التحويل"
          : "View transfer receipt"}
    </button>
  );
}

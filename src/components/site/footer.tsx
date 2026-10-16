import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { saveLocalEmailPreferences } from "@/lib/local-data";
import { STORE_SUPPORT_EMAIL } from "@/lib/store";

export function Footer() {
  const [email, setEmail] = useState("");

  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      saveLocalEmailPreferences(email, {
        source: "footer",
        newsletterOptIn: true,
        orderTrackingOptIn: false,
      });
      setEmail("");
      toast.success("تم تسجيل بريدك في نشرة ROELIX البريدية.");
    } catch (error) {
      console.error("Could not save the ROELIX newsletter subscription", error);
      toast.error(error instanceof Error ? error.message : "تعذر تسجيل الاشتراك. حاول مرة أخرى.");
    }
  }

  return (
    <footer className="mt-32 bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-6">
        <div className="md:col-span-2">
          <p className="font-serif text-3xl tracking-[0.35em]">ROELIX</p>
          <p className="mt-4 max-w-sm text-sm opacity-60">
            Hotel-grade bedding and linens, woven from the world’s finest fibres for those who
            consider sleep an art.
          </p>
        </div>
        <div className="space-y-3 text-sm opacity-80">
          <p className="eyebrow text-gold mb-4">Maison</p>
          <Link to="/shop" className="block hover:text-gold">
            Collections
          </Link>
        </div>
        <div className="space-y-3 text-sm opacity-80">
          <p className="eyebrow text-gold mb-4">Client Care</p>
          <a href={`mailto:${STORE_SUPPORT_EMAIL}`} className="block hover:text-gold">
            {STORE_SUPPORT_EMAIL}
          </a>
          <p>ROELIX Personal Concierge</p>
          <p>Premium Nationwide Delivery</p>
        </div>
        <nav
          aria-label="السياسات ومعلومات المتجر"
          dir="rtl"
          className="space-y-3 text-right text-sm opacity-80"
        >
          <p className="mb-4 font-serif text-lg text-gold">معلومات المتجر</p>
          <Link to="/privacy" className="block hover:text-gold">
            سياسة الخصوصية
          </Link>
          <Link to="/shipping" className="block hover:text-gold">
            الشحن والتوصيل
          </Link>
          <Link to="/refunds" className="block hover:text-gold">
            الاستبدال والاسترجاع
          </Link>
          <Link to="/terms" className="block hover:text-gold">
            الشروط والأحكام
          </Link>
        </nav>
        <div dir="rtl" className="text-right">
          <p className="mb-4 font-serif text-lg text-gold">نشرة ROELIX البريدية</p>
          <p className="mb-4 text-sm leading-7 opacity-75">
            الاشتراك اختياري ليصلك جديد تشكيلات المفروشات الفاخرة والعروض.
          </p>
          <form onSubmit={subscribe} className="space-y-3">
            <label htmlFor="footer-newsletter-email" className="sr-only">
              البريد الإلكتروني
            </label>
            <input
              id="footer-newsletter-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="بريدك الإلكتروني"
              className="w-full border border-navy-foreground/30 bg-transparent px-3 py-2 text-sm text-navy-foreground outline-none placeholder:text-navy-foreground/50 focus:border-gold"
            />
            <button type="submit" className="btn-ghost-lux w-full text-xs">
              اشترك اختياريًا
            </button>
          </form>
        </div>
      </div>
      <div className="border-t border-navy-foreground/10 py-6 text-center eyebrow opacity-50">
        © 2026 ROELIX Maison
      </div>
    </footer>
  );
}

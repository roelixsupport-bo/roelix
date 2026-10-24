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
    <footer className="mt-16 sm:mt-32 bg-navy text-navy-foreground border-t border-white/10">
      <div className="mx-auto grid max-w-7xl gap-8 sm:gap-12 px-5 sm:px-6 py-12 sm:py-20 grid-cols-1 md:grid-cols-6">
        {/* الوصف وشعار الماركة */}
        <div className="md:col-span-2">
          <p className="font-serif text-2xl sm:text-3xl tracking-[0.35em] font-bold text-white">ROELIX</p>
          <p className="mt-3 max-w-sm text-xs sm:text-sm text-navy-foreground/80 leading-relaxed font-light">
            Hotel-grade bedding and linens, woven from the world’s finest fibres for those who
            consider sleep an art.
          </p>
        </div>

        {/* المجموعات */}
        <div className="space-y-2.5 text-xs sm:text-sm">
          <p className="eyebrow text-gold font-bold mb-3 sm:mb-4">Maison</p>
          <Link to="/shop" className="block text-navy-foreground/90 hover:text-gold transition-colors font-medium">
            Collections
          </Link>
        </div>

        {/* خدمة العملاء */}
        <div className="space-y-2.5 text-xs sm:text-sm">
          <p className="eyebrow text-gold font-bold mb-3 sm:mb-4">Client Care</p>
          <a href={`mailto:${STORE_SUPPORT_EMAIL}`} className="block text-navy-foreground/90 hover:text-gold transition-colors font-medium truncate">
            {STORE_SUPPORT_EMAIL}
          </a>
          <p className="text-navy-foreground/80">ROELIX Personal Concierge</p>
          <p className="text-navy-foreground/80">Premium Nationwide Delivery</p>
        </div>

        {/* معلومات المتجر بالعربية */}
        <nav
          aria-label="السياسات ومعلومات المتجر"
          dir="rtl"
          className="space-y-2.5 text-right text-xs sm:text-sm"
        >
          <p className="mb-3 sm:mb-4 font-serif text-base sm:text-lg text-gold font-bold">معلومات المتجر</p>
          <Link to="/privacy" className="block text-navy-foreground/90 hover:text-gold transition-colors font-medium">
            سياسة الخصوصية
          </Link>
          <Link to="/shipping" className="block text-navy-foreground/90 hover:text-gold transition-colors font-medium">
            الشحن والتوصيل
          </Link>
          <Link to="/refunds" className="block text-navy-foreground/90 hover:text-gold transition-colors font-medium">
            الاستبدال والاسترجاع
          </Link>
          <Link to="/terms" className="block text-navy-foreground/90 hover:text-gold transition-colors font-medium">
            الشروط والأحكام
          </Link>
        </nav>

        {/* النشرة البريدية */}
        <div dir="rtl" className="text-right">
          <p className="mb-3 sm:mb-4 font-serif text-base sm:text-lg text-gold font-bold">نشرة ROELIX البريدية</p>
          <p className="mb-3 text-xs sm:text-sm leading-6 text-navy-foreground/80">
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
              className="w-full border border-navy-foreground/40 bg-navy-foreground/5 px-3.5 py-2.5 text-xs sm:text-sm text-navy-foreground outline-none placeholder:text-navy-foreground/50 focus:border-gold rounded-sm"
            />
            <button type="submit" className="btn-ghost-lux w-full text-xs font-bold py-2.5">
              اشترك اختياريًا
            </button>
          </form>
        </div>
      </div>

      {/* حقوق النشر والملكية */}
      <div className="border-t border-navy-foreground/10 py-5 text-center eyebrow text-xs text-navy-foreground/60 font-medium">
        © 2026 ROELIX Maison
      </div>
    </footer>
  );
}
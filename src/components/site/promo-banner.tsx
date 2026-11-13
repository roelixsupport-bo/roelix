import { useEffect, useState } from "react";

import { fetchPromoSlides, type PromoSlide } from "@/lib/promo-slides";
import { useStore } from "@/lib/store";

const ROTATION_INTERVAL_MS = 5_000;

function messageFor(slide: PromoSlide, isArabic: boolean): string {
  return isArabic ? slide.message_ar : slide.message_en;
}

export function PromoBanner() {
  const { lang, t } = useStore();
  const [slides, setSlides] = useState<PromoSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchPromoSlides(true)
      .then((rows) => {
        if (!active) return;
        setSlides(rows);
        setActiveIndex(0);
      })
      .catch((error) => {
        console.error("Could not load active promotional slides", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setActiveIndex((index) => (index + 1) % slides.length),
      ROTATION_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const slide = slides[activeIndex];
  const message = slide ? messageFor(slide, lang === "ar") : t.announce;

  return (
    <div
      className="relative flex min-h-8 items-center justify-center bg-navy px-3 py-1 text-center text-[0.62rem] tracking-[0.12em] text-navy-foreground sm:min-h-9 sm:text-xs"
      aria-label={lang === "ar" ? "العروض والإعلانات" : "Promotions and announcements"}
      aria-live="polite"
    >
      {slide ? (
        <a
          href={slide.target_url}
          className="max-w-[72%] truncate underline-offset-2 hover:underline sm:max-w-none"
        >
          <span key={slide.id} className="promo-banner-message">
            {message}
          </span>
        </a>
      ) : (
        <span key="default" className="promo-banner-message">
          {message}
        </span>
      )}
    </div>
  );
}

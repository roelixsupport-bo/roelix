import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { fetchPromoSlides, type PromoSlide } from "@/lib/promo-slides";
import { useStore } from "@/lib/store";

const ROTATION_INTERVAL_MS = 5_000;

function messageFor(slide: PromoSlide, isArabic: boolean): string {
  return isArabic ? slide.message_ar : slide.message_en;
}

export function PromoBanner({ visible = true }: { visible?: boolean }) {
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
  const previous = () => setActiveIndex((index) => (index - 1 + slides.length) % slides.length);
  const next = () => setActiveIndex((index) => (index + 1) % slides.length);

  if (!visible) return null;

  return (
    <div
      className="relative flex min-h-9 items-center justify-center gap-3 bg-[#1e293b] px-2 py-1 text-center text-[0.62rem] tracking-[0.08em] text-white sm:min-h-10 sm:gap-4 sm:px-3 sm:text-xs"
      aria-label={lang === "ar" ? "العروض والإعلانات" : "Promotions and announcements"}
      aria-live="polite"
    >
      {slides.length > 1 && (
        <button
          type="button"
          onClick={previous}
          aria-label={lang === "ar" ? "الإعلان السابق" : "Previous announcement"}
          className="grid size-7 shrink-0 place-items-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      )}
      {slide ? (
        <a
          href={slide.target_url}
          className="min-w-0 max-w-[calc(100vw-7rem)] truncate underline-offset-2 hover:underline sm:max-w-[min(70vw,48rem)]"
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
      {slides.length > 1 && (
        <button
          type="button"
          onClick={next}
          aria-label={lang === "ar" ? "الإعلان التالي" : "Next announcement"}
          className="grid size-7 shrink-0 place-items-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";

import bedroomImage from "@/assets/hero.jpg";
import beddingImage from "@/assets/p_pedding.jpg";
import pillowImage from "@/assets/p_pillow.jpg";
import towelImage from "@/assets/p_towel.jpg";
import { fetchHeroSlides } from "@/lib/hero-slides";
import { isAllowedPromoUrl } from "@/lib/promo-slides";
import { useStore } from "@/lib/store";

const SLIDE_INTERVAL_MS = 4_500;

type DisplaySlide = {
  id: string;
  src: string;
  alt: string;
  showButton: boolean;
  buttonTextAr: string;
  buttonTextEn: string;
  buttonUrl: string;
  buttonPosition: "bottom-left" | "bottom-center" | "bottom-right";
};

const FALLBACK_SLIDES: DisplaySlide[] = [
  {
    id: "bedroom",
    src: bedroomImage,
    alt: "An elegant bedroom styled with luxurious ROELIX bedding",
    showButton: false,
    buttonTextAr: "",
    buttonTextEn: "",
    buttonUrl: "",
    buttonPosition: "bottom-center",
  },
  {
    id: "bedding",
    src: beddingImage,
    alt: "Soft, premium bedding in a refined navy and ivory palette",
    showButton: false,
    buttonTextAr: "",
    buttonTextEn: "",
    buttonUrl: "",
    buttonPosition: "bottom-center",
  },
  {
    id: "pillow",
    src: pillowImage,
    alt: "A plush pillow crafted for a restful night's sleep",
    showButton: false,
    buttonTextAr: "",
    buttonTextEn: "",
    buttonUrl: "",
    buttonPosition: "bottom-center",
  },
  {
    id: "towel",
    src: towelImage,
    alt: "Hotel-quality towels in timeless neutral colors",
    showButton: false,
    buttonTextAr: "",
    buttonTextEn: "",
    buttonUrl: "",
    buttonPosition: "bottom-center",
  },
];

const BUTTON_POSITION_CLASSES = {
  "bottom-left": "left-4 sm:left-8",
  "bottom-center": "left-1/2 -translate-x-1/2",
  "bottom-right": "right-4 sm:right-8",
} as const;

export function HeroSlider() {
  const { lang } = useStore();
  const [slides, setSlides] = useState(FALLBACK_SLIDES);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchHeroSlides()
      .then((rows) => {
        if (!active || rows.length === 0) return;
        setSlides(
          rows
            .filter((slide) => slide.is_active)
            .map((slide) => ({
              id: slide.id,
              src: slide.image_url,
              alt: slide.alt_text,
              showButton: slide.show_button,
              buttonTextAr: slide.button_text_ar,
              buttonTextEn: slide.button_text_en,
              buttonUrl: slide.button_url,
              buttonPosition: slide.button_position,
            })),
        );
        setActiveIndex(0);
      })
      .catch((error) => {
        console.warn(
          "ROELIX hero slider: could not load managed slides; using built-in images.",
          error,
        );
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="w-full">
      <div
        aria-label="Featured ROELIX home collection"
        aria-roledescription="carousel"
        className="hero-slider relative h-[clamp(15rem,48vw,42rem)] w-full overflow-hidden bg-secondary"
        role="region"
      >
        {slides.map((slide, index) => (
          <img
            key={slide.id}
            src={slide.src}
            alt={slide.alt}
            aria-hidden={index !== activeIndex}
            className={`hero-slide absolute inset-0 h-full w-full object-cover ${
              index === activeIndex ? "hero-slide-active" : ""
            }`}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/20 via-transparent to-white/10" />
        {slides[activeIndex]?.showButton &&
          slides[activeIndex].buttonTextEn.trim() &&
          slides[activeIndex].buttonTextAr.trim() &&
          isAllowedPromoUrl(slides[activeIndex].buttonUrl) && (
            <a
              href={slides[activeIndex].buttonUrl}
              className={`btn-lux absolute bottom-8 z-10 max-w-[calc(100%-2rem)] whitespace-nowrap px-5 py-3 text-center text-[0.62rem] sm:bottom-12 sm:px-8 sm:py-4 sm:text-xs ${BUTTON_POSITION_CLASSES[slides[activeIndex].buttonPosition]}`}
            >
              {lang === "ar"
                ? slides[activeIndex].buttonTextAr
                : slides[activeIndex].buttonTextEn}
            </a>
          )}
      </div>
      <div
        aria-label="Choose a featured image"
        className="mt-3 flex justify-center gap-1"
        role="group"
      >
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Show image ${index + 1}: ${slide.alt}`}
            aria-pressed={index === activeIndex}
            className="flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            onClick={() => setActiveIndex(index)}
          >
            <span
              className={`h-1.5 rounded-full transition-all duration-500 ${
                index === activeIndex ? "w-5 bg-navy" : "w-1.5 bg-navy/35"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

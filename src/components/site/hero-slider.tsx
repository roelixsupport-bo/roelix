import { useEffect, useState } from "react";

import bedroomImage from "@/assets/hero.jpg";
import beddingImage from "@/assets/p_pedding.jpg";
import pillowImage from "@/assets/p_pillow.jpg";
import towelImage from "@/assets/p_towel.jpg";
import { fetchHeroSlides } from "@/lib/hero-slides";
import { isAllowedPromoUrl } from "@/lib/promo-slides";
import { useStore } from "@/lib/store";
import { DEFAULT_STOREFRONT_CONTENT, type StorefrontHeroContent } from "@/lib/site-settings";

const SLIDE_INTERVAL_MS = 4_500;

type DisplaySlide = {
  id: string;
  src: string;
  alt: string;
  showButton: boolean;
  buttonTextAr: string;
  buttonTextEn: string;
  buttonUrl: string;
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
  },
  {
    id: "bedding",
    src: beddingImage,
    alt: "Soft, premium bedding in a refined navy and ivory palette",
    showButton: false,
    buttonTextAr: "",
    buttonTextEn: "",
    buttonUrl: "",
  },
  {
    id: "pillow",
    src: pillowImage,
    alt: "A plush pillow crafted for a restful night's sleep",
    showButton: false,
    buttonTextAr: "",
    buttonTextEn: "",
    buttonUrl: "",
  },
  {
    id: "towel",
    src: towelImage,
    alt: "Hotel-quality towels in timeless neutral colors",
    showButton: false,
    buttonTextAr: "",
    buttonTextEn: "",
    buttonUrl: "",
  },
];

export function HeroSlider({
  content = DEFAULT_STOREFRONT_CONTENT.hero,
}: {
  content?: StorefrontHeroContent;
}) {
  const { lang } = useStore();
  const [slides, setSlides] = useState(FALLBACK_SLIDES);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchHeroSlides()
      .then((rows) => {
        if (!active) return;
        const managedSlides = rows
          .filter((slide) => slide.is_active)
          .map((slide) => ({
            id: slide.id,
            src: slide.image_url,
            alt: slide.alt_text,
            showButton: slide.show_button,
            buttonTextAr: slide.button_text_ar,
            buttonTextEn: slide.button_text_en,
            buttonUrl: slide.button_url,
          }));
        if (managedSlides.length === 0) return;
        setSlides(managedSlides);
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

  if (!content.visible) return null;

  const activeSlide = slides[activeIndex];
  const isManagedSlide =
    !!activeSlide && !FALLBACK_SLIDES.some((fallback) => fallback.id === activeSlide.id);
  const buttonText = activeSlide?.showButton
    ? lang === "ar"
      ? activeSlide.buttonTextAr
      : activeSlide.buttonTextEn
    : isManagedSlide
      ? ""
      : lang === "ar"
        ? content.cta_text_ar
        : content.cta_text_en;
  const buttonUrl = activeSlide?.showButton
    ? activeSlide.buttonUrl
    : isManagedSlide
      ? ""
      : content.cta_url;

  return (
    <div className="w-full">
      <div
        aria-label="Featured ROELIX home collection"
        aria-roledescription="carousel"
        className="hero-slider relative h-[clamp(28rem,58vw,46rem)] w-full overflow-hidden bg-secondary"
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/10" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
          <h1 className="max-w-4xl font-serif text-4xl font-semibold leading-tight drop-shadow-md sm:text-6xl lg:text-7xl">
            {lang === "ar" ? content.title_ar : content.title_en}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/95 drop-shadow sm:text-lg">
            {lang === "ar" ? content.description_ar : content.description_en}
          </p>
          {buttonText?.trim() &&
            isAllowedPromoUrl(buttonUrl) &&
            (!activeSlide?.showButton ||
              (activeSlide.buttonTextEn.trim() && activeSlide.buttonTextAr.trim())) && (
              <a
                href={buttonUrl}
                className="luxury-rounded mt-7 inline-flex min-h-12 items-center justify-center rounded-none bg-white px-9 py-3 text-sm font-semibold text-navy shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-background hover:shadow-xl active:scale-95"
              >
                {buttonText}
              </a>
            )}
        </div>
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

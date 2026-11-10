import { useEffect, useState } from "react";

import bedroomImage from "@/assets/hero.jpg";
import beddingImage from "@/assets/p_pedding.jpg";
import pillowImage from "@/assets/p_pillow.jpg";
import towelImage from "@/assets/p_towel.jpg";

const SLIDE_INTERVAL_MS = 4_500;

const slides = [
  { src: bedroomImage, alt: "An elegant bedroom styled with luxurious ROELIX bedding" },
  { src: beddingImage, alt: "Soft, premium bedding in a refined navy and ivory palette" },
  { src: pillowImage, alt: "A plush pillow crafted for a restful night's sleep" },
  { src: towelImage, alt: "Hotel-quality towels in timeless neutral colors" },
];

export function HeroSlider() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="w-full">
      <div
        aria-label="Featured ROELIX home collection"
        aria-roledescription="carousel"
        className="hero-slider relative h-52 w-full overflow-hidden rounded-sm bg-secondary shadow-lux sm:h-72 lg:h-[22rem]"
        role="region"
      >
        {slides.map((slide, index) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            aria-hidden={index !== activeIndex}
            className={`hero-slide absolute inset-0 h-full w-full object-cover ${
              index === activeIndex ? "hero-slide-active" : ""
            }`}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/20 via-transparent to-white/10" />
      </div>
      <div aria-label="Choose a featured image" className="mt-3 flex justify-center gap-1" role="group">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
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

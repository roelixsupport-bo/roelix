import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Twitter } from "lucide-react";
import { toast } from "sonner";
import { saveLocalEmailPreferences } from "@/lib/local-data";
import { STORE_SUPPORT_EMAIL, useStore } from "@/lib/store";
import { useSiteSettings } from "@/lib/site-settings";

const FOOTER_COPY = {
  en: {
    hello: "Come Say Hi",
    intro: "A little more comfort, thoughtfully made for your home.",
    contact: "Contact us",
    tagline: "Hotel-grade bedding and linens, woven for the art of living well.",
    about: "About",
    home: "Home",
    collections: "Collections",
    discover: "Discover",
    bundles: "Custom bundles",
    help: "Need help?",
    shipping: "Shipping",
    returns: "Returns & exchanges",
    information: "Information",
    privacy: "Privacy policy",
    terms: "Terms & conditions",
    newsletter: "Get on the list",
    newsletterBody: "Sign up to hear about new collections and offers.",
    email: "Email address",
    subscribe: "Subscribe to the newsletter",
    instagram: "ROELIX on Instagram",
    facebook: "ROELIX on Facebook",
    x: "ROELIX on X",
    success: "Your email has been added to the ROELIX newsletter.",
    error: "Could not subscribe. Please try again.",
  },
  ar: {
    hello: "نسعد بتواصلك",
    intro: "راحة إضافية صُممت بعناية لتناسب منزلك.",
    contact: "تواصل معنا",
    tagline: "مفروشات فندقية فاخرة منسوجة لتجعل الراحة أسلوب حياة.",
    about: "عن ROELIX",
    home: "الرئيسية",
    collections: "التشكيلات",
    discover: "اكتشف",
    bundles: "الأطقم المخصصة",
    help: "كيف نساعدك؟",
    shipping: "الشحن والتوصيل",
    returns: "الاستبدال والاسترجاع",
    information: "معلومات المتجر",
    privacy: "سياسة الخصوصية",
    terms: "الشروط والأحكام",
    newsletter: "انضم إلى قائمتنا",
    newsletterBody: "سجّل لتصلك أخبار التشكيلات الجديدة والعروض.",
    email: "البريد الإلكتروني",
    subscribe: "الاشتراك في النشرة البريدية",
    instagram: "ROELIX على Instagram",
    facebook: "ROELIX على Facebook",
    x: "ROELIX على X",
    success: "تم تسجيل بريدك في نشرة ROELIX البريدية.",
    error: "تعذر تسجيل الاشتراك. حاول مرة أخرى.",
  },
} as const;

export function Footer() {
  const { lang } = useStore();
  const { settings } = useSiteSettings();
  const [email, setEmail] = useState("");
  const text = FOOTER_COPY[lang];
  const socialLinks = settings?.storefront_content.socialLinks;

  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      saveLocalEmailPreferences(email, {
        source: "footer",
        newsletterOptIn: true,
        orderTrackingOptIn: false,
      });
      setEmail("");
      toast.success(text.success);
    } catch (error) {
      console.error("Could not save the ROELIX newsletter subscription", error);
      toast.error(error instanceof Error ? error.message : text.error);
    }
  }

  return (
    <footer
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="mt-16 border-t border-border bg-secondary text-foreground sm:mt-24"
    >
      <div className="border-b border-border">
        <div className="mx-auto grid max-w-7xl items-center gap-4 px-5 py-7 sm:px-6 md:grid-cols-[auto_1fr_auto] md:gap-8">
          <h2 className="font-serif text-3xl text-foreground sm:text-4xl">{text.hello}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{text.intro}</p>
          <a
            href={`mailto:${STORE_SUPPORT_EMAIL}`}
            className="luxury-rounded inline-flex min-h-12 items-center justify-center rounded-none bg-navy px-7 py-3 text-sm font-semibold text-navy-foreground transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
          >
            {text.contact}
          </a>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-10 px-5 py-10 sm:px-6 sm:py-14 md:grid-cols-7">
        <div className="space-y-3 md:col-span-1">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt="ROELIX"
              className="max-h-12 max-w-40 object-contain"
            />
          ) : (
            <p className="font-serif text-2xl font-bold tracking-[0.2em] text-foreground">ROELIX</p>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">{text.tagline}</p>
        </div>

        <nav aria-label="About ROELIX" className="space-y-3 text-sm md:col-span-1">
          <h3 className="font-semibold text-foreground">{text.about}</h3>
          <Link
            to="/"
            className="block text-muted-foreground transition-colors hover:text-foreground"
          >
            {text.home}
          </Link>
          <Link
            to="/shop"
            className="block text-muted-foreground transition-colors hover:text-foreground"
          >
            {text.collections}
          </Link>
        </nav>

        <nav aria-label="Discover ROELIX" className="space-y-3 text-sm md:col-span-1">
          <h3 className="font-semibold text-foreground">{text.discover}</h3>
          <Link
            to="/shop"
            className="block text-muted-foreground transition-colors hover:text-foreground"
          >
            {text.collections}
          </Link>
          <Link
            to="/custom-bundle"
            className="block text-muted-foreground transition-colors hover:text-foreground"
          >
            {text.bundles}
          </Link>
        </nav>

        <nav aria-label="Customer care" className="space-y-3 text-sm md:col-span-1">
          <h3 className="font-semibold text-foreground">{text.help}</h3>
          <Link
            to="/shipping"
            className="block text-muted-foreground transition-colors hover:text-foreground"
          >
            {text.shipping}
          </Link>
          <Link
            to="/refunds"
            className="block text-muted-foreground transition-colors hover:text-foreground"
          >
            {text.returns}
          </Link>
          <a
            href={`mailto:${STORE_SUPPORT_EMAIL}`}
            className="block break-words text-muted-foreground transition-colors hover:text-foreground"
          >
            Contact
          </a>
        </nav>

        <nav aria-label="Policies" className="space-y-3 text-sm md:col-span-1">
          <h3 className="font-semibold text-foreground">{text.information}</h3>
          <Link
            to="/privacy"
            className="block text-muted-foreground transition-colors hover:text-foreground"
          >
            {text.privacy}
          </Link>
          <Link
            to="/terms"
            className="block text-muted-foreground transition-colors hover:text-foreground"
          >
            {text.terms}
          </Link>
        </nav>

        <div className="md:col-span-2">
          <h3 className="font-serif text-2xl text-foreground">{text.newsletter}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {text.newsletterBody}
          </p>
          <form onSubmit={subscribe} className="mt-4">
            <label htmlFor="footer-newsletter-email" className="sr-only">
              {text.email}
            </label>
            <div className="luxury-rounded flex overflow-hidden rounded-none border border-border bg-background focus-within:border-foreground">
              <input
                id="footer-newsletter-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={text.email}
                className="min-w-0 flex-1 bg-transparent px-5 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                aria-label={text.subscribe}
                className="grid size-12 shrink-0 place-items-center text-foreground transition-colors hover:bg-secondary"
              >
                <span aria-hidden="true">{lang === "ar" ? "←" : "→"}</span>
              </button>
            </div>
          </form>
          <div className="mt-4 flex gap-3">
            {socialLinks?.instagram && (
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label={text.instagram}
                className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Instagram size={18} aria-hidden="true" />
              </a>
            )}
            {socialLinks?.facebook && (
              <a
                href={socialLinks.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label={text.facebook}
                className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Facebook size={18} aria-hidden="true" />
              </a>
            )}
            {socialLinks?.x && (
              <a
                href={socialLinks.x}
                target="_blank"
                rel="noreferrer"
                aria-label={text.x}
                className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Twitter size={18} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © 2026 ROELIX Maison
      </div>
    </footer>
  );
}

import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import {
  saveSiteSettings,
  uploadBrandingImage,
  useSiteSettings,
  validateBrandingImage,
} from "@/lib/site-settings";
import { isAllowedPromoUrl } from "@/lib/promo-slides";

const COPY = {
  en: {
    title: "Store logo and favicon",
    description: "Upload the logo used across the store and the browser/search favicon.",
    logo: "Store logo",
    favicon: "Browser and Google favicon",
    choose: "Choose image",
    save: "Save branding",
    saving: "Saving…",
    saved: "Store branding updated",
    loadError: "Could not load current branding.",
    error: "Could not save store branding.",
    preview: "Current preview",
    ctaTitle: "Hero call to action",
    ctaEnabled: "Show a call-to-action button over the hero slider",
    ctaEnglish: "Button label (English)",
    ctaArabic: "Button label (Arabic)",
    ctaUrl: "Button destination URL",
    ctaRequired: "Add the button label in both languages and a destination URL.",
    ctaInvalidUrl: "Use a secure https:// URL or a local path beginning with /.",
  },
  ar: {
    title: "شعار المتجر وأيقونة الموقع",
    description: "ارفعي الشعار المستخدم في الموقع وأيقونة المتصفح ونتائج البحث.",
    logo: "شعار المتجر",
    favicon: "أيقونة المتصفح وجوجل",
    choose: "اختيار صورة",
    save: "حفظ الهوية البصرية",
    saving: "جارٍ الحفظ…",
    saved: "تم تحديث هوية المتجر",
    loadError: "تعذّر تحميل الهوية البصرية الحالية.",
    error: "تعذّر حفظ هوية المتجر.",
    preview: "معاينة حالية",
    ctaTitle: "زر الدعوة لاتخاذ إجراء في السلايدر",
    ctaEnabled: "إظهار زر فوق السلايدر الرئيسي",
    ctaEnglish: "نص الزر بالإنجليزية",
    ctaArabic: "نص الزر بالعربية",
    ctaUrl: "رابط الزر",
    ctaRequired: "أدخلي نص الزر باللغتين ورابط الوجهة.",
    ctaInvalidUrl: "استخدمي رابطًا آمنًا يبدأ بـ https:// أو مسارًا محليًا يبدأ بـ /.",
  },
} as const;

type SiteBrandingSettingsProps = { isArabic: boolean };
type BrandingKind = "logo" | "favicon";

export function SiteBrandingSettings({ isArabic }: SiteBrandingSettingsProps) {
  const text = COPY[isArabic ? "ar" : "en"];
  const { settings, reload } = useSiteSettings();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaLabelEn, setCtaLabelEn] = useState("");
  const [ctaLabelAr, setCtaLabelAr] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  useEffect(() => {
    if (!settings) return;
    setCtaEnabled(settings.cta_enabled);
    setCtaLabelEn(settings.cta_label_en);
    setCtaLabelAr(settings.cta_label_ar);
    setCtaUrl(settings.cta_url);
  }, [settings]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (faviconPreview) URL.revokeObjectURL(faviconPreview);
    };
  }, [logoPreview, faviconPreview]);

  function chooseFile(kind: BrandingKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const validationError = validateBrandingImage(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const preview = URL.createObjectURL(file);
    if (kind === "logo") {
      setLogoPreview(preview);
      setLogoFile(file);
    } else {
      setFaviconPreview(preview);
      setFaviconFile(file);
    }
  }

  async function save() {
    if (!settings) {
      toast.error(text.loadError);
      return;
    }
    if (
      ctaEnabled &&
      (!ctaLabelEn.trim() || !ctaLabelAr.trim() || !ctaUrl.trim())
    ) {
      toast.error(text.ctaRequired);
      return;
    }
    if (ctaEnabled && !isAllowedPromoUrl(ctaUrl)) {
      toast.error(text.ctaInvalidUrl);
      return;
    }
    setSaving(true);
    try {
      const [logoUrl, faviconUrl] = await Promise.all([
        logoFile ? uploadBrandingImage(logoFile, "logo") : settings.logo_url,
        faviconFile ? uploadBrandingImage(faviconFile, "favicon") : settings.favicon_url,
      ]);
      await saveSiteSettings({
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        cta_enabled: ctaEnabled,
        cta_label_en: ctaLabelEn.trim(),
        cta_label_ar: ctaLabelAr.trim(),
        cta_url: ctaUrl.trim(),
      });
      await reload();
      setLogoFile(null);
      setFaviconFile(null);
      setLogoPreview(null);
      setFaviconPreview(null);
      toast.success(text.saved);
    } catch (error) {
      console.error("Could not save store branding", error);
      toast.error(error instanceof Error ? error.message : text.error);
    } finally {
      setSaving(false);
    }
  }

  const logoSrc = logoPreview ?? settings?.logo_url;
  const faviconSrc = faviconPreview ?? settings?.favicon_url;

  return (
    <section className="space-y-5 border-b pb-6" aria-label={text.title}>
      <header>
        <h3 className="font-serif text-2xl">{text.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{text.description}</p>
      </header>
      {!settings ? (
        <p role="status" className="text-sm text-muted-foreground">
          {text.loadError}
        </p>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <BrandingUpload
              label={text.logo}
              previewLabel={text.preview}
              src={logoSrc}
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => chooseFile("logo", event)}
              chooseText={text.choose}
              isArabic={isArabic}
              logo
            />
            <BrandingUpload
              label={text.favicon}
              previewLabel={text.preview}
              src={faviconSrc}
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => chooseFile("favicon", event)}
              chooseText={text.choose}
              isArabic={isArabic}
            />
          </div>
          <div className="space-y-4 border-t pt-5">
            <h4 className="font-serif text-xl">{text.ctaTitle}</h4>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={ctaEnabled}
                onChange={(event) => setCtaEnabled(event.target.checked)}
                className="accent-[var(--gold)]"
              />
              {text.ctaEnabled}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <span className="eyebrow">{text.ctaEnglish}</span>
                <input
                  value={ctaLabelEn}
                  onChange={(event) => setCtaLabelEn(event.target.value)}
                  maxLength={80}
                  disabled={!ctaEnabled}
                  className="w-full border bg-background px-3 py-2"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="eyebrow">{text.ctaArabic}</span>
                <input
                  dir="rtl"
                  value={ctaLabelAr}
                  onChange={(event) => setCtaLabelAr(event.target.value)}
                  maxLength={80}
                  disabled={!ctaEnabled}
                  className="w-full border bg-background px-3 py-2"
                />
              </label>
              <label className="block space-y-2 text-sm sm:col-span-2">
                <span className="eyebrow">{text.ctaUrl}</span>
                <input
                  dir="ltr"
                  type="url"
                  value={ctaUrl}
                  onChange={(event) => setCtaUrl(event.target.value)}
                  maxLength={2048}
                  disabled={!ctaEnabled}
                  className="w-full border bg-background px-3 py-2"
                />
              </label>
            </div>
          </div>
          <button type="button" className="btn-lux" disabled={saving} onClick={() => void save()}>
            {saving ? text.saving : text.save}
          </button>
        </>
      )}
    </section>
  );
}

function BrandingUpload({
  label,
  previewLabel,
  src,
  accept,
  onChange,
  chooseText,
  isArabic,
  logo = false,
}: {
  label: string;
  previewLabel: string;
  src: string | null | undefined;
  accept: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  chooseText: string;
  isArabic: boolean;
  logo?: boolean;
}) {
  return (
    <label className="block space-y-3 text-sm">
      <span className="eyebrow">{label}</span>
      <span className="flex min-h-24 items-center justify-center border bg-secondary p-4">
        {src ? (
          <img
            src={src}
            alt={previewLabel}
            className={logo ? "max-h-20 max-w-full object-contain" : "size-16 object-contain"}
          />
        ) : (
          <span className="text-muted-foreground">
            {isArabic ? "لم يتم رفع صورة بعد" : "No image uploaded yet"}
          </span>
        )}
      </span>
      <span className="block cursor-pointer border bg-background px-3 py-2 text-center">
        {chooseText}
        <input type="file" accept={accept} onChange={onChange} className="sr-only" />
      </span>
      <span className="block text-xs text-muted-foreground">PNG, JPG, WebP · 5 MB max</span>
    </label>
  );
}

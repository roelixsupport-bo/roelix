import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createHeroSlide,
  deleteHeroSlide,
  fetchHeroSlides,
  replaceHeroSlideImage,
  updateHeroSlide,
  type HeroSlide,
  type HeroSlideButtonSettings,
  type HeroSlideButtonPosition,
} from "@/lib/hero-slides";
import { isAllowedPromoUrl } from "@/lib/promo-slides";

const COPY = {
  en: {
    title: "Hero slider",
    description: "Manage the images shown on the homepage.",
    add: "Add slide",
    chooseImage: "Choose an image",
    altText: "Image description",
    altPlaceholder: "Describe this image",
    save: "Save slide",
    showButton: "Show button on this slide",
    buttonTextEn: "Button text (English)",
    buttonTextAr: "Button text (Arabic)",
    buttonUrl: "Button destination URL",
    buttonPosition: "Button position",
    bottomLeft: "Bottom left",
    bottomCenter: "Bottom center",
    bottomRight: "Bottom right",
    buttonRequired: "Add the button text in both languages and a destination URL.",
    buttonInvalidUrl: "Use a secure https:// URL or a local path beginning with /.",
    moveUp: "Move slide up",
    moveDown: "Move slide down",
    show: "Show on homepage",
    hide: "Hide from homepage",
    replace: "Change image",
    remove: "Delete slide",
    confirmDelete: "Delete this slide and its image?",
    noSlides: "No slides yet. Add an image to get started.",
    loading: "Loading slides…",
    loaded: "Hero slides loaded",
    saved: "Slide updated",
    added: "Slide added",
    deleted: "Slide deleted",
    error: "Could not complete the slide action",
    imageRequired: "Choose an image before adding a slide.",
    altRequired: "Add an image description before saving.",
    loadError: "Could not load hero slides.",
  },
  ar: {
    title: "سلايدر الواجهة الرئيسية",
    description: "إدارة الصور التي تظهر في الصفحة الرئيسية.",
    add: "إضافة شريحة",
    chooseImage: "اختر صورة",
    altText: "وصف الصورة",
    altPlaceholder: "اكتب وصفًا للصورة",
    save: "حفظ الشريحة",
    showButton: "إظهار الزر على هذه الشريحة",
    buttonTextEn: "نص الزر بالإنجليزية",
    buttonTextAr: "نص الزر بالعربية",
    buttonUrl: "رابط الزر",
    buttonPosition: "موضع الزر",
    bottomLeft: "أسفل اليسار",
    bottomCenter: "أسفل المنتصف",
    bottomRight: "أسفل اليمين",
    buttonRequired: "أدخلي نص الزر باللغتين ورابط الوجهة.",
    buttonInvalidUrl: "استخدمي رابطًا آمنًا يبدأ بـ https:// أو مسارًا محليًا يبدأ بـ /.",
    moveUp: "تحريك الشريحة للأعلى",
    moveDown: "تحريك الشريحة للأسفل",
    show: "إظهار في الصفحة الرئيسية",
    hide: "إخفاء من الصفحة الرئيسية",
    replace: "تغيير الصورة",
    remove: "حذف الشريحة",
    confirmDelete: "هل تريد حذف هذه الشريحة وصورتها؟",
    noSlides: "لا توجد شرائح بعد. أضف صورة للبدء.",
    loading: "جارٍ تحميل الصور…",
    loaded: "تم تحميل صور السلايدر",
    saved: "تم تحديث الشريحة",
    added: "تمت إضافة الشريحة",
    deleted: "تم حذف الشريحة",
    error: "تعذّر تنفيذ الإجراء",
    imageRequired: "اختر صورة قبل إضافة الشريحة.",
    altRequired: "أضف وصفًا للصورة قبل الحفظ.",
    loadError: "تعذّر تحميل صور السلايدر.",
  },
} as const;

type HeroSlidesPanelProps = { isArabic: boolean };
type HeroSlideDraft = Pick<
  HeroSlide,
  "alt_text" | keyof HeroSlideButtonSettings
>;
const EMPTY_BUTTON: HeroSlideButtonSettings = {
  show_button: false,
  button_text_ar: "",
  button_text_en: "",
  button_url: "",
  button_position: "bottom-center",
};

export function HeroSlidesPanel({ isArabic }: HeroSlidesPanelProps) {
  const text = COPY[isArabic ? "ar" : "en"];
  const [hydrated, setHydrated] = useState(false);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [drafts, setDrafts] = useState<Record<string, HeroSlideDraft>>({});
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newAltText, setNewAltText] = useState("");
  const [newButton, setNewButton] = useState<HeroSlideButtonSettings>(EMPTY_BUTTON);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchHeroSlides();
      setSlides(next);
      setDrafts(
        Object.fromEntries(
          next.map((slide) => [
            slide.id,
            {
              alt_text: slide.alt_text,
              show_button: slide.show_button,
              button_text_ar: slide.button_text_ar,
              button_text_en: slide.button_text_en,
              button_url: slide.button_url,
              button_position: slide.button_position,
            },
          ]),
        ),
      );
    } catch (error) {
      console.error("Could not load hero slides", error);
      toast.error(error instanceof Error ? error.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    setHydrated(true);
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
      await load();
    } catch (error) {
      console.error("ROELIX hero slide action failed", error);
      toast.error(error instanceof Error ? error.message : text.error);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function addSlide() {
    if (!newFile) {
      toast.error(text.imageRequired);
      return;
    }
    if (!newAltText.trim()) {
      toast.error(text.altRequired);
      return;
    }
    if (!validateButton(newButton)) return;
    void run(async () => {
      await createHeroSlide({
        file: newFile,
        altText: newAltText,
        sortOrder: slides.length,
        button: newButton,
      });
      setNewFile(null);
      setNewAltText("");
      setNewButton(EMPTY_BUTTON);
    }, text.added);
  }

  function validateButton(button: HeroSlideButtonSettings): boolean {
    if (!button.show_button) return true;
    if (!button.button_text_ar.trim() || !button.button_text_en.trim() || !button.button_url.trim()) {
      toast.error(text.buttonRequired);
      return false;
    }
    if (!isAllowedPromoUrl(button.button_url)) {
      toast.error(text.buttonInvalidUrl);
      return false;
    }
    return true;
  }

  function updateDraft(id: string, changes: Partial<HeroSlideDraft>) {
    const slide = slides.find((item) => item.id === id);
    if (!slide) return;
    setDrafts((current) => ({
      ...current,
      [id]: { ...slide, ...current[id], ...changes },
    }));
  }

  function moveSlide(index: number, offset: -1 | 1) {
    const target = slides[index + offset];
    const current = slides[index];
    if (!target || !current) return;

    void run(async () => {
      await updateHeroSlide(current.id, { sort_order: target.sort_order });
      await updateHeroSlide(target.id, { sort_order: current.sort_order });
    }, text.saved);
  }

  if (!hydrated) {
    return (
      <section className="mt-6 space-y-6" aria-busy="true">
        <p role="status" aria-label="Loading hero slides" className="sr-only">
          Loading hero slides
        </p>
        <div className="h-9 w-48 animate-pulse bg-secondary" />
        <div className="h-24 animate-pulse border bg-secondary" />
        <div className="h-40 animate-pulse border bg-secondary" />
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6" aria-label={text.title}>
      <header>
        <h2 className="font-serif text-3xl">{text.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{text.description}</p>
      </header>

      <div className="grid gap-3 border p-4 sm:grid-cols-2 sm:items-end">
        <label className="block space-y-2 text-sm">
          <span className="eyebrow">{text.chooseImage}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => setNewFile(event.target.files?.[0] ?? null)}
            disabled={busy}
            className="block w-full text-sm file:me-3 file:border file:bg-background file:px-3 file:py-2"
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span className="eyebrow">{text.altText}</span>
          <input
            type="text"
            value={newAltText}
            onChange={(event) => setNewAltText(event.target.value)}
            placeholder={text.altPlaceholder}
            maxLength={240}
            disabled={busy}
            className="w-full border bg-background px-3 py-2"
          />
        </label>
        <HeroButtonFields
          value={newButton}
          text={text}
          disabled={busy}
          onChange={setNewButton}
        />
        <button
          type="button"
          onClick={addSlide}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 bg-navy px-4 py-2 text-sm text-navy-foreground disabled:opacity-50 sm:col-span-2"
        >
          <ImagePlus size={16} aria-hidden="true" />
          {text.add}
        </button>
      </div>

      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {text.loading}
        </p>
      )}
      {!loading && slides.length === 0 && (
        <p className="border p-6 text-muted-foreground">{text.noSlides}</p>
      )}
      <ol className="grid gap-4 md:grid-cols-2">
        {slides.map((slide, index) => (
          <li key={slide.id} className="flex min-w-0 gap-4 border p-4">
            <img
              src={slide.image_url}
              alt={drafts[slide.id]?.alt_text ?? slide.alt_text}
              className="h-28 w-36 shrink-0 object-cover"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="eyebrow">{text.altText}</span>
                <input
                  type="text"
                  value={drafts[slide.id]?.alt_text ?? slide.alt_text}
                  onChange={(event) => updateDraft(slide.id, { alt_text: event.target.value })}
                  maxLength={240}
                  disabled={busy}
                  className="w-full border bg-background px-3 py-2"
                />
              </label>
              <HeroButtonFields
                value={drafts[slide.id] ?? slide}
                text={text}
                disabled={busy}
                onChange={(value) => updateDraft(slide.id, value)}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <button
                  type="button"
                  aria-label={text.save}
                  title={text.save}
                  disabled={
                    busy ||
                    !(drafts[slide.id]?.alt_text ?? slide.alt_text).trim()
                  }
                  onClick={() =>
                    (() => {
                      const draft = drafts[slide.id] ?? slide;
                      if (!validateButton(draft)) return;
                      void run(
                        () =>
                          updateHeroSlide(slide.id, {
                            ...draft,
                            alt_text: draft.alt_text.trim(),
                            button_text_ar: draft.button_text_ar.trim(),
                            button_text_en: draft.button_text_en.trim(),
                            button_url: draft.button_url.trim(),
                          }),
                        text.saved,
                      );
                    })()
                  }
                  className="hover:text-gold disabled:opacity-50"
                >
                  <Save size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={slide.is_active ? text.hide : text.show}
                  title={slide.is_active ? text.hide : text.show}
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => updateHeroSlide(slide.id, { is_active: !slide.is_active }),
                      text.saved,
                    )
                  }
                  className="hover:text-gold disabled:opacity-50"
                >
                  {slide.is_active ? (
                    <Eye size={16} aria-hidden="true" />
                  ) : (
                    <EyeOff size={16} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={text.moveUp}
                  title={text.moveUp}
                  disabled={busy || index === 0}
                  onClick={() => moveSlide(index, -1)}
                  className="hover:text-gold disabled:opacity-30"
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={text.moveDown}
                  title={text.moveDown}
                  disabled={busy || index === slides.length - 1}
                  onClick={() => moveSlide(index, 1)}
                  className="hover:text-gold disabled:opacity-30"
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <label className="cursor-pointer hover:text-gold">
                  <span>{text.replace}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    aria-label={text.replace}
                    disabled={busy}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void run(() => replaceHeroSlideImage(slide, file), text.saved);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  aria-label={text.remove}
                  title={text.remove}
                  disabled={busy}
                  onClick={() => {
                    if (confirm(text.confirmDelete))
                      void run(() => deleteHeroSlide(slide), text.deleted);
                  }}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HeroButtonFields({
  value,
  text,
  disabled,
  onChange,
}: {
  value: HeroSlideButtonSettings;
  text: (typeof COPY)["en"] | (typeof COPY)["ar"];
  disabled: boolean;
  onChange: (value: HeroSlideButtonSettings) => void;
}) {
  return (
    <div className="space-y-3 border-t pt-3 sm:col-span-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.show_button}
          onChange={(event) => onChange({ ...value, show_button: event.target.checked })}
          disabled={disabled}
          className="accent-[var(--gold)]"
        />
        {text.showButton}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="eyebrow">{text.buttonTextEn}</span>
          <input
            type="text"
            value={value.button_text_en}
            onChange={(event) => onChange({ ...value, button_text_en: event.target.value })}
            maxLength={80}
            disabled={disabled || !value.show_button}
            className="w-full border bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="eyebrow">{text.buttonTextAr}</span>
          <input
            type="text"
            dir="rtl"
            value={value.button_text_ar}
            onChange={(event) => onChange({ ...value, button_text_ar: event.target.value })}
            maxLength={80}
            disabled={disabled || !value.show_button}
            className="w-full border bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="eyebrow">{text.buttonUrl}</span>
          <input
            dir="ltr"
            type="url"
            value={value.button_url}
            onChange={(event) => onChange({ ...value, button_url: event.target.value })}
            maxLength={2048}
            disabled={disabled || !value.show_button}
            className="w-full border bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="eyebrow">{text.buttonPosition}</span>
          <select
            value={value.button_position}
            onChange={(event) => {
              const position = event.target.value;
              if (isHeroSlideButtonPosition(position))
                onChange({ ...value, button_position: position });
            }}
            disabled={disabled || !value.show_button}
            className="w-full border bg-background px-3 py-2"
          >
            <option value="bottom-left">{text.bottomLeft}</option>
            <option value="bottom-center">{text.bottomCenter}</option>
            <option value="bottom-right">{text.bottomRight}</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function isHeroSlideButtonPosition(value: string): value is HeroSlideButtonPosition {
  return value === "bottom-left" || value === "bottom-center" || value === "bottom-right";
}

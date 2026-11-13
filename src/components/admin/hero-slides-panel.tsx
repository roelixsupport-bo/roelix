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
} from "@/lib/hero-slides";

const COPY = {
  en: {
    title: "Hero slider",
    description: "Manage the images shown on the homepage.",
    add: "Add slide",
    chooseImage: "Choose an image",
    altText: "Image description",
    altPlaceholder: "Describe this image",
    save: "Save description",
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
    save: "حفظ الوصف",
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

export function HeroSlidesPanel({ isArabic }: HeroSlidesPanelProps) {
  const text = COPY[isArabic ? "ar" : "en"];
  const [hydrated, setHydrated] = useState(false);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newAltText, setNewAltText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchHeroSlides();
      setSlides(next);
      setAltDrafts(Object.fromEntries(next.map((slide) => [slide.id, slide.alt_text])));
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
    void run(async () => {
      await createHeroSlide({ file: newFile, altText: newAltText, sortOrder: slides.length });
      setNewFile(null);
      setNewAltText("");
    }, text.added);
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

      <div className="grid gap-3 border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
        <button
          type="button"
          onClick={addSlide}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 bg-navy px-4 py-2 text-sm text-navy-foreground disabled:opacity-50"
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
              alt={altDrafts[slide.id] ?? slide.alt_text}
              className="h-28 w-36 shrink-0 object-cover"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="eyebrow">{text.altText}</span>
                <input
                  type="text"
                  value={altDrafts[slide.id] ?? ""}
                  onChange={(event) =>
                    setAltDrafts((drafts) => ({ ...drafts, [slide.id]: event.target.value }))
                  }
                  maxLength={240}
                  disabled={busy}
                  className="w-full border bg-background px-3 py-2"
                />
              </label>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <button
                  type="button"
                  aria-label={text.save}
                  title={text.save}
                  disabled={busy || !(altDrafts[slide.id] ?? "").trim()}
                  onClick={() =>
                    void run(
                      () =>
                        updateHeroSlide(slide.id, { alt_text: altDrafts[slide.id]?.trim() ?? "" }),
                      text.saved,
                    )
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

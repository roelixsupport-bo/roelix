import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createHeroSlide,
  deleteHeroSlide,
  fetchHeroSlides,
  replaceHeroSlideMedia,
  setHeroSlideVideoUrl,
  updateHeroSlide,
  type HeroSlide,
  type HeroSlideButtonSettings,
  type HeroSlideButtonPosition,
  type HeroSlideMediaType,
} from "@/lib/hero-slides";
import { isAllowedPromoUrl } from "@/lib/promo-slides";

const COPY = {
  en: {
    title: "Hero slider",
    description: "Manage image and MP4 video slides shown on the homepage.",
    add: "Add slide",
    chooseImage: "Choose an image",
    mediaType: "Slide media",
    image: "Image",
    video: "Video",
    chooseVideo: "Choose an MP4 video (up to 50 MB)",
    videoUrl: "Video URL (HTTPS)",
    titleEn: "Title (English)",
    titleAr: "Title (Arabic)",
    descriptionEn: "Description (English)",
    descriptionAr: "Description (Arabic)",
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
    replace: "Replace media",
    remove: "Delete slide",
    confirmDelete: "Delete this slide and its image?",
    noSlides: "No slides yet. Add an image or video to get started.",
    loading: "Loading slides…",
    loaded: "Hero slides loaded",
    saved: "Slide updated",
    added: "Slide added",
    deleted: "Slide deleted",
    error: "Could not complete the slide action",
    imageRequired: "Choose an image before adding a slide.",
    videoRequired: "Choose an MP4 video or enter its HTTPS URL.",
    videoTitleRequired: "Add the video title in both languages.",
    videoInvalidUrl: "Use a secure https:// video URL or a local path beginning with /.",
    altRequired: "Add an image description before saving.",
    loadError: "Could not load hero slides.",
  },
  ar: {
    title: "سلايدر الواجهة الرئيسية",
    description: "إدارة الصور وفيديوهات MP4 التي تظهر في الصفحة الرئيسية.",
    add: "إضافة شريحة",
    chooseImage: "اختر صورة",
    mediaType: "نوع الشريحة",
    image: "صورة",
    video: "فيديو",
    chooseVideo: "اختر فيديو MP4 (حتى 50 ميجابايت)",
    videoUrl: "رابط الفيديو (HTTPS)",
    titleEn: "العنوان (بالإنجليزية)",
    titleAr: "العنوان (بالعربية)",
    descriptionEn: "الوصف (بالإنجليزية)",
    descriptionAr: "الوصف (بالعربية)",
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
    replace: "استبدال الوسائط",
    remove: "حذف الشريحة",
    confirmDelete: "هل تريد حذف هذه الشريحة وصورتها؟",
    noSlides: "لا توجد شرائح بعد. أضف صورة أو فيديو للبدء.",
    loading: "جارٍ تحميل الصور…",
    loaded: "تم تحميل صور السلايدر",
    saved: "تم تحديث الشريحة",
    added: "تمت إضافة الشريحة",
    deleted: "تم حذف الشريحة",
    error: "تعذّر تنفيذ الإجراء",
    imageRequired: "اختر صورة قبل إضافة الشريحة.",
    videoRequired: "اختر فيديو MP4 أو أدخل رابطه الآمن.",
    videoTitleRequired: "أدخل عنوان الفيديو باللغتين.",
    videoInvalidUrl: "استخدم رابط فيديو آمنًا يبدأ بـ https:// أو مسارًا محليًا يبدأ بـ /.",
    altRequired: "أضف وصفًا للصورة قبل الحفظ.",
    loadError: "تعذّر تحميل صور السلايدر.",
  },
} as const;

type HeroSlidesPanelProps = { isArabic: boolean };
type HeroSlideDraft = Pick<
  HeroSlide,
  | "media_type"
  | "image_url"
  | "video_url"
  | "alt_text"
  | "title_ar"
  | "title_en"
  | "description_ar"
  | "description_en"
  | keyof HeroSlideButtonSettings
>;
type HeroSlideCopy = (typeof COPY)["en"] | (typeof COPY)["ar"];
const EMPTY_BUTTON: HeroSlideButtonSettings = {
  show_button: false,
  button_text_ar: "",
  button_text_en: "",
  button_url: "",
  button_position: "bottom-center",
};
const EMPTY_CONTENT = {
  title_ar: "",
  title_en: "",
  description_ar: "",
  description_en: "",
};

export function HeroSlidesPanel({ isArabic }: HeroSlidesPanelProps) {
  const text = COPY[isArabic ? "ar" : "en"];
  const [hydrated, setHydrated] = useState(false);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [drafts, setDrafts] = useState<Record<string, HeroSlideDraft>>({});
  const [replacementFiles, setReplacementFiles] = useState<Record<string, File | undefined>>({});
  const [newMediaType, setNewMediaType] = useState<HeroSlideMediaType>("image");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newAltText, setNewAltText] = useState("");
  const [newButton, setNewButton] = useState<HeroSlideButtonSettings>(EMPTY_BUTTON);
  const [newContent, setNewContent] = useState(EMPTY_CONTENT);
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
              media_type: slide.media_type,
              image_url: slide.image_url,
              video_url: slide.video_url,
              alt_text: slide.alt_text,
              title_ar: slide.title_ar,
              title_en: slide.title_en,
              description_ar: slide.description_ar,
              description_en: slide.description_en,
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
    if (newMediaType === "image" && !newFile) {
      toast.error(text.imageRequired);
      return;
    }
    if (newMediaType === "video" && !newFile && !newVideoUrl.trim()) {
      toast.error(text.videoRequired);
      return;
    }
    if (
      newMediaType === "video" &&
      newVideoUrl.trim() &&
      !newFile &&
      !isAllowedPromoUrl(newVideoUrl)
    ) {
      toast.error(text.videoInvalidUrl);
      return;
    }
    if (newMediaType === "video" && (!newContent.title_ar.trim() || !newContent.title_en.trim())) {
      toast.error(text.videoTitleRequired);
      return;
    }
    if (!newAltText.trim()) {
      toast.error(text.altRequired);
      return;
    }
    if (!validateButton(newButton)) return;
    void run(async () => {
      await createHeroSlide({
        mediaType: newMediaType,
        file: newFile,
        videoUrl: newVideoUrl,
        altText: newAltText,
        titleAr: newContent.title_ar,
        titleEn: newContent.title_en,
        descriptionAr: newContent.description_ar,
        descriptionEn: newContent.description_en,
        sortOrder: slides.length,
        button: newButton,
      });
      setNewFile(null);
      setNewVideoUrl("");
      setNewAltText("");
      setNewContent(EMPTY_CONTENT);
      setNewButton(EMPTY_BUTTON);
    }, text.added);
  }

  function validateButton(button: HeroSlideButtonSettings): boolean {
    if (!button.show_button) return true;
    if (
      !button.button_text_ar.trim() ||
      !button.button_text_en.trim() ||
      !button.button_url.trim()
    ) {
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

  function saveSlide(slide: HeroSlide, draft: HeroSlideDraft) {
    if (!draft.alt_text.trim()) {
      toast.error(text.altRequired);
      return;
    }
    if (draft.media_type === "video" && (!draft.title_ar.trim() || !draft.title_en.trim())) {
      toast.error(text.videoTitleRequired);
      return;
    }
    if (!validateSlideMedia(slide, draft)) return;
    if (!validateButton(draft)) return;

    const file = replacementFiles[slide.id];
    void run(async () => {
      const changes = {
        alt_text: draft.alt_text.trim(),
        title_ar: draft.title_ar.trim(),
        title_en: draft.title_en.trim(),
        description_ar: draft.description_ar.trim(),
        description_en: draft.description_en.trim(),
        button_text_ar: draft.button_text_ar.trim(),
        button_text_en: draft.button_text_en.trim(),
        button_url: draft.button_url.trim(),
      };

      if (file) {
        await replaceHeroSlideMedia(slide, draft.media_type, file);
        setReplacementFiles((current) => ({ ...current, [slide.id]: undefined }));
        await updateHeroSlide(slide.id, changes);
      } else if (draft.media_type === "video") {
        await setHeroSlideVideoUrl(slide, draft.video_url ?? "", changes);
      } else {
        await updateHeroSlide(slide.id, { ...changes, media_type: "image" });
      }
    }, text.saved);
  }

  function validateSlideMedia(slide: HeroSlide, draft: HeroSlideDraft): boolean {
    if (replacementFiles[slide.id]) return true;
    if (draft.media_type === "image" && draft.image_url) return true;
    if (
      draft.media_type === "video" &&
      draft.video_url?.trim() &&
      isAllowedPromoUrl(draft.video_url)
    )
      return true;
    toast.error(draft.media_type === "image" ? text.imageRequired : text.videoRequired);
    return false;
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
          <span className="eyebrow">{text.mediaType}</span>
          <select
            value={newMediaType}
            onChange={(event) => {
              if (isHeroSlideMediaType(event.target.value)) {
                setNewMediaType(event.target.value);
                setNewFile(null);
              }
            }}
            disabled={busy}
            className="w-full border bg-background px-3 py-2"
          >
            <option value="image">{text.image}</option>
            <option value="video">{text.video}</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="eyebrow">
            {newMediaType === "image" ? text.chooseImage : text.chooseVideo}
          </span>
          <input
            type="file"
            accept={
              newMediaType === "image"
                ? "image/jpeg,image/png,image/webp,image/avif"
                : "video/mp4,.mp4"
            }
            onChange={(event) => setNewFile(event.target.files?.[0] ?? null)}
            disabled={busy}
            className="block w-full text-sm file:me-3 file:border file:bg-background file:px-3 file:py-2"
          />
        </label>
        {newMediaType === "video" && (
          <label className="block space-y-2 text-sm sm:col-span-2">
            <span className="eyebrow">{text.videoUrl}</span>
            <input
              type="url"
              dir="ltr"
              value={newVideoUrl}
              onChange={(event) => setNewVideoUrl(event.target.value)}
              maxLength={2048}
              disabled={busy}
              className="w-full border bg-background px-3 py-2"
            />
          </label>
        )}
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
        <HeroSlideContentFields
          value={newContent}
          text={text}
          disabled={busy}
          onChange={(changes) => setNewContent((current) => ({ ...current, ...changes }))}
        />
        <HeroButtonFields value={newButton} text={text} disabled={busy} onChange={setNewButton} />
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
            {slide.media_type === "video" && slide.video_url ? (
              <video
                src={slide.video_url}
                aria-label={drafts[slide.id]?.alt_text ?? slide.alt_text}
                className="h-28 w-36 shrink-0 object-cover"
                muted
                controls
                playsInline
              />
            ) : slide.image_url ? (
              <img
                src={slide.image_url}
                alt={drafts[slide.id]?.alt_text ?? slide.alt_text}
                className="h-28 w-36 shrink-0 object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1 space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="eyebrow">{text.mediaType}</span>
                <select
                  value={drafts[slide.id]?.media_type ?? slide.media_type}
                  onChange={(event) => {
                    if (isHeroSlideMediaType(event.target.value))
                      updateDraft(slide.id, { media_type: event.target.value });
                  }}
                  disabled={busy}
                  className="w-full border bg-background px-3 py-2"
                >
                  <option value="image">{text.image}</option>
                  <option value="video">{text.video}</option>
                </select>
              </label>
              {(drafts[slide.id]?.media_type ?? slide.media_type) === "video" && (
                <label className="block space-y-1 text-sm">
                  <span className="eyebrow">{text.videoUrl}</span>
                  <input
                    type="url"
                    dir="ltr"
                    value={drafts[slide.id]?.video_url ?? slide.video_url ?? ""}
                    onChange={(event) => updateDraft(slide.id, { video_url: event.target.value })}
                    maxLength={2048}
                    disabled={busy}
                    className="w-full border bg-background px-3 py-2"
                  />
                </label>
              )}
              <label className="block space-y-1 text-sm">
                <span className="eyebrow">
                  {(drafts[slide.id]?.media_type ?? slide.media_type) === "image"
                    ? text.chooseImage
                    : text.chooseVideo}
                </span>
                <input
                  type="file"
                  accept={
                    (drafts[slide.id]?.media_type ?? slide.media_type) === "image"
                      ? "image/jpeg,image/png,image/webp,image/avif"
                      : "video/mp4,.mp4"
                  }
                  aria-label={text.replace}
                  disabled={busy}
                  onChange={(event) =>
                    setReplacementFiles((current) => ({
                      ...current,
                      [slide.id]: event.target.files?.[0],
                    }))
                  }
                  className="block w-full text-sm file:me-3 file:border file:bg-background file:px-3 file:py-2"
                />
              </label>
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
              <HeroSlideContentFields
                value={drafts[slide.id] ?? slide}
                text={text}
                disabled={busy}
                onChange={(changes) => updateDraft(slide.id, changes)}
              />
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
                  disabled={busy || !(drafts[slide.id]?.alt_text ?? slide.alt_text).trim()}
                  onClick={() => saveSlide(slide, drafts[slide.id] ?? slide)}
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

function HeroSlideContentFields({
  value,
  text,
  disabled,
  onChange,
}: {
  value: Pick<HeroSlide, "title_ar" | "title_en" | "description_ar" | "description_en">;
  text: HeroSlideCopy;
  disabled: boolean;
  onChange: (
    changes: Partial<
      Pick<HeroSlide, "title_ar" | "title_en" | "description_ar" | "description_en">
    >,
  ) => void;
}) {
  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      <label className="block space-y-1 text-sm">
        <span className="eyebrow">{text.titleEn}</span>
        <input
          type="text"
          value={value.title_en}
          onChange={(event) => onChange({ title_en: event.target.value })}
          maxLength={160}
          disabled={disabled}
          className="w-full border bg-background px-3 py-2"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="eyebrow">{text.titleAr}</span>
        <input
          type="text"
          dir="rtl"
          value={value.title_ar}
          onChange={(event) => onChange({ title_ar: event.target.value })}
          maxLength={160}
          disabled={disabled}
          className="w-full border bg-background px-3 py-2"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="eyebrow">{text.descriptionEn}</span>
        <textarea
          value={value.description_en}
          onChange={(event) => onChange({ description_en: event.target.value })}
          maxLength={500}
          disabled={disabled}
          className="w-full border bg-background px-3 py-2"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="eyebrow">{text.descriptionAr}</span>
        <textarea
          dir="rtl"
          value={value.description_ar}
          onChange={(event) => onChange({ description_ar: event.target.value })}
          maxLength={500}
          disabled={disabled}
          className="w-full border bg-background px-3 py-2"
        />
      </label>
    </div>
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

function isHeroSlideMediaType(value: string): value is HeroSlideMediaType {
  return value === "image" || value === "video";
}

function isHeroSlideButtonPosition(value: string): value is HeroSlideButtonPosition {
  return value === "bottom-left" || value === "bottom-center" || value === "bottom-right";
}

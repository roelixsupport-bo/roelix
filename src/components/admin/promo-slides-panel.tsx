import { useCallback, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createPromoSlide,
  deletePromoSlide,
  fetchPromoSlides,
  isAllowedPromoUrl,
  updatePromoSlide,
  type PromoSlide,
} from "@/lib/promo-slides";

const COPY = {
  en: {
    title: "Promotional banner",
    description: "Manage the rotating messages shown in the top banner.",
    loading: "Loading promotions…",
    loadError: "Could not load promotional slides.",
    add: "Add promotion",
    english: "English text",
    arabic: "Arabic text",
    url: "Destination URL",
    save: "Save changes",
    activate: "Activate promotion",
    deactivate: "Deactivate promotion",
    remove: "Delete promotion",
    empty: "No promotional slides yet.",
    added: "Promotion added",
    saved: "Promotion updated",
    removed: "Promotion deleted",
    confirmDelete: "Delete this promotional slide?",
    error: "Could not complete the promotion action.",
    required: "Add both language versions and a destination URL.",
    invalidUrl: "Use a secure https:// URL or a local path beginning with /.",
  },
  ar: {
    title: "الشريط الترويجي",
    description: "إدارة الرسائل المتناوبة التي تظهر في الشريط العلوي.",
    loading: "جارٍ تحميل العروض…",
    loadError: "تعذّر تحميل الشرائح الترويجية.",
    add: "إضافة عرض",
    english: "النص بالإنجليزية",
    arabic: "النص بالعربية",
    url: "رابط الوجهة",
    save: "حفظ التعديلات",
    activate: "تفعيل العرض",
    deactivate: "إيقاف العرض",
    remove: "حذف العرض",
    empty: "لا توجد شرائح ترويجية بعد.",
    added: "تمت إضافة العرض",
    saved: "تم تحديث العرض",
    removed: "تم حذف العرض",
    confirmDelete: "هل تريد حذف هذه الشريحة الترويجية؟",
    error: "تعذّر تنفيذ الإجراء.",
    required: "أدخلي النص باللغتين ورابط الوجهة.",
    invalidUrl: "استخدمي رابطًا آمنًا يبدأ بـ https:// أو مسارًا محليًا يبدأ بـ /.",
  },
} as const;

type PromoSlidesPanelProps = { isArabic: boolean };
type PromoDraft = Pick<PromoSlide, "message_en" | "message_ar" | "target_url">;
const EMPTY_DRAFT: PromoDraft = { message_en: "", message_ar: "", target_url: "" };

export function PromoSlidesPanel({ isArabic }: PromoSlidesPanelProps) {
  const text = COPY[isArabic ? "ar" : "en"];
  const [slides, setSlides] = useState<PromoSlide[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PromoDraft>>({});
  const [newSlide, setNewSlide] = useState<PromoDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPromoSlides();
      setSlides(rows);
      setDrafts(
        Object.fromEntries(
          rows.map((row) => [
            row.id,
            { message_en: row.message_en, message_ar: row.message_ar, target_url: row.target_url },
          ]),
        ),
      );
    } catch (error) {
      console.error("Could not load promotional slides", error);
      toast.error(error instanceof Error ? error.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  function validate(draft: PromoDraft): boolean {
    if (!draft.message_en.trim() || !draft.message_ar.trim() || !draft.target_url.trim()) {
      toast.error(text.required);
      return false;
    }
    if (!isAllowedPromoUrl(draft.target_url)) {
      toast.error(text.invalidUrl);
      return false;
    }
    return true;
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error) {
      console.error("Promotional slide action failed", error);
      toast.error(error instanceof Error ? error.message : text.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 space-y-6" aria-label={text.title}>
      <header>
        <h2 className="font-serif text-3xl">{text.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{text.description}</p>
      </header>

      <div className="grid gap-3 border p-4 md:grid-cols-2">
        <PromoFields
          value={newSlide}
          text={text}
          disabled={busy}
          onChange={setNewSlide}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!validate(newSlide)) return;
            void run(async () => {
              await createPromoSlide({ ...newSlide, is_active: true });
              setNewSlide(EMPTY_DRAFT);
            }, text.added);
          }}
          className="inline-flex items-center justify-center gap-2 bg-navy px-4 py-2 text-sm text-navy-foreground disabled:opacity-50 md:col-span-2"
        >
          <Plus size={16} aria-hidden="true" />
          {text.add}
        </button>
      </div>

      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {text.loading}
        </p>
      )}
      {!loading && slides.length === 0 && (
        <p className="border p-6 text-muted-foreground">{text.empty}</p>
      )}
      <div className="space-y-4">
        {slides.map((slide) => (
          <article key={slide.id} className="space-y-4 border p-4">
            <PromoFields
              value={drafts[slide.id] ?? slide}
              text={text}
              disabled={busy}
              onChange={(value) => setDrafts((current) => ({ ...current, [slide.id]: value }))}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const draft = drafts[slide.id] ?? slide;
                  if (!validate(draft)) return;
                  void run(
                    () => updatePromoSlide(slide.id, draft),
                    text.saved,
                  );
                }}
                className="inline-flex items-center gap-2 border px-3 py-2 text-sm disabled:opacity-50"
              >
                <Save size={16} aria-hidden="true" />
                {text.save}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={slide.is_active}
                aria-label={slide.is_active ? text.deactivate : text.activate}
                disabled={busy}
                onClick={() =>
                  void run(
                    () => updatePromoSlide(slide.id, { is_active: !slide.is_active }),
                    slide.is_active ? text.deactivate : text.activate,
                  )
                }
                className="border px-3 py-2 text-sm disabled:opacity-50"
              >
                {slide.is_active ? text.deactivate : text.activate}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(text.confirmDelete))
                    void run(() => deletePromoSlide(slide.id), text.removed);
                }}
                className="inline-flex items-center gap-2 border px-3 py-2 text-sm text-destructive disabled:opacity-50"
              >
                <Trash2 size={16} aria-hidden="true" />
                {text.remove}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PromoFields({
  value,
  text,
  disabled,
  onChange,
}: {
  value: PromoDraft;
  text: (typeof COPY)["en"] | (typeof COPY)["ar"];
  disabled: boolean;
  onChange: (value: PromoDraft) => void;
}) {
  return (
    <>
      <label className="block space-y-2 text-sm">
        <span className="eyebrow">{text.english}</span>
        <input
          value={value.message_en}
          onChange={(event) => onChange({ ...value, message_en: event.target.value })}
          maxLength={180}
          disabled={disabled}
          className="w-full border bg-background px-3 py-2"
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span className="eyebrow">{text.arabic}</span>
        <input
          dir="rtl"
          value={value.message_ar}
          onChange={(event) => onChange({ ...value, message_ar: event.target.value })}
          maxLength={180}
          disabled={disabled}
          className="w-full border bg-background px-3 py-2"
        />
      </label>
      <label className="block space-y-2 text-sm md:col-span-2">
        <span className="eyebrow">{text.url}</span>
        <input
          dir="ltr"
          type="url"
          value={value.target_url}
          onChange={(event) => onChange({ ...value, target_url: event.target.value })}
          maxLength={2048}
          disabled={disabled}
          className="w-full border bg-background px-3 py-2"
        />
      </label>
    </>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_STOREFRONT_CONTENT,
  saveStorefrontContent,
  useSiteSettings,
  type StorefrontCategory,
  type StorefrontContent,
} from "@/lib/site-settings";

const COPY = {
  en: {
    title: "Homepage headings and collections",
    description:
      "Manage the circled homepage titles, collection links, and nested collection headings.",
    navigation: "Show collection navigation",
    customBundle: "Custom set link",
    customBundleTitle: "Custom set title",
    featured: "Featured collections section",
    eyebrow: "Small heading",
    featuredTitle: "Section title",
    showEyebrow: "Show small heading",
    showTitle: "Show section title",
    showAll: "Show the All filter",
    categories: "Collection headings",
    addCategory: "Add collection",
    addSubcategory: "Add subheading",
    placeholder: "Collection title",
    parent: "Add under a collection",
    rootOption: "Top-level collection",
    show: "Show",
    hide: "Hide",
    delete: "Delete",
    save: "Save homepage content",
    saving: "Saving...",
    saved: "Homepage content updated",
    error: "Could not save homepage content.",
    loadError: "Could not load homepage content.",
    duplicate: "A collection with this title already exists.",
    empty: "Enter a collection title first.",
  },
  ar: {
    title: "عناوين الصفحة الرئيسية والأقسام",
    description: "تحكم في العناوين المحددة وروابط الأقسام والعناوين الفرعية.",
    navigation: "إظهار روابط الأقسام",
    customBundle: "رابط إنشاء طقم مخصص",
    customBundleTitle: "عنوان الطقم المخصص",
    featured: "قسم المجموعات المميزة",
    eyebrow: "العنوان الصغير",
    featuredTitle: "عنوان القسم",
    showEyebrow: "إظهار العنوان الصغير",
    showTitle: "إظهار عنوان القسم",
    showAll: "إظهار مرشح الكل",
    categories: "عناوين الأقسام",
    addCategory: "إضافة قسم",
    addSubcategory: "إضافة عنوان فرعي",
    placeholder: "عنوان القسم",
    parent: "أضف داخل قسم",
    rootOption: "قسم رئيسي",
    show: "إظهار",
    hide: "إخفاء",
    delete: "حذف",
    save: "حفظ إعدادات الصفحة",
    saving: "جارٍ الحفظ...",
    saved: "تم تحديث محتوى الصفحة الرئيسية",
    error: "تعذر حفظ محتوى الصفحة الرئيسية.",
    loadError: "تعذر تحميل محتوى الصفحة الرئيسية.",
    duplicate: "يوجد قسم بهذا العنوان بالفعل.",
    empty: "أدخل عنوان القسم أولاً.",
  },
} as const;

export function StorefrontContentSettings({ isArabic }: { isArabic: boolean }) {
  const text = COPY[isArabic ? "ar" : "en"];
  const { settings, reload } = useSiteSettings();
  const [draft, setDraft] = useState<StorefrontContent>(DEFAULT_STOREFRONT_CONTENT);
  const [newTitle, setNewTitle] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setDraft(settings.storefront_content);
  }, [settings]);

  function update(patch: Partial<StorefrontContent>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateCategory(id: string, patch: Partial<StorefrontCategory>) {
    update({
      categories: draft.categories.map((category) =>
        category.id === id ? { ...category, ...patch } : category,
      ),
    });
  }

  function addCategory() {
    const label = newTitle.trim();
    if (!label) {
      toast.error(text.empty);
      return;
    }
    if (
      draft.categories.some(
        (category) => category.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
      )
    ) {
      toast.error(text.duplicate);
      return;
    }

    update({
      categories: [
        ...draft.categories,
        {
          id: crypto.randomUUID(),
          name: label,
          label,
          parentId: parentId || null,
          visible: true,
        },
      ],
    });
    setNewTitle("");
  }

  function deleteCategory(id: string) {
    update({
      categories: draft.categories.filter(
        (category) => category.id !== id && category.parentId !== id,
      ),
    });
    if (parentId === id) setParentId("");
  }

  async function save() {
    if (!settings) {
      toast.error(text.loadError);
      return;
    }
    setSaving(true);
    try {
      await saveStorefrontContent(draft);
      await reload();
      toast.success(text.saved);
    } catch (error) {
      console.error("Could not save homepage content", error);
      toast.error(error instanceof Error ? error.message : text.error);
    } finally {
      setSaving(false);
    }
  }

  const parents = draft.categories.filter((category) => category.parentId === null);

  return (
    <section
      className="space-y-5 border-b pb-6"
      aria-label={text.title}
      dir={isArabic ? "rtl" : "ltr"}
    >
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
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={draft.navVisible}
              onChange={(event) => update({ navVisible: event.target.checked })}
              className="accent-[var(--gold)]"
            />
            {text.navigation}
          </label>

          <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.customBundle.visible}
                onChange={(event) =>
                  update({
                    customBundle: { ...draft.customBundle, visible: event.target.checked },
                  })
                }
                className="accent-[var(--gold)]"
              />
              {text.customBundle}
            </label>
            <TextField
              label={text.customBundleTitle}
              value={draft.customBundle.title}
              onChange={(title) => update({ customBundle: { ...draft.customBundle, title } })}
            />
          </div>

          <div className="space-y-4 border-t pt-5">
            <h4 className="font-serif text-xl">{text.featured}</h4>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.featured.visible}
                onChange={(event) =>
                  update({ featured: { ...draft.featured, visible: event.target.checked } })
                }
                className="accent-[var(--gold)]"
              />
              {text.featured}
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label={text.eyebrow}
                value={draft.featured.eyebrow}
                onChange={(eyebrow) => update({ featured: { ...draft.featured, eyebrow } })}
              />
              <TextField
                label={text.featuredTitle}
                value={draft.featured.title}
                onChange={(title) => update({ featured: { ...draft.featured, title } })}
              />
            </div>
            <div className="flex flex-wrap gap-5">
              <CheckField
                label={text.showEyebrow}
                checked={draft.featured.eyebrowVisible}
                onChange={(eyebrowVisible) =>
                  update({ featured: { ...draft.featured, eyebrowVisible } })
                }
              />
              <CheckField
                label={text.showTitle}
                checked={draft.featured.titleVisible}
                onChange={(titleVisible) =>
                  update({ featured: { ...draft.featured, titleVisible } })
                }
              />
              <CheckField
                label={text.showAll}
                checked={draft.featured.showAllFilter}
                onChange={(showAllFilter) =>
                  update({ featured: { ...draft.featured, showAllFilter } })
                }
              />
            </div>
          </div>

          <div className="space-y-4 border-t pt-5">
            <h4 className="font-serif text-xl">{text.categories}</h4>
            <div className="space-y-3">
              {draft.categories.map((category) => (
                <div key={category.id} className="flex flex-wrap items-center gap-3 border p-3">
                  <input
                    aria-label={`${text.categories}: ${category.label}`}
                    value={category.label}
                    onChange={(event) => updateCategory(category.id, { label: event.target.value })}
                    className="min-w-40 flex-1 border bg-background px-3 py-2 text-sm"
                  />
                  {category.parentId && (
                    <span className="text-xs text-muted-foreground">
                      {parents.find((parent) => parent.id === category.parentId)?.label}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => updateCategory(category.id, { visible: !category.visible })}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {category.visible ? text.hide : text.show}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(category.id)}
                    className="text-sm text-destructive hover:underline"
                  >
                    {text.delete}
                  </button>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input
                aria-label={text.placeholder}
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder={text.placeholder}
                className="border bg-background px-3 py-2 text-sm"
              />
              <select
                aria-label={text.parent}
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                className="border bg-background px-3 py-2 text-sm"
              >
                <option value="">{text.rootOption}</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addCategory} className="btn-lux">
                {parentId ? text.addSubcategory : text.addCategory}
              </button>
            </div>
          </div>

          <button type="button" disabled={saving} onClick={() => void save()} className="btn-lux">
            {saving ? text.saving : text.save}
          </button>
        </>
      )}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border bg-background px-3 py-2"
      />
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[var(--gold)]"
      />
      {label}
    </label>
  );
}

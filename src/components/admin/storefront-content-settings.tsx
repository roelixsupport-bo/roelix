import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_STOREFRONT_CONTENT,
  saveStorefrontContent,
  useSiteSettings,
  type StorefrontCategory,
  type StorefrontContent,
} from "@/lib/site-settings";
import { isAllowedPromoUrl } from "@/lib/promo-slides";

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
    luxuryDesign: "Enable the luxury storefront design",
    footer: "Show the storefront footer",
    promoBanner: "Show the rotating announcement bar",
    heroSettings: "Hero banner",
    bundleBanner: "Bundle banner",
    categoryShowcase: "Shop by category",
    descriptionEn: "Description (English)",
    descriptionAr: "Description (Arabic)",
    ctaTextEn: "Button text (English)",
    ctaTextAr: "Button text (Arabic)",
    destination: "Destination URL",
    categoryImage: "Category image URL",
    socialLinks: "Social links",
    instagram: "Instagram URL",
    facebook: "Facebook URL",
    x: "X URL",
    productSections: "Homepage product lists",
    productSectionsDescription: "Create titled product lists linked to a collection.",
    productSectionTitleEn: "List title (English)",
    productSectionTitleAr: "List title (Arabic)",
    productSectionCategory: "Product collection",
    addProductSection: "Add product list",
    moveUp: "Move up",
    moveDown: "Move down",
    removeSection: "Remove list",
    sectionRequired: "Enter both titles and choose a collection.",
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
    luxuryDesign: "تفعيل التصميم الفاخر للمتجر",
    footer: "إظهار تذييل المتجر",
    promoBanner: "إظهار شريط الإعلانات المتحرك",
    heroSettings: "البانر الرئيسي",
    bundleBanner: "شريط الباقات",
    categoryShowcase: "تسوق حسب القسم",
    descriptionEn: "الوصف (بالإنجليزية)",
    descriptionAr: "الوصف (بالعربية)",
    ctaTextEn: "نص الزر (بالإنجليزية)",
    ctaTextAr: "نص الزر (بالعربية)",
    destination: "رابط الوجهة",
    categoryImage: "رابط صورة القسم",
    socialLinks: "روابط التواصل الاجتماعي",
    instagram: "رابط Instagram",
    facebook: "رابط Facebook",
    x: "رابط X",
    productSections: "قوائم منتجات الصفحة الرئيسية",
    productSectionsDescription: "أنشئ قوائم بعناوين مخصصة واربط كل قائمة بتصنيف منتجات.",
    productSectionTitleEn: "عنوان القائمة (بالإنجليزية)",
    productSectionTitleAr: "عنوان القائمة (بالعربية)",
    productSectionCategory: "تصنيف المنتجات",
    addProductSection: "إضافة قائمة منتجات",
    moveUp: "تحريك لأعلى",
    moveDown: "تحريك لأسفل",
    removeSection: "حذف القائمة",
    sectionRequired: "أدخل العنوانين واختر تصنيفًا.",
  },
} as const;

export function StorefrontContentSettings({ isArabic }: { isArabic: boolean }) {
  const text = COPY[isArabic ? "ar" : "en"];
  const { settings, reload } = useSiteSettings();
  const [draft, setDraft] = useState<StorefrontContent>(DEFAULT_STOREFRONT_CONTENT);
  const [newTitle, setNewTitle] = useState("");
  const [parentId, setParentId] = useState("");
  const [newSectionTitleEn, setNewSectionTitleEn] = useState("");
  const [newSectionTitleAr, setNewSectionTitleAr] = useState("");
  const [newSectionCategoryId, setNewSectionCategoryId] = useState("");
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
      deletedCategoryNames: draft.deletedCategoryNames.filter(
        (name) => name.toLocaleLowerCase() !== label.toLocaleLowerCase(),
      ),
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
    const deletedCategories = draft.categories.filter(
      (category) => category.id === id || category.parentId === id,
    );
    update({
      deletedCategoryNames: [
        ...new Set([
          ...draft.deletedCategoryNames,
          ...deletedCategories.flatMap((category) => [category.name, category.label]),
        ]),
      ],
      categories: draft.categories.filter(
        (category) => category.id !== id && category.parentId !== id,
      ),
    });
    if (parentId === id) setParentId("");
  }

  function addProductSection() {
    const titleEn = newSectionTitleEn.trim();
    const titleAr = newSectionTitleAr.trim();
    if (!titleEn || !titleAr || !newSectionCategoryId) {
      toast.error(text.sectionRequired);
      return;
    }

    update({
      productSections: [
        ...draft.productSections,
        {
          id: crypto.randomUUID(),
          title_en: titleEn,
          title_ar: titleAr,
          categoryId: newSectionCategoryId,
          visible: true,
        },
      ],
    });
    setNewSectionTitleEn("");
    setNewSectionTitleAr("");
  }

  function moveProductSection(id: string, direction: -1 | 1) {
    const index = draft.productSections.findIndex((section) => section.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= draft.productSections.length) return;

    const productSections = [...draft.productSections];
    const current = productSections[index];
    const next = productSections[nextIndex];
    if (!current || !next) return;
    productSections[index] = next;
    productSections[nextIndex] = current;
    update({ productSections });
  }

  async function save() {
    if (!settings) {
      toast.error(text.loadError);
      return;
    }
    if (!isAllowedPromoUrl(draft.hero.cta_url) || !isAllowedPromoUrl(draft.bundleBanner.cta_url)) {
      toast.error(
        isArabic
          ? "استخدمي رابطًا آمنًا يبدأ بـ https:// أو مسارًا محليًا."
          : "Use a secure https:// URL or a local path beginning with /.",
      );
      return;
    }
    if (
      draft.categories.some(
        (category) => category.imageUrl && !isAllowedPromoUrl(category.imageUrl),
      )
    ) {
      toast.error(
        isArabic
          ? "استخدمي رابط صورة آمنًا أو مسارًا محليًا يبدأ بـ /."
          : "Use a secure image URL or a local path beginning with /.",
      );
      return;
    }
    if (Object.values(draft.socialLinks).some((url) => url && !isAllowedPromoUrl(url))) {
      toast.error(
        isArabic
          ? "استخدمي روابط تواصل آمنة تبدأ بـ https://."
          : "Use secure social links beginning with https://.",
      );
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
          <CheckField
            label={text.promoBanner}
            checked={draft.promoBannerVisible}
            onChange={(promoBannerVisible) => update({ promoBannerVisible })}
          />
          <CheckField
            label={text.luxuryDesign}
            checked={draft.luxuryDesignEnabled}
            onChange={(luxuryDesignEnabled) => update({ luxuryDesignEnabled })}
          />
          <CheckField
            label={text.footer}
            checked={draft.footerVisible}
            onChange={(footerVisible) => update({ footerVisible })}
          />

          <div className="space-y-4 border-t pt-5">
            <h4 className="font-serif text-xl">{text.heroSettings}</h4>
            <CheckField
              label={text.heroSettings}
              checked={draft.hero.visible}
              onChange={(visible) => update({ hero: { ...draft.hero, visible } })}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label={text.featuredTitle}
                value={draft.hero.title_en}
                onChange={(title_en) => update({ hero: { ...draft.hero, title_en } })}
              />
              <TextField
                label={`${text.featuredTitle} (العربية)`}
                value={draft.hero.title_ar}
                onChange={(title_ar) => update({ hero: { ...draft.hero, title_ar } })}
              />
              <TextField
                label={text.descriptionEn}
                value={draft.hero.description_en}
                onChange={(description_en) => update({ hero: { ...draft.hero, description_en } })}
              />
              <TextField
                label={text.descriptionAr}
                value={draft.hero.description_ar}
                onChange={(description_ar) => update({ hero: { ...draft.hero, description_ar } })}
              />
              <TextField
                label={text.ctaTextEn}
                value={draft.hero.cta_text_en}
                onChange={(cta_text_en) => update({ hero: { ...draft.hero, cta_text_en } })}
              />
              <TextField
                label={text.ctaTextAr}
                value={draft.hero.cta_text_ar}
                onChange={(cta_text_ar) => update({ hero: { ...draft.hero, cta_text_ar } })}
              />
              <TextField
                label={text.destination}
                value={draft.hero.cta_url}
                onChange={(cta_url) => update({ hero: { ...draft.hero, cta_url } })}
              />
            </div>
          </div>

          <div className="space-y-4 border-t pt-5">
            <h4 className="font-serif text-xl">{text.bundleBanner}</h4>
            <CheckField
              label={text.bundleBanner}
              checked={draft.bundleBanner.visible}
              onChange={(visible) => update({ bundleBanner: { ...draft.bundleBanner, visible } })}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label={text.featuredTitle}
                value={draft.bundleBanner.title_en}
                onChange={(title_en) =>
                  update({ bundleBanner: { ...draft.bundleBanner, title_en } })
                }
              />
              <TextField
                label={`${text.featuredTitle} (العربية)`}
                value={draft.bundleBanner.title_ar}
                onChange={(title_ar) =>
                  update({ bundleBanner: { ...draft.bundleBanner, title_ar } })
                }
              />
              <TextField
                label={text.descriptionEn}
                value={draft.bundleBanner.description_en}
                onChange={(description_en) =>
                  update({ bundleBanner: { ...draft.bundleBanner, description_en } })
                }
              />
              <TextField
                label={text.descriptionAr}
                value={draft.bundleBanner.description_ar}
                onChange={(description_ar) =>
                  update({ bundleBanner: { ...draft.bundleBanner, description_ar } })
                }
              />
              <TextField
                label={text.ctaTextEn}
                value={draft.bundleBanner.cta_text_en}
                onChange={(cta_text_en) =>
                  update({ bundleBanner: { ...draft.bundleBanner, cta_text_en } })
                }
              />
              <TextField
                label={text.ctaTextAr}
                value={draft.bundleBanner.cta_text_ar}
                onChange={(cta_text_ar) =>
                  update({ bundleBanner: { ...draft.bundleBanner, cta_text_ar } })
                }
              />
              <TextField
                label={text.destination}
                value={draft.bundleBanner.cta_url}
                onChange={(cta_url) => update({ bundleBanner: { ...draft.bundleBanner, cta_url } })}
              />
            </div>
          </div>

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
            <div>
              <h4 className="font-serif text-xl">{text.productSections}</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {text.productSectionsDescription}
              </p>
            </div>
            <div className="space-y-3">
              {draft.productSections.map((section, index) => (
                <div key={section.id} className="space-y-3 border p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label={text.productSectionTitleEn}
                      value={section.title_en}
                      onChange={(title_en) =>
                        update({
                          productSections: draft.productSections.map((item) =>
                            item.id === section.id ? { ...item, title_en } : item,
                          ),
                        })
                      }
                    />
                    <TextField
                      label={text.productSectionTitleAr}
                      value={section.title_ar}
                      onChange={(title_ar) =>
                        update({
                          productSections: draft.productSections.map((item) =>
                            item.id === section.id ? { ...item, title_ar } : item,
                          ),
                        })
                      }
                    />
                    <label className="block space-y-2 text-sm sm:col-span-2">
                      <span>{text.productSectionCategory}</span>
                      <select
                        aria-label={`${text.productSectionCategory}: ${section.title_en}`}
                        value={section.categoryId}
                        onChange={(event) =>
                          update({
                            productSections: draft.productSections.map((item) =>
                              item.id === section.id
                                ? { ...item, categoryId: event.target.value }
                                : item,
                            ),
                          })
                        }
                        className="w-full border bg-background px-3 py-2"
                      >
                        {draft.categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <CheckField
                      label={text.show}
                      checked={section.visible}
                      onChange={(visible) =>
                        update({
                          productSections: draft.productSections.map((item) =>
                            item.id === section.id ? { ...item, visible } : item,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label={`${text.moveUp}: ${section.title_en}`}
                      disabled={index === 0}
                      onClick={() => moveProductSection(section.id, -1)}
                      className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      {text.moveUp}
                    </button>
                    <button
                      type="button"
                      aria-label={`${text.moveDown}: ${section.title_en}`}
                      disabled={index === draft.productSections.length - 1}
                      onClick={() => moveProductSection(section.id, 1)}
                      className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      {text.moveDown}
                    </button>
                    <button
                      type="button"
                      aria-label={`${text.removeSection}: ${section.title_en}`}
                      onClick={() =>
                        update({
                          productSections: draft.productSections.filter(
                            (item) => item.id !== section.id,
                          ),
                        })
                      }
                      className="text-sm text-destructive hover:underline"
                    >
                      {text.removeSection}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {draft.categories.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  aria-label={text.productSectionTitleEn}
                  value={newSectionTitleEn}
                  onChange={(event) => setNewSectionTitleEn(event.target.value)}
                  placeholder={text.productSectionTitleEn}
                  className="border bg-background px-3 py-2 text-sm"
                />
                <input
                  aria-label={text.productSectionTitleAr}
                  value={newSectionTitleAr}
                  onChange={(event) => setNewSectionTitleAr(event.target.value)}
                  placeholder={text.productSectionTitleAr}
                  className="border bg-background px-3 py-2 text-sm"
                />
                <select
                  aria-label={text.productSectionCategory}
                  value={newSectionCategoryId}
                  onChange={(event) => setNewSectionCategoryId(event.target.value)}
                  className="border bg-background px-3 py-2 text-sm"
                >
                  <option value="">{text.productSectionCategory}</option>
                  {draft.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addProductSection} className="btn-lux sm:col-span-3">
                  {text.addProductSection}
                </button>
              </div>
            )}
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
            <h4 className="font-serif text-xl">{text.categoryShowcase}</h4>
            <CheckField
              label={text.categoryShowcase}
              checked={draft.categoryShowcase.visible}
              onChange={(visible) =>
                update({ categoryShowcase: { ...draft.categoryShowcase, visible } })
              }
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label={text.featuredTitle}
                value={draft.categoryShowcase.title_en}
                onChange={(title_en) =>
                  update({ categoryShowcase: { ...draft.categoryShowcase, title_en } })
                }
              />
              <TextField
                label={`${text.featuredTitle} (العربية)`}
                value={draft.categoryShowcase.title_ar}
                onChange={(title_ar) =>
                  update({ categoryShowcase: { ...draft.categoryShowcase, title_ar } })
                }
              />
            </div>
            <h4 className="pt-3 font-serif text-xl">{text.categories}</h4>
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                label={text.instagram}
                value={draft.socialLinks.instagram}
                onChange={(instagram) =>
                  update({ socialLinks: { ...draft.socialLinks, instagram } })
                }
              />
              <TextField
                label={text.facebook}
                value={draft.socialLinks.facebook}
                onChange={(facebook) => update({ socialLinks: { ...draft.socialLinks, facebook } })}
              />
              <TextField
                label={text.x}
                value={draft.socialLinks.x}
                onChange={(x) => update({ socialLinks: { ...draft.socialLinks, x } })}
              />
            </div>
            <div className="space-y-3">
              {draft.categories.map((category) => (
                <div key={category.id} className="flex flex-wrap items-center gap-3 border p-3">
                  <input
                    aria-label={`${text.categories}: ${category.label}`}
                    value={category.label}
                    onChange={(event) => updateCategory(category.id, { label: event.target.value })}
                    className="min-w-40 flex-1 border bg-background px-3 py-2 text-sm"
                  />
                  <input
                    aria-label={`${text.categoryImage}: ${category.label}`}
                    value={category.imageUrl ?? ""}
                    onChange={(event) =>
                      updateCategory(category.id, { imageUrl: event.target.value })
                    }
                    placeholder={text.categoryImage}
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

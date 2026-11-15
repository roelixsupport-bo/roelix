import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CATEGORIES } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export const SITE_BRANDING_BUCKET = "site-branding";
export const SITE_BRANDING_MAX_BYTES = 5 * 1024 * 1024;
export const SITE_BRANDING_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SITE_SETTINGS_CHANGED_EVENT = "roelix-site-settings-changed";

export type StorefrontCategory = {
  id: string;
  name: string;
  label: string;
  parentId: string | null;
  visible: boolean;
  imageUrl?: string;
};

export type StorefrontProductSection = {
  id: string;
  title_en: string;
  title_ar: string;
  categoryId: string;
  visible: boolean;
};

export type StorefrontHeroContent = {
  visible: boolean;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  cta_text_en: string;
  cta_text_ar: string;
  cta_url: string;
};

export type StorefrontBundleBanner = {
  visible: boolean;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  cta_text_en: string;
  cta_text_ar: string;
  cta_url: string;
};

export type StorefrontContent = {
  navVisible: boolean;
  promoBannerVisible: boolean;
  luxuryDesignEnabled: boolean;
  footerVisible: boolean;
  hero: StorefrontHeroContent;
  bundleBanner: StorefrontBundleBanner;
  categoryShowcase: {
    visible: boolean;
    title_en: string;
    title_ar: string;
  };
  socialLinks: {
    instagram: string;
    facebook: string;
    x: string;
  };
  customBundle: { visible: boolean; title: string };
  featured: {
    visible: boolean;
    eyebrowVisible: boolean;
    eyebrow: string;
    titleVisible: boolean;
    title: string;
    showAllFilter: boolean;
  };
  deletedCategoryNames: string[];
  categories: StorefrontCategory[];
  productSections: StorefrontProductSection[];
};

export const DEFAULT_STOREFRONT_CONTENT: StorefrontContent = {
  navVisible: true,
  promoBannerVisible: true,
  luxuryDesignEnabled: true,
  footerVisible: true,
  hero: {
    visible: true,
    title_en: "Rest, Refined",
    title_ar: "راحة تليق بك",
    description_en: "Thoughtfully crafted Egyptian cotton for the art of living well.",
    description_ar: "قطن مصري فاخر صُمم بعناية لتجربة معيشة أكثر رقيًا.",
    cta_text_en: "Shop now",
    cta_text_ar: "تسوق الآن",
    cta_url: "/shop",
  },
  bundleBanner: {
    visible: true,
    title_en: "Bundle & Save",
    title_ar: "نسّق طقمك ووفر",
    description_en: "Thoughtful bundles for a more beautiful bedroom.",
    description_ar: "باقات منسقة بعناية لغرفة نوم أكثر جمالًا.",
    cta_text_en: "Shop bundles",
    cta_text_ar: "تسوق الأطقم",
    cta_url: "/custom-bundle",
  },
  categoryShowcase: {
    visible: true,
    title_en: "Shop by category",
    title_ar: "تسوق حسب القسم",
  },
  socialLinks: { instagram: "", facebook: "", x: "" },
  customBundle: { visible: true, title: "Build a Custom Set" },
  featured: {
    visible: true,
    eyebrowVisible: true,
    eyebrow: "Curated",
    titleVisible: true,
    title: "Featured Collections",
    showAllFilter: true,
  },
  deletedCategoryNames: [],
  productSections: [],
  categories: CATEGORIES.map((name) => ({
    id: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    name,
    label: name,
    parentId: null,
    visible: true,
  })),
};

export type SiteSettings = {
  logo_url: string | null;
  favicon_url: string | null;
  storefront_content: StorefrontContent;
  updated_at: string;
};

type SiteSettingsContextValue = {
  settings: SiteSettings | null;
  reload: () => Promise<void>;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("logo_url, favicon_url, storefront_content, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;

    const next = data
      ? {
          logo_url: data.logo_url,
          favicon_url: data.favicon_url,
          storefront_content: normalizeStorefrontContent(data.storefront_content),
          updated_at: data.updated_at,
        }
      : null;
    setSettings(next);
    if (typeof document !== "undefined")
      updateFaviconLinks(next?.favicon_url ?? FALLBACK_FAVICON_URL, next?.updated_at ?? "default");
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await reload();
      } catch (error) {
        console.error("Could not load public site branding settings", error);
      }
    };
    const onChanged = () => {
      if (active) void load();
    };

    void load();
    window.addEventListener(SITE_SETTINGS_CHANGED_EVENT, onChanged);
    return () => {
      active = false;
      window.removeEventListener(SITE_SETTINGS_CHANGED_EVENT, onChanged);
    };
  }, [reload]);

  return (
    <SiteSettingsContext.Provider value={{ settings, reload }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): SiteSettingsContextValue {
  const value = useContext(SiteSettingsContext);
  if (!value) throw new Error("useSiteSettings must be used within SiteSettingsProvider.");
  return value;
}

export function updateFaviconLinks(faviconUrl: string, version: string): void {
  const href = faviconUrl.startsWith("data:")
    ? faviconUrl
    : faviconUrl.startsWith("/")
      ? `${faviconUrl}${faviconUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`
      : withCacheVersion(faviconUrl, version);
  for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
    let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.append(link);
    }
    link.href = href;
    if (rel !== "apple-touch-icon") link.type = imageMimeType(faviconUrl);
  }
}

const FALLBACK_FAVICON_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/%3E";

function withCacheVersion(url: string, version: string): string {
  const parsed = new URL(url, window.location.origin);
  parsed.searchParams.set("v", version);
  return parsed.href;
}

function imageMimeType(url: string): string {
  if (url.startsWith("data:image/svg+xml")) return "image/svg+xml";
  const pathname = new URL(url, window.location.origin).pathname.toLowerCase();
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

export function validateBrandingImage(file: File): string | null {
  if (!(SITE_BRANDING_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a PNG, JPG or WebP image.";
  }
  if (file.size === 0) return "The selected image is empty.";
  if (file.size > SITE_BRANDING_MAX_BYTES) return "Choose an image smaller than 5 MB.";
  return null;
}

export async function uploadBrandingImage(file: File, kind: "logo" | "favicon"): Promise<string> {
  const validationError = validateBrandingImage(file);
  if (validationError) throw new Error(validationError);

  const extension = file.type === "image/jpeg" ? "jpg" : file.type.slice("image/".length);
  const path = `${kind}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(SITE_BRANDING_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(SITE_BRANDING_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) throw new Error("Supabase did not return a public image URL.");
  return data.publicUrl;
}

export async function saveSiteSettings(settings: {
  logo_url: string | null;
  favicon_url: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ id: 1, ...settings, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
  window.dispatchEvent(new Event(SITE_SETTINGS_CHANGED_EVENT));
}

export async function saveStorefrontContent(content: StorefrontContent): Promise<void> {
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { id: 1, storefront_content: content, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) throw error;
  window.dispatchEvent(new Event(SITE_SETTINGS_CHANGED_EVENT));
}

function normalizeStorefrontContent(value: unknown): StorefrontContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_STOREFRONT_CONTENT;
  }

  const content = value as Partial<StorefrontContent>;
  const featured = content.featured;
  const customBundle = content.customBundle;
  const deletedCategoryNames = Array.isArray(content.deletedCategoryNames)
    ? content.deletedCategoryNames.filter((name): name is string => typeof name === "string")
    : [];
  const hero = content.hero && typeof content.hero === "object" ? content.hero : undefined;
  const bundleBanner =
    content.bundleBanner && typeof content.bundleBanner === "object"
      ? content.bundleBanner
      : undefined;
  const categoryShowcase =
    content.categoryShowcase && typeof content.categoryShowcase === "object"
      ? content.categoryShowcase
      : undefined;
  const socialLinks =
    content.socialLinks && typeof content.socialLinks === "object"
      ? content.socialLinks
      : undefined;
  const categories = Array.isArray(content.categories)
    ? content.categories
        .filter(
          (category): category is StorefrontCategory =>
            typeof category?.id === "string" &&
            typeof category.name === "string" &&
            (typeof category.label === "string" || category.label === undefined) &&
            (category.parentId === null || typeof category.parentId === "string") &&
            typeof category.visible === "boolean",
        )
        .map((category) => ({
          ...category,
          label: category.label ?? category.name,
          imageUrl: typeof category.imageUrl === "string" ? category.imageUrl : "",
        }))
    : DEFAULT_STOREFRONT_CONTENT.categories;
  const productSections = Array.isArray(content.productSections)
    ? content.productSections.filter(
        (section): section is StorefrontProductSection =>
          typeof section?.id === "string" &&
          typeof section.title_en === "string" &&
          typeof section.title_ar === "string" &&
          typeof section.categoryId === "string" &&
          typeof section.visible === "boolean",
      )
    : DEFAULT_STOREFRONT_CONTENT.productSections;

  return {
    navVisible: typeof content.navVisible === "boolean" ? content.navVisible : true,
    promoBannerVisible:
      typeof content.promoBannerVisible === "boolean" ? content.promoBannerVisible : true,
    luxuryDesignEnabled:
      typeof content.luxuryDesignEnabled === "boolean" ? content.luxuryDesignEnabled : true,
    footerVisible: typeof content.footerVisible === "boolean" ? content.footerVisible : true,
    hero: {
      visible: typeof hero?.visible === "boolean" ? hero.visible : true,
      title_en: textOrDefault(hero?.title_en, DEFAULT_STOREFRONT_CONTENT.hero.title_en),
      title_ar: textOrDefault(hero?.title_ar, DEFAULT_STOREFRONT_CONTENT.hero.title_ar),
      description_en: textOrDefault(
        hero?.description_en,
        DEFAULT_STOREFRONT_CONTENT.hero.description_en,
      ),
      description_ar: textOrDefault(
        hero?.description_ar,
        DEFAULT_STOREFRONT_CONTENT.hero.description_ar,
      ),
      cta_text_en: textOrDefault(hero?.cta_text_en, DEFAULT_STOREFRONT_CONTENT.hero.cta_text_en),
      cta_text_ar: textOrDefault(hero?.cta_text_ar, DEFAULT_STOREFRONT_CONTENT.hero.cta_text_ar),
      cta_url: textOrDefault(hero?.cta_url, DEFAULT_STOREFRONT_CONTENT.hero.cta_url),
    },
    bundleBanner: {
      visible: typeof bundleBanner?.visible === "boolean" ? bundleBanner.visible : true,
      title_en: textOrDefault(
        bundleBanner?.title_en,
        DEFAULT_STOREFRONT_CONTENT.bundleBanner.title_en,
      ),
      title_ar: textOrDefault(
        bundleBanner?.title_ar,
        DEFAULT_STOREFRONT_CONTENT.bundleBanner.title_ar,
      ),
      description_en: textOrDefault(
        bundleBanner?.description_en,
        DEFAULT_STOREFRONT_CONTENT.bundleBanner.description_en,
      ),
      description_ar: textOrDefault(
        bundleBanner?.description_ar,
        DEFAULT_STOREFRONT_CONTENT.bundleBanner.description_ar,
      ),
      cta_text_en: textOrDefault(
        bundleBanner?.cta_text_en,
        DEFAULT_STOREFRONT_CONTENT.bundleBanner.cta_text_en,
      ),
      cta_text_ar: textOrDefault(
        bundleBanner?.cta_text_ar,
        DEFAULT_STOREFRONT_CONTENT.bundleBanner.cta_text_ar,
      ),
      cta_url: textOrDefault(
        bundleBanner?.cta_url,
        DEFAULT_STOREFRONT_CONTENT.bundleBanner.cta_url,
      ),
    },
    categoryShowcase: {
      visible: typeof categoryShowcase?.visible === "boolean" ? categoryShowcase.visible : true,
      title_en: textOrDefault(
        categoryShowcase?.title_en,
        DEFAULT_STOREFRONT_CONTENT.categoryShowcase.title_en,
      ),
      title_ar: textOrDefault(
        categoryShowcase?.title_ar,
        DEFAULT_STOREFRONT_CONTENT.categoryShowcase.title_ar,
      ),
    },
    socialLinks: {
      instagram: textOrDefault(socialLinks?.instagram, ""),
      facebook: textOrDefault(socialLinks?.facebook, ""),
      x: textOrDefault(socialLinks?.x, ""),
    },
    customBundle: {
      visible: typeof customBundle?.visible === "boolean" ? customBundle.visible : true,
      title:
        typeof customBundle?.title === "string"
          ? customBundle.title
          : DEFAULT_STOREFRONT_CONTENT.customBundle.title,
    },
    featured: {
      visible: typeof featured?.visible === "boolean" ? featured.visible : true,
      eyebrowVisible:
        typeof featured?.eyebrowVisible === "boolean" ? featured.eyebrowVisible : true,
      eyebrow:
        typeof featured?.eyebrow === "string"
          ? featured.eyebrow
          : DEFAULT_STOREFRONT_CONTENT.featured.eyebrow,
      titleVisible: typeof featured?.titleVisible === "boolean" ? featured.titleVisible : true,
      title:
        typeof featured?.title === "string"
          ? featured.title
          : DEFAULT_STOREFRONT_CONTENT.featured.title,
      showAllFilter: typeof featured?.showAllFilter === "boolean" ? featured.showAllFilter : true,
    },
    deletedCategoryNames,
    categories,
    productSections,
  };
}

function textOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

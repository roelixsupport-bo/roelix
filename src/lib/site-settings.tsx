import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export const SITE_BRANDING_BUCKET = "site-branding";
export const SITE_BRANDING_MAX_BYTES = 5 * 1024 * 1024;
export const SITE_BRANDING_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SITE_SETTINGS_CHANGED_EVENT = "roelix-site-settings-changed";

export type SiteSettings = {
  logo_url: string | null;
  favicon_url: string | null;
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
      .select("logo_url, favicon_url, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;

    const next = data
      ? {
          logo_url: data.logo_url,
          favicon_url: data.favicon_url,
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

import type { Language } from "@/lib/store";

/**
 * The sign-in address register behind `public.customers`.
 *
 * The storefront asks for an email before it knows whether the visitor has an
 * account, so the address is stored on its own — independent of an auth user —
 * and joined to `public.profiles` once the customer authenticates. Everything
 * here is pure so the mapping and the admin filtering can be unit tested
 * without Supabase.
 */

export type CustomerEmailSource = "signin_modal" | "checkout" | "footer" | "admin";

export type CustomerEmail = {
  id: string;
  email: string;
  marketingOptIn: boolean;
  source: string;
  signInCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Set once the address belongs to an authenticated account. */
  userId: string | null;
  notes: string | null;
};

/** Columns every read of `customers` asks for, kept in one place. */
export const CUSTOMER_EMAIL_COLUMNS =
  "id,email,marketing_opt_in,source,sign_in_count,first_seen_at,last_seen_at,user_id,notes";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lower-cased and trimmed — the exact form the database stores. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}

function readCount(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Maps one `public.customers` row, or null when it cannot identify an address.
 *
 * A row without a readable `last_seen_at` keeps `first_seen_at` so it still
 * sorts with the register instead of vanishing from the dashboard.
 */
export function customerEmailFromRecord(value: unknown): CustomerEmail | null {
  if (!isRecord(value)) return null;

  const id = readText(value, "id");
  const email = readText(value, "email");
  const firstSeenAt = readText(value, "first_seen_at", "firstSeenAt");
  if (!id || !email || !firstSeenAt) return null;

  const notes = readText(value, "notes");
  const userId = readText(value, "user_id", "userId");

  return {
    id,
    email,
    marketingOptIn: value["marketing_opt_in"] === true || value["marketingOptIn"] === true,
    source: readText(value, "source") || "signin_modal",
    signInCount: readCount(value, "sign_in_count"),
    firstSeenAt,
    lastSeenAt: readText(value, "last_seen_at", "lastSeenAt") || firstSeenAt,
    userId: userId || null,
    notes: notes || null,
  };
}

export function customerEmailsFromRecords(value: unknown): CustomerEmail[] {
  if (!Array.isArray(value)) return [];
  return value.map(customerEmailFromRecord).filter((row): row is CustomerEmail => row !== null);
}

/** Newest activity first — what the admin register reads as "most recent". */
export function sortCustomerEmails(rows: CustomerEmail[]): CustomerEmail[] {
  return [...rows].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/** Search across the address, its source and the join status. */
export function filterCustomerEmails(rows: CustomerEmail[], query: string): CustomerEmail[] {
  const needle = normalizeEmail(query);
  if (needle === "") return rows;

  return rows.filter((row) =>
    `${row.email} ${row.source} ${row.userId ? "account" : "not linked"}`
      .toLowerCase()
      .includes(needle),
  );
}

export function customerEmailStats(rows: CustomerEmail[]): {
  total: number;
  marketing: number;
  linked: number;
} {
  return {
    total: rows.length,
    marketing: rows.filter((row) => row.marketingOptIn).length,
    linked: rows.filter((row) => row.userId !== null).length,
  };
}

const SOURCE_LABELS: Record<Language, Record<string, string>> = {
  en: {
    signin_modal: "Sign-in modal",
    checkout: "Checkout",
    footer: "Footer newsletter",
    admin: "Added by the team",
  },
  ar: {
    signin_modal: "نافذة تسجيل الدخول",
    checkout: "إتمام الطلب",
    footer: "نشرة الموقع",
    admin: "إضافة الفريق",
  },
};

/** A readable origin for the admin row; unknown values are printed as-is. */
export function customerEmailSourceLabel(source: string, lang: Language = "en"): string {
  return SOURCE_LABELS[lang][source] ?? source;
}

/** "01 Nov 2026" — the last time this address was submitted or used. */
export function customerEmailSeenLabel(iso: string, lang: Language = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

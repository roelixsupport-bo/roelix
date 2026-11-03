import type { Language } from "@/lib/store";

/**
 * Customer accounts: the shape of a `public.profiles` row, plus the pure helpers
 * that the account UI and the admin register share.
 *
 * Nothing in this module touches the network or React, so every rule the
 * storefront enforces (what counts as a usable profile, which status a row
 * carries, how a Supabase auth failure is worded) can be unit tested directly.
 */

export type AccountRole = "customer" | "admin" | "staff";

/** What the admin register prints at the end of a row. */
export type AccountStatus = "active" | "unconfirmed" | "staff" | "admin";

export type AuthMode = "signin" | "register";

export type CustomerFilter = "all" | "customers" | "team";

export type AuthField = "fullName" | "email" | "password" | "confirmPassword";

/** A validation failure, kept as a key so the dialog can localise it. */
export type AuthFieldIssue =
  | "nameRequired"
  | "emailRequired"
  | "emailInvalid"
  | "passwordShort"
  | "passwordMismatch";

export type AuthFieldIssues = Partial<Record<AuthField, AuthFieldIssue>>;

export type CustomerProfile = {
  id: string;
  email: string;
  fullName: string;
  role: AccountRole;
  marketingOptIn: boolean;
  /** Registration timestamp (ISO). */
  createdAt: string;
  /** Set once Supabase confirms the address; drives the "Unconfirmed" status. */
  confirmedAt: string | null;
  /** Best effort, refreshed by the `touch_roelix_session` RPC on sign in. */
  lastSeenAt: string | null;
};

/** The columns every read of `profiles` asks for, kept in one place. */
export const PROFILE_COLUMNS =
  "id,email,role,full_name,marketing_opt_in,created_at,email_confirmed_at,last_sign_in_at";

export const PASSWORD_MIN_LENGTH = 8;

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

function readTimestamp(record: Record<string, unknown>, ...keys: string[]): string | null {
  const value = readText(record, ...keys);
  return value === "" ? null : value;
}

function readRole(value: unknown): AccountRole {
  return value === "admin" || value === "staff" ? value : "customer";
}

/**
 * Maps one `public.profiles` row, or null when the row cannot identify anyone.
 *
 * An unknown role folds to `customer`: a missing or unexpected role must never
 * read as staff access anywhere in the UI.
 */
export function profileFromRecord(value: unknown): CustomerProfile | null {
  if (!isRecord(value)) return null;

  const id = readText(value, "id");
  const email = readText(value, "email");
  const createdAt = readTimestamp(value, "created_at", "createdAt");
  if (!id || !email || !createdAt) return null;

  return {
    id,
    email,
    fullName: readText(value, "full_name", "fullName"),
    role: readRole(value["role"]),
    marketingOptIn: value["marketing_opt_in"] === true,
    createdAt,
    confirmedAt: readTimestamp(value, "email_confirmed_at", "confirmedAt"),
    lastSeenAt: readTimestamp(value, "last_sign_in_at", "lastSeenAt"),
  };
}

export function profilesFromRecords(value: unknown): CustomerProfile[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(profileFromRecord)
    .filter((profile): profile is CustomerProfile => profile !== null);
}

/** Two letters for the identity tile, e.g. "NS" or "RO". */
export function initialsFor(input: { fullName?: string; email?: string }): string {
  const name = (input.fullName ?? "").trim();
  if (name) {
    const words = name.split(/\s+/).filter(Boolean);
    const letters = words.slice(0, 2).map((word) => [...word][0] ?? "");
    const initials = letters.join("");
    if (initials) return initials.toLocaleUpperCase();
  }

  const local = (input.email ?? "").split("@")[0] ?? "";
  const letters = [...local.replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 2).join("");
  return letters.toLocaleUpperCase() || "RO";
}

export function displayNameFor(
  profile: CustomerProfile | null,
  fallbackEmail = "",
): string {
  const name = profile?.fullName.trim();
  if (name) return name;
  return profile?.email || fallbackEmail || "ROELIX";
}

export function isTeamRole(role: AccountRole): boolean {
  return role === "admin" || role === "staff";
}

export function accountStatus(profile: CustomerProfile): AccountStatus {
  if (profile.role === "admin") return "admin";
  if (profile.role === "staff") return "staff";
  return profile.confirmedAt ? "active" : "unconfirmed";
}

// --- Validation -------------------------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Field-level rules for both leaves of the auth card. Passwords are never trimmed. */
export function validateAuthForm(
  mode: AuthMode,
  values: Partial<Record<AuthField, string>>,
): AuthFieldIssues {
  const issues: AuthFieldIssues = {};
  const email = (values.email ?? "").trim();
  const password = values.password ?? "";

  if (mode === "register" && (values.fullName ?? "").trim() === "") {
    issues.fullName = "nameRequired";
  }

  if (email === "") issues.email = "emailRequired";
  else if (!EMAIL_PATTERN.test(email)) issues.email = "emailInvalid";

  if (password.length < PASSWORD_MIN_LENGTH) issues.password = "passwordShort";

  if (mode === "register" && password !== (values.confirmPassword ?? "")) {
    issues.confirmPassword = "passwordMismatch";
  }

  return issues;
}

export function hasIssues(issues: AuthFieldIssues): boolean {
  return Object.keys(issues).length > 0;
}

// --- Auth error wording -----------------------------------------------------

export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "alreadyExists"
  | "weakPassword"
  | "invalidEmail"
  | "rateLimited"
  | "signupDisabled"
  | "notConfigured";

const AUTH_ERROR_COPY: Record<Language, Record<AuthErrorKey, string>> = {
  en: {
    invalidCredentials: "That email and password do not match an account.",
    emailNotConfirmed: "Confirm your email address before signing in.",
    alreadyExists: "An account already exists for that email. Sign in instead.",
    weakPassword: "Passwords must be at least 8 characters.",
    invalidEmail: "Enter a valid email address.",
    rateLimited: "Too many attempts. Try again in a few minutes.",
    signupDisabled: "New registrations are closed on this deployment.",
    notConfigured: "Accounts are not configured on this deployment.",
  },
  ar: {
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    emailNotConfirmed: "أكّد بريدك الإلكتروني قبل تسجيل الدخول.",
    alreadyExists: "يوجد حساب بهذا البريد بالفعل. سجّل الدخول بدلاً من ذلك.",
    weakPassword: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
    invalidEmail: "أدخل بريداً إلكترونياً صحيحاً.",
    rateLimited: "محاولات كثيرة. أعد المحاولة بعد دقائق.",
    signupDisabled: "التسجيل الجديد مغلق على هذا النشر.",
    notConfigured: "الحسابات غير مُهيّأة على هذا النشر.",
  },
};

/** Which known failure a Supabase auth error is, or null when it is unfamiliar. */
export function authErrorKey(error: unknown): AuthErrorKey | null {
  const record = isRecord(error) ? error : {};
  const code = typeof record["code"] === "string" ? record["code"].toLowerCase() : "";
  const message = (
    typeof record["message"] === "string"
      ? record["message"]
      : error instanceof Error
        ? error.message
        : ""
  ).toLowerCase();

  if (code === "invalid_credentials" || /invalid login credentials|invalid credentials/.test(message)) {
    return "invalidCredentials";
  }
  if (code === "email_not_confirmed" || /email not confirmed/.test(message)) {
    return "emailNotConfirmed";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    /already registered|already exists|user already registered/.test(message)
  ) {
    return "alreadyExists";
  }
  if (code === "weak_password" || /password should be at least|weak password/.test(message)) {
    return "weakPassword";
  }
  if (
    code === "email_address_invalid" ||
    code === "validation_failed" ||
    /invalid email|unable to validate email/.test(message)
  ) {
    return "invalidEmail";
  }
  if (code.includes("rate_limit") || /rate limit|too many requests/.test(message)) {
    return "rateLimited";
  }
  if (code === "signup_disabled" || /signups? (are )?disabled/.test(message)) {
    return "signupDisabled";
  }
  return null;
}

/**
 * What to show the customer for a failed auth call.
 *
 * Known codes get a sentence they can act on; anything else keeps the exact
 * Supabase message rather than hiding it behind "something went wrong".
 */
export function authErrorMessage(error: unknown, lang: Language = "en"): string {
  const key = authErrorKey(error);
  if (key) return AUTH_ERROR_COPY[lang][key];

  if (typeof error === "string" && error.trim() !== "") return error.trim();
  if (isRecord(error) && typeof error["message"] === "string" && error["message"].trim() !== "") {
    return error["message"].trim();
  }
  if (error instanceof Error && error.message.trim() !== "") return error.message.trim();
  return lang === "ar" ? "تعذر إتمام الطلب." : "The request could not be completed.";
}

// --- Emailed one-time codes -------------------------------------------------

/**
 * The token kinds Supabase accepts for a six-digit code sent by email, most
 * common first.
 *
 * `signInWithOtp` writes a `magiclink` token for an address that already exists
 * and a `signup` token when the visitor is new, while current GoTrue also
 * accepts both under `email`. No single type is right for every visitor, so the
 * card tries them in order instead of betting on one.
 */
export const EMAIL_OTP_TYPES = ["email", "signup", "magiclink"] as const;

export type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export const OTP_CODE_LENGTH = 6;

/** Digits only — what the code field accepts and what `verifyOtp` expects. */
export function normalizeOtpCode(code: string): string {
  return code.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);
}

export function isCompleteOtpCode(code: string): boolean {
  return normalizeOtpCode(code).length === OTP_CODE_LENGTH;
}

/**
 * Whether a rejected code is worth retrying as a different token kind.
 *
 * A wrong kind and a wrong code both answer "Token has expired or is invalid",
 * so those are retried. A rate limit or a network failure is not fixed by
 * changing the kind and would spend another attempt, so the chain stops.
 */
export function shouldRetryOtpType(error: unknown): boolean {
  const record = isRecord(error) ? error : {};
  const code = (typeof record["code"] === "string" ? record["code"] : "").toLowerCase();
  const message = (
    typeof record["message"] === "string"
      ? record["message"]
      : error instanceof Error
        ? error.message
        : ""
  ).toLowerCase();

  if (
    record["status"] === 429 ||
    code.includes("rate_limit") ||
    /rate limit|too many requests|failed to fetch|network error/.test(message)
  ) {
    return false;
  }

  return (
    code === "otp_expired" ||
    /token has expired or is invalid|invalid (one-time )?token|token.*not found/.test(message)
  );
}

export type OtpVerificationOutcome<T> =
  | { ok: true; data: T; type: EmailOtpType }
  | { ok: false; error: unknown };

/**
 * Verifies a code with each token kind until one is accepted.
 *
 * `verify` is the Supabase call itself, injected so the ordering, the stop rule
 * and the error that reaches the customer can be tested without a network.
 */
export async function verifyEmailOtp<T>(
  verify: (type: EmailOtpType) => Promise<{ data: T | null; error: unknown }>,
): Promise<OtpVerificationOutcome<T>> {
  let lastError: unknown = null;

  for (const type of EMAIL_OTP_TYPES) {
    const { data, error } = await verify(type);

    if (!error && data) return { ok: true, data, type };
    if (error && !shouldRetryOtpType(error)) return { ok: false, error };

    lastError = error ?? new Error("The sign-in code was not accepted.");
  }

  return { ok: false, error: lastError };
}

// --- Dates and grouping -----------------------------------------------------

function localeFor(lang: Language): string {
  return lang === "ar" ? "ar-EG" : "en-GB";
}

function parseDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "October 2026" — the divider in the admin register. */
export function joinMonthLabel(iso: string, lang: Language): string {
  const date = parseDate(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat(localeFor(lang), { month: "long", year: "numeric" }).format(date);
}

/** "30 Oct 2026" — the per-row join date. */
export function joinDateLabel(iso: string, lang: Language): string {
  const date = parseDate(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Groups the register by join month, newest month first, rows newest first.
 *
 * A row whose timestamp cannot be read lands in a trailing bucket rather than
 * disappearing, so a broken value is still visible to the admin.
 */
export function groupByJoinMonth(
  profiles: CustomerProfile[],
  lang: Language,
): Array<{ key: string; label: string; profiles: CustomerProfile[] }> {
  const buckets = new Map<string, CustomerProfile[]>();

  for (const profile of profiles) {
    const date = parseDate(profile.createdAt);
    const key = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : "unknown";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(profile);
    else buckets.set(key, [profile]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a === "unknown" ? 1 : b === "unknown" ? -1 : b.localeCompare(a)))
    .map(([key, rows]) => ({
      key,
      label: key === "unknown" || !rows[0] ? "" : joinMonthLabel(rows[0].createdAt, lang),
      profiles: [...rows].sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
    }));
}

/** Applies the register's filter chips and its single search field. */
export function filterProfiles(
  profiles: CustomerProfile[],
  filter: CustomerFilter,
  query: string,
): CustomerProfile[] {
  const needle = query.trim().toLocaleLowerCase();

  return profiles.filter((profile) => {
    if (filter === "customers" && profile.role !== "customer") return false;
    if (filter === "team" && !isTeamRole(profile.role)) return false;
    if (needle === "") return true;
    return `${profile.email} ${profile.fullName}`.toLocaleLowerCase().includes(needle);
  });
}

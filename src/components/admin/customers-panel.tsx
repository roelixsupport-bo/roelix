import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  PROFILE_COLUMNS,
  accountStatus,
  filterProfiles,
  groupByJoinMonth,
  isTeamRole,
  joinDateLabel,
  profilesFromRecords,
  type AccountStatus,
  type CustomerFilter,
  type CustomerProfile,
} from "@/lib/account";
import {
  CUSTOMER_EMAIL_COLUMNS,
  customerEmailSeenLabel,
  customerEmailSourceLabel,
  customerEmailStats,
  customerEmailsFromRecords,
  filterCustomerEmails,
  sortCustomerEmails,
  type CustomerEmail,
} from "@/lib/customer-emails";
import { describeError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    title: "Customers",
    hint: "Every account created on the storefront, newest first. Confirmed means the customer clicked the link in the sign-up email.",
    all: "All accounts",
    customers: "Customers",
    team: "Team",
    refresh: "Refresh",
    search: "Search email or name",
    loading: "Loading accounts…",
    empty: "No accounts have been registered yet.",
    emptyFilter: "No accounts match this filter.",
    countAccounts: "accounts",
    countConfirmed: "confirmed",
    countWaiting: "awaiting confirmation",
    joined: "Joined",
    accountsSection: "Registered accounts",
    migrationHint:
      "Profiles could not be read. Apply the account migration 20261016160000/20261016170000/20261016180000/20261016190000 and 20261030150000, then refresh.",
    loadFailed: "Could not load customer accounts.",
    status: {
      active: "Active",
      unconfirmed: "Unconfirmed",
      staff: "Staff",
      admin: "Admin",
    } satisfies Record<AccountStatus, string>,

    emailsTitle: "Sign-in emails",
    emailsHint:
      "Every address submitted in the sign-in modal, saved before the email is sent. Linked means that address has completed a sign-in.",
    emailsSearch: "Search saved emails",
    emailsLoading: "Loading saved emails…",
    emailsEmpty: "No sign-in emails have been saved yet.",
    emailsEmptyFilter: "No saved emails match this search.",
    emailsMigrationHint:
      "Saved emails could not be read. Apply supabase/migrations/20261101103000_customer_email_signins.sql, then refresh.",
    emailsLoadFailed: "Could not load saved emails.",
    countEmails: "saved emails",
    countMarketing: "accept news",
    countLinked: "linked",
    lastSeen: "Last seen",
    signIns: "sign-ins",
    marketingOn: "News & offers",
    marketingOff: "No marketing",
    linked: "Linked",
    notLinked: "Not linked",
    deleteEmail: "Delete saved email",
    deleteEmailConfirm: "Delete the saved email {email}? This cannot be undone.",
    deleted: "Saved email deleted",
    deleteFailed: "Could not delete the saved email",
  },
  ar: {
    title: "العملاء",
    hint: "كل حساب أُنشئ في المتجر، الأحدث أولاً. «مؤكد» تعني أن العميل ضغط رابط رسالة التسجيل.",
    all: "كل الحسابات",
    customers: "العملاء",
    team: "الفريق",
    refresh: "تحديث",
    search: "ابحث بالبريد أو الاسم",
    loading: "جارٍ تحميل الحسابات…",
    empty: "لا توجد حسابات مسجّلة بعد.",
    emptyFilter: "لا توجد حسابات مطابقة لهذا التصنيف.",
    countAccounts: "حساب",
    countConfirmed: "مؤكد",
    countWaiting: "بانتظار التأكيد",
    joined: "الانضمام",
    accountsSection: "الحسابات المسجّلة",
    migrationHint: "تعذر قراءة الحسابات. شغّل تحديث الحسابات 20261030150000 ثم أعد التحديث.",
    loadFailed: "تعذر تحميل حسابات العملاء.",
    status: {
      active: "مؤكد",
      unconfirmed: "غير مؤكد",
      staff: "فريق",
      admin: "مدير",
    } satisfies Record<AccountStatus, string>,

    emailsTitle: "بريد تسجيل الدخول",
    emailsHint:
      "كل بريد أُدخل في نافذة تسجيل الدخول، ويُحفظ قبل إرسال الرسالة. «مرتبط» تعني أن هذا البريد أكمل تسجيل الدخول.",
    emailsSearch: "ابحث في البريد المحفوظ",
    emailsLoading: "جارٍ تحميل البريد المحفوظ…",
    emailsEmpty: "لم يُحفظ أي بريد لتسجيل الدخول بعد.",
    emailsEmptyFilter: "لا يوجد بريد مطابق لهذا البحث.",
    emailsMigrationHint:
      "تعذر قراءة البريد المحفوظ. شغّل التحديث 20261101103000_customer_email_signins.sql ثم أعد التحديث.",
    emailsLoadFailed: "تعذر تحميل البريد المحفوظ.",
    countEmails: "بريد محفوظ",
    countMarketing: "موافق على الأخبار",
    countLinked: "مرتبط",
    lastSeen: "آخر ظهور",
    signIns: "تسجيل دخول",
    marketingOn: "الأخبار والعروض",
    marketingOff: "لا تسويق",
    linked: "مرتبط",
    notLinked: "غير مرتبط",
    deleteEmail: "حذف البريد المحفوظ",
    deleteEmailConfirm: "هل تريد حذف البريد {email}؟ لا يمكن التراجع.",
    deleted: "تم حذف البريد المحفوظ",
    deleteFailed: "تعذر حذف البريد المحفوظ",
  },
} as const;

const STATUS_TONE: Record<AccountStatus, string> = {
  active: "text-emerald",
  unconfirmed: "text-gold",
  staff: "text-muted-foreground",
  admin: "text-muted-foreground",
};

/** Reads every profile the dashboard is allowed to see (admins can read all rows). */
async function fetchProfiles(): Promise<CustomerProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return profilesFromRecords(data);
}

/**
 * Reads the address register written by the sign-in modal.
 *
 * This is a different register from `profiles`: it holds addresses that have
 * not become accounts yet, which is exactly the interest for the shop — a
 * visitor who typed their email and never opened the link is still a lead.
 */
async function fetchCustomerEmails(): Promise<CustomerEmail[]> {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_EMAIL_COLUMNS)
    .order("last_seen_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return customerEmailsFromRecords(data);
}

function isSchemaError(error: unknown): boolean {
  const shape = (error ?? {}) as { code?: string; message?: string };
  if (shape.code === "42P01" || shape.code === "42703" || shape.code === "PGRST205") return true;
  return /column .* does not exist|schema cache|could not find the table|relation .* does not exist/i.test(
    shape.message ?? "",
  );
}

/**
 * The customer register, in two layers.
 *
 * `Sign-in emails` is the raw material: what people typed into the modal, with
 * or without an account. `Registered accounts` is the same audience once it
 * authenticated. The dashboard needs both because the first explains the second.
 */
export function CustomersPanel({ isArabic }: { isArabic: boolean }) {
  const text = COPY[isArabic ? "ar" : "en"];
  const lang = isArabic ? "ar" : "en";

  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [query, setQuery] = useState("");

  const [emails, setEmails] = useState<CustomerEmail[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [emailsError, setEmailsError] = useState<string | null>(null);
  const [emailQuery, setEmailQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(
    async (announce = false) => {
      try {
        setProfiles(await fetchProfiles());
        setLoadError(null);
      } catch (error) {
        console.error("Could not load ROELIX customer accounts", error);
        const message = `${text.migrationHint}\n${describeError(error, text.loadFailed)}`;
        setLoadError(message);
        if (announce) toast.error(text.loadFailed);
      } finally {
        setLoading(false);
      }
    },
    [text.loadFailed, text.migrationHint],
  );

  const loadEmails = useCallback(
    async (announce = false) => {
      try {
        setEmails(sortCustomerEmails(await fetchCustomerEmails()));
        setEmailsError(null);
      } catch (error) {
        console.error("Could not load ROELIX sign-in emails", error);
        const message = isSchemaError(error)
          ? `${text.emailsMigrationHint}\n${describeError(error, text.emailsLoadFailed)}`
          : describeError(error, text.emailsLoadFailed);
        setEmailsError(message);
        if (announce) toast.error(text.emailsLoadFailed);
      } finally {
        setEmailsLoading(false);
      }
    },
    [text.emailsLoadFailed, text.emailsMigrationHint],
  );

  const refreshAll = useCallback(
    async (announce = false) => {
      await Promise.all([load(announce), loadEmails(announce)]);
    },
    [load, loadEmails],
  );

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Registers change on another device; re-read when the tab comes back into view.
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refreshAll();
    };
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [refreshAll]);

  const stats = useMemo(() => {
    const customers = profiles.filter((profile) => profile.role === "customer");
    const confirmed = customers.filter((profile) => profile.confirmedAt !== null).length;
    return {
      total: profiles.length,
      customers: customers.length,
      confirmed,
      waiting: customers.length - confirmed,
      team: profiles.filter((profile) => isTeamRole(profile.role)).length,
    };
  }, [profiles]);

  const emailStats = useMemo(() => customerEmailStats(emails), [emails]);
  const visibleEmails = useMemo(
    () => filterCustomerEmails(emails, emailQuery),
    [emails, emailQuery],
  );

  const visible = useMemo(() => filterProfiles(profiles, filter, query), [profiles, filter, query]);
  const months = useMemo(() => groupByJoinMonth(visible, lang), [visible, lang]);

  async function removeEmail(row: CustomerEmail) {
    const confirmed = window.confirm(text.deleteEmailConfirm.replace("{email}", row.email));
    if (!confirmed) return;

    setDeletingId(row.id);
    try {
      const { error } = await supabase.from("customers").delete().eq("id", row.id);
      if (error) throw error;
      setEmails((current) => current.filter((item) => item.id !== row.id));
      toast.success(text.deleted);
    } catch (error) {
      console.error("Could not delete a saved ROELIX sign-in email", error);
      toast.error(describeError(error, text.deleteFailed));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-6 space-y-8" aria-label={text.title}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl">{text.title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {text.hint}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll(true)}
          className="inline-flex items-center gap-2 border px-3 py-2 text-xs uppercase tracking-[0.12em] transition-colors hover:border-gold"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {text.refresh}
        </button>
      </div>

      {/* ------------------------------------------------- Sign-in email register */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl sm:text-2xl">{text.emailsTitle}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {text.emailsHint}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <div className="flex items-baseline gap-2">
              <dd className="font-serif text-lg text-foreground">{emailStats.total}</dd>
              <dt>{text.countEmails}</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-serif text-lg text-foreground">{emailStats.marketing}</dd>
              <dt>{text.countMarketing}</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-serif text-lg text-foreground">{emailStats.linked}</dd>
              <dt>{text.countLinked}</dt>
            </div>
          </dl>
        </div>

        <div className="flex w-full items-center gap-2 border-b sm:max-w-xs">
          <Search size={14} className="text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={emailQuery}
            onChange={(event) => setEmailQuery(event.target.value)}
            placeholder={text.emailsSearch}
            aria-label={text.emailsSearch}
            className="w-full bg-transparent pb-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {emailsError && (
          <div
            role="alert"
            dir="ltr"
            className="border border-destructive/60 bg-destructive/5 p-3 text-start text-xs text-destructive"
          >
            <p className="font-semibold">{text.emailsLoadFailed}</p>
            <p className="mt-1 whitespace-pre-line break-words font-mono">{emailsError}</p>
          </div>
        )}

        {emailsLoading && emails.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            {text.emailsLoading}
          </p>
        ) : visibleEmails.length === 0 ? (
          <p className="border border-dashed p-5 text-sm text-muted-foreground">
            {emails.length === 0 ? text.emailsEmpty : text.emailsEmptyFilter}
          </p>
        ) : (
          <ul>
            {visibleEmails.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-1 gap-1.5 border-b py-3 sm:grid-cols-[minmax(0,1fr)_8.5rem_10.5rem_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="break-all font-serif text-sm leading-tight">{row.email}</p>
                  <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                    {customerEmailSourceLabel(row.source, lang)} · {text.signIns}: {row.signInCount}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {text.lastSeen}: {customerEmailSeenLabel(row.lastSeenAt, lang) || "—"}
                </p>
                <p
                  className={cn(
                    "eyebrow whitespace-nowrap text-[0.55rem]",
                    row.marketingOptIn ? "text-emerald" : "text-muted-foreground",
                  )}
                >
                  {row.marketingOptIn ? text.marketingOn : text.marketingOff}
                </p>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span
                    className={cn(
                      "eyebrow whitespace-nowrap text-[0.55rem]",
                      row.userId ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {row.userId ? text.linked : text.notLinked}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeEmail(row)}
                    disabled={deletingId === row.id}
                    aria-label={`${text.deleteEmail}: ${row.email}`}
                    title={text.deleteEmail}
                    className="p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------------------------------------------------- Registered accounts */}
      <div className="space-y-5 border-t pt-6">
        <h3 className="font-serif text-xl sm:text-2xl">{text.accountsSection}</h3>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y py-3 text-xs text-muted-foreground">
          <div className="flex items-baseline gap-2">
            <dd className="font-serif text-lg text-foreground">{stats.customers}</dd>
            <dt>{text.countAccounts}</dt>
          </div>
          <div className="flex items-baseline gap-2">
            <dd className="font-serif text-lg text-foreground">{stats.confirmed}</dd>
            <dt>{text.countConfirmed}</dt>
          </div>
          <div className="flex items-baseline gap-2">
            <dd className="font-serif text-lg text-foreground">{stats.waiting}</dd>
            <dt>{text.countWaiting}</dt>
          </div>
          {stats.team > 0 && (
            <div className="flex items-baseline gap-2">
              <dd className="font-serif text-lg text-foreground">{stats.team}</dd>
              <dt>{text.team}</dt>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={text.title}>
            {(
              [
                ["all", text.all],
                ["customers", text.customers],
                ["team", text.team],
              ] as Array<[CustomerFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "border px-3 py-2 text-xs uppercase tracking-[0.12em] transition-colors",
                  filter === value
                    ? "border-navy bg-navy text-navy-foreground"
                    : "hover:border-gold hover:bg-gold/5",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-2 border-b sm:max-w-xs">
            <Search size={14} className="text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.search}
              aria-label={text.search}
              className="w-full bg-transparent pb-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            dir="ltr"
            className="border border-destructive/60 bg-destructive/5 p-3 text-start text-xs text-destructive"
          >
            <p className="font-semibold">{text.loadFailed}</p>
            <p className="mt-1 whitespace-pre-line break-words font-mono">{loadError}</p>
          </div>
        )}

        {loading && profiles.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            {text.loading}
          </p>
        ) : visible.length === 0 ? (
          <p className="border border-dashed p-5 text-sm text-muted-foreground">
            {profiles.length === 0 ? text.empty : text.emptyFilter}
          </p>
        ) : (
          <div>
            {months.map((month) => (
              <section key={month.key} aria-label={month.label || text.accountsSection}>
                <div className="flex items-baseline justify-between gap-4 border-b pb-2 pt-6">
                  <h4 className="font-serif text-lg">{month.label || text.accountsSection}</h4>
                  <span className="eyebrow text-[0.6rem] text-muted-foreground">
                    {month.profiles.length}
                  </span>
                </div>

                <ul>
                  {month.profiles.map((profile) => {
                    const status = accountStatus(profile);
                    return (
                      <li
                        key={profile.id}
                        className="grid grid-cols-1 gap-1 border-b py-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem] sm:items-center sm:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="break-all font-serif text-sm leading-tight">
                            {profile.email}
                          </p>
                          {profile.fullName && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {profile.fullName}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {joinDateLabel(profile.createdAt, lang)}
                        </p>
                        <p
                          className={cn("eyebrow text-[0.55rem] sm:text-end", STATUS_TONE[status])}
                        >
                          {text.status[status]}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

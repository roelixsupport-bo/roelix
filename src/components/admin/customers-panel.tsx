import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
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
    migrationHint:
      "تعذر قراءة الحسابات. شغّل تحديث الحسابات 20261030150000 ثم أعد التحديث.",
    loadFailed: "تعذر تحميل حسابات العملاء.",
    status: {
      active: "مؤكد",
      unconfirmed: "غير مؤكد",
      staff: "فريق",
      admin: "مدير",
    } satisfies Record<AccountStatus, string>,
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

function isSchemaError(error: unknown): boolean {
  const shape = (error ?? {}) as { code?: string; message?: string };
  if (shape.code === "42P01" || shape.code === "42703" || shape.code === "PGRST205") return true;
  return /column .* does not exist|schema cache|could not find the table|relation .* does not exist/i.test(
    shape.message ?? "",
  );
}

/**
 * The customer register.
 *
 * Not a data grid: accounts are grouped under the month they were created in and
 * separated by hairlines only. The status is a word at the end of the row, because
 * what the admin needs from it is "can this person sign in", not a coloured chip.
 */
export function CustomersPanel({ isArabic }: { isArabic: boolean }) {
  const text = COPY[isArabic ? "ar" : "en"];
  const lang = isArabic ? "ar" : "en";

  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [query, setQuery] = useState("");

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

  useEffect(() => {
    void load();
  }, [load]);

  // Accounts change on another device; re-read when the tab comes back into view.
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [load]);

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

  const visible = useMemo(
    () => filterProfiles(profiles, filter, query),
    [profiles, filter, query],
  );
  const months = useMemo(() => groupByJoinMonth(visible, lang), [visible, lang]);

  return (
    <section className="mt-6 space-y-5" aria-label={text.title}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl">{text.title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {text.hint}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          className="inline-flex items-center gap-2 border px-3 py-2 text-xs uppercase tracking-[0.12em] transition-colors hover:border-gold"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {text.refresh}
        </button>
      </div>

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
                <h3 className="font-serif text-lg">
                  {month.label || text.accountsSection}
                </h3>
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
                        className={cn(
                          "eyebrow text-[0.55rem] sm:text-end",
                          STATUS_TONE[status],
                        )}
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
    </section>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  fetchPaymentSettings,
  updatePaymentSetting,
  type PaymentSetting,
} from "@/lib/manual-payments";

const COPY = {
  en: {
    title: "Manual payment methods",
    description: "Set the transfer details customers see during checkout.",
    loading: "Loading payment methods…",
    loadError: "Could not load payment methods.",
    vodafone_cash: "Vodafone Cash",
    instapay: "InstaPay",
    accountInfo: "Wallet number / IPA address",
    save: "Save details",
    saving: "Saving…",
    activate: "Activate payment method",
    deactivate: "Deactivate payment method",
    saved: "Payment method saved",
    enabled: "Payment method activated",
    disabled: "Payment method deactivated",
    error: "Could not update payment method.",
    missingInfo: "Enter the account details before activating this method.",
  },
  ar: {
    title: "طرق الدفع اليدوية",
    description: "أدخلي بيانات التحويل التي ستظهر للعملاء عند إتمام الطلب.",
    loading: "جارٍ تحميل طرق الدفع…",
    loadError: "تعذّر تحميل طرق الدفع.",
    vodafone_cash: "فودافون كاش",
    instapay: "إنستاباي",
    accountInfo: "رقم المحفظة / عنوان IPA",
    save: "حفظ البيانات",
    saving: "جارٍ الحفظ…",
    activate: "تفعيل طريقة الدفع",
    deactivate: "إيقاف طريقة الدفع",
    saved: "تم حفظ طريقة الدفع",
    enabled: "تم تفعيل طريقة الدفع",
    disabled: "تم إيقاف طريقة الدفع",
    error: "تعذّر تحديث طريقة الدفع.",
    missingInfo: "أدخلي بيانات الحساب قبل تفعيل الطريقة.",
  },
} as const;

type PaymentSettingsPanelProps = { isArabic: boolean };

export function PaymentSettingsPanel({ isArabic }: PaymentSettingsPanelProps) {
  const text = COPY[isArabic ? "ar" : "en"];
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPaymentSettings();
      setSettings(rows);
      setDrafts(Object.fromEntries(rows.map((row) => [row.id, row.account_info])));
    } catch (error) {
      console.error("Could not load payment settings", error);
      toast.error(error instanceof Error ? error.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(setting: PaymentSetting) {
    const accountInfo = drafts[setting.id]?.trim() ?? "";
    if (!accountInfo) {
      toast.error(text.missingInfo);
      return;
    }
    setBusyId(setting.id);
    try {
      await updatePaymentSetting(setting.id, { account_info: accountInfo });
      setSettings((rows) =>
        rows.map((row) => (row.id === setting.id ? { ...row, account_info: accountInfo } : row)),
      );
      toast.success(text.saved);
    } catch (error) {
      console.error("Could not save payment account details", error);
      toast.error(error instanceof Error ? error.message : text.error);
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(setting: PaymentSetting) {
    if (!setting.is_active && !(drafts[setting.id]?.trim() ?? setting.account_info.trim())) {
      toast.error(text.missingInfo);
      return;
    }
    setBusyId(setting.id);
    try {
      const isActive = !setting.is_active;
      await updatePaymentSetting(setting.id, {
        account_info: drafts[setting.id]?.trim() ?? setting.account_info,
        is_active: isActive,
      });
      setSettings((rows) =>
        rows.map((row) =>
          row.id === setting.id
            ? {
                ...row,
                account_info: drafts[setting.id]?.trim() ?? row.account_info,
                is_active: isActive,
              }
            : row,
        ),
      );
      toast.success(isActive ? text.enabled : text.disabled);
    } catch (error) {
      console.error("Could not toggle payment method", error);
      toast.error(error instanceof Error ? error.message : text.error);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-6 space-y-6" aria-label={text.title}>
      <header>
        <h2 className="font-serif text-3xl">{text.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{text.description}</p>
      </header>
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {text.loading}
        </p>
      )}
      {!loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {settings.map((setting) => {
            const Icon = setting.method_key === "vodafone_cash" ? Smartphone : Wallet;
            return (
              <article key={setting.id} className="space-y-4 border p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="flex items-center gap-2 font-serif text-xl">
                    <Icon size={20} aria-hidden="true" />
                    {text[setting.method_key]}
                  </h3>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={setting.is_active}
                    aria-label={setting.is_active ? text.deactivate : text.activate}
                    disabled={busyId === setting.id}
                    onClick={() => void toggle(setting)}
                    className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
                      setting.is_active ? "bg-emerald-600" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                        setting.is_active ? "start-6" : "start-1"
                      }`}
                    />
                  </button>
                </div>
                <label className="block space-y-2 text-sm">
                  <span className="eyebrow">{text.accountInfo}</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={drafts[setting.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [setting.id]: event.target.value }))
                    }
                    maxLength={120}
                    disabled={busyId === setting.id}
                    className="w-full border bg-background px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  disabled={busyId === setting.id}
                  onClick={() => void save(setting)}
                  className="bg-navy px-4 py-2 text-sm text-navy-foreground disabled:opacity-50"
                >
                  {busyId === setting.id ? text.saving : text.save}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

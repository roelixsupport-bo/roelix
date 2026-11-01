import { useEffect, useId, useState, type FormEvent } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  authErrorMessage,
  validateAuthForm,
  type AuthField,
  type AuthFieldIssues,
  type AuthMode,
} from "@/lib/account";
import { useAccount } from "@/lib/account-provider";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    signInTab: "Sign in",
    registerTab: "Create account",
    signInTitle: "Sign in to your account",
    registerTitle: "Create your account",
    signInBody: "Use the email and password you registered with.",
    registerBody: "Your wishlist and delivery details stay on this account.",
    fullName: "Full name",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    forgot: "Forgot your password?",
    signIn: "Sign in",
    register: "Create account",
    signingIn: "Signing in…",
    creating: "Creating account…",
    sendingReset: "Sending reset link…",
    close: "Close",
    showPassword: "Show password",
    hidePassword: "Hide password",
    terms: "By creating an account you accept the",
    termsLink: "terms",
    and: "and",
    privacyLink: "privacy policy",
    signedIn: "Signed in.",
    created: "Account created and signed in.",
    createdConfirm: "Account created. Confirm your email address, then sign in.",
    resetSent: "Reset link sent. Check your email.",
    issues: {
      nameRequired: "Enter your name.",
      emailRequired: "Enter your email address.",
      emailInvalid: "Enter a valid email address.",
      passwordShort: "Use at least 8 characters.",
      passwordMismatch: "Passwords do not match.",
    },
    notConfigured: "Accounts are not configured on this deployment.",
    resetNeedsEmail: "Enter your email address first, then request a reset link.",
  },
  ar: {
    signInTab: "تسجيل الدخول",
    registerTab: "إنشاء حساب",
    signInTitle: "تسجيل الدخول إلى حسابك",
    registerTitle: "إنشاء حسابك",
    signInBody: "استخدم البريد وكلمة المرور المسجّلين.",
    registerBody: "تبقى قائمة أمنياتك وبيانات التوصيل على هذا الحساب.",
    fullName: "الاسم الكامل",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
    signIn: "تسجيل الدخول",
    register: "إنشاء حساب",
    signingIn: "جارٍ تسجيل الدخول…",
    creating: "جارٍ إنشاء الحساب…",
    sendingReset: "جارٍ إرسال رابط الاستعادة…",
    close: "إغلاق",
    showPassword: "إظهار كلمة المرور",
    hidePassword: "إخفاء كلمة المرور",
    terms: "بإنشاء حساب فإنك توافق على",
    termsLink: "الشروط",
    and: "و",
    privacyLink: "سياسة الخصوصية",
    signedIn: "تم تسجيل الدخول.",
    created: "تم إنشاء الحساب وتسجيل الدخول.",
    createdConfirm: "تم إنشاء الحساب. أكّد بريدك الإلكتروني ثم سجّل الدخول.",
    resetSent: "تم إرسال رابط الاستعادة. تحقق من بريدك.",
    issues: {
      nameRequired: "أدخل اسمك.",
      emailRequired: "أدخل بريدك الإلكتروني.",
      emailInvalid: "أدخل بريداً إلكترونياً صحيحاً.",
      passwordShort: "استخدم 8 أحرف على الأقل.",
      passwordMismatch: "كلمتا المرور غير متطابقتين.",
    },
    notConfigured: "الحسابات غير مُهيّأة على هذا النشر.",
    resetNeedsEmail: "أدخل بريدك الإلكتروني أولاً ثم اطلب رابط الاستعادة.",
  },
} as const;

export type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: AuthMode;
};

/**
 * Sign in / create account, written as a ruled card rather than a boxed form.
 *
 * One state machine: the leaf at the top decides which rules are shown, the
 * submit button is the only place that talks to Supabase, and every failure is
 * reported twice — on the field it belongs to, and as a toast with the exact
 * reason the request failed.
 */
export function AuthDialog({ open, onOpenChange, initialMode = "signin" }: AuthDialogProps) {
  const { lang } = useStore();
  const lang2 = lang === "ar" ? "ar" : "en";
  const text = COPY[lang2];
  const { configured, signIn, register, requestPasswordReset } = useAccount();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [issues, setIssues] = useState<AuthFieldIssues>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fieldId = useId();
  const id = (field: AuthField) => `${fieldId}-${field}`;

  // Reopening starts clean, and switching leaves clears the previous verdicts
  // without making the customer retype their email.
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setIssues({});
    setFormError(null);
    setShowPassword(false);
  }, [open, initialMode]);

  function changeMode(next: AuthMode) {
    if (next === mode) return;
    setMode(next);
    setIssues({});
    setFormError(null);
  }

  function clearIssue(field: AuthField) {
    if (!issues[field]) return;
    setIssues((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const values = { fullName, email, password, confirmPassword };
    const found = validateAuthForm(mode, values);
    setIssues(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        toast.success(text.signedIn);
        onOpenChange(false);
      } else {
        const outcome = await register({ fullName, email, password });
        if (outcome.needsEmailConfirmation) {
          toast.success(text.createdConfirm, { duration: 9000 });
          setPassword("");
          setConfirmPassword("");
          changeMode("signin");
        } else {
          toast.success(text.created);
          onOpenChange(false);
        }
      }
    } catch (error) {
      console.error("ROELIX account request failed", error);
      const message = authErrorMessage(error, lang2);
      setFormError(message);
      toast.error(message, { duration: 9000 });
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotPassword() {
    if (sendingReset) return;
    if (email.trim() === "") {
      setIssues((current) => ({ ...current, email: "emailRequired" }));
      setFormError(text.resetNeedsEmail);
      return;
    }

    setSendingReset(true);
    setFormError(null);
    try {
      await requestPasswordReset(email);
      toast.success(text.resetSent);
    } catch (error) {
      console.error("ROELIX password reset failed", error);
      const message = authErrorMessage(error, lang2);
      setFormError(message);
      toast.error(message);
    } finally {
      setSendingReset(false);
    }
  }

  const issueMessage = (field: AuthField): string | undefined => {
    const issue = issues[field];
    return issue ? text.issues[issue] : undefined;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[26rem] gap-0 rounded-[2px] border bg-card p-0 shadow-lux sm:rounded-[2px]"
      >
        <div dir={lang2 === "ar" ? "rtl" : "ltr"}>
          <div className="flex items-start justify-between gap-4 p-6 pb-5">
            <DialogTitle className="font-serif text-2xl leading-tight">
              {mode === "signin" ? text.signInTitle : text.registerTitle}
            </DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                aria-label={text.close}
                className="-me-1 -mt-1 p-1 text-muted-foreground transition-colors hover:text-gold"
              >
                <X size={18} />
              </button>
            </DialogClose>
          </div>

          <div className="grid grid-cols-2 border-y" role="tablist" aria-label={text.signInTab}>
            {(
              [
                ["signin", text.signInTab],
                ["register", text.registerTab],
              ] as Array<[AuthMode, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => changeMode(value)}
                className={cn(
                  "eyebrow py-3 text-[0.6rem] transition-colors",
                  mode === value
                    ? "bg-navy text-navy-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {mode === "signin" ? text.signInBody : text.registerBody}
            </DialogDescription>

            <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
              {mode === "register" && (
                <RuledField
                  id={id("fullName")}
                  label={text.fullName}
                  value={fullName}
                  autoComplete="name"
                  autoFocus
                  error={issueMessage("fullName")}
                  onChange={(value) => {
                    setFullName(value);
                    clearIssue("fullName");
                  }}
                />
              )}

              <RuledField
                id={id("email")}
                label={text.email}
                type="email"
                inputMode="email"
                dir="ltr"
                value={email}
                autoComplete="email"
                autoFocus={mode === "signin"}
                error={issueMessage("email")}
                onChange={(value) => {
                  setEmail(value);
                  clearIssue("email");
                }}
              />

              <RuledField
                id={id("password")}
                label={text.password}
                type={showPassword ? "text" : "password"}
                dir="ltr"
                value={password}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                error={issueMessage("password")}
                onChange={(value) => {
                  setPassword(value);
                  clearIssue("password");
                }}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? text.hidePassword : text.showPassword}
                    aria-pressed={showPassword}
                    className="text-muted-foreground transition-colors hover:text-gold"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              {mode === "signin" ? (
                <button
                  type="button"
                  onClick={() => void onForgotPassword()}
                  disabled={sendingReset}
                  className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-gold disabled:opacity-60"
                >
                  {sendingReset ? text.sendingReset : text.forgot}
                </button>
              ) : (
                <RuledField
                  id={id("confirmPassword")}
                  label={text.confirmPassword}
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  value={confirmPassword}
                  autoComplete="new-password"
                  error={issueMessage("confirmPassword")}
                  onChange={(value) => {
                    setConfirmPassword(value);
                    clearIssue("confirmPassword");
                  }}
                />
              )}

              {formError && (
                <p
                  role="alert"
                  className="border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive"
                >
                  {formError}
                </p>
              )}

              {!configured && (
                <p className="border border-border p-3 text-xs leading-relaxed text-muted-foreground">
                  {text.notConfigured}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !configured}
                className="btn-lux w-full"
              >
                {submitting
                  ? mode === "signin"
                    ? text.signingIn
                    : text.creating
                  : mode === "signin"
                    ? text.signIn
                    : text.register}
              </button>

              {mode === "register" && (
                <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
                  {text.terms}{" "}
                  <a href="/terms" className="underline underline-offset-4 hover:text-gold">
                    {text.termsLink}
                  </a>{" "}
                  {text.and}{" "}
                  <a href="/privacy" className="underline underline-offset-4 hover:text-gold">
                    {text.privacyLink}
                  </a>
                  .
                </p>
              )}
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RuledField({
  id,
  label,
  value,
  onChange,
  type = "text",
  error,
  trailing,
  autoComplete,
  autoFocus,
  inputMode,
  dir,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  error?: string;
  trailing?: React.ReactNode;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: "email";
  dir?: "ltr" | "rtl" | "auto";
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow block text-[0.6rem] text-muted-foreground">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={type}
          dir={dir}
          value={value}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn("field-rule", trailing && "pe-8")}
        />
        {trailing && <div className="absolute inset-y-0 end-0 flex items-center">{trailing}</div>}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs leading-relaxed text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

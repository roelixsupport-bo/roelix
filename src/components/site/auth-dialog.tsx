import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input_otp";
import {
  authErrorMessage,
  validateAuthForm,
  type AuthFieldIssues,
  type AuthMode,
} from "@/lib/account";
import { useAccount } from "@/lib/account-provider";
import { isValidEmail, normalizeEmail } from "@/lib/customer-emails";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    title: "Sign in",
    subtitle: "Sign in or create an account",
    continueWithShop: "Continue with shop",
    or: "or",
    emailLabel: "Email address",
    emailPlaceholder: "Email",
    continueWithEmail: "Continue with email",
    marketing: "Email me with news and offers",
    termsPrefix: "By continuing, you agree to our",
    termsLink: "Terms of service",
    usePassword: "Sign in with a password instead",
    close: "Close",
    signedIn: "Signed in.",
    emailRequired: "Enter your email address.",
    emailInvalid: "Enter a valid email address.",
    codeTitle: "Check your email",
    codeBody: "We sent a six-digit code and a sign-in link to",
    codeLabel: "Sign-in code",
    verify: "Verify code",
    verifying: "Verifying…",
    resend: "Send a new code",
    resending: "Sending…",
    changeEmail: "Use a different email",
    sent: "Your sign-in code is on its way.",
    resent: "A new code is on its way.",
    invalidCode: "Enter the six-digit code from the email.",
    passwordTitle: "Sign in with a password",
    passwordBody: "Use the email and password on your ROELIX account.",
    passwordLabel: "Password",
    passwordRequired: "Enter your password.",
    signIn: "Sign in",
    signingIn: "Signing in…",
    backToEmail: "Back to email sign-in",
    forgot: "Forgot your password?",
    sendingReset: "Sending reset link…",
    resetSent: "Reset link sent. Check your email.",
    resetNeedsEmail: "Enter your email address first, then request a reset link.",
    notConfigured: "Accounts are not configured on this deployment.",
    newHere: "New to ROELIX? The code creates your account.",
  },
  ar: {
    title: "تسجيل الدخول",
    subtitle: "سجّل الدخول أو أنشئ حسابًا",
    continueWithShop: "المتابعة عبر المتجر",
    or: "أو",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "البريد الإلكتروني",
    continueWithEmail: "المتابعة بالبريد",
    marketing: "أرسل لي الأخبار والعروض",
    termsPrefix: "بالمتابعة فإنك توافق على",
    termsLink: "شروط الخدمة",
    usePassword: "تسجيل الدخول بكلمة المرور",
    close: "إغلاق",
    signedIn: "تم تسجيل الدخول.",
    emailRequired: "أدخل بريدك الإلكتروني.",
    emailInvalid: "أدخل بريداً إلكترونياً صحيحاً.",
    codeTitle: "تحقق من بريدك",
    codeBody: "أرسلنا رمزًا من ستة أرقام ورابط دخول إلى",
    codeLabel: "رمز التحقق",
    verify: "تحقق من الرمز",
    verifying: "جارٍ التحقق…",
    resend: "أرسل رمزًا جديدًا",
    resending: "جارٍ الإرسال…",
    changeEmail: "استخدام بريد آخر",
    sent: "تم إرسال رمز الدخول إلى بريدك.",
    resent: "تم إرسال رمز جديد.",
    invalidCode: "أدخل الرمز المكوّن من ستة أرقام.",
    passwordTitle: "تسجيل الدخول بكلمة المرور",
    passwordBody: "استخدم البريد وكلمة المرور المسجّلين في حساب ROELIX.",
    passwordLabel: "كلمة المرور",
    passwordRequired: "أدخل كلمة المرور.",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    backToEmail: "العودة إلى تسجيل الدخول بالبريد",
    forgot: "نسيت كلمة المرور؟",
    sendingReset: "جارٍ إرسال رابط الاستعادة…",
    resetSent: "تم إرسال رابط الاستعادة. تحقق من بريدك.",
    resetNeedsEmail: "أدخل بريدك الإلكتروني أولاً ثم اطلب رابط الاستعادة.",
    notConfigured: "الحسابات غير مُهيّأة على هذا النشر.",
    newHere: "جديد في ROELIX؟ الرمز يُنشئ حسابك.",
  },
} as const;

export type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kept for callers that opened the card on a specific leaf. */
  initialMode?: AuthMode;
};

type Step = "email" | "code" | "password";

/**
 * The storefront sign-in card.
 *
 * One address is all a customer gives: it is written to `public.customers` the
 * moment they submit, then Supabase emails a magic link and a six-digit code.
 * The code arrives in this card so signing in never requires leaving the page;
 * the link covers the case where they read their inbox elsewhere.
 *
 * The password leaf stays reachable from the footer for accounts that already
 * have one (and for customers whose inbox delivery is broken), but it is never
 * the default path.
 */
export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { lang } = useStore();
  const lang2 = lang === "ar" ? "ar" : "en";
  const text = COPY[lang2];
  const { configured, signIn, requestPasswordReset, requestEmailSignIn, verifyEmailCode } =
    useAccount();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [code, setCode] = useState("");
  const [issues, setIssues] = useState<AuthFieldIssues>({});
  const [emailIssue, setEmailIssue] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const fieldId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const verifyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep("email");
    setIssues({});
    setEmailIssue(null);
    setFormError(null);
    setCode("");
    setPassword("");
  }, [open]);

  /** The brand CTA and the "use a different email" link both land here. */
  function focusEmail() {
    setStep("email");
    setFormError(null);
    window.requestAnimationFrame(() => emailRef.current?.focus());
  }

  async function onSubmitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const clean = normalizeEmail(email);
    if (clean === "") {
      setEmailIssue(text.emailRequired);
      return;
    }
    if (!isValidEmail(clean)) {
      setEmailIssue(text.emailInvalid);
      return;
    }

    setEmailIssue(null);
    setFormError(null);
    setSubmitting(true);
    try {
      await requestEmailSignIn({ email: clean, marketingOptIn, redirectPath: "/" });
      setEmail(clean);
      setCode("");
      setStep("code");
      toast.success(text.sent);
      window.requestAnimationFrame(() => verifyRef.current?.focus());
    } catch (error) {
      console.error("ROELIX email sign-in request failed", error);
      const message = authErrorMessage(error, lang2);
      setFormError(message);
      toast.error(message, { duration: 9000 });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCode(value: string) {
    if (submitting) return;
    const token = value.replace(/\D/g, "");
    if (token.length !== 6) {
      setFormError(text.invalidCode);
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      await verifyEmailCode(email, token);
      toast.success(text.signedIn);
      onOpenChange(false);
    } catch (error) {
      console.error("ROELIX email code verification failed", error);
      const message = authErrorMessage(error, lang2);
      setFormError(message);
      toast.error(message, { duration: 9000 });
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await requestEmailSignIn({ email, marketingOptIn, redirectPath: "/" });
      setCode("");
      toast.success(text.resent);
    } catch (error) {
      console.error("ROELIX email sign-in resend failed", error);
      const message = authErrorMessage(error, lang2);
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const found = validateAuthForm("signin", { email, password });
    setIssues(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success(text.signedIn);
      onOpenChange(false);
    } catch (error) {
      console.error("ROELIX password sign in failed", error);
      const message = authErrorMessage(error, lang2);
      setFormError(message);
      toast.error(message, { duration: 9000 });
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotPassword() {
    if (sendingReset) return;
    if (normalizeEmail(email) === "") {
      setEmailIssue(text.emailRequired);
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

  const passwordIssue = issues.password ? text.passwordRequired : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // The storefront dims with the navy scrim (navy at 60%) that the cart
        // drawer already uses, not a neutral black wash.
        overlayClassName="bg-navy/60 backdrop-blur-xs"
        className="w-[calc(100%-2rem)] max-w-[26rem] gap-0 rounded-[2px] border bg-card p-0 shadow-lux sm:rounded-[2px]"
      >
        <div dir={lang2 === "ar" ? "rtl" : "ltr"} className="px-6 pb-6 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="font-serif text-2xl leading-tight">
                {step === "email"
                  ? text.title
                  : step === "code"
                    ? text.codeTitle
                    : text.passwordTitle}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step === "email"
                  ? text.subtitle
                  : step === "code"
                    ? text.codeBody
                    : text.passwordBody}
                {step === "code" && (
                  <span dir="ltr" className="mt-1 block font-medium text-foreground">
                    {email}
                  </span>
                )}
              </DialogDescription>
            </div>
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

          {formError && (
            <p
              role="alert"
              className="mt-4 border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive"
            >
              {formError}
            </p>
          )}

          {!configured && (
            <p className="mt-4 border border-border p-3 text-xs leading-relaxed text-muted-foreground">
              {text.notConfigured}
            </p>
          )}

          {step === "email" && (
            <>
              <button
                type="button"
                onClick={focusEmail}
                disabled={!configured}
                className="btn-lux mt-5 w-full"
              >
                <ShoppingBag size={14} aria-hidden="true" />
                {text.continueWithShop}
              </button>

              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="eyebrow text-[0.58rem] text-muted-foreground">{text.or}</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={onSubmitEmail} noValidate>
                <label htmlFor={`${fieldId}-email`} className="sr-only">
                  {text.emailLabel}
                </label>
                <div
                  className={cn(
                    "flex h-12 items-stretch border bg-background transition-colors focus-within:border-gold",
                    emailIssue ? "border-destructive" : "border-border",
                  )}
                >
                  <input
                    id={`${fieldId}-email`}
                    ref={emailRef}
                    type="email"
                    dir="ltr"
                    value={email}
                    autoComplete="email"
                    inputMode="email"
                    placeholder={text.emailPlaceholder}
                    aria-invalid={emailIssue ? true : undefined}
                    aria-describedby={emailIssue ? `${fieldId}-email-error` : undefined}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (emailIssue) setEmailIssue(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent px-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !configured}
                    aria-label={text.continueWithEmail}
                    title={text.continueWithEmail}
                    className="grid w-12 shrink-0 place-items-center border-s border-border text-foreground transition-colors hover:bg-navy hover:text-navy-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowRight size={18} aria-hidden="true" className="rtl:rotate-180" />
                  </button>
                </div>
                {emailIssue && (
                  <p
                    id={`${fieldId}-email-error`}
                    className="mt-1.5 text-xs leading-relaxed text-destructive"
                  >
                    {emailIssue}
                  </p>
                )}

                <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                  <Checkbox
                    checked={marketingOptIn}
                    onCheckedChange={(value) => setMarketingOptIn(value === true)}
                    aria-label={text.marketing}
                    className="mt-0.5 rounded-[2px] border-border shadow-none data-[state=checked]:border-navy data-[state=checked]:bg-navy data-[state=checked]:text-navy-foreground"
                  />
                  <span className="text-foreground">{text.marketing}</span>
                </label>

                <p className="mt-6 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
                  {text.termsPrefix}{" "}
                  <a
                    href="/terms"
                    className="underline underline-offset-4 transition-colors hover:text-gold"
                  >
                    {text.termsLink}
                  </a>
                </p>
              </form>

              <button
                type="button"
                onClick={() => {
                  setStep("password");
                  setFormError(null);
                }}
                className="mt-4 w-full text-center text-[0.7rem] text-muted-foreground underline underline-offset-4 transition-colors hover:text-gold"
              >
                {text.usePassword}
              </button>
            </>
          )}

          {step === "code" && (
            <form
              className="mt-6"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCode(code);
              }}
            >
              <p className="eyebrow text-[0.6rem] text-muted-foreground">{text.codeLabel}</p>
              <InputOTP
                autoFocus
                maxLength={6}
                value={code}
                onChange={setCode}
                onComplete={(value) => void submitCode(value)}
                aria-label={text.codeLabel}
                containerClassName="mt-3 justify-center gap-2"
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="h-12 w-10 rounded-[2px] border border-border bg-background text-base first:rounded-[2px] last:rounded-[2px]"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <button
                ref={verifyRef}
                type="submit"
                disabled={submitting || code.replace(/\D/g, "").length !== 6}
                className="btn-lux mt-5 w-full"
              >
                {submitting ? text.verifying : text.verify}
              </button>

              <div className="mt-4 flex items-center justify-between gap-3 text-[0.7rem]">
                <button
                  type="button"
                  onClick={() => void onResend()}
                  disabled={submitting}
                  className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-gold disabled:opacity-60"
                >
                  {submitting ? text.resending : text.resend}
                </button>
                <button
                  type="button"
                  onClick={focusEmail}
                  className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-gold"
                >
                  {text.changeEmail}
                </button>
              </div>

              <p className="mt-5 text-center text-[0.68rem] leading-relaxed text-muted-foreground">
                {text.newHere}
              </p>
            </form>
          )}

          {step === "password" && (
            <form className="mt-5 space-y-4" onSubmit={onSubmitPassword} noValidate>
              <div>
                <label htmlFor={`${fieldId}-password-email`} className="sr-only">
                  {text.emailLabel}
                </label>
                <input
                  id={`${fieldId}-password-email`}
                  type="email"
                  dir="ltr"
                  value={email}
                  autoComplete="email"
                  placeholder={text.emailPlaceholder}
                  aria-invalid={issues.email ? true : undefined}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input-lux w-full"
                />
                {issues.email && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {issues.email === "emailInvalid" ? text.emailInvalid : text.emailRequired}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={`${fieldId}-password`} className="sr-only">
                  {text.passwordLabel}
                </label>
                <input
                  id={`${fieldId}-password`}
                  type="password"
                  dir="ltr"
                  value={password}
                  autoComplete="current-password"
                  placeholder={text.passwordLabel}
                  aria-invalid={issues.password ? true : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (!issues.password) return;
                    setIssues((current) => {
                      const next = { ...current };
                      delete next.password;
                      return next;
                    });
                  }}
                  className="input-lux w-full"
                />
                {passwordIssue && (
                  <p className="mt-1.5 text-xs text-destructive">{passwordIssue}</p>
                )}
              </div>

              <button type="submit" disabled={submitting || !configured} className="btn-lux w-full">
                {submitting ? text.signingIn : text.signIn}
              </button>

              <div className="flex items-center justify-between gap-3 text-[0.7rem]">
                <button
                  type="button"
                  onClick={() => void onForgotPassword()}
                  disabled={sendingReset}
                  className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-gold disabled:opacity-60"
                >
                  {sendingReset ? text.sendingReset : text.forgot}
                </button>
                <button
                  type="button"
                  onClick={focusEmail}
                  className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-gold"
                >
                  {text.backToEmail}
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useStore, type Language } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * The two languages the storefront ships in, in display order.
 *
 * Each option always sets its *own* language, so "English" can only ever mean
 * `en`. The previous control was a single button rendering the opposite
 * language's name, which is why it read as reversed: with English active it
 * showed "العربية", so the label looked like a statement about the current
 * language instead of the language you were about to switch to.
 */
const OPTIONS: ReadonlyArray<{
  value: Language;
  label: string;
  /** Spoken name, used for the accessible label when the visible text is terse. */
  name: { en: string; ar: string };
  className: string;
}> = [
  {
    value: "en",
    label: "English",
    name: { en: "English", ar: "الإنجليزية" },
    className: "uppercase tracking-[0.14em]",
  },
  {
    value: "ar",
    label: "العربية",
    name: { en: "Arabic", ar: "العربية" },
    className: "tracking-normal",
  },
];

export function LanguageSwitcher() {
  const s = useStore();

  return (
    <div
      role="group"
      aria-label={s.lang === "ar" ? "اختيار لغة الموقع" : "Site language"}
      className="flex shrink-0 items-center gap-1"
    >
      {OPTIONS.map((option, index) => {
        const active = s.lang === option.value;
        return (
          <div key={option.value} className="flex items-center gap-1">
            {index > 0 && (
              <span aria-hidden="true" className="opacity-30">
                /
              </span>
            )}
            <button
              type="button"
              // Always the option's own language — never a computed "other".
              onClick={() => s.setLang(option.value)}
              aria-pressed={active}
              lang={option.value}
              aria-label={
                s.lang === "ar"
                  ? `عرض الموقع ${option.name.ar}`
                  : `View the store in ${option.name.en}`
              }
              className={cn(
                "px-0.5 text-[0.68rem] font-medium transition-colors sm:text-[0.72rem]",
                option.className,
                active
                  ? "text-gold underline decoration-gold/50 underline-offset-4"
                  : "text-navy-foreground/65 hover:text-gold",
              )}
            >
              {option.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

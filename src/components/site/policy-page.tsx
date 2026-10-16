import type { ReactNode } from "react";

export type PolicySection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type PolicyContent = {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: PolicySection[];
  closing: string;
};

export function PolicyPage({ content }: { content: PolicyContent }) {
  return (
    <article
      lang="ar"
      dir="rtl"
      className="mx-auto max-w-4xl px-6 py-16 text-right md:py-24"
    >
      <header className="border-b border-border pb-10 text-center">
        <p className="text-sm text-gold">{content.eyebrow}</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight md:text-6xl">{content.title}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
          {content.introduction}
        </p>
        <p className="mt-6 text-xs text-muted-foreground">آخر تحديث: ١٤ أكتوبر ٢٠٢٦</p>
      </header>
      <div className="mt-10 space-y-8">
        {content.sections.map((section, index) => (
          <section key={section.title} className="border-b border-border/70 pb-8 last:border-0">
            <h2 className="font-serif text-2xl text-navy md:text-3xl">
              <span className="me-2 text-gold">{String(index + 1).padStart(2, "0")}</span>
              {section.title}
            </h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-4 leading-8 text-muted-foreground">
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-4 list-disc space-y-2 pe-6 leading-8 text-muted-foreground">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <footer className="mt-8 border-t border-gold/40 pt-6">
        <p className="leading-8 text-muted-foreground">{content.closing}</p>
      </footer>
    </article>
  );
}

export function PolicyShell({ children }: { children: ReactNode }) {
  return <div className="min-h-[60vh] bg-background">{children}</div>;
}

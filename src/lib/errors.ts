/**
 * Turns anything a Supabase / fetch / JS failure can throw into readable text.
 */
export function describeError(error: unknown, fallback = "The requested action failed"): string {
  if (typeof error === "string") return error.trim() || fallback;
  if (typeof error !== "object" || error === null) return fallback;

  const record = error as Record<string, unknown>;
  const text = (key: string): string => {
    const value = record[key];
    return typeof value === "string" ? value.trim() : "";
  };

  const message = text("message") || (error instanceof Error ? error.message : "");
  const details = text("details");
  const hint = text("hint");
  const code = text("code");

  const lines = [
    message || fallback,
    details ? `Details: ${details}` : "",
    hint ? `Hint: ${hint}` : "",
    code ? `Code: ${code}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}
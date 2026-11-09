import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    // Review photos can take longer on mobile than regular API calls.
    fetch: (input, init) => {
      const requestUrl =
        typeof input === "string" || input instanceof URL ? input.toString() : input.url;
      const isStorageRequest = new URL(requestUrl).pathname.includes("/storage/v1/object/");
      const timeout = isStorageRequest ? 65_000 : 15_000;
      return fetch(input, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(timeout),
      });
    },
  },
});

/**
 * Errors that mean "the token in this browser is not a token this project can
 * verify" — an expired refresh token, a session minted before the project's JWT
 * secret was rotated, or a hand-edited storage entry.
 *
 * While such a token sits in local storage it is attached to *every* request, so
 * the whole shop looks broken: PostgREST answers 401 "None of the keys was able
 * to decode the JWT" even though the anon key itself is perfectly valid.
 */
function isUnverifiableSessionError(error: {
  code?: string | undefined;
  message?: string | undefined;
}): boolean {
  const message = error.message ?? "";
  return (
    error.code === "bad_jwt" ||
    error.code === "invalid_jwt" ||
    error.code === "session_not_found" ||
    error.code === "refresh_token_not_found" ||
    /invalid jwt|jwt expired|signature is invalid|unable to parse or verify|could not decode|refresh token .* not found|token has expired/i.test(
      message,
    )
  );
}

let healPromise: Promise<boolean> | null = null;

/**
 * Drops a stored session that the project can no longer verify.
 *
 * Public reads and reviews only need the anon key, so discarding an unverifiable
 * session turns a fully broken shop back into a working one and sends the user
 * through a fresh sign-in instead of an "invalid JWT" screen. Safe to call from
 * every cloud call site: the work happens once per page load and later callers
 * await the same promise.
 *
 * Resolves true when a stale session was removed.
 */
export function healStaleSession(): Promise<boolean> {
  healPromise ??= runSessionHeal();
  return healPromise;
}

async function runSessionHeal(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;

    const { error } = await supabase.auth.getUser();
    if (!error || !isUnverifiableSessionError(error)) return false;

    console.warn(
      "ROELIX auth: the stored session is no longer verifiable by this project (it may predate a JWT secret rotation). Signing this browser out so the anon key can be used.",
      error.message,
    );
    await supabase.auth.signOut({ scope: "local" });
    return true;
  } catch (error) {
    // Never let a housekeeping step break a page.
    console.warn("ROELIX auth: could not validate the stored session", error);
    return false;
  }
}

/** Test hook: allow a later call to re-run the heal. */
export function resetSessionHeal(): void {
  healPromise = null;
}

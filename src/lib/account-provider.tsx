import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  PROFILE_COLUMNS,
  authErrorMessage,
  profileFromRecord,
  type CustomerProfile,
} from "@/lib/account";
import { describeError } from "@/lib/errors";

/**
 * Customer session state for the storefront.
 *
 * The provider owns exactly one thing: who is signed in and what their
 * `public.profiles` row says. Pages read it through `useAccount()`, so the header
 * control, the auth card and the admin register never each open their own auth
 * listener.
 *
 * Supabase is optional at runtime, not just at build time: on a deployment
 * without env vars, or in a unit test, the provider reports `configured: false`
 * and the storefront keeps rendering. Nothing here throws during mount.
 */

export type AccountUser = { id: string; email: string };

export type RegisterOutcome = { needsEmailConfirmation: boolean };

export type AccountContextValue = {
  user: AccountUser | null;
  profile: CustomerProfile | null;
  /** True until the first `getSession()` resolves — the header must not flash. */
  loading: boolean;
  /** Exact Supabase message when the profile row cannot be read. */
  profileError: string | null;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<RegisterOutcome>;
  /**
   * Stores the address on `public.customers` and asks Supabase for a magic link
   * plus a six-digit code. The address is saved first so the register keeps it
   * even when the customer never opens the email.
   */
  requestEmailSignIn: (input: {
    email: string;
    marketingOptIn: boolean;
    redirectPath?: string;
  }) => Promise<void>;
  /** Completes the passwordless flow with the six-digit code from the email. */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updateProfile: (input: { fullName: string; marketingOptIn: boolean }) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

type SupabaseClient = Awaited<typeof import("@/lib/supabase")>["supabase"];

const AccountContext = createContext<AccountContextValue | null>(null);

export function accountsConfigured(): boolean {
  if (import.meta.env["MODE"] === "test") return false;
  return Boolean(import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_ANON_KEY"]);
}

/** Opens a client, or null when the module/env is missing. Never throws. */
async function accountClient(): Promise<SupabaseClient | null> {
  if (!accountsConfigured()) return null;
  try {
    const { supabase } = await import("@/lib/supabase");
    return supabase;
  } catch (error) {
    console.warn("ROELIX accounts: Supabase is not available on this deployment", error);
    return null;
  }
}

const MIGRATION_HINT =
  "Account details are unavailable. Apply supabase/migrations/20261030150000_customer_accounts.sql, then reload.";

/** A profiles read that blames the schema means the migration is not applied yet. */
function isMissingProfileColumn(error: unknown): boolean {
  const shape = (error ?? {}) as { code?: string; message?: string };
  if (shape.code === "42P01" || shape.code === "42703" || shape.code === "PGRST205") return true;
  return /column .* does not exist|schema cache|could not find the table|relation .* does not exist/i.test(
    shape.message ?? "",
  );
}

function userMetadataName(user: { user_metadata?: Record<string, unknown> }): string {
  const fullName = user.user_metadata?.["full_name"];
  return typeof fullName === "string" ? fullName.trim() : "";
}

/**
 * Writes the submitted address to `public.customers` before the email is sent.
 *
 * Best effort on purpose: a deployment that has not applied the customers
 * migration must still be able to sign in — the missing row is logged, not
 * turned into a failed login the customer cannot act on.
 */
async function captureSignInEmail(
  client: SupabaseClient,
  email: string,
  marketingOptIn: boolean,
): Promise<void> {
  try {
    const { error } = await client.rpc("capture_roelix_customer_email", {
      p_email: email,
      p_marketing_opt_in: marketingOptIn,
      p_source: "signin_modal",
    });
    if (error) throw error;
  } catch (error) {
    console.warn("ROELIX accounts: the sign-in address could not be saved", error);
  }
}

/** Attaches the signed-in account to its address row; telemetry only. */
async function linkSignInEmail(client: SupabaseClient): Promise<void> {
  try {
    const { error } = await client.rpc("link_roelix_customer_account");
    if (error) throw error;
  } catch (error) {
    console.warn("ROELIX accounts: the sign-in address could not be linked", error);
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const configured = accountsConfigured();

  const clientRef = useRef<SupabaseClient | null>(null);
  const currentUserId = useRef<string | null>(null);

  /** Reads the signed-in customer's row, or synthesises one from auth metadata. */
  const loadProfile = useCallback(async (nextUser: AccountUser | null) => {
    const client = clientRef.current;

    if (!nextUser || !client) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    try {
      const { data, error } = await client
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", nextUser.id)
        .maybeSingle();

      if (error) throw error;

      const mapped = profileFromRecord(data);
      if (mapped) {
        setProfile(mapped);
        setProfileError(null);
        return;
      }

      // The auth user exists but the trigger has not written a row (or the
      // table is missing one of the new columns). Keep the header usable.
      setProfile({
        id: nextUser.id,
        email: nextUser.email,
        fullName: "",
        role: "customer",
        marketingOptIn: false,
        createdAt: new Date().toISOString(),
        confirmedAt: null,
        lastSeenAt: null,
      });
      setProfileError(null);
    } catch (error) {
      if (isMissingProfileColumn(error)) {
        setProfileError(`${MIGRATION_HINT}\n${describeError(error)}`);
      } else {
        setProfileError(describeError(error, "Could not read your account details."));
      }
      setProfile({
        id: nextUser.id,
        email: nextUser.email,
        fullName: "",
        role: "customer",
        marketingOptIn: false,
        createdAt: new Date().toISOString(),
        confirmedAt: null,
        lastSeenAt: null,
      });
    }
  }, []);

  const applySessionUser = useCallback(
    async (nextUser: AccountUser | null) => {
      const changed = currentUserId.current !== (nextUser?.id ?? null);
      currentUserId.current = nextUser?.id ?? null;
      setUser(nextUser);
      if (changed) await loadProfile(nextUser);
    },
    [loadProfile],
  );

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const client = await accountClient();
      if (disposed) return;

      if (!client) {
        setLoading(false);
        return;
      }
      clientRef.current = client;

      const { data, error } = await client.auth.getSession();
      if (disposed) return;
      if (error) {
        console.warn("ROELIX accounts: could not read the stored session", error);
      }

      const sessionUser = data.session?.user;
      await applySessionUser(
        sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? "" } : null,
      );
      if (disposed) return;
      setLoading(false);

      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (disposed) return;
        const next = session?.user;
        // Every way in — magic link, six-digit code, password — lands here, so
        // this is the one place the address register is joined to the account.
        if (event === "SIGNED_IN" && next) void linkSignInEmail(client);
        void applySessionUser(next ? { id: next.id, email: next.email ?? "" } : null);
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    })();

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [applySessionUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const client = await accountClient();
      if (!client) throw new Error(MIGRATION_HINT);

      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw error;

      // Telemetry only: a missing RPC must never fail a valid sign in.
      try {
        await client.rpc("touch_roelix_session");
      } catch (telemetryError) {
        console.warn("ROELIX accounts: could not record the sign in", telemetryError);
      }

      await applySessionUser(
        data.user ? { id: data.user.id, email: data.user.email ?? cleanEmail } : null,
      );
    },
    [applySessionUser],
  );

  const requestEmailSignIn = useCallback(
    async (input: { email: string; marketingOptIn: boolean; redirectPath?: string }) => {
      const client = await accountClient();
      if (!client) throw new Error(MIGRATION_HINT);

      const cleanEmail = input.email.trim().toLowerCase();
      await captureSignInEmail(client, cleanEmail, input.marketingOptIn);

      const { error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          // A first-time visitor is a new account: the link both proves the
          // address and creates the customer, which is what the one-field
          // modal promises.
          shouldCreateUser: true,
          ...(typeof window === "undefined"
            ? {}
            : {
                emailRedirectTo: `${window.location.origin}${input.redirectPath ?? "/"}`,
              }),
        },
      });
      if (error) throw error;
    },
    [],
  );

  const verifyEmailCode = useCallback(
    async (email: string, code: string) => {
      const client = await accountClient();
      if (!client) throw new Error(MIGRATION_HINT);

      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await client.auth.verifyOtp({
        email: cleanEmail,
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;

      try {
        await client.rpc("touch_roelix_session");
      } catch (telemetryError) {
        console.warn("ROELIX accounts: could not record the sign in", telemetryError);
      }

      await applySessionUser(
        data.user ? { id: data.user.id, email: data.user.email ?? cleanEmail } : null,
      );
    },
    [applySessionUser],
  );

  const register = useCallback(
    async (input: { fullName: string; email: string; password: string }) => {
      const client = await accountClient();
      if (!client) throw new Error(MIGRATION_HINT);

      const cleanEmail = input.email.trim().toLowerCase();
      const { data, error } = await client.auth.signUp({
        email: cleanEmail,
        password: input.password,
        options: {
          data: { full_name: input.fullName.trim() },
          ...(typeof window === "undefined" ? {} : { emailRedirectTo: window.location.origin }),
        },
      });
      if (error) throw error;

      // With confirmations on, Supabase answers 200 for an address that is
      // already registered and returns an empty identity list instead of an error.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw { code: "user_already_exists", message: "User already registered" };
      }

      if (data.session && data.user) {
        await applySessionUser({ id: data.user.id, email: data.user.email ?? cleanEmail });
      }

      return { needsEmailConfirmation: !data.session };
    },
    [applySessionUser],
  );

  const signOut = useCallback(async () => {
    const client = await accountClient();
    if (!client) return;

    const { error } = await client.auth.signOut();
    if (error) throw error;

    currentUserId.current = null;
    setUser(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const client = await accountClient();
    if (!client) throw new Error(MIGRATION_HINT);

    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      ...(typeof window === "undefined" ? {} : { redirectTo: window.location.origin }),
    });
    if (error) throw error;
  }, []);

  const updateProfile = useCallback(
    async (input: { fullName: string; marketingOptIn: boolean }) => {
      const client = await accountClient();
      if (!client) throw new Error(MIGRATION_HINT);

      const { error } = await client.rpc("update_roelix_customer_profile", {
        p_full_name: input.fullName.trim(),
        p_marketing_opt_in: input.marketingOptIn,
      });
      if (error) throw error;

      await loadProfile(user);
    },
    [loadProfile, user],
  );

  const refreshProfile = useCallback(async () => {
    await loadProfile(user);
  }, [loadProfile, user]);

  const value = useMemo<AccountContextValue>(
    () => ({
      user,
      profile,
      loading,
      profileError,
      configured,
      signIn,
      register,
      requestEmailSignIn,
      verifyEmailCode,
      signOut,
      requestPasswordReset,
      updateProfile,
      refreshProfile,
    }),
    [
      user,
      profile,
      loading,
      profileError,
      configured,
      signIn,
      register,
      requestEmailSignIn,
      verifyEmailCode,
      signOut,
      requestPasswordReset,
      updateProfile,
      refreshProfile,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside <AccountProvider>");
  return value;
}

/** Re-exported so callers can word a failed auth call the same way the card does. */
export { authErrorMessage };

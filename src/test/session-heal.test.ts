import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The stored-session heal is the one piece of the Supabase bootstrap that cannot
 * be exercised through the storefront: it needs a token the project refuses, and
 * that is exactly what a rotated JWT secret leaves behind in a browser.
 *
 * These tests stand in a fake client for the real one, so the decision ("is this
 * token verifiable, and do we purge it?") is covered without a network.
 */
const auth = {
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth }),
}));

const SESSION = {
  access_token: "header.payload.signature",
  refresh_token: "refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "user-1" },
};

beforeEach(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://limvczvkeoecahvrkbia.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon.jwt.value");
  auth.getSession.mockReset();
  auth.getUser.mockReset();
  auth.signOut.mockClear();
  const mod = await import("@/lib/supabase");
  mod.resetSessionHeal();
});

describe("stale session healing", () => {
  it("leaves a verifiable session alone", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } });
    auth.getUser.mockResolvedValue({ data: { user: SESSION.user }, error: null });

    const { healStaleSession, resetSessionHeal } = await import("@/lib/supabase");
    resetSessionHeal();

    await expect(healStaleSession()).resolves.toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("signs out when the project cannot verify the token's signature", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } });
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: {
        code: "bad_jwt",
        message: "invalid JWT: unable to parse or verify signature, signature is invalid",
      },
    });

    const { healStaleSession, resetSessionHeal } = await import("@/lib/supabase");
    resetSessionHeal();

    await expect(healStaleSession()).resolves.toBe(true);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("signs out when the refresh token is gone", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } });
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { code: "refresh_token_not_found", message: "Invalid Refresh Token" },
    });

    const { healStaleSession, resetSessionHeal } = await import("@/lib/supabase");
    resetSessionHeal();

    await expect(healStaleSession()).resolves.toBe(true);
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("does nothing for a visitor with no session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });

    const { healStaleSession, resetSessionHeal } = await import("@/lib/supabase");
    resetSessionHeal();

    await expect(healStaleSession()).resolves.toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("swallows a network failure so a page still renders", async () => {
    auth.getSession.mockRejectedValue(new Error("Failed to fetch"));

    const { healStaleSession, resetSessionHeal } = await import("@/lib/supabase");
    resetSessionHeal();

    await expect(healStaleSession()).resolves.toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

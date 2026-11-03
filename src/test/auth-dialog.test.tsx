import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { AuthDialog } from "@/components/site/auth-dialog";
import { StoreProvider } from "@/lib/store";

/**
 * The card is tested with the account layer stubbed: `accountsConfigured()` is
 * false under Vitest, which would disable the form before any assertion. The
 * stub also records what the card asks the provider to do, so the flow — not
 * the network — is what the test checks.
 */
const account = vi.hoisted(() => ({
  requestEmailSignIn: vi.fn(async () => {}),
  verifyEmailCode: vi.fn(async () => {}),
  signIn: vi.fn(async () => {}),
  requestPasswordReset: vi.fn(async () => {}),
  signOut: vi.fn(async () => {}),
}));

vi.mock("@/lib/account-provider", () => ({
  AccountProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAccount: () => ({
    user: null,
    profile: null,
    loading: false,
    profileError: null,
    configured: true,
    signIn: account.signIn,
    register: vi.fn(),
    requestEmailSignIn: account.requestEmailSignIn,
    verifyEmailCode: account.verifyEmailCode,
    signOut: account.signOut,
    requestPasswordReset: account.requestPasswordReset,
    updateProfile: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

function renderDialog() {
  return render(
    <StoreProvider>
      <AuthDialog open onOpenChange={() => {}} />
    </StoreProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("sign-in modal", () => {
  it("renders the reference layout in the ROELIX palette", async () => {
    renderDialog();

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Sign in or create an account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with shop/i })).toBeInTheDocument();
    expect(screen.getByText(/^or$/i)).toBeInTheDocument();

    const email = screen.getByLabelText("Email address");
    expect(email).toHaveAttribute("type", "email");
    expect(screen.getByRole("button", { name: "Continue with email" })).toBeInTheDocument();

    // Marketing consent is checked for a visitor who has not touched it.
    expect(
      screen.getByRole("checkbox", { name: /email me with news and offers/i }),
    ).toHaveAttribute("aria-checked", "true");

    const terms = screen.getByRole("link", { name: "Terms of service" });
    expect(terms).toHaveAttribute("href", "/terms");
  });

  it("rejects an unusable address without leaving the email step", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();

    expect(account.requestEmailSignIn).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Sign-in code")).not.toBeInTheDocument();
  });

  it("saves the address, then asks for the six-digit code", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: " Nour@Example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));

    await waitFor(() => expect(account.requestEmailSignIn).toHaveBeenCalledTimes(1));
    expect(account.requestEmailSignIn).toHaveBeenCalledWith({
      email: "nour@example.com",
      marketingOptIn: true,
      redirectPath: "/",
    });

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("nour@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Sign-in code")).toBeInTheDocument();
  });

  it("verifies the six-digit code against the address it was sent to", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "nour@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));

    const input = await screen.findByLabelText("Sign-in code");
    expect(screen.getByRole("button", { name: "Verify code" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "123456" } });

    await waitFor(() =>
      expect(account.verifyEmailCode).toHaveBeenCalledWith("nour@example.com", "123456"),
    );
  });

  it("passes a cleared consent checkbox through to the save", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("checkbox", { name: /email me with news and offers/i }));
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "hala@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));

    await waitFor(() =>
      expect(account.requestEmailSignIn).toHaveBeenCalledWith({
        email: "hala@example.com",
        marketingOptIn: false,
        redirectPath: "/",
      }),
    );
  });
});

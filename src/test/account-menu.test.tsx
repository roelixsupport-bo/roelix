import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";

import { AccountMenu } from "@/components/site/account-menu";
import { StoreProvider } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  useAccount: vi.fn(),
  useAuthDialog: vi.fn(() => ({ open: vi.fn() })),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: ComponentPropsWithoutRef<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/account-provider", () => ({
  useAccount: mocks.useAccount,
}));

vi.mock("@/lib/auth-dialog-provider", () => ({
  useAuthDialog: mocks.useAuthDialog,
}));

async function renderMenu(role: "customer" | "admin", profileId = "user-1") {
  mocks.useAccount.mockReturnValue({
    user: { id: "user-1", email: "customer@example.com" },
    profile: {
      id: profileId,
      email: "customer@example.com",
      fullName: "Customer",
      role,
      marketingOptIn: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      confirmedAt: null,
      lastSeenAt: null,
    },
    loading: false,
    profileError: null,
    signOut: vi.fn(),
  });

  render(
    <StoreProvider>
      <AccountMenu />
    </StoreProvider>,
  );

  fireEvent.keyDown(screen.getByRole("button", { name: /open your account/i }), {
    key: "Enter",
  });
  await screen.findByRole("menu");
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("account menu admin link", () => {
  it("does not show the admin dashboard to customers", async () => {
    await renderMenu("customer");

    expect(screen.queryByRole("menuitem", { name: /admin dashboard/i })).not.toBeInTheDocument();
  });

  it("shows the admin dashboard only for a matching team profile", async () => {
    await renderMenu("admin");
    expect(screen.getByRole("menuitem", { name: /admin dashboard/i })).toBeInTheDocument();

    cleanup();
    await renderMenu("admin", "previous-user");
    expect(screen.queryByRole("menuitem", { name: /admin dashboard/i })).not.toBeInTheDocument();
  });
});

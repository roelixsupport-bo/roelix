import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const accountState = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  loading: false,
}));

vi.mock("@/lib/account-provider", () => ({
  useAccount: () => accountState,
}));

vi.mock("@/components/site/auth-dialog", () => ({
  AuthDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (open ? <button onClick={() => onOpenChange(false)}>Close dialog</button> : null),
}));

import { AuthDialogProvider } from "@/lib/auth-dialog-provider";

describe("automatic sign-in prompt", () => {
  beforeEach(() => {
    accountState.user = null;
    accountState.loading = false;
    window.sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("opens the sign-in dialog after five seconds", async () => {
    render(
      <AuthDialogProvider>
        <div />
      </AuthDialogProvider>,
    );

    await act(async () => {
      vi.advanceTimersByTime(4_999);
    });
    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
  });

  it("does not prompt a signed-in customer", async () => {
    accountState.user = { id: "customer-1", email: "customer@example.com" };

    render(
      <AuthDialogProvider>
        <div />
      </AuthDialogProvider>,
    );

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();
  });

  it("does not prompt again after the customer closes it", async () => {
    render(
      <AuthDialogProvider>
        <div />
      </AuthDialogProvider>,
    );

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("roelix_auth_prompt_seen")).toBe("true");
  });
});

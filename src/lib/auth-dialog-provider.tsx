import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { AuthDialog } from "@/components/site/auth-dialog";

/**
 * One auth card for the whole storefront.
 *
 * The header control used to own the dialog, which left every other "sign in to
 * continue" moment — writing a review, for one — with no way to open it. The
 * card now lives here and anything under the provider can call `open()`.
 */
export type AuthDialogControl = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const AuthDialogContext = createContext<AuthDialogControl | null>(null);

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<AuthDialogControl>(
    () => ({ open: () => setIsOpen(true), close: () => setIsOpen(false), isOpen }),
    [isOpen],
  );

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <AuthDialog open={isOpen} onOpenChange={setIsOpen} />
    </AuthDialogContext.Provider>
  );
}

export function useAuthDialog(): AuthDialogControl {
  const value = useContext(AuthDialogContext);
  if (!value) throw new Error("useAuthDialog must be used inside <AuthDialogProvider>");
  return value;
}

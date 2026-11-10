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

import { AuthDialog } from "@/components/site/auth-dialog";
import { useAccount } from "@/lib/account-provider";

const AUTO_PROMPT_DELAY_MS = 5_000;
const AUTO_PROMPT_SESSION_KEY = "roelix_auth_prompt_seen";

function rememberAuthPrompt() {
  try {
    window.sessionStorage.setItem(AUTO_PROMPT_SESSION_KEY, "true");
  } catch (error) {
    console.warn("ROELIX sign-in prompt could not be saved for this session", error);
  }
}

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
  const { user, loading } = useAccount();
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (loading || user || isOpen || hasOpenedRef.current) return;

    try {
      if (window.sessionStorage.getItem(AUTO_PROMPT_SESSION_KEY) === "true") {
        hasOpenedRef.current = true;
        return;
      }
    } catch (error) {
      console.warn("ROELIX sign-in prompt could not be checked for this session", error);
    }

    const timer = window.setTimeout(() => {
      hasOpenedRef.current = true;
      rememberAuthPrompt();
      setIsOpen(true);
    }, AUTO_PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isOpen, loading, user]);

  const open = useCallback(() => {
    hasOpenedRef.current = true;
    rememberAuthPrompt();
    setIsOpen(true);
  }, []);

  const onOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      hasOpenedRef.current = true;
      rememberAuthPrompt();
    }
    setIsOpen(nextOpen);
  }, []);

  const value = useMemo<AuthDialogControl>(
    () => ({ open, close: () => setIsOpen(false), isOpen }),
    [isOpen, open],
  );

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <AuthDialog open={isOpen} onOpenChange={onOpenChange} />
    </AuthDialogContext.Provider>
  );
}

export function useAuthDialog(): AuthDialogControl {
  const value = useContext(AuthDialogContext);
  if (!value) throw new Error("useAuthDialog must be used inside <AuthDialogProvider>");
  return value;
}

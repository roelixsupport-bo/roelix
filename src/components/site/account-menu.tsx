import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, LayoutDashboard, UserRound } from "lucide-react";
import { toast } from "sonner";

import { AuthDialog } from "@/components/site/auth-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown_menu";
import {
  displayNameFor,
  initialsFor,
  isTeamRole,
  joinDateLabel,
} from "@/lib/account";
import { useAccount } from "@/lib/account-provider";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    account: "Account",
    openAccount: "Open your account",
    joined: "Joined",
    unconfirmed: "Email not confirmed",
    wishlist: "My wishlist",
    admin: "Admin dashboard",
    signOut: "Sign out",
    signedOut: "Signed out.",
    signOutFailed: "Could not sign out.",
  },
  ar: {
    account: "الحساب",
    openAccount: "افتح حسابك",
    joined: "تاريخ الانضمام",
    unconfirmed: "البريد غير مؤكد",
    wishlist: "قائمة أمنياتي",
    admin: "لوحة التحكم",
    signOut: "تسجيل الخروج",
    signedOut: "تم تسجيل الخروج.",
    signOutFailed: "تعذر تسجيل الخروج.",
  },
} as const;

/**
 * The account affordance in the main header.
 *
 * Signed out it is the same 22px outline glyph as the bag beside it, and it opens
 * the auth card. Signed in it becomes the identity tile — initials on navy with a
 * gold hairline — and opens the account card. One component owns both states so
 * the header stays free of session logic.
 */
export function AccountMenu() {
  const { lang } = useStore();
  const langKey = lang === "ar" ? "ar" : "en";
  const text = COPY[langKey];
  const { user, profile, loading, profileError, signOut } = useAccount();
  const [authOpen, setAuthOpen] = useState(false);

  const name = displayNameFor(profile, user?.email ?? "");
  const initials = initialsFor({
    ...(profile?.fullName ? { fullName: profile.fullName } : {}),
    ...(user?.email ? { email: user.email } : {}),
  });

  async function handleSignOut() {
    try {
      await signOut();
      toast.success(text.signedOut);
    } catch (error) {
      console.error("ROELIX sign out failed", error);
      toast.error(error instanceof Error ? error.message : text.signOutFailed);
    }
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          aria-label={text.account}
          title={text.account}
          aria-busy={loading || undefined}
          className={cn(
            "relative p-1.5 text-foreground transition-colors hover:text-gold",
            loading && "opacity-40",
          )}
        >
          <UserRound size={22} />
        </button>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${text.openAccount}: ${name}`}
            title={name}
            className="identity-tile h-8 w-8 text-[0.8rem] tracking-[0.04em] transition-colors hover:shadow-[inset_0_0_0_1px_var(--gold)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gold"
          >
            {initials}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-[17rem] rounded-[2px] border bg-card p-0 text-card-foreground shadow-lux"
        >
          <div className="p-4" dir={langKey === "ar" ? "rtl" : "ltr"}>
            <div className="flex items-start gap-3">
              <span className="identity-tile h-10 w-10 shrink-0 text-sm">{initials}</span>
              <div className="min-w-0">
                <p className="truncate font-serif text-base leading-tight">{name}</p>
                <p className="mt-0.5 break-all text-xs text-muted-foreground">
                  {profile?.email || user.email}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
              {text.joined}
              {profile ? ` · ${joinDateLabel(profile.createdAt, langKey)}` : ""}
            </p>

            {profile && profile.role === "customer" && !profile.confirmedAt && (
              <p className="mt-1 text-[0.65rem] text-gold">{text.unconfirmed}</p>
            )}

            {profileError && (
              <p className="mt-2 break-words text-[0.65rem] leading-relaxed text-destructive">
                {profileError}
              </p>
            )}
          </div>

          <DropdownMenuSeparator className="my-0" />

          <DropdownMenuItem asChild className="cursor-pointer rounded-none px-4 py-2.5">
            <Link to="/shop" search={{ wish: true }}>
              <Heart size={14} aria-hidden="true" />
              {text.wishlist}
            </Link>
          </DropdownMenuItem>

          {isTeamRole(profile?.role ?? "customer") && (
            <DropdownMenuItem asChild className="cursor-pointer rounded-none px-4 py-2.5">
              <Link to="/admin">
                <LayoutDashboard size={14} aria-hidden="true" />
                {text.admin}
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="my-0" />

          <DropdownMenuItem
            onSelect={() => void handleSignOut()}
            className="cursor-pointer rounded-none px-4 py-3 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground underline underline-offset-4 hover:text-foreground focus:text-foreground"
          >
            {text.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}

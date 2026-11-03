import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

import { AuthDialog } from "@/components/site/auth-dialog";
import { ProfileIcon } from "@/components/site/profile-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown_menu";
import { displayNameFor, isTeamRole, joinDateLabel } from "@/lib/account";
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

/** One hairline trigger for both states, so the header never grows an extra tile. */
const TRIGGER_CLASS =
  "relative p-1.5 text-foreground transition-colors hover:text-gold focus-visible:text-gold focus-visible:outline-hidden";

/**
 * The account affordance in the main header.
 *
 * Signed out it opens the auth card; signed in it opens the account card. In
 * both states it is the same 22px outline profile glyph — the ROELIX mark stays
 * the only lettering on the bar, and the hairline icon matches the bag beside it.
 */
export function AccountMenu() {
  const { lang } = useStore();
  const langKey = lang === "ar" ? "ar" : "en";
  const text = COPY[langKey];
  const { user, profile, loading, profileError, signOut } = useAccount();
  const [authOpen, setAuthOpen] = useState(false);

  const name = displayNameFor(profile, user?.email ?? "");

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
          className={cn(TRIGGER_CLASS, loading && "opacity-40")}
        >
          <ProfileIcon size={22} />
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
            className={TRIGGER_CLASS}
          >
            <ProfileIcon size={22} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={10}
          className="w-[17rem] rounded-[2px] border bg-card p-0 text-card-foreground shadow-lux"
        >
          <div className="p-4" dir={langKey === "ar" ? "rtl" : "ltr"}>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold/45 text-foreground">
                <ProfileIcon size={20} />
              </span>
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

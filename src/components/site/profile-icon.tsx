import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

type ProfileIconProps = {
  size?: number;
  /** 1.5 keeps the glyph on the same hairline weight as the bag beside it. */
  strokeWidth?: number;
  className?: string;
};

/**
 * The storefront profile mark.
 *
 * The header shows one identity affordance in both states: a single hairline
 * outline glyph, navy on the page background and gold on hover — never an
 * initials tile, which competes with the wordmark and reads as a second logo.
 * The signed-in account card reuses the same glyph inside a gold hairline ring.
 */
export function ProfileIcon({ size = 22, strokeWidth = 1.5, className }: ProfileIconProps) {
  return (
    <UserRound
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    />
  );
}

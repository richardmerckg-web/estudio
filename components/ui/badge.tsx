import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "pending" | "confirmed" | "checked_in" | "checked_out" | "rejected" | "cancelled" | "expired";

export function Badge({
  className = "",
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={`ui-badge ui-badge--${variant} ${className}`.trim()} {...props} />;
}

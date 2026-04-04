import * as React from "react";

import { cn } from "@/lib/utils";

/** Inline shimmer placeholder for metric numbers (not full-card skeleton). */
export function ValueShimmer({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      role="presentation"
      className={cn(
        "value-shimmer inline-block min-h-[1.15em] rounded-md align-baseline",
        className
      )}
      {...props}
    />
  );
}

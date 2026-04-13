import * as React from "react";

import { cn } from "@/lib/utils";

type PageHeadingProps = {
  title: string;
  description?: React.ReactNode;
  className?: string;
  /** Optional leading icon (e.g. People page) — matches shell brand tile style */
  icon?: React.ComponentType<{ className?: string }>;
};

/** Shared title block so page titles align with the shell header. */
export function PageHeading({
  title,
  description,
  className,
  icon: Icon,
}: PageHeadingProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3 sm:items-center sm:gap-4",
        className
      )}
    >
      {Icon ? (
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner ring-1 ring-primary/10"
          aria-hidden
        >
          <Icon className="size-5 text-primary" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description != null ? (
          <div className="text-muted-foreground mt-1 flex flex-wrap items-start gap-x-1.5 gap-y-1 text-sm">
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );
}

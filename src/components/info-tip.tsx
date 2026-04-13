"use client";

import * as React from "react";
import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type InfoTipProps = {
  children: React.ReactNode;
  /** Screen reader label for the trigger */
  label?: string;
  className?: string;
  contentClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
};

/**
 * Small info icon; hover (or focus) shows technical or extra detail without cluttering the page.
 */
export function InfoTip({
  children,
  label = "More information",
  className,
  contentClassName,
  side = "top",
}: InfoTipProps) {
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-muted-foreground hover:text-foreground -m-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label={label}
        >
          <Info className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn(
          "max-w-[min(22rem,calc(100vw-2rem))] text-left text-xs leading-relaxed",
          contentClassName
        )}
      >
        <div className="space-y-2 [&_code]:rounded [&_code]:bg-background/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px]">
          {children}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

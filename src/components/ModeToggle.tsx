"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useThemeConfig } from "@/components/active-theme";
import { cn } from "@/lib/utils";

export function ModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useThemeConfig();

  const toggleTheme = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "relative size-9 shrink-0 rounded-xl text-muted-foreground",
        "hover:bg-background/90 hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/60",
        className
      )}
      aria-label="Toggle theme"
    >
      <Sun className="size-[1.15rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-[1.15rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

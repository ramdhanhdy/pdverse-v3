"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";
import { useThemeStore } from "@/lib/store/themeStore";

function ThemeBridge() {
  const { theme: nextTheme, setTheme: setNextTheme } = useTheme();
  const { theme: storeTheme, setTheme: setStoreTheme } = useThemeStore();
  const initialSyncCompleted = React.useRef(false);

  React.useEffect(() => {
    if (nextTheme && !initialSyncCompleted.current) {
      setStoreTheme(nextTheme as 'light' | 'dark' | 'system');
      initialSyncCompleted.current = true;
    }
  }, [nextTheme, setStoreTheme]);

  React.useEffect(() => {
    if (initialSyncCompleted.current && storeTheme !== nextTheme) {
      setNextTheme(storeTheme);
    }
  }, [storeTheme, nextTheme, setNextTheme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <NextThemesProvider {...props}>
      {children}
      <ThemeBridge />
    </NextThemesProvider>
  );
}

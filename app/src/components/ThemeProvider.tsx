"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => { },
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "archdiagram-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Read persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
    }
    setMounted(true);
  }, []);

  // Apply data-theme attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Ensure we always render children to avoid Next.js hydration blocking
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {/* Optional: Add an inline script here if we want to strictly prevent flash, 
          but simply rendering children works safely with suppressHydrationWarning. */}
      <div style={{ visibility: mounted ? "visible" : "hidden", display: "contents" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

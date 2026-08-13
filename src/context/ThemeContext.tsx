"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (e?: React.MouseEvent) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  mounted: false,
});

const updateMobileStatusThemeColor = (activeTheme: Theme) => {
  if (typeof document === "undefined") return;

  const targetColor = activeTheme === "dark" ? "#090D16" : "#F8FAFC";
  
  let metaTags = document.querySelectorAll('meta[name="theme-color"]');
  if (metaTags.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = targetColor;
    document.head.appendChild(meta);
  } else {
    metaTags.forEach((meta) => {
      meta.setAttribute("content", targetColor);
    });
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      let initial: Theme = "dark";
      if (saved === "dark" || saved === "light") {
        initial = saved;
      } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        initial = "light";
      }
      if (initial === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      updateMobileStatusThemeColor(initial);
      return initial;
    }
    return "dark";
  });
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme");
    let activeTheme: Theme = "dark";
    if (saved === "dark" || saved === "light") {
      activeTheme = saved;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      activeTheme = "light";
    }

    setTheme(activeTheme);
    if (activeTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    updateMobileStatusThemeColor(activeTheme);
  }, []);

  const toggleTheme = (e?: React.MouseEvent) => {
    const nextTheme = theme === "light" ? "dark" : "light";

    const updateDOM = () => {
      setTheme(nextTheme);
      localStorage.setItem("theme", nextTheme);
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      updateMobileStatusThemeColor(nextTheme);
    };

    if (typeof window === "undefined" || typeof document === "undefined") {
      updateDOM();
      return;
    }

    const doc = document as any;
    if ("startViewTransition" in doc && typeof doc.startViewTransition === "function") {
      const x = e?.clientX ?? window.innerWidth / 2;
      const y = e?.clientY ?? window.innerHeight / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = doc.startViewTransition(() => {
        updateDOM();
      });

      transition.ready.then(() => {
        const clipPath = [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`
        ];
        document.documentElement.animate(
          {
            clipPath: nextTheme === "dark" ? clipPath : [...clipPath].reverse()
          },
          {
            duration: 450,
            easing: "ease-in-out",
            pseudoElement: nextTheme === "dark"
              ? "::view-transition-new(root)"
              : "::view-transition-old(root)"
          }
        );
      });
    } else {
      document.documentElement.classList.add("theme-transitioning");
      updateDOM();
      setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
      }, 450);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

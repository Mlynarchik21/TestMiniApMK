import { useState, useEffect } from "react";

export type ThemeName = "dark" | "light";

export type Theme = {
  bg: string;
  surface: string;
  card: string;
  text: string;
  textMain: string;
  textSoft: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderSoft: string;
  borderHard: string;
  green: string;
  red: string;
  blue: string;
  yellow: string;
  cyan: string;
  brand: string;
};

const dark: Theme = {
  bg: "#000",
  surface: "#0a0a0a",
  card: "rgba(255,255,255,0.04)",
  text: "#f3f3f3",
  textMain: "rgba(255,255,255,0.96)",
  textSoft: "rgba(255,255,255,0.78)",
  textMuted: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.42)",
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.09)",
  borderHard: "rgba(255,255,255,0.18)",
  green: "#64d97b",
  red: "#ff6a6a",
  blue: "#8eb2ff",
  yellow: "#f3d709",
  cyan: "#6fdcff",
  brand: "#2979ff",
};

const light: Theme = {
  bg: "#f2f2f7",
  surface: "#ffffff",
  card: "rgba(0,0,0,0.03)",
  text: "#111111",
  textMain: "rgba(0,0,0,0.96)",
  textSoft: "rgba(0,0,0,0.76)",
  textMuted: "rgba(0,0,0,0.55)",
  textFaint: "rgba(0,0,0,0.38)",
  border: "rgba(0,0,0,0.12)",
  borderSoft: "rgba(0,0,0,0.07)",
  borderHard: "rgba(0,0,0,0.18)",
  green: "#16a34a",
  red: "#dc2626",
  blue: "#2563eb",
  yellow: "#d97706",
  cyan: "#0891b2",
  brand: "#1d4ed8",
};

export function getStoredTheme(): ThemeName {
  try {
    return localStorage.getItem("theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(name: ThemeName) {
  try {
    localStorage.setItem("theme", name);
    if (name === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch {}
}

export function useTheme(): { T: Theme; theme: ThemeName; setTheme: (t: ThemeName) => void } {
  const [theme, setThemeName] = useState<ThemeName>("dark");

  useEffect(() => {
    setThemeName(getStoredTheme());
  }, []);

  function setTheme(t: ThemeName) {
    setThemeName(t);
    applyTheme(t);
  }

  return { T: theme === "light" ? light : dark, theme, setTheme };
}

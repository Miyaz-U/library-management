import { useState } from "react";

const THEME_KEY = "library_theme";

export default function ThemeToggle() {
  // index.html already set data-theme before React started, so we just read it
  const [theme, setTheme] = useState(
    document.documentElement.getAttribute("data-theme") || "light"
  );

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="btn btn-small btn-ghost theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
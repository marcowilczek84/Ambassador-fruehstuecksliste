"use client";

import { useEffect } from "react";

const THEMES = [
  { id: "petrol", label: "Petrol", colors: ["#6ebfc4", "#edf8f8", "#d99a00"] },
  { id: "classic", label: "Classic", colors: ["#2b3134", "#eef0f1", "#d99a00"] },
] as const;

type ThemeId = typeof THEMES[number]["id"];
const STORAGE_KEY = "ambassador-color-theme";

function isThemeId(value: string | null): value is ThemeId {
  return Boolean(value && THEMES.some(theme => theme.id === value));
}

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.colorTheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  document.querySelectorAll<HTMLButtonElement>(".theme-choice").forEach(button => {
    const selected = button.dataset.theme === theme;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function buildPicker(card: HTMLElement) {
  if (card.querySelector(".theme-picker-block")) return;

  const logoutButton = Array.from(card.querySelectorAll<HTMLButtonElement>(":scope > button")).find(button =>
    /Abmelden|Sign out|Đăng xuất/i.test(button.textContent || "")
  );

  const block = document.createElement("div");
  block.className = "theme-picker-block";

  const title = document.createElement("div");
  title.className = "menu-label theme-picker-title";
  title.textContent = "Design";
  block.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "theme-choice-grid";

  const saved = localStorage.getItem(STORAGE_KEY);
  const active: ThemeId = isThemeId(saved) ? saved : "petrol";

  THEMES.forEach(theme => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `theme-choice${theme.id === active ? " selected" : ""}`;
    button.dataset.theme = theme.id;
    button.setAttribute("aria-pressed", theme.id === active ? "true" : "false");
    button.setAttribute("aria-label", `${theme.label} auswählen`);

    const swatches = document.createElement("span");
    swatches.className = "theme-swatches";
    theme.colors.forEach(color => {
      const swatch = document.createElement("i");
      swatch.style.background = color;
      swatches.appendChild(swatch);
    });

    const label = document.createElement("span");
    label.className = "theme-choice-label";
    label.textContent = theme.label;

    const check = document.createElement("span");
    check.className = "theme-choice-check";
    check.textContent = "✓";

    button.append(swatches, label, check);
    button.addEventListener("click", () => applyTheme(theme.id));
    grid.appendChild(button);
  });

  block.appendChild(grid);
  if (logoutButton) card.insertBefore(block, logoutButton);
  else card.appendChild(block);
}

export default function ThemeSelector() {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const theme: ThemeId = isThemeId(saved) ? saved : "petrol";
    applyTheme(theme);

    const scan = () => document.querySelectorAll<HTMLElement>(".menu-card").forEach(buildPicker);
    scan();

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

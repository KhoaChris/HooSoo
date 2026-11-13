import { useSyncExternalStore } from "react";
export type Locale = "vi" | "en";
export type Theme = "light" | "dark";
export const PREFERENCES_KEY = "hoosoo:appearance:v1";
type Preferences = { locale: Locale; theme: Theme };
export function parsePreferences(
  raw: string | null,
  dark = false,
): Preferences {
  let value: Partial<Preferences> = {};
  try {
    value = JSON.parse(raw || "{}") ?? {};
  } catch {
    /* Use defaults. */
  }
  return {
    locale: value.locale === "en" ? "en" : "vi",
    theme:
      value.theme === "dark" || (value.theme !== "light" && dark)
        ? "dark"
        : "light",
  };
}
function read(): Preferences {
  if (typeof window === "undefined") return parsePreferences(null);
  try {
    return parsePreferences(
      localStorage.getItem(PREFERENCES_KEY),
      matchMedia("(prefers-color-scheme: dark)").matches,
    );
  } catch {
    return parsePreferences(null);
  }
}
let current = read();
const listeners = new Set<() => void>();
function apply() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = current.theme;
  document.documentElement.style.colorScheme = current.theme;
  document.documentElement.lang = current.locale;
  document.title =
    current.locale === "en"
      ? "HooSoo · People management"
      : "HooSoo · Quản trị nhân lực";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", current.theme === "dark" ? "#101216" : "#f7f9fb");
}
apply();
export function setPreferences(update: Partial<Preferences>) {
  current = { ...current, ...update };
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(current));
  } catch {
    /* Session still works when storage is unavailable. */
  }
  apply();
  listeners.forEach((fn) => fn());
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key !== PREFERENCES_KEY && event.key !== null) return;
    current = read();
    apply();
    listeners.forEach((fn) => fn());
  });
export const getPreferences = () => current;
export const intlLocale = () => (current.locale === "en" ? "en-GB" : "vi-VN");
export function usePreferences() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getPreferences,
    getPreferences,
  );
}
export function useLocale() {
  return usePreferences().locale;
}

/** Sunday = 0, matching the stored work schedule. */
export function weekdayLabel(day: number) {
  if (getPreferences().locale === "vi")
    return day === 0 ? "Chủ nhật" : `Thứ ${day + 1}`;
  return new Intl.DateTimeFormat(intlLocale(), {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2023, 0, 1 + day)));
}

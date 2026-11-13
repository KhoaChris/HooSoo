import { english } from "./english";
import { getPreferences } from "./preferences";
export { useLocale, intlLocale } from "./preferences";
// Only application copy is passed here. Names, messages and stored business
// values retain their original content; API payloads always keep stable enums.
export function t(
  message: string | undefined | null,
  values: readonly unknown[] = [],
): string {
  if (!message) return "";
  const key = message.replace(/\s+/g, " ").trim();
  const translated =
    getPreferences().locale === "en" ? english[key] : undefined;
  const text =
    translated === undefined
      ? message
      : `${message.match(/^\s*/)?.[0] ?? ""}${translated}${message.match(/\s*$/)?.[0] ?? ""}`;
  return text.replace(/\{(\d+)\}/g, (match, index: string) =>
    values[Number(index)] === undefined ? match : String(values[Number(index)]),
  );
}

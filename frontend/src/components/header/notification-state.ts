export function readNotificationIds(raw: string | null): string[] {
  try {
    const items: unknown = JSON.parse(raw || "[]");
    return Array.isArray(items)
      ? items
          .filter(
            (id): id is string => typeof id === "string" && id.length < 250,
          )
          .slice(-300)
      : [];
  } catch {
    return [];
  }
}
export function markNotificationsRead(
  previous: readonly string[],
  ids: readonly string[],
) {
  return [...new Set([...previous, ...ids])].slice(-300);
}

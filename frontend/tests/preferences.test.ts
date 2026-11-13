import { describe, it, expect, afterEach } from "vitest";
import {
  parsePreferences,
  setPreferences,
  getPreferences,
  intlLocale,
} from "../src/i18n/preferences";
import { t } from "../src/i18n";
import {
  readNotificationIds,
  markNotificationsRead,
} from "../src/components/header/notification-state";
afterEach(() => setPreferences({ locale: "vi", theme: "light" }));
describe("workspace preferences", () => {
  it("restores valid preferences and recovers from invalid storage", () => {
    expect(parsePreferences('{"locale":"en","theme":"dark"}')).toEqual({
      locale: "en",
      theme: "dark",
    });
    expect(parsePreferences("broken", true)).toEqual({
      locale: "vi",
      theme: "dark",
    });
    expect(parsePreferences("null")).toEqual({ locale: "vi", theme: "light" });
    expect(
      parsePreferences('{"locale":"unknown","theme":"light"}', true),
    ).toEqual({ locale: "vi", theme: "light" });
  });
  it("changes locale and formats without modifying stored content or interpolation values", () => {
    setPreferences({ locale: "en", theme: "dark" });
    expect(getPreferences()).toEqual({ locale: "en", theme: "dark" });
    expect(intlLocale()).toBe("en-GB");
    expect(t("Nhân viên")).toBe("Employees");
    expect(t("Xem hồ sơ {0}{1}", ["Nguyễn An", ""])).toBe(
      "View profile for Nguyễn An",
    );
    expect(t("Nguyễn An")).toBe("Nguyễn An");
    expect(t(undefined)).toBe("");
    expect(t("Xem hồ sơ ")).toBe("View profile ");
    setPreferences({ locale: "vi" });
    expect(t("Xem hồ sơ {0}{1}", ["Nguyễn An", ""])).toBe(
      "Xem hồ sơ Nguyễn An",
    );
  });
});
describe("notification read markers", () => {
  it("does not mark a new version of an event as read", () => {
    const previous = markNotificationsRead([], ["work:123:1"]);
    expect(previous).not.toContain("work:123:2");
    expect(
      markNotificationsRead(previous, ["work:123:1", "leave:42:approved"]),
    ).toEqual(["work:123:1", "leave:42:approved"]);
  });
  it("bounds local history and tolerates invalid data", () => {
    expect(readNotificationIds("bad")).toEqual([]);
    expect(readNotificationIds('["valid",2,null,{}]')).toEqual(["valid"]);
    expect(
      markNotificationsRead(
        [],
        Array.from({ length: 400 }, (_, i) => String(i)),
      ),
    ).toHaveLength(300);
  });
});

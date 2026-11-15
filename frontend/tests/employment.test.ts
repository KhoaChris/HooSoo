import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  contractSchema,
  probationReviewSchema,
  contractPhase,
  queryAffected,
  type EmploymentContract,
} from "@hoosoo/shared";
import { apiQueryOptions } from "../src/services/query-cache";
import { refreshQueries, cancelRefresh } from "../src/services/query-sync";
import { readChanges } from "../src/services/live-updates";
import { t } from "../src/i18n";
import { setPreferences } from "../src/i18n/preferences";
const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((c) => {
    cancelRefresh(c);
    c.clear();
  });
  vi.useRealTimers();
  setPreferences({ locale: "vi" });
});
const input = {
  employeeId: "person",
  title: "Employment agreement",
  kind: "fixed_term",
  startDate: "2026-11-01",
  endDate: "2027-01-01",
};
describe("employment input and presentation", () => {
  it("validates real dates, required contract periods and safe document protocols", () => {
    expect(contractSchema.safeParse(input).success).toBe(true);
    for (const change of [
      { endDate: "2026-02-30" },
      { endDate: "2026-10-01" },
      { endDate: "" },
      { documentUrl: "data:text/html,<script/>" },
      { kind: "indefinite" },
    ])
      expect(contractSchema.safeParse({ ...input, ...change }).success).toBe(
        false,
      );
    expect(
      contractSchema.safeParse({ ...input, kind: "indefinite", endDate: "" })
        .success,
    ).toBe(true);
  });
  it("requires exactly one explicit rating per criterion and evidence", () => {
    const review = {
      version: 1,
      quality: "meets",
      delivery: "exceeds",
      collaboration: "meets",
      independence: "developing",
      strengths: "Completed objectives",
      improvements: "More independent work",
      recommendation: "confirm",
    };
    expect(probationReviewSchema.safeParse(review).success).toBe(true);
    expect(
      probationReviewSchema.safeParse({ ...review, quality: ["meets"] })
        .success,
    ).toBe(false);
    expect(
      probationReviewSchema.safeParse({ ...review, recommendation: "" })
        .success,
    ).toBe(false);
    expect(
      probationReviewSchema.safeParse({ ...review, strengths: "" }).success,
    ).toBe(false);
  });
  it("derives expiration without a scheduled database write and keeps state labels localized", () => {
    const contract = { ...input, status: "active" } as EmploymentContract;
    expect(contractPhase(contract, "2026-11-01")).toBe("active");
    expect(contractPhase(contract, "2026-12-02")).toBe("expiring");
    expect(contractPhase(contract, "2027-01-02")).toBe("expired");
    expect(contractPhase({ ...contract, status: "ended" }, "2027-01-02")).toBe(
      "ended",
    );
    setPreferences({ locale: "en" });
    expect(t("Chờ HR xác nhận")).toBe("Awaiting HR decision");
    expect(t("Vòng đời nhân sự")).toBe("Employee lifecycle");
  });
});
it("reuses per-role navigation caches and coalesces each live onboarding update without reloading contracts", async () => {
  vi.useFakeTimers();
  const sessions = ["admin", "hr", "manager", "employee"].map((uid) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    clients.push(client);
    const read = vi.fn(async (path: string) => ({ path }));
    const path =
      "/employment/onboarding?scope=" + (uid === "employee" ? "my" : "team");
    const options = apiQueryOptions(path, uid, read);
    const stop = new QueryObserver(client, options).subscribe(() => {});
    return { client, read, options, stop };
  });
  await vi.advanceTimersByTimeAsync(0);
  for (const s of sessions) {
    expect(s.read).toHaveBeenCalledOnce();
    s.stop();
    s.stop = new QueryObserver(s.client, s.options).subscribe(() => {});
  }
  await vi.advanceTimersByTimeAsync(30_000);
  expect(sessions.every((s) => s.read.mock.calls.length === 1)).toBe(true);
  const changed =
    'event: changed\ndata: {"version":"revision-2","collections":["onboardingPlans"]}\n\n';
  for (const s of sessions)
    await readChanges(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(changed + changed));
          c.close();
        },
      }),
      (_version, collections) => {
        void refreshQueries(s.client, collections ?? null);
      },
    );
  await vi.advanceTimersByTimeAsync(200);
  expect(sessions.every((s) => s.read.mock.calls.length === 2)).toBe(true);
  expect(
    queryAffected("/employment/contracts?scope=my", ["onboardingPlans"]),
  ).toBe(false);
  expect(queryAffected("/employees", ["employees", "probationReviews"])).toBe(
    true,
  );
  expect(
    queryAffected("/employment/onboarding?scope=team", ["memberships"]),
  ).toBe(true);
  sessions.forEach((s) => s.stop());
});

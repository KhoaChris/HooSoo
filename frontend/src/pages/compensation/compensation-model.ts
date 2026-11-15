import type {
  CompensationPerson,
  SalaryPackage,
  RecruitmentReward,
  CompensationPhase,
} from "@hoosoo/shared";
import { t, intlLocale } from "../../i18n";
export const compensationLabels: Record<CompensationPhase, string> = {
  draft: "Bản nháp",
  current: "Đang áp dụng",
  scheduled: "Sắp áp dụng",
  superseded: "Trước đây",
  cancelled: "Đã hủy",
};
export const emptySalaryPackage = (): SalaryPackage => ({
  currency: "VND",
  basis: "gross_monthly",
  baseSalary: 0,
  probationSalary: null,
  allowances: [],
  benefits: [],
  bonusPolicy: "",
});
export const emptyRecruitmentReward = (): RecruitmentReward => ({
  mode: "negotiable",
  currency: "VND",
  min: null,
  max: null,
  benefits: [],
});
export function moneyLabel(value: number) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat(intlLocale(), {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(value)
    : "—";
}
export function parseMoneyInput(value: string) {
  if (!value.trim()) return 0;
  return /^(?:\d+|\d{1,3}([.,\s])\d{3}(?:\1\d{3})*)$/.test(value.trim())
    ? Number(value.replace(/[.,\s]/g, ""))
    : NaN;
}
export function rewardLabel(value?: RecruitmentReward) {
  return !value
    ? t("Chưa thiết lập khung lương")
    : value.mode === "negotiable"
      ? t("Lương thỏa thuận")
      : `${moneyLabel(value.min!)} – ${moneyLabel(value.max!)} / ${t("tháng")}`;
}
export function nextCompensationDate(
  person: CompensationPerson | undefined,
  today: string,
) {
  let day = person && person.hireDate > today ? person.hireDate : today;
  const dates = new Set(
    person?.records
      .filter((r) => r.status === "published")
      .map((r) => r.effectiveDate),
  );
  while (dates.has(day)) {
    const date = new Date(day);
    date.setUTCDate(date.getUTCDate() + 1);
    day = date.toISOString().slice(0, 10);
  }
  return day;
}

import {
  contractPhase,
  employmentStatusLabels,
  onboardingProgress,
  type EmploymentSection,
  type EmploymentView,
  type EmploymentContract,
  type OnboardingPlan,
} from "@hoosoo/shared";
export const sectionLabels: Record<EmploymentSection, string> = {
  contracts: "Hợp đồng",
  probations: "Thử việc",
  onboarding: "Tiếp nhận",
};
export function itemStatus(
  section: EmploymentSection,
  item: EmploymentView,
  today: string,
) {
  return section === "contracts"
    ? contractPhase(item as EmploymentContract, today)
    : item.status;
}
export function itemLabel(section: EmploymentSection, item: EmploymentView) {
  if (section === "contracts") return (item as EmploymentContract).reference;
  if (section === "onboarding")
    return `${onboardingProgress(item as OnboardingPlan)}%`;
  return employmentStatusLabels[item.status];
}

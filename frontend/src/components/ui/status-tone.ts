export type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

const statusTones: Record<string, StatusTone> = {
  active: "success",
  enabled: "success",
  approved: "success",
  on_time: "success",
  passed: "success",
  hired: "success",
  confirmed: "success",
  complete: "success",
  completed: "success",
  done: "success",
  success: "success",
  rejected: "danger",
  declined: "danger",
  failed: "danger",
  error: "danger",
  terminated: "danger",
  cancelled: "danger",
  disabled: "danger",
  pending: "warning",
  pending_manager: "warning",
  pending_hr: "warning",
  proposed: "warning",
  probation: "warning",
  late: "warning",
  missing_checkout: "warning",
  in_review: "warning",
  returned: "warning",
  warning: "warning",
  working: "info",
  in_progress: "info",
};

export function statusTone(status: string): StatusTone {
  return Object.hasOwn(statusTones, status) ? statusTones[status] : "neutral";
}

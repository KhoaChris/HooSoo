import { balanceAdjustmentSchema, type BalanceView } from "@hoosoo/shared";

export type AdjustmentDirection = "increase" | "decrease";
type BalanceSnapshot = Pick<
  BalanceView,
  "year" | "allowance" | "used" | "pending" | "canAdjust"
>;

export function adjustmentLimit(
  balance: BalanceSnapshot,
  direction: AdjustmentDirection,
) {
  return direction === "increase"
    ? 365
    : Math.max(0, Math.min(365, Math.floor(balance.allowance - balance.used)));
}

export function previewBalanceAdjustment(
  balance: BalanceSnapshot,
  direction: AdjustmentDirection,
  days: string,
) {
  const quantity = /^\d+$/.test(days) ? Number(days) : NaN;
  const valid =
    Number.isSafeInteger(quantity) &&
    quantity > 0 &&
    quantity <= adjustmentLimit(balance, direction);
  if (!valid) return null;
  const amount = direction === "increase" ? quantity : -quantity;
  return {
    amount,
    allowance: balance.allowance + amount,
    available: balance.allowance + amount - balance.used,
  };
}

/** UI accepts a direction and positive days; the existing API keeps signed amounts. */
export function prepareBalanceAdjustment(
  balance: BalanceSnapshot,
  direction: AdjustmentDirection,
  days: string,
  reason: string,
) {
  const issue = (field: "days" | "reason" | "form", message: string) => ({
    success: false as const,
    field,
    message,
  });
  if (!balance.canAdjust)
    return issue("form", "Bạn không có quyền điều chỉnh quỹ phép này.");
  if (
    !/^\d+$/.test(days) ||
    !Number.isSafeInteger(Number(days)) ||
    Number(days) < 1
  )
    return issue("days", "Nhập số ngày nguyên lớn hơn 0.");
  if (Number(days) > 365)
    return issue("days", "Mỗi lần điều chỉnh tối đa 365 ngày.");
  const preview = previewBalanceAdjustment(balance, direction, days);
  if (!preview)
    return issue("days", "Số ngày giảm không được vượt quá quỹ phép còn lại.");
  if (reason.trim().length < 5)
    return issue("reason", "Nhập lý do điều chỉnh, tối thiểu 5 ký tự.");
  if (reason.trim().length > 1000)
    return issue("reason", "Lý do điều chỉnh tối đa 1.000 ký tự.");
  const parsed = balanceAdjustmentSchema.safeParse({
    year: balance.year,
    amount: preview.amount,
    reason,
  });
  if (!parsed.success)
    return issue(
      "form",
      "Thông tin điều chỉnh không hợp lệ. Vui lòng kiểm tra lại.",
    );
  return { success: true as const, data: parsed.data };
}

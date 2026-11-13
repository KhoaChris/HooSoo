import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Info,
  Minus,
  Plus,
  Wallet,
} from "lucide-react";
import type { BalanceView, BalanceTransaction } from "@hoosoo/shared";
import {
  Button,
  ErrorBox,
  Input,
  Modal,
  Textarea,
} from "../../../components/ui";
import { useModalForm } from "../../../components/ui/modal";
import { StableText } from "../../../i18n/stable-text";
import { intlLocale, t, useLocale } from "../../../i18n";
import { dateText } from "../../../utils/date-time";
import {
  adjustmentLimit,
  prepareBalanceAdjustment,
  previewBalanceAdjustment,
  type AdjustmentDirection,
} from "../balance-adjustment-model";

type Props = {
  balance: BalanceView;
  onClose: () => void;
  onSubmit: (body: {
    year: number;
    amount: number;
    reason: string;
  }) => Promise<void>;
};

export function BalanceAdjustmentDialog(props: Props) {
  useLocale();
  return (
    <Modal
      title={t("Điều chỉnh quỹ phép")}
      description={`${props.balance.employeeName} · ${t("Năm")} ${props.balance.year}`}
      icon={<Wallet size={21} />}
      onClose={props.onClose}
    >
      <BalanceAdjustmentForm {...props} />
    </Modal>
  );
}

function BalanceAdjustmentForm({ balance, onClose, onSubmit }: Props) {
  useLocale();
  const [direction, setDirection] = useState<AdjustmentDirection>("increase");
  const [days, setDays] = useState("1"),
    [reason, setReason] = useState("");
  const [inputError, setInputError] = useState(false),
    [reasonTouched, setReasonTouched] = useState(false);
  const [failure, setFailure] = useState<Error | null>(null),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false),
    amountRef = useRef<HTMLInputElement>(null),
    reasonRef = useRef<HTMLTextAreaElement>(null);
  const modal = useModalForm(),
    report = modal?.setFormStatus,
    id = useId();
  const dirty = direction !== "increase" || days !== "1" || reason !== "";
  const maximum = adjustmentLimit(balance, direction),
    preview = previewBalanceAdjustment(balance, direction, days);
  const prepared = prepareBalanceAdjustment(balance, direction, days, reason);
  const daysError =
    maximum === 0 && direction === "decrease"
      ? ""
      : inputError
        ? t("Nhập số ngày nguyên lớn hơn 0.")
        : !prepared.success && prepared.field === "days"
          ? t(prepared.message)
          : "";
  const reasonError =
    reasonTouched && !prepared.success && prepared.field === "reason"
      ? t(prepared.message)
      : "";
  const available = balance.allowance - balance.used;
  const pendingWarning =
    direction === "decrease" && preview && balance.pending > preview.available;
  const format = (value: number) =>
    new Intl.NumberFormat(intlLocale()).format(value);

  useEffect(() => {
    report?.({ dirty, busy });
  }, [report, dirty, busy]);
  useEffect(
    () => () => {
      report?.({ dirty: false, busy: false });
    },
    [report],
  );
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  return (
    <form
      className="balance-adjustment form"
      aria-busy={busy}
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        setReasonTouched(true);
        setFailure(null);
        if (inputError) {
          amountRef.current?.focus();
          return;
        }
        if (!prepared.success) {
          if (prepared.field === "days") amountRef.current?.focus();
          else if (prepared.field === "reason") reasonRef.current?.focus();
          else setFailure(new Error(t(prepared.message)));
          return;
        }
        submitting.current = true;
        setBusy(true);
        try {
          await onSubmit(prepared.data);
        } catch (error) {
          setFailure(error as Error);
        } finally {
          submitting.current = false;
          setBusy(false);
        }
      }}
    >
      <ErrorBox error={failure} />
      {!balance.canAdjust && (
        <p className="form-validation" role="alert">
          {t("Bạn không có quyền điều chỉnh quỹ phép này.")}
        </p>
      )}
      <dl className="balance-adjustment-summary">
        <div>
          <dt>
            <StableText>{t("Hạn mức hiện tại")}</StableText>
          </dt>
          <dd>
            {format(balance.allowance)} <small>{t("ngày")}</small>
          </dd>
        </div>
        <div>
          <dt>
            <StableText>{t("Đã duyệt")}</StableText>
          </dt>
          <dd>
            {format(balance.used)} <small>{t("ngày")}</small>
          </dd>
        </div>
        <div>
          <dt>
            <StableText>{t("Còn lại")}</StableText>
          </dt>
          <dd>
            {format(available)} <small>{t("ngày")}</small>
          </dd>
        </div>
      </dl>
      <fieldset
        className="balance-adjustment-direction"
        disabled={busy || !balance.canAdjust}
      >
        <legend>
          <StableText>{t("Loại điều chỉnh")}</StableText>
        </legend>
        <div className="balance-direction-options">
          {(["increase", "decrease"] as const).map((mode) => (
            <label
              key={mode}
              className={`balance-direction-option ${mode}${direction === mode ? " is-selected" : ""}`}
            >
              <input
                className="balance-direction-radio"
                type="radio"
                name={`${id}-direction`}
                value={mode}
                checked={direction === mode}
                onChange={() => {
                  setDirection(mode);
                  setInputError(false);
                  setFailure(null);
                }}
              />
              <span className="balance-direction-icon" aria-hidden="true">
                {mode === "increase" ? <Plus size={18} /> : <Minus size={18} />}
              </span>
              <span>
                <strong>
                  <StableText>
                    {t(mode === "increase" ? "Tăng quỹ phép" : "Giảm quỹ phép")}
                  </StableText>
                </strong>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field balance-adjustment-amount">
        <label htmlFor={`${id}-days`}>
          <StableText
            after={
              <span className="field-required" aria-hidden="true">
                {" "}
                *
              </span>
            }
          >
            {t("Số ngày điều chỉnh")}
          </StableText>
        </label>
        <div className={`balance-day-stepper${daysError ? " has-error" : ""}`}>
          <button
            type="button"
            aria-label={t("Bớt một ngày")}
            disabled={
              busy ||
              !balance.canAdjust ||
              maximum === 0 ||
              !Number.isSafeInteger(Number(days)) ||
              Number(days) <= 1
            }
            onClick={() => {
              setDays(String(Math.max(1, Number(days) - 1)));
              setInputError(false);
            }}
          >
            <Minus size={18} />
          </button>
          <Input
            ref={amountRef}
            id={`${id}-days`}
            name="days"
            type="text"
            inputMode="numeric"
            maxLength={3}
            autoComplete="off"
            value={days}
            disabled={busy || !balance.canAdjust || maximum === 0}
            aria-required="true"
            aria-invalid={!!daysError && maximum > 0}
            aria-describedby={
              [
                direction === "decrease" ? `${id}-days-hint` : "",
                daysError && maximum > 0 ? `${id}-days-error` : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            onChange={(event) => {
              if (!/^\d*$/.test(event.target.value)) {
                setInputError(true);
                return;
              }
              setDays(event.target.value);
              setInputError(false);
              setFailure(null);
            }}
          />
          <span className="balance-day-unit">{t("ngày")}</span>
          <button
            type="button"
            aria-label={t("Thêm một ngày")}
            disabled={busy || !balance.canAdjust || Number(days) >= maximum}
            onClick={() => {
              setDays(String(Math.min(maximum, Number(days || 0) + 1)));
              setInputError(false);
            }}
          >
            <Plus size={18} />
          </button>
        </div>
        {direction === "decrease" && (
          <small id={`${id}-days-hint`}>
            {maximum > 0
              ? t("Giảm tối đa {0} ngày.", [format(maximum)])
              : t("Không còn ngày phép để giảm.")}
          </small>
        )}
        {daysError && maximum > 0 && (
          <small id={`${id}-days-error`} className="field-error" role="alert">
            {daysError}
          </small>
        )}
      </div>

      <section
        className={`balance-adjustment-preview ${direction}`}
        aria-labelledby={`${id}-preview-title`}
      >
        <h3 id={`${id}-preview-title`}>
          <StableText>{t("Sau điều chỉnh")}</StableText>
        </h3>
        <div className="balance-preview-columns" aria-hidden="true">
          <span />
          <span>{t("Hiện tại")}</span>
          <span />
          <span>{t("Dự kiến")}</span>
        </div>
        <dl aria-live="polite" aria-atomic="true">
          <div>
            <dt>
              <StableText>{t("Hạn mức năm")}</StableText>
            </dt>
            <dd>
              <span>
                <span className="sr-only">{t("Hiện tại")} </span>
                {format(balance.allowance)}
              </span>
              <ArrowRight size={15} aria-hidden="true" />
              <strong>
                <span className="sr-only">{t("Dự kiến")} </span>
                {preview && !inputError ? format(preview.allowance) : "—"}
              </strong>
            </dd>
          </div>
          <div>
            <dt>
              <StableText>{t("Phép còn lại")}</StableText>
            </dt>
            <dd>
              <span>
                <span className="sr-only">{t("Hiện tại")} </span>
                {format(available)}
              </span>
              <ArrowRight size={15} aria-hidden="true" />
              <strong>
                <span className="sr-only">{t("Dự kiến")} </span>
                {preview && !inputError ? format(preview.available) : "—"}
              </strong>
            </dd>
          </div>
        </dl>
      </section>
      {pendingWarning && (
        <p className="balance-adjustment-warning" role="status">
          <Info size={16} aria-hidden="true" />
          <span>
            {t("Quỹ còn lại không đủ cho {0} ngày đang chờ duyệt.", [
              format(balance.pending),
            ])}
          </span>
        </p>
      )}

      <div className="field">
        <label htmlFor={`${id}-reason`}>
          <StableText
            after={
              <span className="field-required" aria-hidden="true">
                {" "}
                *
              </span>
            }
          >
            {t("Lý do điều chỉnh")}
          </StableText>
        </label>
        <Textarea
          ref={reasonRef}
          id={`${id}-reason`}
          name="reason"
          rows={3}
          maxLength={1000}
          value={reason}
          disabled={busy || !balance.canAdjust}
          aria-required="true"
          aria-invalid={!!reasonError}
          aria-describedby={reasonError ? `${id}-reason-error` : undefined}
          onBlur={() => setReasonTouched(true)}
          onChange={(event) => {
            setReason(event.target.value);
            setFailure(null);
          }}
        />
        {reasonError && (
          <small id={`${id}-reason-error`} className="field-error" role="alert">
            {reasonError}
          </small>
        )}
      </div>

      {balance.transactions.length > 0 && (
        <details className="balance-adjustment-history">
          <summary>
            <span>
              <StableText>{t("Lịch sử quỹ phép")}</StableText>{" "}
              <small>({balance.transactions.length})</small>
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <ol>
            {balance.transactions.map((transaction) => (
              <li key={transaction.id}>
                <div>
                  <strong>{transactionLabel(transaction)}</strong>
                  <time>{dateText(transaction.createdAt)}</time>
                  <p>{transaction.reason}</p>
                </div>
                <span
                  className={
                    transaction.amount < 0
                      ? "balance-history-decrease"
                      : "balance-history-increase"
                  }
                >
                  {transaction.amount > 0 ? "+" : ""}
                  {format(transaction.amount)} <small>{t("ngày")}</small>
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
      <div className="form-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={modal?.requestClose ?? onClose}
        >
          {t("Hủy")}
        </Button>
        <Button
          type="submit"
          busy={busy}
          disabled={!balance.canAdjust || !preview || inputError}
          tone={direction === "increase" ? "success" : "danger"}
        >
          {t(
            direction === "increase"
              ? "Xác nhận tăng phép"
              : "Xác nhận giảm phép",
          )}
        </Button>
      </div>
    </form>
  );
}

function transactionLabel(transaction: BalanceTransaction) {
  if (transaction.kind === "allocation") return t("Cấp quỹ phép ban đầu");
  if (transaction.kind === "debit") return t("Sử dụng phép đã duyệt");
  if (transaction.kind === "refund") return t("Hoàn lại ngày phép");
  return t(transaction.amount < 0 ? "Giảm quỹ phép" : "Tăng quỹ phép");
}

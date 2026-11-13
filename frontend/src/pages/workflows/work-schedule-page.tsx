import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock3,
} from "lucide-react";
import {
  workRegistrationSchema,
  type WorkRegistrationView,
  type Schedule,
} from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import {
  Heading,
  Button,
  Modal,
  Form,
  ErrorBox,
  Loading,
} from "../../components/ui";
import {
  ApprovalSteps,
  WorkflowBadge,
  WorkflowHistory,
  ReviewDialog,
  today,
  dayLabel,
} from "./workflow-ui";
import { WorkScheduleApprovals } from "./work-schedule-approvals";
const days = [
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
  "Chủ nhật",
];
export function WorkSchedulePage({
  approvals = false,
}: {
  approvals?: boolean;
}) {
  useLocale();
  const [month, setMonth] = useState(today().slice(0, 7)),
    [selected, setSelected] = useState<string | null>(null),
    [detailRecord, setDetail] = useState<WorkRegistrationView | null>(null),
    [review, setReview] = useState<{
      record: WorkRegistrationView;
      action: "approve" | "reject" | "cancel";
    } | null>(null),
    [page, setPage] = useState(1);
  const start = `${month}-01`,
    last = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0,
    ).getDate(),
    end = `${month}-${String(last).padStart(2, "0")}`;
  const q = useApi<{ items: WorkRegistrationView[]; schedule: Schedule }>(
      `/work-registrations?startDate=${start}&endDate=${end}${approvals ? "&approvals=true" : ""}`,
    ),
    save = useAction();
  const schedule = q.data?.schedule,
    rows = q.data?.items ?? [],
    detail = rows.find((r) => r.id === detailRecord?.id),
    byDate = new Map(rows.map((r) => [r.date, r]));
  const shift = (delta: number) => {
    const d = new Date(`${start}T12:00:00`);
    d.setMonth(d.getMonth() + delta);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setPage(1);
  };
  const offset = (new Date(`${start}T12:00:00`).getDay() + 6) % 7;
  const isWork = (date: string) =>
    !!schedule &&
    schedule.workDays.includes(new Date(date + "T12:00:00").getDay()) &&
    !schedule.holidays.includes(date);
  const existing = selected ? byDate.get(selected) : undefined;
  const timeOptions = [
    ...new Set([
      ...Array.from(
        { length: 96 },
        (_, i) =>
          `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
      ).filter((t) => schedule && t >= schedule.start && t <= schedule.end),
      ...(schedule ? [schedule.start, schedule.end] : []),
    ]),
  ]
    .sort()
    .map((value) => ({ value, label: value }));
  return (
    <>
      <Heading
        title={
          approvals ? t("Duyệt lịch làm việc") : t("Lịch làm việc của tôi")
        }
        action={
          !approvals && (
            <span className="workflow-header-note">
              <Clock3 size={16} />
              {schedule
                ? `${schedule.start} – ${schedule.end}`
                : t("Giờ làm việc chính quy")}
            </span>
          )
        }
      />
      {approvals ? (
        <WorkScheduleApprovals
          month={month}
          rows={rows}
          loading={q.isPending}
          error={q.error}
          onRetry={() => void q.refetch()}
          onMonth={shift}
          onToday={() => {
            setMonth(today().slice(0, 7));
            setPage(1);
          }}
          page={page}
          onPage={setPage}
          onOpen={setDetail}
        />
      ) : (
        <section className="work-calendar">
          <div className="calendar-toolbar">
            <div>
              <span className="section-eyebrow">
                <StableText>{t("KẾ HOẠCH LÀM VIỆC")}</StableText>
              </span>
              <h2>
                <StableText>{t("Tháng")}</StableText> {Number(month.slice(5))},{" "}
                {month.slice(0, 4)}
              </h2>
            </div>
            <div className="row-actions">
              <Button
                variant="secondary"
                aria-label={t("Tháng trước")}
                onClick={() => shift(-1)}
              >
                <ChevronLeft size={17} />
              </Button>
              <Button
                variant="secondary"
                onClick={() => setMonth(today().slice(0, 7))}
              >
                {t("Hôm nay")}
              </Button>
              <Button
                variant="secondary"
                aria-label={t("Tháng sau")}
                onClick={() => shift(1)}
              >
                <ChevronRight size={17} />
              </Button>
            </div>
          </div>
          <ErrorBox error={q.error} retry={() => void q.refetch()} />
          {q.isPending ? (
            <Loading />
          ) : (
            <div className="calendar-scroll">
              <div
                className="calendar-grid"
                role="group"
                aria-label={t("Lịch đăng ký làm việc")}
              >
                {days.map((d) => (
                  <div className="calendar-weekday" key={d}>
                    {t(d)}
                  </div>
                ))}
                {Array.from({ length: offset }, (_, i) => (
                  <div key={`blank-${i}`} className="calendar-blank" />
                ))}
                {Array.from({ length: last }, (_, i) => {
                  const date = `${month}-${String(i + 1).padStart(2, "0")}`,
                    r = byDate.get(date),
                    canRegister = isWork(date) && date >= today();
                  return (
                    <button
                      key={date}
                      className={`calendar-day ${date === today() ? "is-today" : ""} ${!isWork(date) ? "is-off" : ""}`}
                      disabled={!r && !canRegister}
                      aria-label={`${dayLabel(date)}${r ? t(", {0} đến {1}, xem lịch", [r.start, r.end]) : canRegister ? t(", đăng ký làm việc") : t(", ngày nghỉ")}`}
                      onClick={() => (r ? setDetail(r) : setSelected(date))}
                    >
                      <span className="calendar-date">
                        {i + 1}
                        {date === today() && (
                          <small>
                            <StableText>{t("Hôm nay")}</StableText>
                          </small>
                        )}
                      </span>
                      {r ? (
                        <span className={`calendar-event status-${r.status}`}>
                          <strong>
                            {r.start} – {r.end}
                          </strong>
                          <WorkflowBadge status={r.status} />
                        </span>
                      ) : canRegister ? (
                        <span className="calendar-add">
                          <Plus size={14} />
                          <StableText>{t("Đăng ký")}</StableText>
                        </span>
                      ) : (
                        <span className="calendar-off">
                          <StableText>
                            {!isWork(date) ? t("Ngày nghỉ") : ""}
                          </StableText>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <footer className="calendar-footer">
            <span>
              <CalendarDays size={16} />
              {rows.length} <StableText>{t("lịch đăng ký ·")}</StableText>{" "}
              {rows.filter((r) => r.status === "approved").length}{" "}
              <StableText>{t("đã duyệt")}</StableText>
            </span>
            <span>
              <StableText>{t("Nghỉ giữa ca:")}</StableText>{" "}
              {schedule?.breakStart ?? "—"} – {schedule?.breakEnd ?? "—"}
            </span>
          </footer>
        </section>
      )}
      {selected && schedule && (
        <Modal
          title={
            existing ? t("Điều chỉnh lịch đăng ký") : t("Đăng ký làm việc")
          }
          description={dayLabel(selected)}
          icon={<CalendarDays size={22} />}
          onClose={() => setSelected(null)}
        >
          <Form
            schema={workRegistrationSchema}
            defaults={{
              date: selected,
              start: existing?.start ?? schedule.start,
              end: existing?.end ?? schedule.end,
              reason: existing?.reason ?? "",
              version: existing?.version ?? 0,
            }}
            columns={2}
            fields={[
              {
                name: "start",
                label: t("Bắt đầu"),
                type: "select",
                options: timeOptions,
                required: true,
              },
              {
                name: "end",
                label: t("Kết thúc"),
                type: "select",
                options: timeOptions,
                required: true,
              },
              {
                name: "reason",
                label: t("Kế hoạch / ghi chú công việc"),
                type: "textarea",
                span: "full",
                required: true,
              },
            ]}
            submitLabel={t("Gửi đăng ký")}
            onSubmit={async (body) => {
              await save.mutateAsync({ path: "/work-registrations", body });
              setSelected(null);
            }}
          />
        </Modal>
      )}
      {detail && (
        <Modal
          title={approvals ? detail.employeeName : t("Chi tiết lịch làm việc")}
          description={`${dayLabel(detail.date)} · ${detail.start} – ${detail.end}`}
          onClose={() => setDetail(null)}
        >
          <WorkflowBadge status={detail.status} />
          <ApprovalSteps
            status={detail.status}
            managerName={detail.managerName}
          />
          <p className="workflow-prose">{detail.reason}</p>
          <WorkflowHistory history={detail.history} />
          <div className="workflow-actions">
            {detail.canReview && (
              <>
                <Button
                  variant="secondary"
                  tone="danger"
                  onClick={() => {
                    setReview({ record: detail, action: "reject" });
                    setDetail(null);
                  }}
                >
                  {t("Từ chối")}
                </Button>
                <Button
                  tone="success"
                  onClick={() => {
                    setReview({ record: detail, action: "approve" });
                    setDetail(null);
                  }}
                >
                  {t("Duyệt lịch")}
                </Button>
              </>
            )}
            {detail.canCancel && (
              <Button
                variant="secondary"
                tone="danger"
                onClick={() => {
                  setReview({ record: detail, action: "cancel" });
                  setDetail(null);
                }}
              >
                {t("Rút đăng ký")}
              </Button>
            )}
            {!approvals &&
              detail.status !== "approved" &&
              detail.date >= today() && (
                <Button
                  onClick={() => {
                    setSelected(detail.date);
                    setDetail(null);
                  }}
                >
                  {t("Chỉnh sửa & gửi lại")}
                </Button>
              )}
          </div>
        </Modal>
      )}
      {review && (
        <ReviewDialog
          path={`/work-registrations/${review.record.id}`}
          version={review.record.version}
          action={review.action}
          title={`${review.record.employeeName} · ${dayLabel(review.record.date)}`}
          onClose={() => setReview(null)}
        />
      )}
    </>
  );
}

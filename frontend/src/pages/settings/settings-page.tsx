import { StableText } from "../../i18n/stable-text";
import { weekdayLabel } from "../../i18n/preferences";
import { t, useLocale } from "../../i18n";
import { Clock3, CalendarDays, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { scheduleSchema, type Settings } from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { Heading, Form, Modal, Loading, ErrorBox } from "../../components/ui";
import { LeaveTypes } from "./components/leave-types";
import { BalanceAdmin } from "./components/balance-admin";
import { CompanySettings } from "./components/company-settings";
const scheduleForm = z
  .object({
    start: scheduleSchema.shape.start,
    end: scheduleSchema.shape.end,
    breakStart: scheduleSchema.shape.breakStart,
    breakEnd: scheduleSchema.shape.breakEnd,
    lateGraceMinutes: scheduleSchema.shape.lateGraceMinutes,
    workDays: z
      .array(z.string())
      .min(1, "Chọn ít nhất một ngày làm việc.")
      .transform((values) => values.map(Number)),
    holidays: z.string().transform((s) =>
      s
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
    annualAllowance: z.number().int().min(0).max(365),
  })
  .transform((v) => ({
    schedule: {
      start: v.start,
      end: v.end,
      breakStart: v.breakStart,
      breakEnd: v.breakEnd,
      lateGraceMinutes: v.lateGraceMinutes,
      workDays: v.workDays,
      holidays: v.holidays,
    },
    annualAllowance: v.annualAllowance,
  }))
  .pipe(z.object({ schedule: scheduleSchema, annualAllowance: z.number() }));

export function SettingsPage({ hr = false }: { hr?: boolean }) {
  useLocale();
  const q = useApi<Settings>("/settings"),
    action = useAction();
  const [confirmation, setConfirmation] = useState<Record<
    string,
    unknown
  > | null>(null);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const s = q.data!;
  if (!hr) return <CompanySettings settings={s} />;
  return (
    <>
      <Heading
        title={hr ? t("Chính sách nhân sự") : t("Thông tin doanh nghiệp")}
      />
      <div className={hr ? "policy-layout" : undefined}>
        {hr && (
          <aside className="policy-overview">
            <span className="policy-overview-label">
              {t("CHÍNH SÁCH HIỆN TẠI")}
            </span>
            <h2>
              <Clock3 size={20} />
              <StableText>{t("Khung giờ làm việc")}</StableText>
            </h2>
            <p className="policy-current-hours">
              {s.schedule.start}
              <span>—</span>
              {s.schedule.end}
            </p>
            <p className="policy-current-days">
              {[1, 2, 3, 4, 5, 6, 0]
                .filter((day) => s.schedule.workDays.includes(day))
                .map((day) => weekdayLabel(day))
                .join(" · ")}
            </p>
            <dl>
              <div>
                <dt>
                  <StableText>{t("Nghỉ giữa ca")}</StableText>
                </dt>
                <dd>
                  {s.schedule.breakStart} – {s.schedule.breakEnd}
                </dd>
              </div>
              <div>
                <dt>
                  <StableText>{t("Ngưỡng đi muộn")}</StableText>
                </dt>
                <dd>
                  {s.schedule.lateGraceMinutes}{" "}
                  <StableText>{t("phút")}</StableText>
                </dd>
              </div>
              <div>
                <dt>
                  <StableText>{t("Phép năm ban đầu")}</StableText>
                </dt>
                <dd>
                  {s.annualAllowance} <StableText>{t("ngày")}</StableText>
                </dd>
              </div>
            </dl>
          </aside>
        )}
        <section className={hr ? "policy-editor" : "panel editor-panel"}>
          {hr && (
            <header className="policy-editor-heading">
              <span>
                <CalendarDays size={20} />
              </span>
              <div>
                <h2>
                  <StableText>{t("Lịch làm việc & nghỉ phép")}</StableText>
                </h2>
              </div>
            </header>
          )}
          {hr ? (
            <Form
              key={s.updatedAt}
              columns={2}
              resetAfterSubmit={false}
              schema={scheduleForm}
              fields={[
                {
                  name: "start",
                  label: t("Bắt đầu ca"),
                  type: "time",
                  required: true,
                  section: t("01 · Thời gian làm việc"),
                },
                {
                  name: "end",
                  label: t("Kết thúc ca"),
                  type: "time",
                  required: true,
                },
                {
                  name: "breakStart",
                  label: t("Bắt đầu nghỉ giữa ca"),
                  type: "time",
                  required: true,
                },
                {
                  name: "breakEnd",
                  label: t("Kết thúc nghỉ giữa ca"),
                  type: "time",
                  required: true,
                },
                {
                  name: "workDays",
                  label: t("Ngày làm việc trong tuần"),
                  type: "choices",
                  span: "full",
                  section: t("02 · Lịch làm việc"),
                  options: [1, 2, 3, 4, 5, 6, 0].map((day) => ({
                    value: String(day),
                    label: weekdayLabel(day),
                  })),
                },
                {
                  name: "lateGraceMinutes",
                  label: t("Ngưỡng đi muộn (phút)"),
                  type: "number",
                },
                {
                  name: "annualAllowance",
                  label: t("Phép năm ban đầu (ngày)"),
                  type: "number",
                  section: t("03 · Nghỉ lễ & phép năm"),
                  hint: t("Áp dụng khi cấp quỹ phép mới."),
                },
                {
                  name: "holidays",
                  label: t("Ngày nghỉ lễ"),
                  type: "textarea",
                  placeholder: "2026-01-01\n2026-09-02",
                  hint: t("YYYY-MM-DD, mỗi dòng một ngày."),
                },
              ]}
              defaults={{
                ...s.schedule,
                workDays: s.schedule.workDays.map(String),
                holidays: s.schedule.holidays.join("\n"),
                annualAllowance: s.annualAllowance,
              }}
              onSubmit={async (body) => {
                setConfirmation(body);
              }}
              submitLabel={t("Xem lại thay đổi")}
            />
          ) : null}
        </section>
      </div>
      {confirmation && (
        <Modal
          title={t("Xác nhận cập nhật chính sách")}
          icon={<ShieldCheck size={21} />}
          onClose={() => setConfirmation(null)}
        >
          <p>
            <StableText>{t("Chỉ áp dụng cho bản ghi mới.")}</StableText>
          </p>
          <dl className="policy-review">
            <div>
              <dt>
                <StableText>{t("Giờ làm việc")}</StableText>
              </dt>
              <dd>
                {String((confirmation.schedule as Settings["schedule"]).start)}{" "}
                – {String((confirmation.schedule as Settings["schedule"]).end)}
              </dd>
            </div>
            <div>
              <dt>
                <StableText>{t("Nghỉ giữa ca")}</StableText>
              </dt>
              <dd>
                {(confirmation.schedule as Settings["schedule"]).breakStart} –{" "}
                {(confirmation.schedule as Settings["schedule"]).breakEnd}
              </dd>
            </div>
            <div>
              <dt>
                <StableText>{t("Ngày làm việc")}</StableText>
              </dt>
              <dd>
                {[1, 2, 3, 4, 5, 6, 0]
                  .filter((day) =>
                    (
                      confirmation.schedule as Settings["schedule"]
                    ).workDays.includes(day),
                  )
                  .map((day) => weekdayLabel(day))
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt>
                <StableText>{t("Ngưỡng đi muộn")}</StableText>
              </dt>
              <dd>
                {
                  (confirmation.schedule as Settings["schedule"])
                    .lateGraceMinutes
                }{" "}
                <StableText>{t("phút")}</StableText>
              </dd>
            </div>
            <div>
              <dt>
                <StableText>{t("Phép năm ban đầu")}</StableText>
              </dt>
              <dd>
                {String(confirmation.annualAllowance)}{" "}
                <StableText>{t("ngày")}</StableText>
              </dd>
            </div>
            <div>
              <dt>
                <StableText>{t("Ngày nghỉ lễ")}</StableText>
              </dt>
              <dd>
                {(confirmation.schedule as Settings["schedule"]).holidays.join(
                  ", ",
                ) || t("Chưa thiết lập")}
              </dd>
            </div>
          </dl>
          <Form
            schema={z.object({})}
            fields={[]}
            onSubmit={async () => {
              await action.mutateAsync({
                path: "/settings",
                method: "PATCH",
                body: confirmation,
              });
              setConfirmation(null);
            }}
            submitLabel={t("Lưu chính sách")}
            onCancel={() => setConfirmation(null)}
          />
        </Modal>
      )}
      {hr && (
        <>
          <LeaveTypes />
          <BalanceAdmin />
        </>
      )}
    </>
  );
}

import { Clock3, CalendarDays, ShieldCheck, Info } from "lucide-react";
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
        title={hr ? "Chính sách nhân sự" : "Thông tin doanh nghiệp"}
        description={
          hr
            ? "Lịch làm việc và chính sách phép của doanh nghiệp."
            : "Cấu hình không gian làm việc HooSoo."
        }
      />
      <div className={hr ? "policy-layout" : undefined}>
        {hr && (
          <aside className="policy-overview">
            <span className="policy-overview-label">CHÍNH SÁCH HIỆN TẠI</span>
            <h2>
              <Clock3 size={20} />
              Khung giờ làm việc
            </h2>
            <p className="policy-current-hours">
              {s.schedule.start}
              <span>—</span>
              {s.schedule.end}
            </p>
            <p className="policy-current-days">
              {[1, 2, 3, 4, 5, 6, 0]
                .filter((day) => s.schedule.workDays.includes(day))
                .map((day) => (day === 0 ? "Chủ nhật" : "Thứ " + (day + 1)))
                .join(" · ")}
            </p>
            <dl>
              <div>
                <dt>Nghỉ giữa ca</dt>
                <dd>
                  {s.schedule.breakStart} – {s.schedule.breakEnd}
                </dd>
              </div>
              <div>
                <dt>Ngưỡng đi muộn</dt>
                <dd>{s.schedule.lateGraceMinutes} phút</dd>
              </div>
              <div>
                <dt>Phép năm ban đầu</dt>
                <dd>{s.annualAllowance} ngày</dd>
              </div>
            </dl>
            <p className="policy-overview-note">
              <ShieldCheck size={17} />
              <span>
                Thay đổi chính sách áp dụng cho các bản ghi mới. Dữ liệu đã ghi
                nhận giữ nguyên chính sách tại thời điểm tạo.
              </span>
            </p>
          </aside>
        )}
        <section className={hr ? "policy-editor" : "panel editor-panel"}>
          {hr && (
            <header className="policy-editor-heading">
              <span>
                <CalendarDays size={20} />
              </span>
              <div>
                <h2>Lịch làm việc & nghỉ phép</h2>
                <p>Thiết lập thời gian và quỹ phép chung cho đội ngũ.</p>
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
                  label: "Bắt đầu ca",
                  type: "time",
                  required: true,
                  section: "01 · Thời gian làm việc",
                },
                {
                  name: "end",
                  label: "Kết thúc ca",
                  type: "time",
                  required: true,
                },
                {
                  name: "breakStart",
                  label: "Bắt đầu nghỉ giữa ca",
                  type: "time",
                  required: true,
                },
                {
                  name: "breakEnd",
                  label: "Kết thúc nghỉ giữa ca",
                  type: "time",
                  required: true,
                },
                {
                  name: "workDays",
                  label: "Ngày làm việc trong tuần",
                  type: "choices",
                  span: "full",
                  section: "02 · Lịch làm việc",
                  options: [1, 2, 3, 4, 5, 6, 0].map((day) => ({
                    value: String(day),
                    label: day === 0 ? "Chủ nhật" : "Thứ " + (day + 1),
                  })),
                  hint: "Chọn những ngày áp dụng lịch làm việc của doanh nghiệp.",
                },
                {
                  name: "lateGraceMinutes",
                  label: "Ngưỡng đi muộn (phút)",
                  type: "number",
                  hint: "Khoảng thời gian được phép trễ so với giờ bắt đầu ca.",
                },
                {
                  name: "annualAllowance",
                  label: "Phép năm ban đầu (ngày)",
                  type: "number",
                  section: "03 · Nghỉ lễ & phép năm",
                  hint: "Dùng khi khởi tạo số dư mới. Số dư đã có được điều chỉnh riêng.",
                },
                {
                  name: "holidays",
                  label: "Ngày nghỉ lễ",
                  type: "textarea",
                  placeholder: "2026-01-01\n2026-09-02",
                  hint: "Mỗi dòng một ngày theo định dạng YYYY-MM-DD.",
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
              submitLabel="Xem lại thay đổi"
            />
          ) : null}
          {hr && (
            <p className="policy-editor-note">
              <Info size={14} />
              Bạn sẽ được xem lại các thông tin trước khi lưu chính sách.
            </p>
          )}
        </section>
      </div>
      {confirmation && (
        <Modal
          title="Xác nhận cập nhật chính sách"
          description="Kiểm tra lịch làm việc và hạn mức trước khi lưu."
          icon={<ShieldCheck size={21} />}
          onClose={() => setConfirmation(null)}
        >
          <p>
            Chính sách mới áp dụng cho các bản ghi mới. Ca chấm công và số ngày
            nghỉ đã lưu được giữ theo chính sách tại thời điểm tạo.
          </p>
          <dl className="policy-review">
            <div>
              <dt>Giờ làm việc</dt>
              <dd>
                {String((confirmation.schedule as Settings["schedule"]).start)}{" "}
                – {String((confirmation.schedule as Settings["schedule"]).end)}
              </dd>
            </div>
            <div>
              <dt>Nghỉ giữa ca</dt>
              <dd>
                {(confirmation.schedule as Settings["schedule"]).breakStart} –{" "}
                {(confirmation.schedule as Settings["schedule"]).breakEnd}
              </dd>
            </div>
            <div>
              <dt>Ngày làm việc</dt>
              <dd>
                {[1, 2, 3, 4, 5, 6, 0]
                  .filter((day) =>
                    (
                      confirmation.schedule as Settings["schedule"]
                    ).workDays.includes(day),
                  )
                  .map((day) => (day === 0 ? "Chủ nhật" : "Thứ " + (day + 1)))
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt>Ngưỡng đi muộn</dt>
              <dd>
                {
                  (confirmation.schedule as Settings["schedule"])
                    .lateGraceMinutes
                }{" "}
                phút
              </dd>
            </div>
            <div>
              <dt>Phép năm ban đầu</dt>
              <dd>{String(confirmation.annualAllowance)} ngày</dd>
            </div>
            <div>
              <dt>Ngày nghỉ lễ</dt>
              <dd>
                {(confirmation.schedule as Settings["schedule"]).holidays.join(
                  ", ",
                ) || "Chưa thiết lập"}
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
            submitLabel="Lưu chính sách"
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

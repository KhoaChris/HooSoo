import { useState } from "react";
import { z } from "zod";
import { settingsSchema, scheduleSchema, type Settings } from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { Heading, Form, Modal, Loading, ErrorBox } from "../../components/ui";
import { LeaveTypes } from "./components/leave-types";
import { BalanceAdmin } from "./components/balance-admin";
const scheduleForm = z
  .object({
    start: z.string(),
    end: z.string(),
    breakStart: z.string(),
    breakEnd: z.string(),
    lateGraceMinutes: z.number(),
    workDays: z
      .string()
      .transform((s) => s.split(",").map((v) => Number(v.trim()))),
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
      <section className="panel editor-panel">
        {hr ? (
          <Form
            key={s.updatedAt}
            schema={scheduleForm}
            fields={[
              { name: "start", label: "Giờ bắt đầu (HH:mm)" },
              { name: "end", label: "Giờ kết thúc (HH:mm)" },
              { name: "breakStart", label: "Bắt đầu nghỉ giữa ca (HH:mm)" },
              { name: "breakEnd", label: "Kết thúc nghỉ giữa ca (HH:mm)" },
              {
                name: "lateGraceMinutes",
                label: "Ngưỡng đi muộn (phút)",
                type: "number",
              },
              {
                name: "workDays",
                label: "Ngày làm việc",
                hint: "Các số từ 0 đến 6, cách nhau bằng dấu phẩy. 0 = Chủ nhật, 1 = Thứ hai.",
              },
              {
                name: "holidays",
                label: "Ngày nghỉ cấu hình",
                type: "textarea",
                hint: "Mỗi dòng một ngày YYYY-MM-DD.",
              },
              {
                name: "annualAllowance",
                label: "Hạn mức phép năm ban đầu (ngày)",
                type: "number",
                hint: "Áp dụng cho số dư chưa khởi tạo. Số dư đã có cần điều chỉnh riêng, có lý do.",
              },
            ]}
            defaults={{
              ...s.schedule,
              workDays: s.schedule.workDays.join(","),
              holidays: s.schedule.holidays.join("\n"),
              annualAllowance: s.annualAllowance,
            }}
            onSubmit={async (body) => {
              setConfirmation(body);
            }}
            submitLabel="Xem lại & lưu chính sách"
          />
        ) : (
          <Form
            schema={settingsSchema}
            fields={[{ name: "companyName", label: "Tên doanh nghiệp" }]}
            defaults={{ companyName: s.companyName }}
            onSubmit={async (body) => {
              await action.mutateAsync({
                path: "/settings",
                method: "PATCH",
                body,
              });
            }}
          />
        )}
      </section>
      {confirmation && (
        <Modal
          title="Xác nhận cập nhật chính sách"
          onClose={() => setConfirmation(null)}
        >
          <p>
            Chính sách mới áp dụng cho các bản ghi mới. Ca chấm công và số ngày
            nghỉ đã lưu được giữ theo chính sách tại thời điểm tạo.
          </p>
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

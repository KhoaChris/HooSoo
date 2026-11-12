import { useNavigate } from "react-router-dom";
import { Info, ChevronDown } from "lucide-react";
import {
  leaveSchema,
  type Page,
  type LeaveView,
  type LeaveType,
  type Settings,
} from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { today } from "../../utils/date-time";
import { Loading, ErrorBox, Form } from "../../components/ui";

const formSchema = leaveSchema
  .refine((value) => value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi.",
  })
  .refine(
    (value) => value.startDate.slice(0, 4) === value.endDate.slice(0, 4),
    {
      path: ["endDate"],
      message: "Vui lòng tách thành hai đơn nếu nghỉ qua năm mới.",
    },
  );

export function LeaveCreate() {
  const navigate = useNavigate();
  const types = useApi<Page<LeaveType>>("/leave-types?pageSize=100");
  const settings = useApi<Settings>("/settings");
  const action = useAction();
  if (types.isPending) return <Loading />;
  if (types.error)
    return <ErrorBox error={types.error} retry={() => void types.refetch()} />;
  const available = types.data!.items.filter((type) => type.active);
  if (!available.length)
    return (
      <div className="creation-empty">
        <Info size={24} />
        <h3>Chưa có loại nghỉ phép</h3>
        <p>Liên hệ nhân sự để thiết lập loại nghỉ phép trước khi tạo đơn.</p>
      </div>
    );
  return (
    <div className="creation-form">
      <details className="creation-guidance">
        <summary>
          <Info size={17} aria-hidden="true" />
          <span>Cách tính ngày nghỉ và quỹ phép</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div>
          <p>
            Chỉ tính các ngày làm việc theo lịch của doanh nghiệp. Đơn chờ duyệt
            chưa trừ quỹ phép; đơn mới không được trùng với đơn đang chờ hoặc đã
            được duyệt.
          </p>
          {settings.data && (
            <p>
              Lịch làm việc:{" "}
              {settings.data.schedule.workDays
                .map(
                  (day) =>
                    [
                      "Chủ nhật",
                      "Thứ hai",
                      "Thứ ba",
                      "Thứ tư",
                      "Thứ năm",
                      "Thứ sáu",
                      "Thứ bảy",
                    ][day],
                )
                .join(", ")}
              .
            </p>
          )}
        </div>
      </details>
      <Form
        schema={formSchema}
        columns={2}
        fields={[
          {
            name: "leaveTypeId",
            label: "Loại nghỉ phép",
            type: "select",
            required: true,
            span: "full",
            options: [
              { value: "", label: "Chọn loại nghỉ phép" },
              ...available.map((type) => ({
                value: type.id,
                label:
                  type.name +
                  (type.deductsBalance
                    ? " · Trừ phép năm"
                    : " · Không trừ phép"),
              })),
            ],
          },
          { name: "startDate", label: "Từ ngày", type: "date", required: true },
          { name: "endDate", label: "Đến ngày", type: "date", required: true },
          {
            name: "reason",
            label: "Lý do nghỉ",
            type: "textarea",
            required: true,
            span: "full",
            placeholder: "Chia sẻ lý do nghỉ để người phụ trách xem xét",
            hint: "Từ 5 đến 1.000 ký tự. Ngày nghỉ được tính theo ngày nguyên.",
          },
        ]}
        defaults={{
          leaveTypeId: "",
          startDate: today(),
          endDate: today(),
          reason: "",
        }}
        onSubmit={async (body) => {
          const result = (await action.mutateAsync({
            path: "/leave-requests",
            body,
          })) as LeaveView;
          navigate("/leave/" + result.id, { replace: true });
        }}
        submitLabel="Gửi yêu cầu nghỉ phép"
      />
    </div>
  );
}

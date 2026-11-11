import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  leaveSchema,
  type Page,
  type LeaveView,
  type LeaveType,
  type Settings,
} from "@hoosoo/shared";
import { useApi, useAction } from "../../hooks/data";
import { today } from "../../utils/date-time";
import { Heading, Loading, ErrorBox, Form } from "../../components/ui";

export function LeaveCreate() {
  const navigate = useNavigate();
  const types = useApi<Page<LeaveType>>("/leave-types?pageSize=100"),
    settings = useApi<Settings>("/settings");
  const action = useAction();
  return (
    <>
      <Heading
        title="Tạo đơn nghỉ phép"
        description="Nghỉ theo ngày nguyên. Số ngày được tính theo lịch làm việc đã cấu hình."
        action={
          <Link className="button secondary" to="/leave/my">
            <ArrowLeft size={16} />
            Đơn của tôi
          </Link>
        }
      />
      <div className="detail-grid">
        <section className="panel">
          {types.isPending ? (
            <Loading />
          ) : types.error ? (
            <ErrorBox error={types.error} />
          ) : (
            <Form
              schema={leaveSchema}
              fields={[
                {
                  name: "leaveTypeId",
                  label: "Loại nghỉ phép",
                  type: "select",
                  options: [
                    { value: "", label: "Chọn loại phép" },
                    ...types
                      .data!.items.filter((t) => t.active)
                      .map((t) => ({
                        value: t.id,
                        label:
                          t.name +
                          (t.deductsBalance
                            ? " · Trừ phép"
                            : " · Không trừ phép"),
                      })),
                  ],
                },
                { name: "startDate", label: "Từ ngày", type: "date" },
                { name: "endDate", label: "Đến ngày", type: "date" },
                { name: "reason", label: "Lý do nghỉ", type: "textarea" },
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
                navigate("/leave/" + result.id);
              }}
              submitLabel="Gửi yêu cầu"
            />
          )}
        </section>
        <aside className="panel policy-note">
          <h2>Trước khi gửi yêu cầu</h2>
          <ul>
            <li>Đơn nghỉ không được vượt qua hai năm. Hãy tách đơn nếu cần.</li>
            <li>
              Ngày không làm việc và ngày nghỉ cấu hình không bị trừ phép.
            </li>
            <li>
              Đơn đang chờ duyệt chưa trừ số dư. Người duyệt sẽ kiểm tra số dư
              còn lại khi xử lý.
            </li>
            <li>
              Không thể tạo đơn chồng lấn với đơn đang chờ hoặc đã được duyệt.
            </li>
          </ul>
          {settings.data && (
            <p>
              Lịch làm việc:{" "}
              {settings.data.schedule.workDays
                .map(
                  (d) =>
                    [
                      "Chủ nhật",
                      "Thứ hai",
                      "Thứ ba",
                      "Thứ tư",
                      "Thứ năm",
                      "Thứ sáu",
                      "Thứ bảy",
                    ][d],
                )
                .join(", ")}
              .
            </p>
          )}
          <small>Áp dụng theo chính sách nghỉ phép của doanh nghiệp.</small>
        </aside>
      </div>
    </>
  );
}

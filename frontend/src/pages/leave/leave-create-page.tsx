import { StableText } from "../../i18n/stable-text";
import { t, useLocale } from "../../i18n";
import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import {
  leaveSchema,
  type Page,
  type LeaveView,
  type LeaveType,
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
  useLocale();
  const navigate = useNavigate();
  const types = useApi<Page<LeaveType>>("/leave-types?pageSize=100");
  const action = useAction();
  if (types.isPending) return <Loading />;
  if (types.error)
    return <ErrorBox error={types.error} retry={() => void types.refetch()} />;
  const available = types.data!.items.filter((type) => type.active);
  if (!available.length)
    return (
      <div className="creation-empty">
        <Info size={24} />
        <h3>
          <StableText>{t("Chưa có loại nghỉ phép")}</StableText>
        </h3>
        <p>
          <StableText>
            {t("Liên hệ nhân sự để thêm loại nghỉ phép.")}
          </StableText>
        </p>
      </div>
    );
  return (
    <div className="creation-form">
      <Form
        schema={formSchema}
        columns={2}
        fields={[
          {
            name: "leaveTypeId",
            label: t("Loại nghỉ phép"),
            type: "select",
            required: true,
            span: "full",
            options: [
              { value: "", label: t("Chọn loại nghỉ phép") },
              ...available.map((type) => ({
                value: type.id,
                label:
                  type.name +
                  (type.deductsBalance
                    ? t(" · Trừ phép năm")
                    : t(" · Không trừ phép")),
              })),
            ],
          },
          {
            name: "startDate",
            label: t("Từ ngày"),
            type: "date",
            required: true,
          },
          {
            name: "endDate",
            label: t("Đến ngày"),
            type: "date",
            required: true,
          },
          {
            name: "reason",
            label: t("Lý do nghỉ"),
            type: "textarea",
            required: true,
            span: "full",
            placeholder: t("Chia sẻ lý do nghỉ để người phụ trách xem xét"),
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
        submitLabel={t("Gửi yêu cầu nghỉ phép")}
      />
    </div>
  );
}

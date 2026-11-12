import { Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { CalendarPlus, SquarePen, UserRoundPlus } from "lucide-react";
import { Loading, Modal } from "../components/ui";
import { recordDialogRoute } from "./record-dialog-routes";

export function RecordDialog() {
  const navigate = useNavigate();
  const location = useLocation();
  const route = recordDialogRoute(location.pathname)!;
  const close = () => {
    if (location.state?.backgroundLocation) navigate(-1);
    else navigate(route.fallback, { replace: true });
  };
  return (
    <Modal
      title={
        route.edit
          ? "Chỉnh sửa hồ sơ"
          : route.kind === "employee"
            ? "Thêm nhân viên"
            : "Tạo đơn nghỉ phép"
      }
      description={
        route.edit
          ? "Cập nhật thông tin cá nhân và vị trí làm việc của nhân viên."
          : route.kind === "employee"
            ? "Tạo hồ sơ và sắp xếp vị trí làm việc cho thành viên mới."
            : "Chọn thời gian nghỉ và gửi yêu cầu đến người phụ trách."
      }
      icon={
        route.edit ? (
          <SquarePen size={21} />
        ) : route.kind === "employee" ? (
          <UserRoundPlus size={21} />
        ) : (
          <CalendarPlus size={21} />
        )
      }
      size="wide"
      onClose={close}
    >
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </Modal>
  );
}

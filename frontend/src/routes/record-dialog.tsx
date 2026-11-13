import { t, useLocale } from "../i18n";
import { Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { CalendarPlus, SquarePen, UserRoundPlus } from "lucide-react";
import { Loading, Modal } from "../components/ui";
import { recordDialogRoute } from "./record-dialog-routes";

export function RecordDialog() {
  useLocale();
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
          ? t("Chỉnh sửa hồ sơ")
          : route.kind === "employee"
            ? t("Thêm nhân viên")
            : t("Tạo đơn nghỉ phép")
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

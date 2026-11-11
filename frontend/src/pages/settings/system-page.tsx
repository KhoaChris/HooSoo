import { RefreshCw, CheckCircle2, Activity, ShieldCheck } from "lucide-react";
import { useApi } from "../../hooks/data";
import { dateText, timeText } from "../../utils/date-time";
import { Heading, Button, Loading, ErrorBox } from "../../components/ui";

interface SystemStatus {
  status: string;
  api: string;
  firestore: string;
  mode: string;
  checkedAt: string;
  latencyMs: number;
}

export function SystemPage() {
  const q = useApi<SystemStatus>("/system/status");
  return (
    <>
      <Heading
        title="Trạng thái hệ thống"
        description="Kiểm tra kết nối bằng một lần đọc Firestore thực tế."
        action={
          <Button
            variant="secondary"
            busy={q.isFetching}
            onClick={() => void q.refetch()}
          >
            <RefreshCw size={16} />
            Kiểm tra lại
          </Button>
        }
      />
      <ErrorBox error={q.error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <Loading />
      ) : (
        q.data &&
        !q.error && (
          <section className="panel system-result">
            <CheckCircle2 size={40} className="teal" />
            <h2>Kết nối thành công</h2>
            <p>Lần đọc cơ sở dữ liệu vừa thực hiện đã nhận được phản hồi.</p>
            <dl className="details">
              <dt>
                <Activity size={16} /> API
              </dt>
              <dd>Đã phản hồi</dd>
              <dt>
                <ShieldCheck size={16} /> Firestore
              </dt>
              <dd>Đọc thành công · {q.data.latencyMs} ms</dd>
              <dt>Môi trường</dt>
              <dd>
                {q.data.mode === "emulator"
                  ? "Emulator cục bộ"
                  : "Firebase cloud"}
              </dd>
              <dt>Thời điểm kiểm tra</dt>
              <dd>
                {dateText(q.data.checkedAt)} · {timeText(q.data.checkedAt)}
              </dd>
            </dl>
            <p className="muted-note">
              Kết quả chỉ phản ánh lần kiểm tra này, không xác nhận trạng thái
              liên tục.
            </p>
          </section>
        )
      )}
    </>
  );
}

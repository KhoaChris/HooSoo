import { useState } from "react";
import { FileSpreadsheet, Download, CheckCircle2, Upload } from "lucide-react";
import type { ImportPreview } from "@hoosoo/shared";
import { useAction } from "../../hooks/data";
import { api } from "../../services/api-client";
import {
  Button,
  Heading,
  Input,
  ErrorBox,
  Select,
  Checkbox,
} from "../../components/ui";
import { t, useLocale } from "../../i18n";
import { useAuth } from "../../app/auth";
import {
  readImportMatrix,
  mapRows,
  suggestColumn,
  importColumns,
} from "./import-model";
import { Empty } from "./common";
export function ImportPage() {
  useLocale();
  const { me } = useAuth(),
    run = useAction();
  const [matrix, setMatrix] = useState<string[][]>([]),
    [mapping, setMapping] = useState<string[]>([]),
    [rows, setRows] = useState<Record<string, string>[]>([]),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  if (!["HR", "Admin"].includes(me?.actor.role ?? ""))
    return <Empty>{t("Bạn không có quyền nhập danh sách nhân viên.")}</Empty>;
  const inspect = async (data: Record<string, string>[]) => {
    setError(null);
    setBusy(true);
    setConfirmed(false);
    try {
      setPreview(
        await api<ImportPreview>("/workforce/imports/preview", {
          method: "POST",
          body: { rows: data, fingerprint: "" },
        }),
      );
    } catch (e) {
      setError(e as Error);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wf-page">
      <Heading
        title={t("Nhập danh sách nhân viên")}
        description={t(
          "Chọn tệp, kiểm tra từng dòng và xác nhận trước khi cập nhật hồ sơ.",
        )}
      />
      <ol className="wf-steps">
        <li className="active">1 · {t("Chọn tệp")}</li>
        <li className={preview ? "active" : ""}>2 · {t("Xem trước")}</li>
        <li className={done ? "active" : ""}>3 · {t("Xác nhận")}</li>
      </ol>
      <section className="wf-import-zone">
        <FileSpreadsheet size={30} />
        <h2>{t("Nhập từ Excel hoặc CSV")}</h2>
        <p>
          {t(
            "Tối đa 20 nhân viên / lần, tệp tối đa 256 KB. Hồ sơ có mã sẽ được cập nhật; để trống mã để thêm mới.",
          )}
        </p>
        <div className="wf-actions">
          <label className="wf-file-label">
            {t("Chọn tệp CSV / XLSX")}
            <Input
              type="file"
              accept=".csv,.xlsx"
              disabled={busy || run.isPending}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPreview(null);
                setDone(false);
                setBusy(true);
                setError(null);
                try {
                  const matrix = await readImportMatrix(file);
                  if (
                    matrix.length < 2 ||
                    matrix.length > 21 ||
                    matrix[0].length > 10
                  )
                    throw new Error("Mỗi lần nhập từ 1 đến 20 nhân viên.");
                  setMatrix(matrix);
                  setMapping(matrix[0].map(suggestColumn));
                } catch (err) {
                  setError(err as Error);
                  setRows([]);
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              const blob = new Blob(
                  ["\ufeff" + importColumns.join(",") + "\r\n"],
                  { type: "text/csv;charset=utf-8" },
                ),
                url = URL.createObjectURL(blob),
                a = document.createElement("a");
              a.href = url;
              a.download = "hoosoo-employee-template.csv";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <Download size={16} />
            {t("Tải tệp mẫu")}
          </Button>
        </div>
        <details>
          <summary>{t("Hướng dẫn nhập dữ liệu")}</summary>
          <p>
            {t(
              "Phòng ban và chức danh nhận tên đang có trong hệ thống. Quản lý dùng mã nhân viên; ngày dùng YYYY-MM-DD. Trạng thái: active hoặc probation. Không nhập mật khẩu hay vai trò tài khoản.",
            )}
          </p>
          <p>
            {t(
              "Khi cập nhật, các cột bỏ trống giữ nguyên dữ liệu cũ; học vấn, kinh nghiệm, kỹ năng và chứng chỉ luôn được giữ lại.",
            )}
          </p>
        </details>
      </section>
      {matrix.length > 0 && !done && (
        <section className="wf-import-preview">
          <h2>{t("Ghép cột dữ liệu")}</h2>
          <div className="wf-mapping">
            {matrix[0].map((header, i) => (
              <label key={i}>
                <span>{header}</span>
                <Select
                  aria-label={header}
                  value={mapping[i] || ""}
                  onValueChange={(v) => {
                    setMapping((old) => old.map((x, j) => (j === i ? v : x)));
                    setPreview(null);
                  }}
                  options={[
                    { value: "", label: t("Bỏ qua cột này") },
                    ...importColumns.map((value) => ({
                      value,
                      label: t(columnNames[value]),
                    })),
                  ]}
                />
                <small>{matrix[1]?.[i]}</small>
              </label>
            ))}
          </div>
          <Button
            variant="secondary"
            busy={busy}
            onClick={() => {
              try {
                const chosen = mapping
                    .map((v, i) => ({ v, i }))
                    .filter((x) => x.v),
                  data = mapRows([
                    chosen.map((x) => x.v),
                    ...matrix
                      .slice(1)
                      .map((row) => chosen.map((x) => row[x.i] ?? "")),
                  ]);
                setRows(data);
                void inspect(data);
              } catch (e) {
                setError(e as Error);
              }
            }}
          >
            {t("Kiểm tra dữ liệu")}
          </Button>
        </section>
      )}
      <ErrorBox error={error} />
      {done && (
        <p className="wf-success-note">
          <CheckCircle2 size={20} />
          {t(
            "Đã nhập danh sách. Các hồ sơ đã được lưu và ghi nhận trong nhật ký.",
          )}
        </p>
      )}
      {preview && (
        <section className="wf-import-preview">
          <header>
            <h2>
              {t("Kết quả kiểm tra")} · {preview.rows.length}
            </h2>
            <Button
              variant="secondary"
              busy={busy}
              onClick={() => void inspect(rows)}
            >
              {t("Kiểm tra lại")}
            </Button>
          </header>
          <div className="wf-table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Dòng",
                    "Nhân viên",
                    "Thao tác",
                    "Nội dung thay đổi",
                    "Kết quả",
                  ].map((v) => (
                    <th key={v}>{t(v)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>
                      {r.input.name}
                      <small>{r.input.email}</small>
                    </td>
                    <td>{t(r.mode === "create" ? "Thêm mới" : "Cập nhật")}</td>
                    <td>
                      {r.changes
                        .map((v) =>
                          t(
                            (
                              {
                                name: "Họ tên",
                                email: "Email",
                                phone: "Số điện thoại",
                                address: "Địa chỉ",
                                departmentId: "Phòng ban",
                                positionId: "Chức danh",
                                managerId: "Quản lý trực tiếp",
                                hireDate: "Ngày vào làm",
                                status: "Trạng thái",
                              } as Record<string, string>
                            )[v] ?? v,
                          ),
                        )
                        .join(", ") || "—"}
                    </td>
                    <td className={r.errors.length ? "wf-error" : "wf-valid"}>
                      {r.errors.length
                        ? r.errors.map((v) => t(v)).join(" · ")
                        : t("Hợp lệ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            variant="secondary"
            onClick={() => downloadResult(preview, done)}
          >
            <Download size={16} />
            {t("Tải kết quả kiểm tra")}
          </Button>
          {!done && (
            <>
              <label className="wf-confirm">
                <Checkbox
                  checked={confirmed}
                  disabled={run.isPending || busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>{t("Tôi đã kiểm tra các dòng thêm mới và cập nhật.")}</span>
              </label>
              <Button
                busy={run.isPending}
                disabled={!preview.canCommit || !confirmed || busy}
                onClick={async () => {
                  setError(null);
                  try {
                    await run.mutateAsync({
                      path: "/workforce/imports/commit",
                      body: { rows, fingerprint: preview.fingerprint },
                    });
                    setDone(true);
                    setRows([]);
                  } catch (e) {
                    setError(e as Error);
                  }
                }}
              >
                <Upload size={16} />
                {t("Xác nhận nhập dữ liệu")}
              </Button>
            </>
          )}
        </section>
      )}
    </div>
  );
}

const columnNames: Record<string, string> = {
  employeeCode: "Mã nhân viên",
  name: "Họ tên",
  email: "Email",
  phone: "Số điện thoại",
  address: "Địa chỉ",
  departmentId: "Phòng ban",
  positionId: "Chức danh",
  managerId: "Mã quản lý",
  hireDate: "Ngày vào làm",
  status: "Trạng thái",
};
function downloadResult(preview: ImportPreview, done: boolean) {
  const escape = (value: unknown) => {
    let v = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  };
  const rows = [
      [t("Dòng"), t("Nhân viên"), t("Thao tác"), t("Kết quả")],
      ...preview.rows.map((r) => [
        r.row,
        r.input.name,
        t(r.mode === "create" ? "Thêm mới" : "Cập nhật"),
        r.errors.length
          ? r.errors.map((e) => t(e)).join("; ")
          : t(done ? "Đã lưu" : "Hợp lệ"),
      ]),
    ],
    url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "hoosoo-import-result.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

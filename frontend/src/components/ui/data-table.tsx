import { type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Rows3 } from "lucide-react";
import { type Page } from "@hoosoo/shared";
import { Empty } from "./empty-state";
import { ErrorBox } from "./error-box";

export type TableColumn<T> = {
  label: string;
  render: (row: T) => ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
};
export function DataTable<T extends { id: string }>({
  data,
  columns,
  onPage,
  filtered = false,
  title,
  description,
  toolbar,
  actions,
  icon,
  loading = false,
  error,
  onRetry,
  footerNote,
}: {
  data?: Page<T>;
  columns: TableColumn<T>[];
  onPage?: (page: number) => void;
  filtered?: boolean;
  title?: string;
  description?: string;
  toolbar?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  footerNote?: ReactNode;
}) {
  const current = data?.page || 1,
    total = data?.total || 0,
    size = data?.pageSize || 20,
    pages = Math.max(1, Math.ceil(total / size));
  const pageNumbers = Array.from(
    new Set(
      pages <= 5
        ? Array.from({ length: pages }, (_, i) => i + 1)
        : [1, current - 1, current, current + 1, pages].filter(
            (n) => n >= 1 && n <= pages,
          ),
    ),
  ).sort((a, b) => a - b);
  const start = data?.items.length ? (current - 1) * size + 1 : 0,
    end = data?.items.length ? start + data.items.length - 1 : 0;
  return (
    <section className="table-panel" aria-label={title || "Danh sách dữ liệu"}>
      {title && (
        <header className="data-table-heading">
          <div className="data-table-title">
            <span className="data-table-icon" aria-hidden="true">
              {icon || <Rows3 size={18} />}
            </span>
            <div>
              <div className="data-table-title-line">
                <h2>{title}</h2>
                {!loading && !error && data && (
                  <span className="data-table-count">
                    {total.toLocaleString("vi-VN")}
                  </span>
                )}
              </div>
              {description && <p>{description}</p>}
            </div>
          </div>
          {actions && <div className="data-table-actions">{actions}</div>}
        </header>
      )}
      {toolbar && <div className="table-toolbar">{toolbar}</div>}
      {error ? (
        <div className="table-feedback">
          <ErrorBox error={error} retry={onRetry} />
        </div>
      ) : (
        <>
          <div
            className="table-scroll"
            tabIndex={0}
            aria-label="Nội dung bảng, có thể cuộn ngang"
            aria-busy={loading}
          >
            <table>
              <caption className="sr-only">
                {title || "Danh sách dữ liệu"}
              </caption>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.label}
                      scope="col"
                      className={c.className}
                      style={{ textAlign: c.align }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }, (_, i) => (
                      <tr
                        key={i}
                        aria-hidden="true"
                        className="table-skeleton-row"
                      >
                        {columns.map((c, j) => (
                          <td key={c.label}>
                            <span
                              className={
                                "table-skeleton" + (j === 0 ? " wide" : "")
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  : data?.items.map((row) => (
                      <tr key={row.id}>
                        {columns.map((c) => (
                          <td
                            key={c.label}
                            className={c.className}
                            style={{ textAlign: c.align }}
                          >
                            {c.render(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!loading && !data?.items.length && <Empty filtered={filtered} />}
        </>
      )}
      <footer className="table-footer">
        <span role="status">
          {loading ? (
            "Đang tải danh sách…"
          ) : error ? (
            "Chưa thể tải dữ liệu"
          ) : (
            <>
              Hiển thị{" "}
              <strong>
                {start}–{end}
              </strong>{" "}
              trong <strong>{total.toLocaleString("vi-VN")}</strong> kết quả
            </>
          )}
        </span>
        {onPage && (
          <nav
            className="table-pagination"
            aria-label={`Phân trang ${title || "danh sách"}`}
          >
            <button
              type="button"
              className="table-page-arrow"
              aria-label="Trang trước"
              disabled={loading || !!error || !data || current <= 1}
              onClick={() => onPage(current - 1)}
            >
              <ChevronLeft size={16} />
              <span>Trước</span>
            </button>
            {pageNumbers.map((page, i) => (
              <span className="table-page-slot" key={page}>
                {i > 0 && page - pageNumbers[i - 1] > 1 && (
                  <span className="table-page-gap" aria-hidden="true">
                    …
                  </span>
                )}
                <button
                  type="button"
                  className="table-page-number"
                  aria-label={`Trang ${page}`}
                  aria-current={current === page ? "page" : undefined}
                  disabled={loading || !!error || current === page}
                  onClick={() => onPage(page)}
                >
                  {page}
                </button>
              </span>
            ))}
            <button
              type="button"
              className="table-page-arrow"
              aria-label="Trang tiếp theo"
              disabled={loading || !!error || !data || current >= pages}
              onClick={() => onPage(current + 1)}
            >
              <span>Sau</span>
              <ChevronRight size={16} />
            </button>
          </nav>
        )}
      </footer>
      {footerNote && <div className="table-footnote">{footerNote}</div>}
    </section>
  );
}

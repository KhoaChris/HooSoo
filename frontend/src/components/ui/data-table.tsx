import { StableText } from "../../i18n/stable-text";
import { t, useLocale, intlLocale } from "../../i18n";
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
  /** Reading width on narrow screens; all columns expand proportionally. */
  minWidth?: number;
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
  useLocale();
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
  const minTableWidth = columns.reduce(
    (sum, column) => sum + (column.minWidth ?? 180),
    0,
  );
  return (
    <section
      className="table-panel"
      aria-label={title || t("Danh sách dữ liệu")}
    >
      {title && (
        <header className="data-table-heading">
          <div className="data-table-title">
            <span className="data-table-icon" aria-hidden="true">
              {icon || <Rows3 size={18} />}
            </span>
            <div>
              <div className="data-table-title-line">
                <h2>
                  <StableText>{title}</StableText>
                </h2>
                {!loading && !error && data && (
                  <span className="data-table-count">
                    {total.toLocaleString(intlLocale())}
                  </span>
                )}
              </div>
              {description && (
                <p>
                  <StableText>{description}</StableText>
                </p>
              )}
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
            aria-label={t("Nội dung bảng, có thể cuộn ngang")}
            aria-busy={loading}
          >
            <table style={{ minWidth: minTableWidth }}>
              <caption className="sr-only">
                {title || t("Danh sách dữ liệu")}
              </caption>
              <colgroup>
                {columns.map((c, index) => (
                  <col
                    key={index}
                    style={{
                      width: `${((c.minWidth ?? 180) / minTableWidth) * 100}%`,
                    }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {columns.map((c, index) => (
                    <th
                      key={index}
                      scope="col"
                      className={c.className}
                      style={{ textAlign: c.align }}
                    >
                      <StableText>{t(c.label)}</StableText>
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
                          <td key={j}>
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
                        {columns.map((c, index) => (
                          <td
                            key={index}
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
            t("Đang tải danh sách…")
          ) : error ? (
            t("Chưa thể tải dữ liệu")
          ) : (
            <>
              {t("Hiển thị")}{" "}
              <strong>
                {start}–{end}
              </strong>{" "}
              {t("trong")} <strong>{total.toLocaleString(intlLocale())}</strong>{" "}
              {t("kết quả")}
            </>
          )}
        </span>
        {onPage && (
          <nav
            className="table-pagination"
            aria-label={t("Phân trang {0}", [title || "danh sách"])}
          >
            <button
              type="button"
              className="table-page-arrow"
              aria-label={t("Trang trước")}
              disabled={loading || !!error || !data || current <= 1}
              onClick={() => onPage(current - 1)}
            >
              <ChevronLeft size={16} />
              <span>{t("Trước")}</span>
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
                  aria-label={t("Trang {0}", [page])}
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
              aria-label={t("Trang tiếp theo")}
              disabled={loading || !!error || !data || current >= pages}
              onClick={() => onPage(current + 1)}
            >
              <span>{t("Sau")}</span>
              <ChevronRight size={16} />
            </button>
          </nav>
        )}
      </footer>
      {footerNote && <div className="table-footnote">{footerNote}</div>}
    </section>
  );
}

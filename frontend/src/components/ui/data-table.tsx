import { type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Page } from "@hoosoo/shared";
import { Button } from "./button";
import { Empty } from "./empty-state";

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onPage,
  filtered = false,
}: {
  data?: Page<T>;
  columns: { label: string; render: (row: T) => ReactNode }[];
  onPage?: (page: number) => void;
  filtered?: boolean;
}) {
  return (
    <div className="table-panel">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.label}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.label}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data?.items.length && <Empty filtered={filtered} />}
      <footer className="table-footer">
        <span>
          {data?.total || 0} kết quả · Trang {data?.page || 1}/
          {Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 20)))}
        </span>
        {onPage && (
          <div className="flex gap-2">
            <Button
              aria-label="Trang trước"
              variant="secondary"
              disabled={!data || data.page <= 1}
              onClick={() => onPage(data!.page - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              aria-label="Trang tiếp theo"
              variant="secondary"
              disabled={!data || data.page * data.pageSize >= data.total}
              onClick={() => onPage(data!.page + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
}

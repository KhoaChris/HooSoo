export const importColumns = [
  "employeeCode",
  "name",
  "email",
  "phone",
  "address",
  "departmentId",
  "positionId",
  "managerId",
  "hireDate",
  "status",
];
const aliases: Record<string, string> = {
  "mã nhân viên": "employeeCode",
  "họ tên": "name",
  "họ và tên": "name",
  tên: "name",
  email: "email",
  "điện thoại": "phone",
  "số điện thoại": "phone",
  "địa chỉ": "address",
  "phòng ban": "departmentId",
  "chức danh": "positionId",
  "mã quản lý": "managerId",
  "ngày vào làm": "hireDate",
  "trạng thái": "status",
};
export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const text = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || !cell) quoted = !quoted;
      else throw new Error("CSV không hợp lệ");
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV không hợp lệ");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
// Reject oversized ZIP entries before ExcelJS expands the workbook in memory.
export function checkWorkbookSize(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  let end = -1;
  for (
    let i = view.byteLength - 22;
    i >= Math.max(0, view.byteLength - 65557);
    i--
  )
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Tệp Excel không hợp lệ");
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true),
    total = 0;
  if (count > 100) throw new Error("Tệp Excel vượt giới hạn");
  for (let i = 0; i < count; i++) {
    if (
      cursor + 46 > view.byteLength ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw new Error("Tệp Excel không hợp lệ");
    total += view.getUint32(cursor + 24, true);
    if (total > 2_000_000) throw new Error("Tệp Excel vượt giới hạn");
    cursor +=
      46 +
      view.getUint16(cursor + 28, true) +
      view.getUint16(cursor + 30, true) +
      view.getUint16(cursor + 32, true);
  }
}
export function mapRows(matrix: string[][]) {
  if (matrix.length < 2 || matrix.length > 21)
    throw new Error("Mỗi lần nhập từ 1 đến 20 nhân viên.");
  const headers = matrix[0].map(
    (h) => aliases[h.trim().toLowerCase()] ?? h.trim(),
  );
  if (
    new Set(headers).size !== headers.length ||
    headers.some((h) => !importColumns.includes(h))
  )
    throw new Error("Tên cột không hợp lệ hoặc bị trùng. Dùng tệp mẫu.");
  if (!headers.includes("name") || !headers.includes("email"))
    throw new Error("Tệp cần có cột họ tên và email.");
  return matrix.slice(1).map((row) => {
    if (row.length > headers.length)
      throw new Error("Số cột không khớp tiêu đề.");
    return Object.fromEntries(headers.map((h, i) => [h, row[i]?.trim() ?? ""]));
  });
}
export const suggestColumn = (header: string) =>
  aliases[header.trim().toLowerCase()] ??
  (importColumns.includes(header.trim()) ? header.trim() : "");
export async function readImportMatrix(file: File) {
  if (file.size > 256 * 1024) throw new Error("Tệp nhập tối đa 256 KB.");
  if (file.name.toLowerCase().endsWith(".csv"))
    return parseCsv(await file.text());
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    throw new Error("Chọn tệp CSV hoặc XLSX.");
  const bytes = await file.arrayBuffer();
  checkWorkbookSize(bytes);
  const ExcelJS = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  const sheet = book.worksheets[0];
  if (!sheet || sheet.rowCount > 21 || sheet.columnCount > 10)
    throw new Error("Mỗi lần nhập từ 1 đến 20 nhân viên.");
  const matrix: string[][] = [];
  sheet.eachRow((row) => {
    const values: string[] = [];
    for (let i = 1; i <= sheet.columnCount; i++) {
      const cell = row.getCell(i).value;
      if (cell && typeof cell === "object" && !(cell instanceof Date))
        throw new Error("Không dùng công thức hoặc ô liên kết trong tệp nhập.");
      values.push(
        cell instanceof Date
          ? cell.toISOString().slice(0, 10)
          : String(cell ?? ""),
      );
    }
    matrix.push(values);
  });
  return matrix;
}

export async function readImport(file: File) {
  return mapRows(await readImportMatrix(file));
}

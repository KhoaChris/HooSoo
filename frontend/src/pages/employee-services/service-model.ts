import {
  type ServiceView,
  type ServiceSetup,
  type ServiceSection,
  type ServiceWorkspace,
} from "@hoosoo/shared";
export function serviceDefaults(
  section: ServiceSection,
  date: string,
  item?: ServiceView,
  request?: ServiceWorkspace["requests"][number],
): ServiceSetup {
  const common = {
    section,
    employeeId: item?.employeeId ?? request?.employeeId ?? "",
    title: item?.title ?? request?.resource ?? "",
    notes: item?.notes ?? "",
    version: item?.version ?? 0,
  };
  if (section === "assets")
    return {
      ...common,
      section,
      assetCode: item?.assetCode ?? "",
      startDate: item?.startDate ?? date,
      endDate: item?.endDate ?? "",
      sourceRequestId: item?.sourceRequestId ?? request?.id ?? "",
    };
  if (section === "training")
    return {
      ...common,
      section,
      provider: item?.provider ?? "",
      startDate: item?.startDate ?? date,
      endDate: item?.endDate ?? date,
      sourceRequestId: item?.sourceRequestId ?? request?.id ?? "",
    };
  return { ...common, section, endDate: item?.endDate ?? date };
}
export function safeCsv(rows: readonly (readonly unknown[])[]) {
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
            return '"' + safe.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}

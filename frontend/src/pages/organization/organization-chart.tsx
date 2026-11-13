import { t, useLocale } from "../../i18n";
import { Avatar } from "../../components/ui/avatar";
import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Focus,
  GitBranch,
  Hand,
  Minus,
  Plus,
  UsersRound,
} from "lucide-react";
import type {
  OrganizationMember,
  VisibleDepartment,
} from "./organization-model";

function MemberNode({
  member,
  canViewProfile,
}: {
  member: OrganizationMember;
  canViewProfile: boolean;
}) {
  useLocale();
  const contents = (
    <>
      <div className="org-member-main">
        <Avatar
          name={member.name}
          src={member.avatarUrl}
          className="org-member-avatar"
        />
        <div className="org-member-identity">
          <div className="org-member-name">
            <strong>{member.name}</strong>
            {member.self && <span className="org-self-label">{t("Bạn")}</span>}
          </div>
          <span className="org-member-position">
            {member.positionName || t("Chưa có chức danh")}
          </span>
        </div>
      </div>
      <div className="org-member-manager">
        <GitBranch size={13} aria-hidden="true" />
        <span>
          {member.managerName ? (
            <>
              {t("Quản lý:")}{" "}
              <strong>{member.managerName}</strong>
            </>
          ) : (
            t("Chưa phân công quản lý")
          )}
        </span>
      </div>
    </>
  );
  const className =
    "org-member-node org-chart-node" + (member.self ? " is-self" : "");
  return canViewProfile || member.self ? (
    <Link
      className={className}
      data-self={member.self || undefined}
      to={member.self ? "/profile" : `/employees/${member.id}`}
      aria-label={t("Xem hồ sơ {0}{1}", [
        member.name,
        member.self ? " (bạn)" : "",
      ])}
    >
      {contents}
    </Link>
  ) : (
    <div className={className}>{contents}</div>
  );
}
export function OrganizationChart({
  companyName,
  departments,
  collapsed,
  setCollapsed,
  locateRequest,
  viewKey,
  canViewProfiles,
}: {
  companyName: string;
  departments: VisibleDepartment[];
  collapsed: Set<string>;
  setCollapsed: Dispatch<SetStateAction<Set<string>>>;
  locateRequest: number;
  viewKey: string;
  canViewProfiles: boolean;
}) {
  useLocale();
  const viewport = useRef<HTMLDivElement>(null),
    chart = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, viewportWidth: 0 });
  const [zoom, setZoom] = useState(100),
    [dragging, setDragging] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const pendingZoom = useRef<{ x: number; y: number } | null>(null);
  const focusedRequest = useRef(0);
  const scale = zoom / 100,
    spaceWidth = Math.max(size.viewportWidth, size.width * scale + 48);
  const allCollapsed = departments.every((d) => collapsed.has(d.id));
  const count = departments.reduce((total, d) => total + d.employees.length, 0);
  useLayoutEffect(() => {
    const measure = () => {
      if (!chart.current || !viewport.current) return;
      setSize({
        width: chart.current.offsetWidth,
        height: chart.current.offsetHeight,
        viewportWidth: viewport.current.clientWidth,
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(chart.current!);
    observer.observe(viewport.current!);
    measure();
    return () => observer.disconnect();
  }, []);
  const center = () => {
    const element = viewport.current!;
    element.scrollTo({
      left: (element.scrollWidth - element.clientWidth) / 2,
      top: 0,
    });
  };
  useLayoutEffect(() => {
    if (size.width) center();
  }, [viewKey, size.width, size.viewportWidth]);
  useLayoutEffect(() => {
    const anchor = pendingZoom.current;
    if (!anchor) return;
    const element = viewport.current!;
    element.scrollLeft =
      spaceWidth / 2 + anchor.x * scale - element.clientWidth / 2;
    element.scrollTop = 28 + anchor.y * scale - element.clientHeight / 2;
    pendingZoom.current = null;
  }, [scale, spaceWidth]);
  useLayoutEffect(() => {
    if (
      !locateRequest ||
      focusedRequest.current === locateRequest ||
      !size.height
    )
      return;
    const frame = requestAnimationFrame(() => {
      // Measure an expanded branch before scrolling to its last member.
      if (
        chart.current?.offsetHeight !== size.height ||
        chart.current.offsetWidth !== size.width
      )
        return;
      const element = viewport.current!,
        target =
          chart.current?.querySelector<HTMLElement>('[data-self="true"]');
      if (!target) return;
      // Scroll only the diagram, keeping the page and toolbar in place.
      const box = element.getBoundingClientRect(),
        node = target.getBoundingClientRect();
      element.scrollTo({
        left:
          element.scrollLeft +
          node.left +
          node.width / 2 -
          box.left -
          element.clientWidth / 2,
        top:
          element.scrollTop +
          node.top +
          node.height / 2 -
          box.top -
          element.clientHeight / 2,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      target.focus({ preventScroll: true });
      focusedRequest.current = locateRequest;
    });
    return () => cancelAnimationFrame(frame);
  }, [locateRequest, size.height, size.width]);
  const changeZoom = (next: number) => {
    if (next === zoom) return;
    const element = viewport.current!;
    pendingZoom.current = {
      x:
        (element.scrollLeft + element.clientWidth / 2 - spaceWidth / 2) / scale,
      y: (element.scrollTop + element.clientHeight / 2 - 28) / scale,
    };
    setZoom(next);
  };
  const stopDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  return (
    <>
      <div className="organization-viewbar">
        <span className="organization-pan-hint" id="org-pan-hint">
          <Hand size={15} aria-hidden="true" />
          {t("Kéo nền hoặc cuộn để di chuyển")}
        </span>
        <div className="organization-view-actions">
          <button
            type="button"
            className="org-collapse-all"
            onClick={() =>
              setCollapsed((current) => {
                const next = new Set(current);
                departments.forEach((d) =>
                  allCollapsed ? next.delete(d.id) : next.add(d.id),
                );
                return next;
              })
            }
          >
            {allCollapsed ? (
              <ChevronsUpDown size={16} aria-hidden="true" />
            ) : (
              <ChevronsDownUp size={16} aria-hidden="true" />
            )}
            {allCollapsed ? t("Mở tất cả") : t("Thu gọn")}
          </button>
          <div
            className="organization-zoom"
            role="group"
            aria-label={t("Tỷ lệ sơ đồ")}
          >
            <button
              className="icon-button"
              aria-label={t("Thu nhỏ sơ đồ")}
              disabled={zoom <= 60}
              onClick={() => changeZoom(zoom - 10)}
            >
              <Minus size={16} />
            </button>
            <button
              className="org-zoom-value"
              aria-label={t("Tỷ lệ {0}%, đặt lại 100%", [zoom])}
              onClick={() => changeZoom(100)}
            >
              {zoom}%
            </button>
            <button
              className="icon-button"
              aria-label={t("Phóng to sơ đồ")}
              disabled={zoom >= 140}
              onClick={() => changeZoom(zoom + 10)}
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            className="icon-button"
            aria-label={t("Căn giữa sơ đồ")}
            title={t("Căn giữa sơ đồ")}
            onClick={center}
          >
            <Focus size={17} />
          </button>
        </div>
      </div>
      <div
        ref={viewport}
        className={"organization-canvas" + (dragging ? " is-dragging" : "")}
        role="region"
        aria-label={t("Sơ đồ công ty, phòng ban và thành viên")}
        aria-describedby="org-pan-hint"
        tabIndex={0}
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            event.pointerType !== "mouse" ||
            (event.target as HTMLElement).closest(".org-chart-node, a, button")
          )
            return;
          const element = event.currentTarget;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: element.scrollLeft,
            top: element.scrollTop,
          };
          element.setPointerCapture(event.pointerId);
          setDragging(true);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          event.currentTarget.scrollLeft =
            drag.current.left - event.clientX + drag.current.x;
          event.currentTarget.scrollTop =
            drag.current.top - event.clientY + drag.current.y;
        }}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={stopDrag}
      >
        <div
          className="organization-canvas-space"
          style={{ width: spaceWidth, height: size.height * scale + 64 }}
        >
          <div
            className="org-chart"
            ref={chart}
            style={{ transform: `translateX(-50%) scale(${scale})` }}
          >
            <div className="org-company org-chart-node">
              <span className="org-company-icon">
                <Building2 size={24} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div>
                <span className="org-company-eyebrow">
                  {t("Cơ cấu tổ chức")}
                </span>
                <h2>{companyName}</h2>
                <p>
                  {departments.length} {" "}{t("phòng ban")}{" "}
                  <span aria-hidden="true">·</span> {count} {" "}{t("thành viên")}
                </p>
              </div>
            </div>
            <ul className="org-branches" aria-label={t("Các phòng ban")}>
              {departments.map((department) => {
                const closed = collapsed.has(department.id);
                return (
                  <li className="org-branch" key={department.id}>
                    <section aria-label={department.name}>
                      <h3 className="org-department-heading">
                        <button
                          className="org-department-node org-chart-node"
                          aria-expanded={!closed}
                          aria-controls={`org-members-${department.id}`}
                          onClick={() =>
                            setCollapsed((current) => {
                              const next = new Set(current);
                              if (closed) next.delete(department.id);
                              else next.add(department.id);
                              return next;
                            })
                          }
                        >
                          <span className="org-department-icon">
                            <UsersRound size={18} aria-hidden="true" />
                          </span>
                          <span className="org-department-identity">
                            <strong>{department.name}</strong>
                            <small>
                              {department.employees.length ===
                              department.totalEmployees
                                ? t("{0} thành viên", [
                                    department.totalEmployees,
                                  ])
                                : t("{0} / {1} thành viên", [
                                    department.employees.length,
                                    department.totalEmployees,
                                  ])}
                            </small>
                          </span>
                          <ChevronDown
                            className="org-branch-chevron"
                            size={16}
                            aria-hidden="true"
                          />
                        </button>
                      </h3>
                      <div id={`org-members-${department.id}`} hidden={closed}>
                        {department.employees.length ? (
                          <ul
                            className="org-members"
                            aria-label={t("Thành viên {0}", [department.name])}
                          >
                            {department.employees.map((member) => (
                              <li key={member.id}>
                                <MemberNode
                                  member={member}
                                  canViewProfile={canViewProfiles}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="org-department-empty">
                            {t("Chưa có thành viên")}
                          </p>
                        )}
                      </div>
                    </section>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

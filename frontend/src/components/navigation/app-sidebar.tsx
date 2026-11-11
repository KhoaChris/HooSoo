import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { ArrowUpRight, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { Role } from "@hoosoo/shared";
import { navigation } from "../../layouts/navigation";
import { Tooltip } from "../ui/tooltip";

type AppSidebarProps = {
  companyName: string;
  role: Role;
  workspaceLabel: string;
  collapsed: boolean;
  toggleCollapsed: () => void;
  isMobile: boolean;
  mobileOpen: boolean;
  closeMobile: () => void;
};

export function AppSidebar({
  companyName,
  role,
  workspaceLabel,
  collapsed,
  toggleCollapsed,
  isMobile,
  mobileOpen,
  closeMobile,
}: AppSidebarProps) {
  const sidebar = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const compact = collapsed && !isMobile;
  const toggleLabel = compact
    ? "Mở rộng thanh điều hướng"
    : "Thu gọn thanh điều hướng";

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The drawer must become visible before the browser can focus its controls.
    const focusFrame = requestAnimationFrame(() =>
      closeButton.current?.focus(),
    );
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile();
      }
      if (event.key === "Tab") {
        const elements = Array.from(
          sidebar.current?.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled])",
          ) ?? [],
        ).filter(
          (el) =>
            el.getClientRects().length &&
            getComputedStyle(el).visibility !== "hidden",
        );
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      // Wait until the workspace is no longer inert before restoring focus.
      queueMicrotask(() => {
        if (previousFocus?.getClientRects().length) previousFocus.focus();
        else
          sidebar.current
            ?.querySelector<HTMLButtonElement>(".sidebar-toggle")
            ?.focus();
      });
    };
  }, [isMobile, mobileOpen, closeMobile]);

  return (
    <aside
      id="app-sidebar"
      ref={sidebar}
      className={"sidebar" + (mobileOpen ? " open" : "")}
      aria-label="Thanh điều hướng"
      role={isMobile && mobileOpen ? "dialog" : undefined}
      aria-modal={isMobile && mobileOpen ? true : undefined}
      inert={isMobile && !mobileOpen}
    >
      <div className="sidebar-header">
        <NavLink
          to="/dashboard"
          className="brand"
          aria-label="HooSoo · Tổng quan"
          onClick={closeMobile}
        >
          <span className="brand-mark" aria-hidden="true">
            h.
          </span>
          <span className="brand-name" aria-hidden="true">
            HooSoo
            <span className="brand-dot" />
          </span>
        </NavLink>
        <span className="sidebar-desktop-toggle">
          <Tooltip content={toggleLabel}>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={toggleCollapsed}
              aria-label={toggleLabel}
              aria-expanded={!compact}
              aria-controls="sidebar-navigation"
            >
              {compact ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
          </Tooltip>
        </span>
        <button
          ref={closeButton}
          type="button"
          className="icon-button sidebar-close"
          aria-label="Đóng điều hướng"
          onClick={closeMobile}
        >
          <X size={20} />
        </button>
      </div>
      <div className="workspace-label" aria-label={companyName}>
        <span className="workspace-icon" aria-hidden="true">
          {companyName.trim().charAt(0).toLocaleUpperCase("vi") || "H"}
        </span>
        <div className="workspace-description">
          <strong>{companyName}</strong>
          <small>Không gian nhân sự</small>
        </div>
      </div>
      <nav id="sidebar-navigation" aria-label="Điều hướng chính">
        {navigation
          .filter((n) => n.roles.includes(role))
          .map((n) => (
            <div
              className={n.group ? "nav-section-start" : undefined}
              key={n.path}
            >
              {n.group && (
                <div className="nav-group" aria-hidden={compact || undefined}>
                  {n.group}
                </div>
              )}
              <Tooltip content={n.label} disabled={!compact}>
                <NavLink
                  end={["/attendance", "/settings"].includes(n.path)}
                  to={n.path}
                  onClick={closeMobile}
                  aria-label={n.label}
                >
                  <n.icon size={18} aria-hidden="true" />
                  <span className="nav-label">{n.label}</span>
                </NavLink>
              </Tooltip>
            </div>
          ))}
      </nav>
      <div className="sidebar-bottom" aria-label={workspaceLabel}>
        <span className="status-dot" aria-hidden="true" />
        <span className="sidebar-bottom-label">{workspaceLabel}</span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </div>
    </aside>
  );
}

import { t, useLocale } from "../../i18n";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Search,
  ChevronDown,
} from "lucide-react";
import type { Role } from "@hoosoo/shared";
import {
  activeNavigation,
  navigationFor,
  normalizeNavigationSearch,
} from "../../layouts/navigation";
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
  useLocale();
  const location = useLocation();
  const active = activeNavigation(location.pathname);
  const groups = navigationFor(role);
  const activeGroup = groups.find((group) =>
    group.items.some((item) => item.path === active?.path),
  );
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const query = normalizeNavigationSearch(search);
  const sidebar = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const compact = collapsed && !isMobile;
  const toggleLabel = compact
    ? t("Mở rộng thanh điều hướng")
    : t("Thu gọn thanh điều hướng");

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
            "a[href], button:not([disabled]), input:not([disabled])",
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
      aria-label={t("Thanh điều hướng")}
      role={isMobile && mobileOpen ? "dialog" : undefined}
      aria-modal={isMobile && mobileOpen ? true : undefined}
      inert={isMobile && !mobileOpen}
    >
      <div className="sidebar-header">
        <NavLink
          to="/dashboard"
          className="brand"
          aria-label={t("HooSoo · Tổng quan")}
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
          aria-label={t("Đóng điều hướng")}
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
          <small>{t("Không gian nhân sự")}</small>
        </div>
      </div>
      {!compact && (
        <label className="nav-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label={t("Tìm tính năng")}
            placeholder={t("Tìm tính năng…")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label={t("Xóa tìm kiếm")}
              onClick={() => setSearch("")}
            >
              <X size={14} />
            </button>
          )}
        </label>
      )}
      <nav id="sidebar-navigation" aria-label={t("Điều hướng chính")}>
        {groups.map((group) => {
          const items =
            query && !compact
              ? group.items.filter((item) =>
                  normalizeNavigationSearch(
                    `${item.label} ${t(item.label)} ${t(group.label)}`,
                  ).includes(query),
                )
              : group.items;
          if (!items.length) return null;
          const open =
            compact ||
            !!query ||
            !group.collapsible ||
            (expanded[group.id] ?? group.id === activeGroup?.id);
          return (
            <section className="nav-section" key={group.id}>
              {!compact &&
                (group.collapsible ? (
                  <button
                    type="button"
                    className="nav-section-toggle"
                    aria-expanded={open}
                    aria-controls={`nav-${group.id}`}
                    onClick={() =>
                      setExpanded((previous) => ({
                        ...previous,
                        [group.id]: !open,
                      }))
                    }
                  >
                    <span>{t(group.label)}</span>
                    <ChevronDown size={14} />
                  </button>
                ) : (
                  <div className="nav-group">{t(group.label)}</div>
                ))}
              <div id={`nav-${group.id}`} hidden={!open}>
                {items.map((item) => (
                  <Tooltip
                    key={item.path}
                    content={t(item.label)}
                    disabled={!compact}
                  >
                    <NavLink
                      to={item.path}
                      end={active?.path !== item.path}
                      className={active?.path === item.path ? "active" : ""}
                      aria-label={t(item.label)}
                      onClick={() => {
                        setSearch("");
                        setExpanded({});
                        closeMobile();
                      }}
                    >
                      <item.icon size={18} aria-hidden="true" />
                      <span className="nav-label">{t(item.label)}</span>
                    </NavLink>
                  </Tooltip>
                ))}
              </div>
            </section>
          );
        })}
        {query &&
          !groups.some((group) =>
            group.items.some((item) =>
              normalizeNavigationSearch(
                `${item.label} ${t(item.label)} ${t(group.label)}`,
              ).includes(query),
            ),
          ) && (
            <p className="nav-search-empty" role="status">
              {t("Không tìm thấy tính năng")}
            </p>
          )}
      </nav>
      <div className="sidebar-bottom" aria-label={workspaceLabel}>
        <span className="status-dot" aria-hidden="true" />
        <span className="sidebar-bottom-label">{workspaceLabel}</span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </div>
    </aside>
  );
}

import { t, useLocale } from "../i18n";
import { useLayoutEffect, useRef } from "react";
import { HeaderTools } from "../components/header/header-tools";
import { PresenceControl } from "../components/header/presence-control";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { labels } from "@hoosoo/shared";
import { useAuth } from "../app/auth";
import { env } from "../config/firebase";
import { ErrorBox } from "../components/ui";
import { AppSidebar } from "../components/navigation/app-sidebar";
import { useSidebar } from "../hooks/sidebar";
import { navigation } from "./navigation";

export function AppLayout() {
  useLocale();
  const { me, logout, live, error, retry } = useAuth();
  const sidebar = useSidebar();
  const location = useLocation();
  const mainContent = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    mainContent.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  const active = navigation.find((n) => n.path === location.pathname);
  const name = me!.employee.name;
  return (
    <div
      className={"app-shell" + (sidebar.collapsed ? " sidebar-collapsed" : "")}
    >
      {sidebar.isMobile && sidebar.mobileOpen && (
        <button
          className="sidebar-overlay"
          onClick={sidebar.closeMobile}
          aria-label={t("Đóng điều hướng")}
          tabIndex={-1}
        />
      )}
      <AppSidebar
        companyName={me!.companyName}
        role={me!.actor.role}
        workspaceLabel={
          env.VITE_FIREBASE_MODE === "emulator"
            ? t("Bản demo · Dữ liệu giả lập")
            : "HooSoo Workspace"
        }
        {...sidebar}
      />
      <div className="workspace" inert={sidebar.isMobile && sidebar.mobileOpen}>
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="icon-button mobile-menu"
              aria-label={t("Mở điều hướng")}
              aria-expanded={sidebar.mobileOpen}
              aria-controls="app-sidebar"
              onClick={sidebar.openMobile}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              HooSoo <span>/</span>{" "}
              <strong>{t(active?.label) || t("Chi tiết")}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <HeaderTools />
            <div className="topbar-user">
              <PresenceControl
                name={name}
                employeeId={me!.employee.id}
                avatarUrl={me!.employee.avatarUrl}
                roleLabel={t(labels[me!.actor.role])}
              />
              <button
                className="icon-button"
                title={t("Đăng xuất")}
                aria-label={t("Đăng xuất")}
                onClick={() => void logout()}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>
        <main className="main-content" ref={mainContent}>
          {error && (
            <>
              <ErrorBox error={error} retry={retry} />
              <p role="status">
                {t(
                  "Đang hiển thị dữ liệu cũ. Nội dung đang nhập được giữ lại.",
                )}
              </p>
            </>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>{t("HooSoo · Quản trị nhân lực")}</span>
          <span role="status">
            {live
              ? t("Đang nhận cập nhật trực tiếp")
              : t("Đang kết nối lại dữ liệu…")}
          </span>
        </footer>
      </div>
    </div>
  );
}

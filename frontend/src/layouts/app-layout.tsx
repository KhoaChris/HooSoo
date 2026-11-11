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
  const { me, logout, live, error, retry } = useAuth();
  const sidebar = useSidebar();
  const location = useLocation();
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
          aria-label="Đóng điều hướng"
          tabIndex={-1}
        />
      )}
      <AppSidebar
        companyName={me!.companyName}
        role={me!.actor.role}
        workspaceLabel={
          env.VITE_FIREBASE_MODE === "emulator"
            ? "Bản demo · Dữ liệu giả lập"
            : "HooSoo Workspace"
        }
        {...sidebar}
      />
      <div className="workspace" inert={sidebar.isMobile && sidebar.mobileOpen}>
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở điều hướng"
              aria-expanded={sidebar.mobileOpen}
              aria-controls="app-sidebar"
              onClick={sidebar.openMobile}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              HooSoo <span>/</span>{" "}
              <strong>{active?.label || "Chi tiết"}</strong>
            </span>
          </div>
          <div className="topbar-user">
            <span className="avatar">
              {name
                .split(" ")
                .slice(-2)
                .map((w) => w[0])
                .join("")}
            </span>
            <div>
              <strong>{name}</strong>
              <small>{labels[me!.actor.role]}</small>
            </div>
            <button
              className="icon-button"
              title="Đăng xuất"
              aria-label="Đăng xuất"
              onClick={() => void logout()}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <>
              <ErrorBox error={error} retry={retry} />
              <p role="status">
                Dữ liệu đang hiển thị là lần tải thành công gần nhất và có thể
                chưa cập nhật. Nội dung đang nhập được giữ lại.
              </p>
            </>
          )}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>HooSoo · Quản trị nhân lực</span>
          <span role="status">
            {live
              ? "Đang nhận cập nhật trực tiếp"
              : "Đang kết nối lại dữ liệu…"}
          </span>
        </footer>
      </div>
    </div>
  );
}

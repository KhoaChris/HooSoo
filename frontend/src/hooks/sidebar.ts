import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const preferenceKey = "hoosoo:sidebar:v1";
const mobileQuery = "(max-width: 900px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export function useSidebar() {
  const isMobile = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem(preferenceKey) === "collapsed";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);

  useEffect(() => {
    if (!isMobile) closeMobile();
  }, [isMobile, closeMobile]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    // Keep each tab's layout preference independent, just like its session.
    try {
      sessionStorage.setItem(preferenceKey, next ? "collapsed" : "expanded");
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
  };

  return {
    collapsed,
    toggleCollapsed,
    isMobile,
    mobileOpen,
    openMobile,
    closeMobile,
  };
}

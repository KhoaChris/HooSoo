export interface NotificationItem {
  id: string;
  kind: "chat" | "leave" | "work" | "request";
  subject: string;
  status: string;
  at: string;
  href: string;
  requiresAction: boolean;
}
export interface NotificationFeed {
  items: NotificationItem[];
}

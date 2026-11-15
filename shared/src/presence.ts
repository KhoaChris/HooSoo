import { z } from "zod";
export const presenceModeSchema = z.enum(["online", "dnd", "invisible"]);
export type PresenceMode = z.infer<typeof presenceModeSchema>;
export type PublicPresence = "online" | "dnd" | "offline";
export type PresenceEntry = { employeeId: string; status: PublicPresence };
export const presenceLabels = {
  online: "Trực tuyến",
  dnd: "Không làm phiền",
  invisible: "Vô hình",
  offline: "Ngoại tuyến",
  unknown: "Đang kết nối",
} as const;
export type PresencePacket =
  | {
      kind: "ready";
      connectionId: string;
      mode: PresenceMode;
      entries: PresenceEntry[];
    }
  | { kind: "update"; entries: PresenceEntry[] }
  | { kind: "self"; mode: PresenceMode };
export const presenceSessionSchema = z
  .object({ connectionId: z.string().uuid() })
  .strict();
export const presencePreferenceSchema = z
  .object({ mode: presenceModeSchema })
  .strict();

export const presencePacketSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ready"),
    connectionId: z.string().uuid(),
    mode: presenceModeSchema,
    entries: z
      .array(
        z.object({
          employeeId: z.string().min(1).max(100),
          status: z.enum(["online", "dnd", "offline"]),
        }),
      )
      .max(500),
  }),
  z.object({
    kind: z.literal("update"),
    entries: z
      .array(
        z.object({
          employeeId: z.string().min(1).max(100),
          status: z.enum(["online", "dnd", "offline"]),
        }),
      )
      .max(500),
  }),
  z.object({ kind: z.literal("self"), mode: presenceModeSchema }),
]);

import type { State, Settings } from "@hoosoo/shared";
import { assert } from "../utils/errors";

export function settings(s: State): Settings {
  assert(
    s.settings.main,
    503,
    "SETUP_REQUIRED",
    "Hệ thống chưa được khởi tạo.",
  );
  return s.settings.main;
}

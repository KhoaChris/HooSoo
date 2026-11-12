import type { State } from "@hoosoo/shared";
import { mergeState, type StateReader } from "../database/store";
export async function loadEmployeeAccess(
  read: StateReader,
  s: State,
  ids: string[],
) {
  const uids = [
    ...new Set(
      ids
        .map((id) => s.employees[id]?.uid)
        .filter((uid): uid is string => !!uid && !s.memberships[uid]),
    ),
  ];
  if (uids.length) mergeState(s, await read({ memberships: { ids: uids } }));
}

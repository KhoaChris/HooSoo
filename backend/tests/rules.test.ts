import { beforeAll, afterAll, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFile } from "node:fs/promises";
let testEnv: RulesTestEnvironment;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-hoosoo",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile(
        new URL("../../firebase/firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
afterAll(async () => {
  await testEnv?.cleanup();
});
it("denies business reads and writes even to authenticated client/Admin claims", async () => {
  for (const context of [
    testEnv.unauthenticatedContext(),
    testEnv.authenticatedContext("test-employee"),
    testEnv.authenticatedContext("test-admin", { role: "Admin" }),
  ]) {
    const ref = doc(
      context.firestore(),
      "organizations/hoosoo/employees/staff12",
    );
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { name: "forged" }));
  }
});

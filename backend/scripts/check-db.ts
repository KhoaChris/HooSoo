import { readiness } from "../src/database/store";

try {
  console.log(JSON.stringify(await readiness()));
  process.exit(0);
} catch {
  console.error(
    "Firestore read failed or timed out. Check Firebase Admin credentials, the Firestore database, IAM permissions, and the configured Firebase mode.",
  );
  process.exit(1);
}

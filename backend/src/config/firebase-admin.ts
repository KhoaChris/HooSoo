import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env";
import { AppError } from "../utils/errors";
const credential =
  env.FIREBASE_MODE === "cloud" ? applicationDefault() : undefined;
const app = initializeApp({
  projectId: env.FIREBASE_PROJECT_ID,
  ...(credential ? { credential } : {}),
});
export const auth = getAuth(app);
export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

// Validate ADC before Firestore initializes its gRPC client. Missing credentials
// must produce a handled 503 rather than an unhandled client initialization error.
export async function ensureFirebaseCredentials() {
  if (!credential) return;
  try {
    await credential.getAccessToken();
  } catch {
    throw new AppError(
      503,
      "FIREBASE_CREDENTIALS_UNAVAILABLE",
      "Máy chủ chưa kết nối được Firebase. Vui lòng liên hệ quản trị viên.",
    );
  }
}

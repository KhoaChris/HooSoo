import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserSessionPersistence,
  connectAuthEmulator,
} from "firebase/auth";
import { parseFrontendEnv } from "./env";
export const env = parseFrontendEnv(
  import.meta.env,
  import.meta.env.MODE === "production",
);
// A separate namespace also prevents older tabs using the default LOCAL Auth
// instance from replacing or clearing the new per-tab sessions during rollout.
const app = initializeApp(
  {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
  },
  "hoosoo-tab-session-v1",
);
// Configure before Auth initializes: a tab keeps its own account on reload,
// without reading shared IndexedDB/localStorage sign-ins from other tabs.
export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
});
if (env.VITE_FIREBASE_MODE === "emulator")
  connectAuthEmulator(auth, env.VITE_FIREBASE_AUTH_EMULATOR_URL!, {
    disableWarnings: true,
  });

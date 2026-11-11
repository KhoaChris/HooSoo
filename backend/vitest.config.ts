import { defineConfig } from "vitest/config";

// Tests must remain local even when the developer's .env targets Firebase Cloud.
export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      CORS_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173",
      FIREBASE_MODE: "emulator",
      FIREBASE_PROJECT_ID: "demo-hoosoo",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      GOOGLE_APPLICATION_CREDENTIALS: "",
    },
  },
});

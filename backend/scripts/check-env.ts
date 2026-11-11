import { env } from "../src/config/env";
console.log(
  `Backend environment valid. Mode: ${env.FIREBASE_MODE}; project: ${env.FIREBASE_PROJECT_ID}`,
);

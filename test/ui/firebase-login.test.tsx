import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { name: "test-auth" },
  emailSignIn: vi.fn(),
  googleSignIn: vi.fn(),
  providerOptions: vi.fn(),
}));

vi.mock("firebase/app", () => ({ initializeApp: () => ({}) }));
vi.mock("firebase/firestore", () => ({ getFirestore: () => ({}) }));
vi.mock("firebase/auth", () => ({
  getAuth: () => mocks.auth,
  GoogleAuthProvider: class {
    setCustomParameters = mocks.providerOptions;
  },
  signInWithEmailAndPassword: mocks.emailSignIn,
  signInWithPopup: mocks.googleSignIn,
  signOut: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    MODE: "development",
    VITE_FIREBASE_API_KEY: "test-key",
    VITE_FIREBASE_AUTH_DOMAIN: "my-garage-dev-6169f.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "my-garage-dev-6169f",
    VITE_FIREBASE_APP_ID: "test-app",
    VITE_DEV_AUTH_EMAIL: "test@example.com",
    VITE_DEV_AUTH_PASSWORD: "fixture-password",
  })) vi.stubEnv(key, value);
});

afterEach(() => vi.unstubAllEnvs());

describe("environment-specific sign-in", () => {
  it("signs into development with the configured email account without a popup", async () => {
    const { login, firebaseMessage } = await import("@/lib/firebase");
    await login();
    expect(mocks.emailSignIn).toHaveBeenCalledWith(
      mocks.auth, "test@example.com", "fixture-password",
    );
    expect(mocks.googleSignIn).not.toHaveBeenCalled();
    expect(firebaseMessage({ code: "auth/operation-not-allowed" })).toBe(
      "errors.email_auth_disabled",
    );
    expect(firebaseMessage({ code: "auth/invalid-credential" })).toBe(
      "errors.auth_credentials",
    );
  });

  it("keeps Google sign-in for production even when test credentials are present", async () => {
    vi.stubEnv("MODE", "production");
    const { login, firebaseMessage } = await import("@/lib/firebase");
    await login();
    expect(mocks.googleSignIn).toHaveBeenCalledWith(mocks.auth, expect.anything());
    expect(mocks.providerOptions).toHaveBeenCalledWith({ prompt: "select_account" });
    expect(mocks.emailSignIn).not.toHaveBeenCalled();
    expect(firebaseMessage({ code: "auth/operation-not-allowed" })).toBe(
      "errors.auth_disabled",
    );
  });

  it("reports missing dev credentials without falling back to Google", async () => {
    vi.stubEnv("VITE_DEV_AUTH_PASSWORD", "");
    const { login } = await import("@/lib/firebase");
    await expect(login()).rejects.toMatchObject({ code: "errors.dev_auth_configuration" });
    expect(mocks.emailSignIn).not.toHaveBeenCalled();
    expect(mocks.googleSignIn).not.toHaveBeenCalled();
  });
});

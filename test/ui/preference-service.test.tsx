import { beforeEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  doc: vi.fn(() => "preference-ref"),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
  setDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  serverTimestamp: vi.fn(() => "server-time"),
}));
vi.mock("firebase/firestore", () => sdk);
vi.mock("@/lib/firebase", () => ({ db: {} }));
import {
  initializeLanguage,
  subscribeLanguage,
  writeLanguage,
} from "@/lib/interface-preference";
const snapshot = (
  language?: string,
  metadata = { hasPendingWrites: false, fromCache: false },
) => ({
  metadata,
  exists: () => language !== undefined,
  data: () => ({ language }),
});
beforeEach(() => vi.clearAllMocks());

it("uses the account preference path and ignores cached or pending snapshots", () => {
  const value = vi.fn(),
    error = vi.fn();
  subscribeLanguage("alice", value, error);
  expect(sdk.doc).toHaveBeenCalledWith(
    {},
    "users",
    "alice",
    "preferences",
    "interface",
  );
  const callback = sdk.onSnapshot.mock.calls[0][2];
  callback(snapshot(undefined, { hasPendingWrites: false, fromCache: true }));
  callback(snapshot("ro", { hasPendingWrites: true, fromCache: false }));
  expect(value).not.toHaveBeenCalled();
  callback(snapshot("ro"));
  expect(value).toHaveBeenCalledWith("ro");
  callback(snapshot());
  expect(value).toHaveBeenLastCalledWith(null);
  callback(snapshot("fr"));
  expect(error).toHaveBeenCalledWith(
    expect.objectContaining({ code: "errors.invalid_preference" }),
  );
});
it("initializes only missing documents using a server timestamp", async () => {
  const transaction = {
    get: vi.fn().mockResolvedValue(snapshot()),
    set: vi.fn(),
  };
  sdk.runTransaction.mockImplementation(async (_, callback) =>
    callback(transaction),
  );
  expect(await initializeLanguage("alice", "ro")).toBe("ro");
  expect(transaction.set).toHaveBeenCalledWith("preference-ref", {
    language: "ro",
    updatedAt: "server-time",
  });
  transaction.get.mockResolvedValue(snapshot("en"));
  transaction.set.mockClear();
  expect(await initializeLanguage("alice", "ro")).toBe("en");
  expect(transaction.set).not.toHaveBeenCalled();
});
it("confirms the latest server value after writing a preference", async () => {
  sdk.setDoc.mockResolvedValue(undefined);
  sdk.getDocFromServer.mockResolvedValue(snapshot("en"));
  expect(await writeLanguage("alice", "ro")).toBe("en");
  expect(sdk.setDoc).toHaveBeenCalledWith("preference-ref", {
    language: "ro",
    updatedAt: "server-time",
  });
  sdk.getDocFromServer.mockResolvedValue(snapshot("fr"));
  await expect(writeLanguage("alice", "ro")).rejects.toMatchObject({
    code: "errors.invalid_preference",
  });
});

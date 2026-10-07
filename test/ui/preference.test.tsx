import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { useLanguagePreference } from "@/hooks/use-language-preference";
import { languageKey } from "@/i18n/language.js";
const api = vi.hoisted(() => ({
  subscribeLanguage: vi.fn(),
  initializeLanguage: vi.fn(),
  writeLanguage: vi.fn(),
}));
vi.mock("@/lib/interface-preference", () => api);
let subscriptions: Array<{
  uid: string;
  value: (language: "en" | "ro" | null) => void;
  error: () => void;
  dispose: ReturnType<typeof vi.fn>;
}>;
beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(languageKey(), "en");
  await i18n.changeLanguage("en");
  subscriptions = [];
  vi.resetAllMocks();
  api.subscribeLanguage.mockImplementation((uid, value, error) => {
    const dispose = vi.fn();
    subscriptions.push({ uid, value, error, dispose });
    return dispose;
  });
  api.initializeLanguage.mockImplementation(async (_, language) => language);
  api.writeLanguage.mockImplementation(async (_, language) => language);
});
const emit = async (
  language: "en" | "ro" | null,
  index = subscriptions.length - 1,
) => act(async () => subscriptions[index].value(language));

it("loads account preference over guest choice and restores guest on sign-out", async () => {
  const hook = renderHook(
    ({ uid }: { uid?: string }) => useLanguagePreference(uid),
    { initialProps: { uid: "alice" } },
  );
  await emit("ro");
  expect(i18n.language).toBe("ro");
  expect(localStorage.getItem(languageKey())).toBe("en");
  hook.rerender({ uid: undefined });
  await waitFor(() => expect(i18n.language).toBe("en"));
  expect(subscriptions[0].dispose).toHaveBeenCalledOnce();
});
it("initializes a missing preference and accepts an existing preference found by the transaction", async () => {
  api.initializeLanguage.mockResolvedValue("ro");
  renderHook(() => useLanguagePreference("alice"));
  await emit(null);
  expect(api.initializeLanguage).toHaveBeenCalledWith("alice", "en");
  expect(i18n.language).toBe("ro");
});
it("does not overwrite a deliberate selection with the initial account read", async () => {
  let resolve!: (language: "ro") => void;
  api.writeLanguage.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const hook = renderHook(() => useLanguagePreference("alice"));
  act(() => hook.result.current.selectLanguage("ro"));
  await emit("en");
  expect(i18n.language).toBe("ro");
  await act(async () => resolve("ro"));
  expect(hook.result.current.syncState).toBe("idle");
});
it("ignores late initialization and stale account callbacks", async () => {
  let resolve!: (language: "ro") => void;
  api.initializeLanguage.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const hook = renderHook(({ uid }) => useLanguagePreference(uid), {
    initialProps: { uid: "alice" },
  });
  await emit(null);
  hook.rerender({ uid: "bob" });
  await emit("en");
  await act(async () => {
    resolve("ro");
    subscriptions[0].value("ro");
  });
  expect(i18n.language).toBe("en");
});
it("does not reset a manual selection when a missing-account initialization finishes late", async () => {
  let resolve!: (language: "en") => void;
  api.initializeLanguage.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const hook = renderHook(() => useLanguagePreference("alice"));
  await emit(null);
  await act(async () => hook.result.current.selectLanguage("ro"));
  await act(async () => resolve("en"));
  expect(i18n.language).toBe("ro");
});
it("keeps optimistic language on failure and retries with a fresh subscription", async () => {
  api.writeLanguage.mockRejectedValueOnce(Error("permission-denied"));
  const hook = renderHook(() => useLanguagePreference("alice"));
  await emit("en");
  await act(async () => hook.result.current.selectLanguage("ro"));
  expect(i18n.language).toBe("ro");
  expect(hook.result.current.syncState).toBe("failed");
  await act(async () => hook.result.current.retry());
  expect(api.subscribeLanguage).toHaveBeenCalledTimes(2);
  expect(api.writeLanguage).toHaveBeenLastCalledWith("alice", "ro");
  expect(hook.result.current.syncState).toBe("idle");
});
it("retrying an account read failure does not replace an existing account preference", async () => {
  const hook = renderHook(() => useLanguagePreference("alice"));
  act(() => subscriptions[0].error());
  act(() => hook.result.current.retry());
  await emit("ro");
  expect(api.writeLanguage).not.toHaveBeenCalled();
  expect(i18n.language).toBe("ro");
});
it("accepts cross-device updates and the latest committed value after saving", async () => {
  const hook = renderHook(() => useLanguagePreference("alice"));
  await emit("ro");
  await emit("en");
  expect(i18n.language).toBe("en");
  api.writeLanguage.mockResolvedValueOnce("en");
  await act(async () => hook.result.current.selectLanguage("ro"));
  expect(i18n.language).toBe("en");
});
it("ignores out-of-order save completions and completions after account switching", async () => {
  const finishes: Array<(language: string) => void> = [];
  api.writeLanguage.mockImplementation(
    () => new Promise((done) => finishes.push(done)),
  );
  const hook = renderHook(({ uid }) => useLanguagePreference(uid), {
    initialProps: { uid: "alice" },
  });
  act(() => hook.result.current.selectLanguage("ro"));
  act(() => hook.result.current.selectLanguage("en"));
  await act(async () => finishes[0]("ro"));
  expect(i18n.language).toBe("en");
  hook.rerender({ uid: "bob" });
  await emit("ro");
  await act(async () => finishes[1]("en"));
  expect(i18n.language).toBe("ro");
});
it("uses account-specific cache without leaking another account language", async () => {
  localStorage.setItem(languageKey("alice"), "ro");
  const hook = renderHook(({ uid }) => useLanguagePreference(uid), {
    initialProps: { uid: "alice" },
  });
  expect(i18n.language).toBe("ro");
  hook.rerender({ uid: "bob" });
  expect(i18n.language).toBe("en");
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useNotebook } from "@/hooks/use-notebook";
import { emptyNotebook, previewNotebook } from "@/lib/garage.js";
import type { Notebook } from "@/types";

const connection = vi.hoisted(() => ({
  authListener: null as ((user: unknown) => void) | null,
  snapshots: new Map<string, (entries: unknown[]) => void>(),
  subscribe: vi.fn(),
  write: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({
  auth: {},
  appEnvironment: "development",
  firebaseProjectId: "my-garage-dev-72659",
  firebaseMessage: (error: { code?: string }) =>
    error.code || "errors.unexpected",
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: unknown) => void) => {
    connection.authListener = listener;
    listener(null);
    return () => {};
  },
}));
vi.mock("@/lib/cloud-notebook", () => ({
  subscribeGarage: (uid: string, listener: (entries: unknown[]) => void) => {
    connection.subscribe(uid);
    connection.snapshots.set(uid, listener);
    return () => {};
  },
  writeNotebook: (...args: unknown[]) => connection.write(...args),
  deleteNotebook: (...args: unknown[]) => connection.delete(...args),
}));
const notebook = (model = "CB500") =>
  emptyNotebook({ make: "Honda", model, year: 2020, km: 12000 });
const entry = (state = notebook(), revision = 1) => ({
  id: "vehicle",
  state,
  revision,
});
beforeEach(() => {
  localStorage.clear();
  connection.snapshots.clear();
  connection.subscribe.mockClear();
  connection.write.mockReset();
  connection.delete.mockReset();
});
async function login(uid = "alice", state = notebook()) {
  await act(async () => {
    connection.authListener?.({ uid });
  });
  await act(async () => {
    connection.snapshots.get(uid)?.([entry(state)]);
  });
}

it("rejects guest commits, vehicle creation and vehicle deletion without calling the database", async () => {
  const { result } = renderHook(useNotebook);
  expect(result.current.isPreview).toBe(true);
  expect(result.current.hasVehicle).toBe(true);
  expect(result.current.state).toEqual(previewNotebook());
  expect(connection.subscribe).not.toHaveBeenCalled();
  await expect(
    result.current.commit(notebook(), result.current.version),
  ).rejects.toMatchObject({ code: "errors.sign_in_required" });
  await expect(result.current.createVehicle(notebook())).rejects.toMatchObject({
    code: "errors.sign_in_required",
  });
  await expect(
    result.current.removeVehicle(result.current.version),
  ).rejects.toMatchObject({ code: "errors.sign_in_required" });
  expect(connection.write).not.toHaveBeenCalled();
  expect(connection.delete).not.toHaveBeenCalled();
});
it("does not copy the guest preview into new accounts or treat it as a transferable local log", async () => {
  const { result } = renderHook(useNotebook);
  expect(result.current.hasLocal).toBe(false);
  expect(result.current.localState()).toBeNull();
  await act(async () => {
    connection.authListener?.({ uid: "new-user" });
  });
  await act(async () => {
    connection.snapshots.get("new-user")?.([]);
  });
  expect(result.current.hasVehicle).toBe(false);
  expect(result.current.isPreview).toBe(false);
  expect(result.current.state.tasks).toEqual([]);
  expect(result.current.state.events).toEqual([]);
  expect(connection.write).not.toHaveBeenCalled();
  await act(async () => {
    connection.authListener?.(null);
  });
  expect(result.current.state).toEqual(previewNotebook());
  expect(localStorage.length).toBe(0);
});
it("ignores old account snapshots and pending saves after an account switch", async () => {
  const { result } = renderHook(useNotebook);
  await login();
  let complete!: (revision: number) => void;
  connection.write.mockReturnValue(
    new Promise<number>((resolve) => {
      complete = resolve;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = result.current.commit(
      notebook("Old pending save"),
      result.current.version,
    );
  });
  await login("bob", notebook("Bob vehicle"));
  await act(async () => {
    connection.snapshots.get("alice")?.([
      entry(notebook("Alice late snapshot"), 2),
    ]);
    complete(2);
    await pending;
  });
  expect(result.current.state.vehicle.model).toBe("Bob vehicle");
  expect(result.current.canUndo).toBe(false);
});
it("ignores a pending save from a previous session even when signing back into the same account", async () => {
  const { result } = renderHook(useNotebook);
  await login();
  let complete!: (revision: number) => void;
  connection.write.mockReturnValue(
    new Promise<number>((resolve) => {
      complete = resolve;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = result.current.commit(
      notebook("Old session"),
      result.current.version,
    );
  });
  await act(async () => {
    connection.authListener?.(null);
  });
  await login("alice", notebook("Current session"));
  await act(async () => {
    complete(2);
    await pending;
  });
  expect(result.current.state.vehicle.model).toBe("Current session");
  expect(result.current.canUndo).toBe(false);
});
it("keeps a newer server revision and rejects forms opened before a remote update", async () => {
  const { result } = renderHook(useNotebook);
  await login();
  const originalVersion = result.current.version;
  let complete!: (revision: number) => void;
  connection.write.mockReturnValue(
    new Promise<number>((resolve) => {
      complete = resolve;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = result.current.commit(notebook("My revision 2"), originalVersion);
  });
  await act(async () => {
    connection.snapshots.get("alice")?.([
      entry(notebook("Remote revision 3"), 3),
    ]);
  });
  await act(async () => {
    complete(2);
    await pending;
  });
  expect(result.current.state.vehicle.model).toBe("Remote revision 3");
  await expect(
    result.current.commit(notebook(), originalVersion),
  ).rejects.toMatchObject({ code: "errors.conflict" });
  await expect(
    result.current.removeVehicle(originalVersion),
  ).rejects.toMatchObject({ code: "errors.conflict" });
  expect(connection.delete).not.toHaveBeenCalled();
});
it("undo restores only the immediately preceding revision of the selected vehicle", async () => {
  const { result } = renderHook(useNotebook);
  await login();
  connection.write.mockImplementation(
    async (_uid: string, _id: string, _state: Notebook, revision: number) =>
      revision + 1,
  );
  await act(async () => {
    await result.current.commit(notebook("Edited"), result.current.version);
  });
  await waitFor(() => expect(result.current.canUndo).toBe(true));
  await act(async () => {
    await result.current.undoLast();
  });
  expect(result.current.state.vehicle.model).toBe("CB500");
  expect(result.current.canUndo).toBe(false);
  await act(async () => {
    await result.current.commit(
      notebook("Edited again"),
      result.current.version,
    );
  });
  expect(result.current.canUndo).toBe(true);
  await act(async () => {
    connection.snapshots.get("alice")?.([entry(notebook("Remote"), 5)]);
  });
  expect(result.current.canUndo).toBe(false);
});

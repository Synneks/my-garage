import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import App from "@/App";
import { i18n } from "@/i18n";
import { emptyNotebook } from "@/lib/garage.js";
import type { Notebook } from "@/types";

const cloud = vi.hoisted(() => ({
  user: null as { uid: string; email: string; displayName: string } | null,
  authListener: null as null | ((user: unknown) => void),
  listeners: [] as ((entries: unknown[]) => void)[],
  entries: [] as { id: string; state: Notebook; revision: number }[],
  failure: "",
  writes: 0,
}));
vi.mock("@/lib/firebase", () => ({
  auth: {},
  db: null,
  appEnvironment: "development",
  firebaseProjectId: "my-garage-dev-72659",
  firebaseMessage: (error: { code?: string }) =>
    error.code || "errors.unexpected",
  login: async () => {
    cloud.user = {
      uid: "alice",
      email: "alice@example.com",
      displayName: "Alice",
    };
    cloud.authListener?.(cloud.user);
  },
  logout: async () => {
    cloud.user = null;
    cloud.authListener?.(null);
  },
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: unknown) => void) => {
    cloud.authListener = listener;
    listener(cloud.user);
    return () => {
      cloud.authListener = null;
    };
  },
}));
vi.mock("@/lib/interface-preference", () => ({
  subscribeLanguage: (_uid: string, listener: (language: string) => void) => {
    listener("en");
    return () => {};
  },
  initializeLanguage: async (_uid: string, language: string) => language,
  writeLanguage: async (_uid: string, language: string) => language,
}));
vi.mock("@/lib/cloud-notebook", () => ({
  subscribeGarage: (_uid: string, listener: (entries: unknown[]) => void) => {
    cloud.listeners.push(listener);
    listener(structuredClone(cloud.entries));
    return () => {
      cloud.listeners = cloud.listeners.filter((item) => item !== listener);
    };
  },
  writeNotebook: async (
    _uid: string,
    id: string,
    state: Notebook,
    expected: number,
  ) => {
    if (cloud.failure)
      throw Object.assign(new Error(), { code: cloud.failure });
    const existing = cloud.entries.find((item) => item.id === id);
    if ((existing?.revision || 0) !== expected)
      throw Object.assign(new Error(), { code: "errors.conflict" });
    cloud.writes++;
    const revision = expected + 1;
    cloud.entries = [
      ...cloud.entries.filter((item) => item.id !== id),
      { id, state: structuredClone(state), revision },
    ];
    cloud.listeners.forEach((listener) =>
      listener(structuredClone(cloud.entries)),
    );
    return revision;
  },
  deleteNotebook: async (_uid: string, id: string, expected: number) => {
    if (cloud.entries.find((item) => item.id === id)?.revision !== expected)
      throw Object.assign(new Error(), { code: "errors.conflict" });
    cloud.entries = cloud.entries.filter((item) => item.id !== id);
    cloud.listeners.forEach((listener) =>
      listener(structuredClone(cloud.entries)),
    );
  },
}));
const vehicle = (make = "Honda", model = "CB500") =>
  emptyNotebook({ make, model, year: 2020, km: 12000 });
const show = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>,
  );
const change = async (language: string) =>
  act(async () => {
    await i18n.changeLanguage(language);
  });
const signIn = () => {
  cloud.user = {
    uid: "alice",
    email: "alice@example.com",
    displayName: "Alice",
  };
};
beforeEach(async () => {
  cloud.user = null;
  cloud.listeners = [];
  cloud.authListener = null;
  cloud.entries = [];
  cloud.failure = "";
  cloud.writes = 0;
  localStorage.clear();
  await change("en");
});

describe("database-backed garage workflows", () => {
  it("shows anonymous feature examples without subscribing to or writing account data", async () => {
    show();
    expect(
      await screen.findByRole("heading", {
        name: "Your vehicle. Its whole story.",
      }),
    ).toBeTruthy();
    const demo = screen.getByRole("region", {
      name: "Interactive garage example",
    });
    expect(within(demo).getByText("Fictional demo")).toBeTruthy();
    expect(within(demo).getByText("Front brake pads")).toBeTruthy();
    await userEvent.click(
      within(demo).getByRole("button", { name: "Milestones" }),
    );
    expect(within(demo).getByText("500 km remaining")).toBeTruthy();
    expect(within(demo).getByText("1,500 km remaining")).toBeTruthy();
    await userEvent.click(
      within(demo).getByRole("button", { name: "Service history" }),
    );
    expect(within(demo).getByText("Battery")).toBeTruthy();
    expect(within(demo).getByText("Replacement · 10/02/2026")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("link", { name: "Explore the watch list" }),
    );
    expect(
      within(demo)
        .getByRole("button", { name: /Watch list/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(within(demo).getByText("Front brake pads")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /Suzuki|GSF650S|30,920|Michelin|Motul/,
    );
    expect(
      screen.queryByRole("button", { name: "Add service record" }),
    ).toBeNull();
    expect(cloud.listeners).toHaveLength(0);
    expect(cloud.entries).toEqual([]);
    expect(cloud.writes).toBe(0);
  });
  it("translates the demo when signed out, including service history", async () => {
    show();
    const demo = await screen.findByRole("region", {
      name: "Interactive garage example",
    });
    await userEvent.click(
      within(demo).getByRole("button", { name: "Service history" }),
    );
    expect(within(demo).getByText("Engine oil")).toBeTruthy();
    await change("ro");
    expect(within(demo).getByText("Ulei motor")).toBeTruthy();
    expect(within(demo).getByText("Schimb · 10.02.2026")).toBeTruthy();
    await change("en");
    expect(within(demo).getByText("Engine oil")).toBeTruthy();
    expect(cloud.writes).toBe(0);
  });
  it("shows saved Romanian account data verbatim even when its IDs match the demo", async () => {
    signIn();
    const state = vehicle();
    state.tasks = [
      {
        id: "oil",
        name: "Ulei motor",
        action: "Schimb",
        category: "Motor",
        source: "Sursa mea",
        notes: "Notițele mele",
        intervalKm: null,
        intervalMonths: null,
      },
    ];
    state.events = [
      {
        id: "seed-oil",
        taskId: "oil",
        taskName: "Numele meu istoric",
        action: "Operațiunea mea",
        date: "2026-10-01",
        km: 10000,
        notes: "Istoricul meu",
        confirmed: true,
      },
    ];
    cloud.entries = [{ id: "bandit", state, revision: 1 }];
    const before = JSON.stringify(cloud.entries);
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "Maintenance" }),
    );
    expect(screen.getByRole("button", { name: "Ulei motor" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Engine oil" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Chain and sprocket kit" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Ulei motor" }).closest("td")
        ?.textContent,
    ).toContain("Schimb");
    expect(
      screen.getByRole("button", { name: "Ulei motor" }).closest("td")
        ?.textContent,
    ).toContain("Motor");
    await change("ro");
    expect(screen.getByRole("button", { name: "Ulei motor" })).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Istoric intervenții" }),
    );
    await change("en");
    expect(screen.getByText("Numele meu istoric")).toBeTruthy();
    expect(screen.getByText("Istoricul meu")).toBeTruthy();
    expect(JSON.stringify(cloud.entries)).toBe(before);
    expect(cloud.writes).toBe(0);
  });
  it("returns to anonymous landing examples when the account signs out", async () => {
    signIn();
    cloud.entries = [
      {
        id: "private",
        state: vehicle("Personal make", "Private vehicle"),
        revision: 1,
      },
    ];
    show();
    await screen.findByRole("button", { name: "Add service record" });
    expect(document.body.textContent).toContain("Private vehicle");
    expect(screen.queryByText("Fictional demo")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByText("Fictional demo")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Private vehicle");
    expect(document.body.textContent).not.toContain("alice@example.com");
    expect(cloud.writes).toBe(0);
    expect(cloud.entries[0].state.vehicle.model).toBe("Private vehicle");
  });
  it("requires sign-in, creates an empty vehicle, and edits its database details", async () => {
    show();
    expect(await screen.findByText("Fictional demo")).toBeTruthy();
    expect(cloud.entries).toHaveLength(0);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Start your garage" })[0],
    );
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Add vehicle" }))[0],
    );
    await userEvent.type(screen.getByLabelText("Make"), "Honda");
    await userEvent.type(screen.getByLabelText("Model"), "CB500");
    fireEvent.change(screen.getByLabelText("Year"), {
      target: { value: "2020" },
    });
    fireEvent.change(screen.getByLabelText("Mileage"), {
      target: { value: "12000" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save vehicle" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(cloud.entries[0].state).toMatchObject({
      version: 2,
      vehicle: { make: "Honda", model: "CB500", year: 2020, km: 12000 },
      tasks: [],
      events: [],
    });
    await userEvent.click(screen.getByRole("button", { name: "Edit vehicle" }));
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "CB500X" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save vehicle" }));
    await waitFor(() =>
      expect(cloud.entries[0].state.vehicle.model).toBe("CB500X"),
    );
  });

  it("creates and edits Polish tasks, preserves open fields on language changes, and retains deletable history", async () => {
    signIn();
    cloud.entries = [{ id: "honda", state: vehicle(), revision: 1 }];
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "Maintenance" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add maintenance task" }),
    );
    await userEvent.type(
      screen.getByLabelText("Task name"),
      "Łańcuch i zębatki",
    );
    await userEvent.type(screen.getByLabelText("Category"), "Napęd");
    await userEvent.type(screen.getByLabelText("Action"), "Wymiana");
    await userEvent.type(screen.getByLabelText("Notes"), "Moja notatka");
    fireEvent.change(screen.getByLabelText("Mileage interval"), {
      target: { value: "5000" },
    });
    await change("ro");
    expect(
      (screen.getByLabelText("Numele sarcinii") as HTMLInputElement).value,
    ).toBe("Łańcuch i zębatki");
    expect((screen.getByLabelText("Notițe") as HTMLTextAreaElement).value).toBe(
      "Moja notatka",
    );
    await change("en");
    await userEvent.click(screen.getByRole("button", { name: "Save task" }));
    await screen.findByRole("button", { name: "Łańcuch i zębatki" });
    const id = cloud.entries[0].state.tasks![0].id;
    expect(cloud.entries[0].state.tasks![0]).toMatchObject({
      name: "Łańcuch i zębatki",
      category: "Napęd",
      action: "Wymiana",
      notes: "Moja notatka",
      intervalKm: 5000,
    });
    await userEvent.click(
      screen.getByRole("button", {
        name: "Record: Łańcuch i zębatki — Wymiana",
      }),
    );
    await userEvent.type(screen.getByLabelText("Notes"), "Serwis");
    await userEvent.click(
      screen.getByRole("button", { name: "Save service record" }),
    );
    await waitFor(() => expect(cloud.entries[0].state.events).toHaveLength(1));
    expect(cloud.entries[0].state.events[0].taskName).toBe("Łańcuch i zębatki");
    await userEvent.click(
      screen.getByRole("button", { name: "Łańcuch i zębatki" }),
    );
    fireEvent.change(screen.getByLabelText("Task name"), {
      target: { value: "Nowa nazwa" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save task" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Nowa nazwa" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    expect(
      screen.getByText(/Its service history and recorded names stay available/),
    ).toBeTruthy();
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    await waitFor(() => expect(cloud.entries[0].state.tasks).toHaveLength(0));
    expect(cloud.entries[0].state.overrides[id]).toBeUndefined();
    await userEvent.click(
      screen.getByRole("button", { name: "Service history" }),
    );
    expect(await screen.findByText("Łańcuch i zębatki")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Updated retained record" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Save service record" }),
    );
    await screen.findByText("Updated retained record");
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete service record" }),
    );
    await waitFor(() => expect(cloud.entries[0].state.events).toHaveLength(0));
    expect(
      await screen.findByText(
        "No service records yet. Add your first service.",
      ),
    ).toBeTruthy();
  }, 10000);

  it("separates vehicles, supports independent service records, and confirms vehicle deletion", async () => {
    signIn();
    cloud.entries = [
      { id: "honda", state: vehicle(), revision: 1 },
      { id: "yamaha", state: vehicle("Yamaha", "MT-07"), revision: 1 },
    ];
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "Add service record" }),
    );
    await userEvent.type(screen.getByLabelText("Task name"), "Przegląd");
    await userEvent.type(screen.getByLabelText("Action"), "Kontrola");
    await userEvent.click(
      screen.getByRole("button", { name: "Save service record" }),
    );
    await waitFor(() =>
      expect(
        cloud.entries.find((item) => item.id === "honda")!.state.events,
      ).toHaveLength(1),
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Select vehicle" }),
    );
    await userEvent.click(
      screen.getByRole("option", { name: "Yamaha MT-07 · 2020" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Service history" }),
    );
    expect(screen.queryByText("Przegląd")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Edit vehicle" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Delete vehicle" }),
    );
    expect(screen.getByText(/permanently deletes the vehicle/)).toBeTruthy();
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    await waitFor(() => expect(cloud.entries).toHaveLength(1));
    expect(await screen.findByText("Przegląd")).toBeTruthy();
  });

  it("keeps unsaved fields visible when the database rejects a write", async () => {
    signIn();
    cloud.entries = [{ id: "honda", state: vehicle(), revision: 1 }];
    cloud.failure = "errors.conflict";
    show();
    await userEvent.click(
      await screen.findByRole("button", { name: "Maintenance" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add maintenance task" }),
    );
    await userEvent.type(
      screen.getByLabelText("Task name"),
      "Saved locally in this form",
    );
    await userEvent.type(screen.getByLabelText("Action"), "Check");
    await userEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByText(/changed in another tab/)).toBeTruthy();
    expect((screen.getByLabelText("Task name") as HTMLInputElement).value).toBe(
      "Saved locally in this form",
    );
    expect(cloud.writes).toBe(0);
    expect(cloud.entries[0].state.tasks).toHaveLength(0);
  });
});

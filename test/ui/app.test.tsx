import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import App from "@/App";
import { i18n } from "@/i18n";
import { EventForm, PlanForm } from "@/components/notebook-forms";
import { TranslatedMessage } from "@/components/translated-message";
import { createInitialState, TASKS } from "@/data.js";
import { exportCsv } from "@/csv.js";
import { km, dateLabel, remainingText } from "@/lib/format";
import { firebaseMessage } from "@/lib/firebase";
import { LOCAL_KEY } from "@/hooks/use-notebook";

// Exercise the real UI and error mapping without initializing a cloud session.
vi.hoisted(() => {
  for (const [key, value] of Object.entries({
    MODE: "staging",
    VITE_APP_ENV: "staging",
    VITE_FIREBASE_API_KEY: "ui-test-public-key",
    VITE_FIREBASE_AUTH_DOMAIN: "my-garage-staging.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "my-garage-staging",
    VITE_FIREBASE_APP_ID: "1:123456789:web:ui-test",
    VITE_USE_FIREBASE_EMULATORS: "false",
  }))
    vi.stubEnv(key, value);
});
vi.mock("firebase/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/auth")>()),
  getAuth: () => null,
}));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("firebase/firestore")>()),
  getFirestore: () => null,
}));
import { AppError } from "@/lib/app-error.js";
import { evaluate } from "@/engine.js";
import { localizedTask } from "@/lib/task-labels";
import { Schedule } from "@/components/notebook-views";
const show = (node: React.ReactNode) =>
  render(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>);
const change = async (language: string) =>
  act(async () => {
    await i18n.changeLanguage(language);
  });
beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem("bandit-language-v1", "en");
  await change("en");
});

describe("language switching", () => {
  it("switches the application, document metadata and remembered choice immediately", async () => {
    show(<App />);
    await screen.findByRole("heading", { name: "My garage" });
    expect(screen.getByText("Staging · test data")).toBeTruthy();
    const selector = screen.getByRole("combobox", { name: "Language" });
    expect(selector.closest("aside")).toBeTruthy();
    await userEvent.click(selector);
    await userEvent.click(screen.getByRole("option", { name: "Română" }));
    expect(screen.getByRole("heading", { name: "Garajul meu" })).toBeTruthy();
    expect(screen.getByText("Staging · date de test")).toBeTruthy();
    expect(document.documentElement.lang).toBe("ro");
    expect(document.title).toBe("Bandit · Carnet de mentenanță");
    expect(localStorage.getItem("bandit-language-v1")).toBe("ro");
    await userEvent.click(screen.getByRole("combobox", { name: "Limbă" }));
    await userEvent.click(screen.getByRole("option", { name: "English" }));
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("heading", { name: "My garage" })).toBeTruthy();
  });
  it("preserves unsaved form fields, selected task and confirmation while translating", async () => {
    const state = createInitialState(),
      onSave = vi.fn();
    show(
      <EventForm
        state={state}
        taskId="oil"
        busy={false}
        onSave={onSave}
        onClose={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText("Notes"), "My unsaved note");
    fireEvent.change(screen.getByLabelText("Mileage"), {
      target: { value: "32123" },
    });
    await change("ro");
    expect((screen.getByLabelText("Notițe") as HTMLTextAreaElement).value).toBe(
      "My unsaved note",
    );
    expect(
      (screen.getByLabelText("Kilometraj") as HTMLInputElement).value,
    ).toBe("32123");
    expect(screen.getByRole("combobox").textContent).toContain("Ulei motor");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvează intervenția" }),
    );
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].events.at(-1)).toMatchObject({
      taskId: "oil",
      km: 32123,
      notes: "My unsaved note",
      confirmed: true,
    });
  });
  it("preserves an open dialog, unsaved work and notebook bytes during a language change", async () => {
    const state = createInitialState();
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    show(<App />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Add service record" }),
    );
    await userEvent.type(screen.getByLabelText("Notes"), "Untouched text");
    await change("ro");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByLabelText("Notițe") as HTMLTextAreaElement).value).toBe(
      "Untouched text",
    );
    expect(localStorage.getItem(LOCAL_KEY)).toBe(JSON.stringify(state));
    expect(exportCsv(state)).toBe(
      exportCsv(JSON.parse(localStorage.getItem(LOCAL_KEY)!)),
    );
  });
  it("formats dates, distances, zero, singular and Romanian plurals", async () => {
    expect(km(30137)).toBe("30,137 km");
    expect(dateLabel("2026-09-10")).toBe("10/09/2026");
    expect(remainingText({ remainingKm: -200, days: -1 })).toBe(
      "200 km overdue · 1 day overdue",
    );
    expect(remainingText({ remainingKm: null, days: 1069 })).toBe("1,069 days");
    await change("ro");
    expect(km(30137)).toBe("30.137 km");
    expect(dateLabel("2026-09-10")).toBe("10.09.2026");
    expect(i18n.t("format.days", { count: 0 })).toBe("0 zile");
    expect(i18n.t("format.days", { count: 1 })).toBe("1 zi");
    expect(i18n.t("format.days", { count: 20 })).toBe("20 de zile");
    expect(remainingText({ remainingKm: null, days: 1069 })).toBe(
      "1.069 de zile",
    );
    expect(dateLabel(null)).toBe("—");
  });
  it("updates an already visible error or notification and maps unexpected errors safely", async () => {
    show(
      <TranslatedMessage
        message={firebaseMessage(new AppError("errors.conflict"))}
      />,
    );
    expect(screen.getByText(/changed in another tab/)).toBeTruthy();
    await change("ro");
    expect(screen.getByText(/modificat în altă filă/)).toBeTruthy();
    expect(firebaseMessage(new Error("Untranslated vendor details"))).toBe(
      "errors.unexpected",
    );
    expect(firebaseMessage({ code: "auth/popup-blocked" })).toBe(
      "errors.popup_blocked",
    );
    expect(firebaseMessage({ code: 42 })).toBe("errors.unexpected");
  });
  it("keeps bilingual search text and matches translated task names after switching", async () => {
    const state = createInitialState();
    function Table() {
      // App's language subscription supplies the localized presentation data.
      const tasks = TASKS.map((task) =>
        localizedTask(i18n.t.bind(i18n), evaluate(task, state), false),
      );
      return (
        <Schedule
          tasks={tasks}
          initialFilter="all"
          onDetail={vi.fn()}
          onLog={vi.fn()}
        />
      );
    }
    const view = show(<Table />);
    await userEvent.type(screen.getByRole("searchbox"), "Ulei");
    expect(screen.getByRole("button", { name: "Engine oil" })).toBeTruthy();
    await change("ro");
    view.rerender(
      <I18nextProvider i18n={i18n}>
        <Table />
      </I18nextProvider>,
    );
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
      "Ulei",
    );
    expect(screen.getByRole("button", { name: "Ulei motor" })).toBeTruthy();
  });
  it("translates built-in guidance without persisting it as personal notes", async () => {
    const state = createInitialState(),
      onSave = vi.fn();
    show(
      <PlanForm
        state={state}
        taskId="oil-filter"
        busy={false}
        onSave={onSave}
        onClose={vi.fn()}
        onLog={vi.fn()}
      />,
    );
    expect(screen.getByText(/shorter personal interval/)).toBeTruthy();
    expect(
      (screen.getByLabelText("Personal notes") as HTMLTextAreaElement).value,
    ).toBe("");
    await change("ro");
    expect(screen.getByText(/interval personal mai scurt/)).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Salvează planul" }),
    );
    expect(
      Object.hasOwn(onSave.mock.calls[0][0].overrides["oil-filter"], "notes"),
    ).toBe(false);
  });
  it("keeps saved Romanian notes, deliberate empty notes and user changes intact", async () => {
    const state = createInitialState(),
      onSave = vi.fn();
    state.overrides.oil = { notes: "Notiță personală" };
    show(
      <PlanForm
        state={state}
        taskId="oil"
        busy={false}
        onSave={onSave}
        onClose={vi.fn()}
        onLog={vi.fn()}
      />,
    );
    expect(
      (screen.getByLabelText("Personal notes") as HTMLTextAreaElement).value,
    ).toBe("Notiță personală");
    await userEvent.clear(screen.getByLabelText("Personal notes"));
    await change("ro");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvează planul" }),
    );
    expect(onSave.mock.calls[0][0].overrides.oil.notes).toBe("");
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { EventForm } from "@/components/notebook-forms";
import { i18n } from "@/i18n";
import { emptyNotebook } from "@/lib/garage.js";
import { validateState } from "@/engine.js";
import type { Notebook, ServiceEvent } from "@/types";

const notebook = () =>
  emptyNotebook({ make: "Suzuki", model: "GSF650S", year: 2005, km: 30920 });
const futureLabel = "Save task with action for future";
const form = (
  state: Notebook,
  onSave: (state: Notebook) => Promise<void>,
  event?: ServiceEvent,
  key = "first",
) => (
  <I18nextProvider i18n={i18n}>
    <EventForm
      key={key}
      state={state}
      event={event}
      busy={false}
      onSave={onSave}
      onClose={vi.fn()}
      onDelete={vi.fn()}
    />
  </I18nextProvider>
);
function fillService() {
  fireEvent.change(screen.getByLabelText("Task name"), {
    target: { value: "Schimbat sa" },
  });
  fireEvent.change(screen.getByLabelText("Action"), {
    target: { value: "Tapiter" },
  });
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Am dus la tapiter saua" },
  });
}
beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

it("saves a one-off service only in history unless future reuse is checked", async () => {
  const state = notebook(),
    onSave = vi.fn();
  render(form(state, onSave));
  fillService();
  expect(
    screen
      .getByRole("checkbox", { name: futureLabel })
      .getAttribute("aria-checked"),
  ).toBe("false");
  await userEvent.click(
    screen.getByRole("button", { name: "Save service record" }),
  );
  const saved = onSave.mock.calls[0][0] as Notebook;
  expect(saved.tasks).toEqual([]);
  expect(saved.events).toHaveLength(1);
  expect(saved.events[0]).toMatchObject({
    taskName: "Schimbat sa",
    action: "Tapiter",
    notes: "Am dus la tapiter saua",
  });
  expect(validateState(saved)).toBe(saved);
  expect(state.events).toEqual([]);
});

it("saves the service and reusable name/action together and offers it in the next task dropdown", async () => {
  const state = notebook(),
    onSave = vi.fn();
  const view = render(form(state, onSave));
  fillService();
  await userEvent.click(screen.getByRole("checkbox", { name: futureLabel }));
  await userEvent.click(
    screen.getByRole("button", { name: "Save service record" }),
  );
  expect(onSave).toHaveBeenCalledOnce();
  const saved = onSave.mock.calls[0][0] as Notebook;
  expect(saved.tasks).toHaveLength(1);
  expect(saved.tasks![0]).toMatchObject({
    name: "Schimbat sa",
    action: "Tapiter",
    intervalKm: null,
    intervalMonths: null,
  });
  expect(saved.tasks![0].notes).toBeUndefined();
  expect(saved.events[0]).toMatchObject({
    taskId: saved.tasks![0].id,
    taskName: "Schimbat sa",
    action: "Tapiter",
    notes: "Am dus la tapiter saua",
  });
  expect(validateState(saved)).toBe(saved);
  expect(state.tasks).toEqual([]);
  view.rerender(form(saved, onSave, undefined, "next"));
  expect(screen.getByRole("combobox", { name: "Task" }).textContent).toBe(
    "New task",
  );
  expect(
    screen
      .getByRole("checkbox", { name: futureLabel })
      .getAttribute("aria-checked"),
  ).toBe("false");
  await userEvent.click(screen.getByRole("combobox", { name: "Task" }));
  await userEvent.click(
    screen.getByRole("option", { name: "Schimbat sa — Tapiter" }),
  );
  expect((screen.getByLabelText("Action") as HTMLInputElement).value).toBe(
    "Tapiter",
  );
  expect(screen.queryByRole("checkbox", { name: futureLabel })).toBeNull();
  await userEvent.click(
    screen.getByRole("button", { name: "Save service record" }),
  );
  expect(onSave.mock.calls[1][0].tasks).toHaveLength(1);
  expect(onSave.mock.calls[1][0].events).toHaveLength(2);
  expect(onSave.mock.calls[1][0].events[1].taskId).toBe(saved.tasks![0].id);
});

it("offers Other service as a saved task and keeps New task as the default", async () => {
  const state = notebook();
  state.tasks = [
    {
      id: "other-service",
      name: "Other service",
      action: "Service",
      category: "",
      source: "",
      intervalKm: null,
      intervalMonths: null,
    },
  ];
  const onSave = vi.fn();
  render(form(state, onSave));
  expect(screen.getByRole("combobox", { name: "Task" }).textContent).toBe(
    "New task",
  );
  expect(screen.getByLabelText("Task name")).toBeTruthy();
  await userEvent.click(screen.getByRole("combobox", { name: "Task" }));
  expect(screen.getByRole("option", { name: "New task" })).toBeTruthy();
  await userEvent.click(
    screen.getByRole("option", { name: "Other service — Service" }),
  );
  expect(screen.queryByLabelText("Task name")).toBeNull();
  expect(screen.queryByRole("checkbox", { name: futureLabel })).toBeNull();
  fireEvent.change(screen.getByLabelText("Action"), {
    target: { value: "Tapiter" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Save service record" }),
  );
  const saved = onSave.mock.calls[0][0] as Notebook;
  expect(saved.tasks).toEqual(state.tasks);
  expect(saved.events[0]).toMatchObject({
    taskId: "other-service",
    taskName: "Other service",
    action: "Tapiter",
  });
  expect(validateState(saved)).toBe(saved);
});

it("preserves the reuse choice and entered text when switching the interface language", async () => {
  const onSave = vi.fn();
  render(form(notebook(), onSave));
  fillService();
  await userEvent.click(screen.getByRole("checkbox", { name: futureLabel }));
  await act(async () => {
    await i18n.changeLanguage("ro");
  });
  expect(
    screen
      .getByRole("checkbox", {
        name: "Salvează sarcina și operațiunea pentru viitor",
      })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(
    (screen.getByLabelText("Numele sarcinii") as HTMLInputElement).value,
  ).toBe("Schimbat sa");
  await userEvent.click(
    screen.getByRole("button", { name: "Salvează intervenția" }),
  );
  expect(onSave.mock.calls[0][0].tasks[0]).toMatchObject({
    name: "Schimbat sa",
    action: "Tapiter",
  });
});

it("can promote an existing one-off record without changing other history or duplicating that record", async () => {
  const state = notebook();
  const event: ServiceEvent = {
    id: "original",
    taskId: "history-original",
    taskName: "Schimbat sa",
    action: "Tapiter",
    notes: "Original notes",
    date: "2026-10-01",
    km: 30000,
    confirmed: true,
  };
  const other: ServiceEvent = {
    ...event,
    id: "other",
    notes: "Other history stays intact",
  };
  state.events = [event, other];
  const onSave = vi.fn();
  render(form(state, onSave, event));
  await userEvent.click(screen.getByRole("checkbox", { name: futureLabel }));
  await userEvent.click(
    screen.getByRole("button", { name: "Save service record" }),
  );
  const saved = onSave.mock.calls[0][0] as Notebook;
  expect(saved.events).toHaveLength(2);
  expect(saved.events.find((item) => item.id === "other")).toEqual(other);
  expect(saved.events.find((item) => item.id === "original")).toMatchObject({
    ...event,
    taskId: saved.tasks![0].id,
  });
  expect(validateState(saved)).toBe(saved);
});

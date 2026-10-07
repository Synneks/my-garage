import { taskLabel, taskNotes } from "@/lib/task-labels";
import { useTranslation } from "react-i18next";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASKS } from "@/data.js";
import { evaluate, latestEvent, today } from "@/engine.js";
import { dateLabel, km, monthsLabel } from "@/lib/format";
import { Deadline, StatusBadge } from "./maintenance-table";
import type { Notebook, ServiceEvent, Plan } from "@/types";

interface CommonProps {
  state: Notebook;
  onSave: (state: Notebook) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}
export function EventForm({
  state,
  event,
  taskId,
  onSave,
  onClose,
  busy,
  onDelete,
}: CommonProps & {
  event?: ServiceEvent;
  taskId?: string;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(
    event?.taskId || taskId || TASKS[0].id,
  );
  const [confirmed, setConfirmed] = useState(event?.confirmed ?? true);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const task = TASKS.find((task) => task.id === selected)!;
    const next = structuredClone(state);
    const value: ServiceEvent = {
      id: event?.id || crypto.randomUUID(),
      taskId: selected,
      action: task.action,
      date: String(data.get("date")),
      km: Number(data.get("km")),
      notes: String(data.get("notes")).trim(),
      confirmed,
    };
    next.events = next.events.filter((item) => item.id !== value.id);
    next.events.push(value);
    next.vehicle.km = Math.max(next.vehicle.km, value.km);
    if (
      confirmed &&
      latestEvent(next, selected)?.id === value.id &&
      !value.id.startsWith("seed-")
    )
      next.overrides[selected] = {
        ...next.overrides[selected],
        dueKm: null,
        dueDate: "",
        priority: "normal",
      };
    await onSave(next);
  }
  return (
    <form onSubmit={submit} className="notebook-form">
      <fieldset disabled={busy}>
        <div className="field">
          <Label htmlFor="operation">{t("form.operation")}</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="operation" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASKS.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {taskLabel(t, task.id)} — {t(`actions.${task.action}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="form-columns">
          <div className="field">
            <Label htmlFor="event-date">{t("form.date")}</Label>
            <Input
              id="event-date"
              name="date"
              type="date"
              defaultValue={event?.date || today()}
              max={today()}
              required
            />
          </div>
          <div className="field">
            <Label htmlFor="event-km">{t("form.mileage")}</Label>
            <Input
              id="event-km"
              name="km"
              type="number"
              min="0"
              step="1"
              defaultValue={event?.km ?? state.vehicle.km}
              required
            />
          </div>
        </div>
        <div className="field">
          <Label htmlFor="event-notes">{t("form.notes")}</Label>
          <Textarea
            id="event-notes"
            name="notes"
            rows={4}
            defaultValue={event?.notes || ""}
            placeholder={t("form.notes_placeholder")}
          />
        </div>
        <div className="checkbox-field">
          <Checkbox
            id="confirmed"
            checked={confirmed}
            onCheckedChange={(value) => setConfirmed(value === true)}
          />
          <Label htmlFor="confirmed">{t("form.confirmed")}</Label>
        </div>
        <p className="form-help">{t("form.event_help")}</p>
        <div className="form-actions">
          {event && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onDelete(event.id)}
            >
              {t("common.delete")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">
            {busy ? t("form.saving") : t("form.save_event")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
export function PlanForm({
  state,
  taskId,
  onSave,
  onLog,
  busy,
}: CommonProps & { taskId: string; onLog: () => void }) {
  const { t } = useTranslation();
  const task = evaluate(
    TASKS.find((item) => item.id === taskId)!,
    state,
  );
  const override = state.overrides[taskId] || {};
  const [notesDirty, setNotesDirty] = useState(false);
  const [priority, setPriority] = useState<NonNullable<Plan["priority"]>>(
    override.priority ||
      (!task.latest || task.latest.id.startsWith("seed-")
        ? task.priority || "normal"
        : "normal"),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = structuredClone(state);
    const number = (key: string) =>
      form.get(key) === "" ? null : Number(form.get(key));
    next.overrides[taskId] = {
      intervalKm: number("intervalKm"),
      intervalMonths: number("intervalMonths"),
      dueKm: number("dueKm"),
      dueDate: String(form.get("dueDate")),
      priority,
      ...(notesDirty
        ? { notes: String(form.get("notes")).trim() }
        : Object.hasOwn(override, "notes")
          ? { notes: override.notes }
          : {}),
    };
    await onSave(next);
  }
  const interval =
    [
      task.intervalKm ? km(task.intervalKm) : "",
      task.intervalMonths ? monthsLabel(task.intervalMonths) : "",
    ]
      .filter(Boolean)
      .join(" / ") || t("status.condition");
  return (
    <>
      <div className="detail-summary">
        <StatusBadge status={task.status} />
        <Deadline task={task} />
      </div>
      <p className="form-help">
        {t("form.interval")} {interval} ·{" "}
        {task.personal
          ? t("form.edited_plan")
          : taskLabel(t, task.id, "source")}
      </p>
      <p className="form-help">
        {task.latest
          ? t("form.last_service", {
              date: dateLabel(task.latest.date),
              distance: km(task.latest.km),
            })
          : t("form.no_confirmed")}
      </p>
      {!Object.hasOwn(override, "notes") && task.notes && (
        <p className="form-help">
          <strong>{t("form.default_guidance")}: </strong>
          {taskNotes(t, task, state)}
        </p>
      )}
      <form onSubmit={submit} className="notebook-form">
        <fieldset disabled={busy}>
          <div className="field">
            <Label htmlFor="plan-notes">{t("form.personal_notes")}</Label>
            <Textarea
              id="plan-notes"
              name="notes"
              defaultValue={override.notes ?? ""}
              onChange={() => setNotesDirty(true)}
              rows={4}
            />
          </div>
          <details className="plan-details">
            <summary>{t("form.edit_plan")}</summary>
            <p className="form-help">{t("form.plan_help")}</p>
            <div className="form-columns">
              <div className="field">
                <Label htmlFor="interval-km">{t("form.interval_km")}</Label>
                <Input
                  id="interval-km"
                  name="intervalKm"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={task.intervalKm ?? ""}
                  placeholder={t("status.condition")}
                />
              </div>
              <div className="field">
                <Label htmlFor="interval-months">
                  {t("form.interval_months")}
                </Label>
                <Input
                  id="interval-months"
                  name="intervalMonths"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={task.intervalMonths ?? ""}
                  placeholder={t("form.no_limit")}
                />
              </div>
              <div className="field">
                <Label htmlFor="due-km">{t("form.planned_km")}</Label>
                <Input
                  id="due-km"
                  name="dueKm"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={task.plannedKm ?? ""}
                />
              </div>
              <div className="field">
                <Label htmlFor="due-date">{t("form.planned_date")}</Label>
                <Input
                  id="due-date"
                  name="dueDate"
                  type="date"
                  defaultValue={task.plannedDate ?? ""}
                />
              </div>
            </div>
            <div className="field">
              <Label htmlFor="priority">{t("form.priority")}</Label>
              <Select
                value={priority}
                onValueChange={(value) =>
                  setPriority(value as NonNullable<Plan["priority"]>)
                }
              >
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{t("priority.normal")}</SelectItem>
                  <SelectItem value="watch">{t("priority.watch")}</SelectItem>
                  <SelectItem value="attention">
                    {t("priority.attention")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </details>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const next = structuredClone(state);
                delete next.overrides[taskId];
                void onSave(next);
              }}
            >
              {t("form.reset")}
            </Button>
            <Button type="submit" variant="outline">
              {t("form.save_plan")}
            </Button>
            <Button type="button" onClick={onLog}>
              {t("form.log")}
            </Button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
export function OdometerForm({ state, onSave, onClose, busy }: CommonProps) {
  const { t } = useTranslation();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next = structuredClone(state);
    next.vehicle.km = Number(data.get("km"));
    await onSave(next);
  }
  return (
    <form onSubmit={submit} className="notebook-form">
      <fieldset disabled={busy}>
        <div className="field">
          <Label htmlFor="odometer-km">{t("form.odometer")}</Label>
          <Input
            id="odometer-km"
            name="km"
            type="number"
            min={Math.max(0, ...state.events.map((event) => event.km))}
            step="1"
            defaultValue={state.vehicle.km}
            required
            autoFocus
          />
        </div>
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("common.update")}</Button>
        </div>
      </fieldset>
    </form>
  );
}

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
import { ACTIONS, TASKS } from "@/data.js";
import { evaluate, latestEvent, today } from "@/engine.js";
import { dateLabel, km } from "@/lib/format";
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
          <Label htmlFor="operation">Operație</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="operation" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASKS.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.name} — {ACTIONS[task.action]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="form-columns">
          <div className="field">
            <Label htmlFor="event-date">Data</Label>
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
            <Label htmlFor="event-km">Kilometraj</Label>
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
          <Label htmlFor="event-notes">Notițe</Label>
          <Textarea
            id="event-notes"
            name="notes"
            rows={4}
            defaultValue={event?.notes || ""}
            placeholder="Piesa, uleiul, atelierul, observații…"
          />
        </div>
        <div className="checkbox-field">
          <Checkbox
            id="confirmed"
            checked={confirmed}
            onCheckedChange={(value) => setConfirmed(value === true)}
          />
          <Label htmlFor="confirmed">Intervenție confirmată, efectuată</Label>
        </div>
        <p className="form-help">
          O lucrare neconfirmată rămâne în istoric și nu resetează scadența. Un
          kilometraj mai mare actualizează și bordul.
        </p>
        <div className="form-actions">
          {event && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onDelete(event.id)}
            >
              Șterge
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Renunță
          </Button>
          <Button type="submit">
            {busy ? "Se salvează…" : "Salvează intervenția"}
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
  const task = evaluate(
    TASKS.find((item) => item.id === taskId)!,
    state,
  );
  const override = state.overrides[taskId] || {};
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
      notes: String(form.get("notes")).trim(),
    };
    await onSave(next);
  }
  const interval =
    [
      task.intervalKm ? km(task.intervalKm) : "",
      task.intervalMonths ? `${task.intervalMonths} luni` : "",
    ]
      .filter(Boolean)
      .join(" / ") || "După stare";
  return (
    <>
      <div className="detail-summary">
        <StatusBadge status={task.status} />
        <Deadline task={task} />
      </div>
      <p className="form-help">
        Interval: {interval} ·{" "}
        {task.personal ? "Plan personal editat" : task.source}
      </p>
      <p className="form-help">
        {task.latest
          ? `Ultima lucrare: ${dateLabel(task.latest.date)} · ${km(task.latest.km)}`
          : "Nicio lucrare confirmată. Limita de timp rămâne necunoscută."}
      </p>
      <form onSubmit={submit} className="notebook-form">
        <fieldset disabled={busy}>
          <div className="field">
            <Label htmlFor="plan-notes">Observații</Label>
            <Textarea
              id="plan-notes"
              name="notes"
              defaultValue={task.notes}
              rows={4}
            />
          </div>
          <details className="plan-details">
            <summary>Editează intervalul și planul personal</summary>
            <p className="form-help">
              Câmpurile goale dezactivează intervalul personal. Un reper mai
              târziu nu amână scadența calculată.
            </p>
            <div className="form-columns">
              <div className="field">
                <Label htmlFor="interval-km">Interval kilometri</Label>
                <Input
                  id="interval-km"
                  name="intervalKm"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={task.intervalKm ?? ""}
                  placeholder="După stare"
                />
              </div>
              <div className="field">
                <Label htmlFor="interval-months">Interval luni</Label>
                <Input
                  id="interval-months"
                  name="intervalMonths"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={task.intervalMonths ?? ""}
                  placeholder="Fără limită"
                />
              </div>
              <div className="field">
                <Label htmlFor="due-km">Reper planificat · km</Label>
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
                <Label htmlFor="due-date">Reper planificat · dată</Label>
                <Input
                  id="due-date"
                  name="dueDate"
                  type="date"
                  defaultValue={task.plannedDate ?? ""}
                />
              </div>
            </div>
            <div className="field">
              <Label htmlFor="priority">Prioritate</Label>
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
                  <SelectItem value="normal">Normală</SelectItem>
                  <SelectItem value="watch">De urmărit</SelectItem>
                  <SelectItem value="attention">Prioritară</SelectItem>
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
              Reper inițial
            </Button>
            <Button type="submit" variant="outline">
              Salvează planul
            </Button>
            <Button type="button" onClick={onLog}>
              Înregistrează lucrarea
            </Button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
export function OdometerForm({ state, onSave, onClose, busy }: CommonProps) {
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
          <Label htmlFor="odometer-km">Bord · km</Label>
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
            Renunță
          </Button>
          <Button type="submit">Actualizează</Button>
        </div>
      </fieldset>
    </form>
  );
}

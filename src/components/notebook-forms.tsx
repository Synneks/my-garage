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
import { evaluate, latestEvent, today } from "@/engine";
import { emptyNotebook, notebookTasks } from "@/lib/garage";
import { Deadline, StatusBadge } from "./maintenance-table";
import type { Notebook, ServiceEvent, Plan, Task } from "@/types";

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
  const tasks = notebookTasks(state);
  const [selected, setSelected] = useState(
    event?.taskId || taskId || "new-task",
  );
  const [action, setAction] = useState(
    event?.action || tasks.find((task) => task.id === taskId)?.action || "",
  );
  const [confirmed, setConfirmed] = useState(event?.confirmed ?? true);
  const [saveTaskForFuture, setSaveTaskForFuture] = useState(false);
  const selectedTask = tasks.find((task) => task.id === selected);
  const orphan = event && !tasks.some((task) => task.id === event.taskId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next = structuredClone(state);
    const newTaskId =
      !selectedTask && saveTaskForFuture ? crypto.randomUUID() : null;
    const value: ServiceEvent = {
      id: event?.id || crypto.randomUUID(),
      taskId:
        newTaskId ??
        (selected === "new-task" ? `history-${crypto.randomUUID()}` : selected),
      taskName: selectedTask
        ? event?.taskId === selected
          ? event.taskName || selectedTask.name
          : selectedTask.name
        : String(data.get("taskName")).trim(),
      action: action.trim(),
      date: String(data.get("date")),
      km: Number(data.get("km")),
      notes: String(data.get("notes")),
      confirmed,
    };
    if (newTaskId) {
      const task: Task = {
        id: newTaskId,
        name: value.taskName!,
        action: value.action,
        category: "",
        source: "",
        intervalKm: null,
        intervalMonths: null,
      };
      next.tasks = [...(next.tasks || []), task];
    }
    next.events = next.events.filter((item) => item.id !== value.id);
    next.events.push(value);
    next.vehicle.km = Math.max(next.vehicle.km, value.km);
    if (
      selectedTask &&
      confirmed &&
      latestEvent(next, selected)?.id === value.id &&
      !value.id.startsWith("seed-")
    ) {
      next.overrides[selected] = {
        ...next.overrides[selected],
        dueKm: null,
        dueDate: "",
        priority: "normal",
      };
    }
    await onSave(next);
  }
  return (
    <form onSubmit={submit} className="notebook-form">
      <fieldset disabled={busy}>
        <div className="field">
          <Label htmlFor="operation">{t("form.operation")}</Label>
          <Select
            value={selected}
            onValueChange={(id) => {
              setSelected(id);
              setSaveTaskForFuture(false);
              setAction(
                tasks.find((task) => task.id === id)?.action ||
                  (id === event?.taskId ? event.action : ""),
              );
            }}
          >
            <SelectTrigger id="operation" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new-task">{t("garage.new_task")}</SelectItem>
              {orphan && (
                <SelectItem value={event.taskId}>{event.taskName}</SelectItem>
              )}
              {tasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.name} — {task.action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!selectedTask && (
          <div className="field">
            <Label htmlFor="event-name">{t("garage.task_name")}</Label>
            <Input
              id="event-name"
              name="taskName"
              maxLength={200}
              defaultValue={event?.taskName ?? ""}
              required
            />
          </div>
        )}
        <div className="field">
          <Label htmlFor="event-action">{t("garage.action")}</Label>
          <Input
            id="event-action"
            maxLength={100}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            required
          />
        </div>
        {!selectedTask && (
          <>
            <div className="checkbox-field">
              <Checkbox
                id="save-task-for-future"
                checked={saveTaskForFuture}
                onCheckedChange={(value) =>
                  setSaveTaskForFuture(value === true)
                }
              />
              <Label htmlFor="save-task-for-future">
                {t("form.save_task_for_future")}
              </Label>
            </div>
            <p className="form-help">{t("form.save_task_for_future_help")}</p>
          </>
        )}
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
            maxLength={10000}
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

export function TaskForm({
  state,
  taskId,
  onSave,
  onClose,
  onLog,
  onDelete,
  busy,
}: CommonProps & {
  taskId?: string;
  onLog: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const original = notebookTasks(state).find((task) => task.id === taskId);
  const task = original ? evaluate(original, state) : null;
  const [priority, setPriority] = useState<NonNullable<Plan["priority"]>>(
    taskId
      ? state.overrides[taskId]?.priority ||
          (!task?.latest || task.latest.id.startsWith("seed-")
            ? original?.priority
            : undefined) ||
          "normal"
      : "normal",
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = structuredClone(state);
    const number = (key: string) =>
      form.get(key) === "" ? null : Number(form.get(key));
    const id = taskId || crypto.randomUUID();
    const value: Task = {
      ...(original || {}),
      id,
      name: String(form.get("name")).trim(),
      category: String(form.get("category")).trim(),
      action: String(form.get("action")).trim(),
      source: String(form.get("source")),
      notes: String(form.get("notes")),
      intervalKm: number("intervalKm"),
      intervalMonths: number("intervalMonths"),
    };
    next.tasks = [
      ...(next.tasks || []).filter((item) => item.id !== id),
      value,
    ];
    next.overrides[id] = {
      dueKm: number("dueKm"),
      dueDate: String(form.get("dueDate")),
      priority,
    };
    await onSave(next);
  }
  return (
    <>
      {task && (
        <div className="detail-summary">
          <StatusBadge status={task.status} />
          <Deadline task={task} />
        </div>
      )}
      <form onSubmit={submit} className="notebook-form">
        <fieldset disabled={busy}>
          <div className="field">
            <Label htmlFor="task-name">{t("garage.task_name")}</Label>
            <Input
              id="task-name"
              name="name"
              defaultValue={original?.name || ""}
              maxLength={200}
              required
            />
          </div>
          <div className="form-columns">
            <div className="field">
              <Label htmlFor="task-category">{t("garage.category")}</Label>
              <Input
                id="task-category"
                name="category"
                defaultValue={original?.category || ""}
                maxLength={100}
              />
            </div>
            <div className="field">
              <Label htmlFor="task-action">{t("garage.action")}</Label>
              <Input
                id="task-action"
                name="action"
                defaultValue={original?.action || ""}
                maxLength={100}
                required
              />
            </div>
          </div>
          <p className="form-help">{t("garage.language_help")}</p>
          <div className="field">
            <Label htmlFor="task-notes">{t("form.notes")}</Label>
            <Textarea
              id="task-notes"
              name="notes"
              defaultValue={task?.notes || ""}
              maxLength={10000}
              rows={3}
            />
          </div>
          <div className="field">
            <Label htmlFor="task-source">{t("garage.source")}</Label>
            <Input
              id="task-source"
              name="source"
              defaultValue={original?.source || ""}
              maxLength={1000}
            />
          </div>
          <div className="form-columns">
            <div className="field">
              <Label htmlFor="interval-km">{t("form.interval_km")}</Label>
              <Input
                id="interval-km"
                name="intervalKm"
                type="number"
                min="1"
                step="1"
                defaultValue={task?.intervalKm ?? ""}
                placeholder={t("form.no_limit")}
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
                defaultValue={task?.intervalMonths ?? ""}
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
                defaultValue={task?.plannedKm ?? ""}
              />
            </div>
            <div className="field">
              <Label htmlFor="due-date">{t("form.planned_date")}</Label>
              <Input
                id="due-date"
                name="dueDate"
                type="date"
                defaultValue={task?.plannedDate ?? ""}
              />
            </div>
          </div>
          <p className="form-help">{t("form.plan_help")}</p>
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
                {(["normal", "watch", "attention"] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`priority.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="form-actions">
            {taskId && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                {t("garage.delete_task")}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">
              {busy ? t("form.saving") : t("garage.save_task")}
            </Button>
            {taskId && (
              <Button type="button" variant="outline" onClick={onLog}>
                {t("form.log")}
              </Button>
            )}
          </div>
        </fieldset>
      </form>
    </>
  );
}

export function VehicleForm({
  state,
  adding,
  onSave,
  onClose,
  onDelete,
  busy,
}: CommonProps & { adding: boolean; onDelete: () => void }) {
  const { t } = useTranslation();
  const vehicle = adding ? emptyNotebook().vehicle : state.vehicle;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = adding ? emptyNotebook() : structuredClone(state);
    next.vehicle = {
      make: String(form.get("make")).trim(),
      model: String(form.get("model")).trim(),
      year: Number(form.get("year")),
      km: Number(form.get("km")),
    };
    await onSave(next);
  }
  return (
    <form onSubmit={submit} className="notebook-form">
      <fieldset disabled={busy}>
        <div className="field">
          <Label htmlFor="vehicle-make">{t("garage.make")}</Label>
          <Input
            id="vehicle-make"
            name="make"
            maxLength={100}
            defaultValue={vehicle.make || ""}
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="vehicle-model">{t("garage.model")}</Label>
          <Input
            id="vehicle-model"
            name="model"
            maxLength={200}
            defaultValue={vehicle.model}
            required
          />
        </div>
        <div className="form-columns">
          <div className="field">
            <Label htmlFor="vehicle-year">{t("garage.year")}</Label>
            <Input
              id="vehicle-year"
              name="year"
              type="number"
              min="1886"
              max="2200"
              step="1"
              defaultValue={vehicle.year}
              required
            />
          </div>
          <div className="field">
            <Label htmlFor="vehicle-km">{t("form.mileage")}</Label>
            <Input
              id="vehicle-km"
              name="km"
              type="number"
              min={
                adding
                  ? 0
                  : Math.max(0, ...state.events.map((event) => event.km))
              }
              step="1"
              defaultValue={vehicle.km}
              required
            />
          </div>
        </div>
        <div className="form-actions">
          {!adding && (
            <Button type="button" variant="destructive" onClick={onDelete}>
              {t("garage.delete_vehicle")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">
            {busy ? t("form.saving") : t("garage.save_vehicle")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
export function OdometerForm({ state, onSave, onClose, busy }: CommonProps) {
  const { t } = useTranslation();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = structuredClone(state);
    next.vehicle.km = Number(new FormData(e.currentTarget).get("km"));
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

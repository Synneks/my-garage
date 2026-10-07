import {
  categoryId,
  categoryLabel,
  taskLabel,
  searchTask,
} from "@/lib/task-labels";
import { monthsLabel, numberLabel } from "@/lib/format";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clock3,
  Download,
  List,
  Search,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MANUAL_URL, TEXT_MANUAL_URL, TASKS } from "@/data.js";
import { STATUS } from "@/engine.js";
import { km, dateLabel, remainingText } from "@/lib/format";
import { MaintenanceTable, StatusBadge } from "./maintenance-table";
import type { EvaluatedTask, Notebook } from "@/types";

interface Operations {
  onDetail: (id: string) => void;
  onLog: (id: string) => void;
  disabled?: boolean;
}
export function Overview({
  tasks,
  onDetail,
  onLog,
  onSchedule,
  disabled,
}: Operations & {
  tasks: EvaluatedTask[];
  onSchedule: (filter?: string) => void;
}) {
  const { t } = useTranslation();
  const priorities = tasks
    .filter((task) => ["overdue", "attention", "watch"].includes(task.status))
    .sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank);
  const upcoming = tasks
    .filter((task) => task.dueKm !== null && !priorities.includes(task))
    .sort((a, b) => a.dueKm! - b.dueKm!)
    .slice(0, 6);
  const oil = tasks.find((task) => task.id === "oil")!,
    chain = tasks.find((task) => task.id === "chain-lube")!;
  const unknown = tasks.filter((task) => task.status === "unknown").length;
  return (
    <>
      <div className="stats-grid">
        <Card className="stat-card">
          <CardContent>
            <div className="stat-label">
              {t("status.attention_filter")}
              <AlertTriangle />
            </div>
            <div className="stat-value attention-value">
              {numberLabel(priorities.length)}
              <span>
                {t("counts.tasks", { count: priorities.length }).replace(
                  /^\S+\s/,
                  "",
                )}
              </span>
            </div>
            <p className="metadata">{t("overview.attention_description")}</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent>
            <div className="stat-label">
              {t("overview.chain")}
              <Wrench />
            </div>
            <div className="stat-value">
              {chain.dueKm !== null
                ? km(chain.dueKm)
                : t("common.undetermined")}
            </div>
            <p className="metadata">{remainingText(chain)}</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent>
            <div className="stat-label">
              {t("overview.oil")}
              <Clock3 />
            </div>
            <div className="stat-value">
              {oil.dueKm !== null ? km(oil.dueKm) : t("common.undetermined")}
            </div>
            <p className="metadata">
              {oil.dueDate
                ? t("overview.oil_date", { date: dateLabel(oil.dueDate) })
                : t("overview.personal_interval")}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="content-card">
        <CardHeader className="section-header">
          <div>
            <p className="eyebrow">{t("overview.watch")}</p>
            <CardTitle>{t("overview.before_ride")}</CardTitle>
          </div>
          <Badge variant="secondary">
            {t("counts.tasks", { count: priorities.length })}
          </Badge>
        </CardHeader>
        <CardContent className="priority-grid">
          {priorities.slice(0, 5).map((task) => (
            <article className="priority-card" key={task.id}>
              <div className="priority-top">
                <AlertTriangle />
                <StatusBadge status={task.status} />
              </div>
              <h3>{task.name}</h3>
              <p>{task.notes || remainingText(task)}</p>
              <Button
                variant="link"
                className="detail-link"
                disabled={disabled}
                onClick={() => onDetail(task.id)}
              >
                {t("common.details")}
              </Button>
            </article>
          ))}
          {!priorities.length && (
            <p className="empty-state">{t("overview.empty")}</p>
          )}
        </CardContent>
        {priorities.length > 5 && (
          <Button variant="link" onClick={() => onSchedule("attention")}>
            {t("counts.view_all", { count: priorities.length })}
          </Button>
        )}
      </Card>
      <Card className="content-card">
        <CardHeader className="section-header">
          <div>
            <p className="eyebrow">{t("overview.upcoming")}</p>
            <CardTitle>{t("overview.milestones")}</CardTitle>
          </div>
          <Button variant="link" onClick={() => onSchedule()}>
            {t("overview.all")}
            <List />
          </Button>
        </CardHeader>
        <MaintenanceTable
          tasks={upcoming}
          compact
          onDetail={onDetail}
          onLog={onLog}
          disabled={disabled}
        />
      </Card>
      <div className="context-note">
        <BookOpen />
        <div>
          <strong>{t("counts.unknown", { count: unknown })}</strong>
          <p>{t("overview.unknown_guidance", { mileage: km(36000) })}</p>
        </div>
        <Button variant="link" onClick={() => onSchedule("unknown")}>
          {t("common.view_tasks")}
        </Button>
      </div>
    </>
  );
}
export function Schedule({
  tasks,
  initialFilter,
  ...operations
}: Operations & { tasks: EvaluatedTask[]; initialFilter: string }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState(initialFilter),
    [category, setCategory] = useState("all");
  const matches = tasks
    .filter(
      (task) =>
        (filter === "all" ||
          (filter === "attention"
            ? ["overdue", "attention", "watch", "soon"].includes(task.status)
            : task.status === filter)) &&
        (category === "all" || categoryId(task.category) === category) &&
        searchTask(
          t,
          TASKS.find((item) => item.id === task.id)!,
          query,
          task.notes,
        ),
    )
    .sort(
      (a, b) =>
        STATUS[a.status].rank - STATUS[b.status].rank ||
        (a.remainingKm ?? Infinity) - (b.remainingKm ?? Infinity),
    );
  return (
    <>
      <Card className="content-card">
        <CardHeader>
          <CardTitle>{t("schedule.title")}</CardTitle>
          <p className="metadata">
            {t("schedule.count_note", {
              tasks: t("counts.tasks", { count: tasks.length }),
            })}
          </p>
        </CardHeader>
        <div className="filters">
          <div className="search-field">
            <Search />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("schedule.search_placeholder")}
              aria-label={t("schedule.search_label")}
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label={t("schedule.status_label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                ["all", t("schedule.all_statuses")],
                ["attention", t("status.attention_filter")],
                ["unknown", t("status.unknown")],
                ["ok", t("status.ok")],
                ["condition", t("status.condition")],
              ].map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label={t("schedule.category_label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("schedule.all_categories")}
              </SelectItem>
              {[...new Set(TASKS.map((task) => task.category))].map(
                (category) => (
                  <SelectItem
                    value={categoryId(category)}
                    key={categoryId(category)}
                  >
                    {categoryLabel(t, category)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <MaintenanceTable tasks={matches} {...operations} />
      </Card>
      <p className="page-note">{t("schedule.help")}</p>
    </>
  );
}
export function History({
  state,
  onEdit,
  onExport,
  disabled,
}: {
  state: Notebook;
  onEdit: (id: string) => void;
  onExport: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const groups = [...state.events]
    .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km)
    .reduce<Record<string, Notebook["events"]>>((groups, event) => {
      (groups[`${event.date}|${event.km}`] ||= []).push(event);
      return groups;
    }, {});
  return (
    <>
      <div className="history-intro">
        <div>
          <h2>{t("history.title")}</h2>
          <p className="metadata">
            {t("history.count_note", {
              events: t("counts.events", { count: state.events.length }),
              confirmed: t("counts.confirmed", {
                count: state.events.filter((event) => event.confirmed).length,
              }),
            })}
          </p>
        </div>
        <Button variant="outline" onClick={onExport}>
          <Download />
          {t("common.export_csv")}
        </Button>
      </div>
      {Object.entries(groups).map(([key, events]) => (
        <Card key={key} className="content-card history-card">
          <CardHeader className="section-header">
            <div className="history-date">
              <Clock3 />
              <CardTitle>{dateLabel(key.split("|")[0])}</CardTitle>
              <Badge variant="secondary">{km(Number(key.split("|")[1]))}</Badge>
            </div>
            <span className="metadata">
              {t("counts.tasks", { count: events.length })}
            </span>
          </CardHeader>
          <CardContent className="history-entries">
            {events.map((event) => (
              <article key={event.id} className="history-entry">
                <div className="event-icon">
                  {event.confirmed ? <Check /> : <AlertTriangle />}
                </div>
                <div className="event-body">
                  <strong>{taskLabel(t, event.taskId)}</strong>
                  <p className="metadata">
                    {t(`actions.${event.action}`)} ·{" "}
                    {event.confirmed
                      ? t("history.confirmed")
                      : t("history.unconfirmed")}
                    {event.id.startsWith("seed-") && t("history.seed")}
                  </p>
                  {event.notes && <p className="event-notes">{event.notes}</p>}
                </div>
                <Button
                  variant="link"
                  onClick={() => onEdit(event.id)}
                  disabled={disabled}
                >
                  {t("common.edit")}
                </Button>
              </article>
            ))}
          </CardContent>
        </Card>
      ))}
      {!state.events.length && (
        <Card className="empty-state">{t("history.empty")}</Card>
      )}
    </>
  );
}
export function Sources({
  configured,
  onExport,
  onImport,
  onLogin,
  canUndo,
  onUndo,
  disabled,
}: {
  configured: boolean;
  onExport: () => void;
  onImport: () => void;
  onLogin: () => void;
  canUndo: boolean;
  onUndo: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Card className="content-card prose">
        <CardHeader>
          <p className="eyebrow">GSF650S · K5 · 2005</p>
          <CardTitle>{t("sources.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t("sources.intervals")}</p>
          <div className="source-actions">
            <Button asChild variant="outline">
              <a href={MANUAL_URL} target="_blank" rel="noreferrer">
                <BookOpen />
                {t("sources.manual")}
              </a>
            </Button>
            <a href={TEXT_MANUAL_URL} target="_blank" rel="noreferrer">
              {t("sources.online")}
            </a>
          </div>
          <h3>{t("sources.time_limits")}</h3>
          <ul>
            <li>
              {t("sources.oil_filters", {
                mileage: km(18000),
                months: monthsLabel(36),
              })}
            </li>
            <li>
              {t("sources.spark_fuel", {
                mileage: km(12000),
                months: monthsLabel(24),
              })}
            </li>
            <li>
              {t("sources.inspections", {
                mileage: km(6000),
                months: monthsLabel(12),
              })}
            </li>
            <li>
              {t("sources.chain_brakes", {
                mileage: km(1000),
                fluidMonths: monthsLabel(24),
                hoseMonths: monthsLabel(48),
              })}
            </li>
          </ul>
          <h3>{t("sources.unconfirmed")}</h3>
          <p>
            {t("sources.valves", {
              valveMileage: km(24000),
              planMileage: km(36000),
            })}
          </p>
          <p>
            {t("sources.initial_service", {
              mileage: km(30137),
              date: dateLabel("2026-09-10"),
            })}
          </p>
          <p>
            {t("sources.personal_plans", { date: dateLabel("2026-12-01") })}
          </p>
        </CardContent>
      </Card>
      <Card className="content-card prose">
        <CardHeader>
          <CardTitle>{t("sources.your_data")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t("sources.storage")}</p>
          <p>{t("sources.csv")}</p>
          <div className="source-actions">
            <Button onClick={onExport}>
              <Download />
              {t("common.export_log")}
            </Button>
            <Button variant="outline" onClick={onImport} disabled={disabled}>
              {t("common.import_csv")}
            </Button>
            {canUndo && (
              <Button variant="outline" onClick={onUndo} disabled={disabled}>
                {t("common.undo")}
              </Button>
            )}
          </div>
          {!configured && (
            <div className="setup-guide">
              <h3>{t("sources.firebase")}</h3>
              <ol>
                <li>{t("sources.create_project")}</li>
                <li>
                  {t("sources.add_web")} <code>.env.local</code>
                  {t("sources.example")} <code>.env.example</code>.
                </li>
                <li>{t("sources.enable_google")}</li>
                <li>
                  {t("sources.create_firestore")} <code>firestore.rules</code>.
                </li>
                <li>{t("sources.restart")}</li>
              </ol>
              <p>{t("sources.readme")}</p>
            </div>
          )}
          {configured && (
            <Button variant="link" onClick={onLogin}>
              {t("auth.sign_in")}
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}

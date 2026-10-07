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
import { ACTIONS, MANUAL_URL, TEXT_MANUAL_URL, TASKS } from "@/data.js";
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
              Necesită atenție <AlertTriangle />
            </div>
            <div className="stat-value attention-value">
              {priorities.length}
              <span>operații</span>
            </div>
            <p className="metadata">Scadențe și observații de urmărit</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent>
            <div className="stat-label">
              Lanț · următoarea întreținere <Wrench />
            </div>
            <div className="stat-value">
              {chain.dueKm !== null ? km(chain.dueKm) : "De stabilit"}
            </div>
            <p className="metadata">{remainingText(chain)}</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent>
            <div className="stat-label">
              Ulei · următorul schimb <Clock3 />
            </div>
            <div className="stat-value">
              {oil.dueKm !== null ? km(oil.dueKm) : "De stabilit"}
            </div>
            <p className="metadata">
              {oil.dueDate
                ? `sau ${dateLabel(oil.dueDate)}, primul prag atins`
                : "După intervalul personal"}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="content-card">
        <CardHeader className="section-header">
          <div>
            <p className="eyebrow">DE URMĂRIT</p>
            <CardTitle>Înainte de următoarea tură</CardTitle>
          </div>
          <Badge variant="secondary">{priorities.length} operații</Badge>
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
                Vezi detalii
              </Button>
            </article>
          ))}
          {!priorities.length && (
            <p className="empty-state">
              Nicio observație prioritară. Verifică și operațiile cu istoric
              necunoscut.
            </p>
          )}
        </CardContent>
        {priorities.length > 5 && (
          <Button variant="link" onClick={() => onSchedule("attention")}>
            Vezi toate cele {priorities.length} operații
          </Button>
        )}
      </Card>
      <Card className="content-card">
        <CardHeader className="section-header">
          <div>
            <p className="eyebrow">PE PARCURS</p>
            <CardTitle>Următoarele repere în kilometri</CardTitle>
          </div>
          <Button variant="link" onClick={() => onSchedule()}>
            Toată mentenanța <List />
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
          <strong>{unknown} operații cu istoric necunoscut</strong>
          <p>
            Reperele de 36.000 km sunt planuri din fișă. Fără o dată confirmată,
            limita de timp rămâne necunoscută.
          </p>
        </div>
        <Button variant="link" onClick={() => onSchedule("unknown")}>
          Vezi operațiile
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
        (category === "all" || task.category === category) &&
        `${task.name} ${task.notes} ${ACTIONS[task.action]}`
          .toLocaleLowerCase("ro")
          .includes(query.toLocaleLowerCase("ro")),
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
          <CardTitle>Planul de mentenanță</CardTitle>
          <p className="metadata">
            {tasks.length} operații · schimburile și verificările au scadențe
            separate
          </p>
        </CardHeader>
        <div className="filters">
          <div className="search-field">
            <Search />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută o operație…"
              aria-label="Caută o operație"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label="Filtrează după stare">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                ["all", "Toate stările"],
                ["attention", "Necesită atenție"],
                ["unknown", "Istoric necunoscut"],
                ["ok", "În interval"],
                ["condition", "După stare"],
              ].map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label="Filtrează după categorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate categoriile</SelectItem>
              {[...new Set(TASKS.map((task) => task.category))].map(
                (category) => (
                  <SelectItem value={category} key={category}>
                    {category}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <MaintenanceTable tasks={matches} {...operations} />
      </Card>
      <p className="page-note">
        Click pe operație pentru notițe și planificare. „+” înregistrează o
        lucrare.
      </p>
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
          <h2>Carnetul motocicletei</h2>
          <p className="metadata">
            {state.events.length} operații ·{" "}
            {state.events.filter((event) => event.confirmed).length} confirmate
          </p>
        </div>
        <Button variant="outline" onClick={onExport}>
          <Download />
          Exportă CSV
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
            <span className="metadata">{events.length} operații</span>
          </CardHeader>
          <CardContent className="history-entries">
            {events.map((event) => (
              <article key={event.id} className="history-entry">
                <div className="event-icon">
                  {event.confirmed ? <Check /> : <AlertTriangle />}
                </div>
                <div className="event-body">
                  <strong>
                    {TASKS.find((task) => task.id === event.taskId)?.name}
                  </strong>
                  <p className="metadata">
                    {ACTIONS[event.action]} ·{" "}
                    {event.confirmed ? "Confirmată" : "Neconfirmată"}
                    {event.id.startsWith("seed-") && " · Din fișa furnizată"}
                  </p>
                  {event.notes && <p className="event-notes">{event.notes}</p>}
                </div>
                <Button
                  variant="link"
                  onClick={() => onEdit(event.id)}
                  disabled={disabled}
                >
                  Editează
                </Button>
              </article>
            ))}
          </CardContent>
        </Card>
      ))}
      {!state.events.length && (
        <Card className="empty-state">
          Încă nu ai intervenții. Adaugă prima lucrare.
        </Card>
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
  return (
    <>
      <Card className="content-card prose">
        <CardHeader>
          <p className="eyebrow">GSF650S · K5 · 2005</p>
          <CardTitle>Fișa și manualul Suzuki</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Intervalele recurente sunt preluate din manualul de service Suzuki
            GSF650/S, tabelul 2-2. Se folosește primul prag atins: kilometri sau
            luni, calculat de la ultima intervenție confirmată.
          </p>
          <div className="source-actions">
            <Button asChild variant="outline">
              <a href={MANUAL_URL} target="_blank" rel="noreferrer">
                <BookOpen />
                Manual Suzuki · PDF
              </a>
            </Button>
            <a href={TEXT_MANUAL_URL} target="_blank" rel="noreferrer">
              Consultă tabelul online
            </a>
          </div>
          <h3>Limitele de timp completate</h3>
          <ul>
            <li>Filtru ulei și înlocuire filtru aer: 18.000 km sau 36 luni.</li>
            <li>Bujii și filtru benzină: schimb 12.000 km sau 24 luni.</li>
            <li>Verificările de 6.000 km includ limita de 12 luni.</li>
            <li>
              Lanț: lubrifiere la 1.000 km. Lichid frână: schimb la 24 luni.
              Furtunuri frână: schimb la 48 luni.
            </li>
          </ul>
          <h3>Istoricul care rămâne de confirmat</h3>
          <p>
            Supapele la ~24.000 km sunt o presupunere, păstrată ca notiță. Nu am
            adăugat un service fictiv. La lucrările fără documente, 36.000 km
            rămâne un plan; limita temporală este necunoscută.
          </p>
          <p>
            Verificările de la 30.137 km sunt asociate service-ului din
            10.09.2026. Confirmă și corectează data în istoric dacă este
            necesar. Înlocuirile inițiale ale filtrelor, bujiilor și lichidului
            de frână sunt și repere pentru verificarea lor.
          </p>
          <p>
            01.12.2026 pentru anvelope este un reper editabil pentru iarna
            planificată. Kitul de lanț, urmărirea plăcuțelor și verificarea
            anuală a bateriei sunt recomandări personale / ale mecanicului.
          </p>
        </CardContent>
      </Card>
      <Card className="content-card prose">
        <CardHeader>
          <CardTitle>Datele tale</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            În modul local, carnetul rămâne în acest browser. După
            autentificare, carnetul contului se salvează în Firestore și se
            actualizează între dispozitive. Carnetul local se transferă în cont
            doar când alegi acest lucru.
          </p>
          <p>
            Exportul CSV include istoricul, kilometrajul și planurile personale.
            Importul înlocuiește carnetul afișat după confirmare, fără să
            afecteze carnetul local dacă lucrezi în cloud.
          </p>
          <div className="source-actions">
            <Button onClick={onExport}>
              <Download />
              Exportă carnetul
            </Button>
            <Button variant="outline" onClick={onImport} disabled={disabled}>
              Importă CSV
            </Button>
            {canUndo && (
              <Button variant="outline" onClick={onUndo} disabled={disabled}>
                Anulează ultima modificare
              </Button>
            )}
          </div>
          {!configured && (
            <div className="setup-guide">
              <h3>Conectarea la Firebase</h3>
              <ol>
                <li>Creează un proiect Firebase în planul gratuit Spark.</li>
                <li>
                  Adaugă o aplicație Web și copiază configurația în{" "}
                  <code>.env.local</code>, după exemplul{" "}
                  <code>.env.example</code>.
                </li>
                <li>
                  Activează Google în Authentication și adaugă localhost /
                  domeniul GitHub Pages la domeniile autorizate.
                </li>
                <li>
                  Creează Firestore și publică regulile din{" "}
                  <code>firestore.rules</code>.
                </li>
                <li>Repornește aplicația și autentifică-te.</li>
              </ol>
              <p>
                Instrucțiunile complete sunt în README. Nu este nevoie de chei
                private.
              </p>
            </div>
          )}
          {configured && (
            <Button variant="link" onClick={onLogin}>
              Autentificare Google
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Cloud,
  CloudOff,
  Download,
  Gauge,
  History as HistoryIcon,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { EventForm, OdometerForm, PlanForm } from "@/components/notebook-forms";
import {
  History,
  Overview,
  Schedule,
  Sources,
} from "@/components/notebook-views";
import { useNotebook } from "@/hooks/use-notebook";
import { TASKS, createInitialState } from "@/data.js";
import { evaluate, today } from "@/engine.js";
import { exportCsv, importCsv } from "@/csv.js";
import {
  firebaseConfigured,
  firebaseMessage,
  login,
  logout,
  usingFirebaseEmulators,
} from "@/lib/firebase";
import { km } from "@/lib/format";
import type { Notebook } from "@/types";

type View = "overview" | "schedule" | "history" | "sources";
interface Editor {
  type: "event" | "plan" | "km" | "import" | "delete";
  state: Notebook;
  version: string;
  taskId?: string;
  eventId?: string;
  imported?: Notebook;
  filename?: string;
}
const nav = [
  {
    id: "overview" as const,
    icon: LayoutDashboard,
    label: "Privire de ansamblu",
  },
  { id: "schedule" as const, icon: ListChecks, label: "Mentenanță" },
  { id: "history" as const, icon: HistoryIcon, label: "Istoric intervenții" },
  { id: "sources" as const, icon: BookOpen, label: "Fișă și date" },
];
const headings: Record<View, [string, string]> = {
  overview: ["Garajul meu", "Scadențe, priorități și lucrările motocicletei."],
  schedule: ["Mentenanță", "Ce urmează, la ce kilometraj și până când."],
  history: [
    "Istoric intervenții",
    "Data, kilometrajul și observațiile fiecărei lucrări.",
  ],
  sources: [
    "Fișă și date",
    "Manual Suzuki, sincronizare și backupul carnetului.",
  ],
};

export default function App() {
  const store = useNotebook();
  const [view, setView] = useState<View>("overview");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [formError, setFormError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const tasks = TASKS.map((task) => evaluate(task, store.state));
  const disabled = !store.ready || store.saving || store.needsSetup;

  // An editor belongs to exactly one account; close it when that account changes.
  useEffect(() => {
    setEditor(null);
    setFormError("");
  }, [store.user?.uid]);
  function navigate(next: View, filter = "all") {
    setView(next);
    setScheduleFilter(filter);
    window.scrollTo(0, 0);
  }
  function open(type: Editor["type"], taskId?: string, eventId?: string) {
    setFormError("");
    setEditor({
      type,
      taskId,
      eventId,
      state: structuredClone(store.state),
      version: store.version,
    });
  }
  function close() {
    if (!store.saving) {
      setEditor(null);
      setFormError("");
    }
  }
  async function save(next: Notebook, recovery = false) {
    if (!editor) return;
    try {
      await store.commit(next, editor.version, recovery);
      setEditor(null);
      setFormError("");
      toast.success(
        store.user
          ? "Carnet salvat în contul tău."
          : "Carnet salvat în acest browser.",
      );
    } catch (error) {
      setFormError(firebaseMessage(error));
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([exportCsv(store.state)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `bandit-carnet-${today()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("CSV exportat: kilometraj, istoric și planuri personale.");
  }
  async function upload(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("CSV prea mare. Limita este 5 MB.");
      const imported = importCsv(await file.text(), TASKS);
      setFormError("");
      setEditor({
        type: "import",
        state: structuredClone(store.state),
        version: store.version,
        imported,
        filename: file.name,
      });
    } catch (error) {
      toast.error(firebaseMessage(error));
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  async function authenticate() {
    if (!firebaseConfigured) {
      navigate("sources");
      return;
    }
    setAuthBusy(true);
    try {
      await login();
    } catch (error) {
      toast.error(firebaseMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }
  async function signOut() {
    if (store.saving) return;
    setAuthBusy(true);
    try {
      await logout();
      toast.success("Ai revenit la carnetul local.");
    } catch (error) {
      toast.error(firebaseMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }
  async function initialize(useLocal: boolean) {
    try {
      await store.commit(
        useLocal ? store.localState() : createInitialState(),
        store.version,
      );
      toast.success("Carnetul contului este pregătit.");
    } catch (error) {
      toast.error(firebaseMessage(error));
    }
  }
  async function undo() {
    try {
      await store.undoLast();
      toast.success("Ultima modificare a fost anulată.");
    } catch (error) {
      toast.error(firebaseMessage(error));
    }
  }
  const selectedEvent = editor?.state.events.find(
    (event) => event.id === editor.eventId,
  );
  const selectedTask = TASKS.find((task) => task.id === editor?.taskId);
  const title =
    editor?.type === "event"
      ? selectedEvent
        ? "Editează intervenția"
        : "Adaugă o intervenție"
      : editor?.type === "plan"
        ? selectedTask?.name || "Plan personal"
        : editor?.type === "km"
          ? "Kilometrajul actual"
          : "Importă carnetul CSV";
  const description =
    editor?.type === "event"
      ? "Înregistrează ce ai făcut, când și la ce kilometraj."
      : editor?.type === "plan"
        ? "Intervale, observații și repere personale."
        : editor?.type === "km"
          ? "Scadențele se recalculează imediat."
          : "Verifică backupul înainte de a înlocui carnetul.";

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <button className="brand" onClick={() => navigate("overview")}>
            <span className="brand-mark">
              B<span>.</span>
            </span>
            <span>
              BANDIT<small>CARNET DE MENTENANȚĂ</small>
            </span>
          </button>
          <p className="garage-label">MOTOCICLETA MEA</p>
          <div className="vehicle-card">
            <p>SUZUKI / 2005</p>
            <h2>
              Bandit <span>650 S</span>
            </h2>
            <span className="model-tag">GSF650S · K5</span>
          </div>
          <nav aria-label="Navigare principală">
            {nav.map((item) => (
              <Button
                variant="ghost"
                key={item.id}
                className={`nav-button ${view === item.id ? "active" : ""}`}
                onClick={() => navigate(item.id)}
                aria-current={view === item.id ? "page" : undefined}
              >
                <item.icon />
                {item.label}
              </Button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <Separator className="sidebar-separator" />
            <div className="storage-label">
              {store.user ? <Cloud /> : <CloudOff />}
              <span>
                {store.user
                  ? "Carnet în contul tău"
                  : "Carnet pe acest dispozitiv"}
              </span>
            </div>
            <p>
              {store.user
                ? "Date sincronizate între dispozitive."
                : "Exportă periodic un backup CSV."}
            </p>
            <Button
              variant="outline"
              onClick={download}
              className="sidebar-export"
            >
              <Download />
              Exportă CSV
            </Button>
          </div>
        </aside>
        <main className="main-area">
          <header className="topbar">
            <div className="breadcrumb">
              Garaj <span>/</span> Suzuki Bandit 650 S
            </div>
            <div className="topbar-controls">
              <button
                className="odometer"
                onClick={() => open("km")}
                disabled={disabled}
              >
                <span>KILOMETRAJ ACTUAL</span>
                <strong>{km(store.state.vehicle.km)}</strong>
                <small>Actualizează</small>
              </button>
              {store.user ? (
                <Button
                  variant="outline"
                  className="account-button"
                  disabled={authBusy || store.saving}
                  onClick={signOut}
                  aria-label="Deconectare"
                  title={store.user.email || undefined}
                >
                  <LogOut />
                  <span>Deconectare</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="account-button"
                  disabled={authBusy || !store.ready}
                  onClick={authenticate}
                  aria-label={
                    usingFirebaseEmulators
                      ? "Conectare cont de test"
                      : firebaseConfigured
                        ? "Conectare Google"
                        : "Conectează Firebase"
                  }
                >
                  {authBusy ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <LogIn />
                  )}
                  <span>
                    {usingFirebaseEmulators
                      ? "Conectare cont de test"
                      : firebaseConfigured
                        ? "Conectare Google"
                        : "Conectează Firebase"}
                  </span>
                </Button>
              )}
            </div>
          </header>
          <div className="page-content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">SUZUKI BANDIT 650 S · 2005</p>
                <h1>{headings[view][0]}</h1>
                <p>{headings[view][1]}</p>
              </div>
              <Button
                onClick={() => open("event")}
                disabled={disabled}
                size="lg"
              >
                <Plus />
                Adaugă intervenție
              </Button>
            </div>
            {usingFirebaseEmulators && (
              <Alert className="notice">
                <Cloud />
                <AlertTitle>Emulatoare locale · date de test</AlertTitle>
                <AlertDescription>
                  Autentificarea și salvarea folosesc doar serviciile locale.
                </AlertDescription>
              </Alert>
            )}
            {store.error && (
              <Alert variant="destructive" className="notice">
                <AlertTriangle />
                <AlertTitle>Salvarea necesită atenție</AlertTitle>
                <AlertDescription>
                  {store.error}
                  <Button
                    variant="link"
                    onClick={() => window.location.reload()}
                  >
                    Reîncarcă
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {!store.user && store.ready && (
              <div className="local-notice">
                <CloudOff />
                <span>
                  {firebaseConfigured
                    ? "Mod local. Conectează-te pentru sincronizare între dispozitive."
                    : "Mod local · datele existente sunt păstrate. Configurarea Firebase este pregătită."}
                </span>
                {!firebaseConfigured && (
                  <Button variant="link" onClick={() => navigate("sources")}>
                    Vezi configurarea
                  </Button>
                )}
              </div>
            )}
            {store.needsSetup && (
              <Alert className="notice cloud-onboarding">
                <Cloud />
                <AlertTitle>Pregătește carnetul contului</AlertTitle>
                <AlertDescription>
                  Contul {store.user?.email} nu are încă un carnet. Alege datele
                  cu care începi; carnetul local rămâne păstrat.
                  <div className="onboarding-actions">
                    <Button
                      disabled={store.saving}
                      onClick={() => initialize(true)}
                    >
                      Transferă carnetul local
                    </Button>
                    <Button
                      variant="outline"
                      disabled={store.saving}
                      onClick={() => initialize(false)}
                    >
                      Folosește fișa inițială
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {!store.ready ? (
              <div className="loading-state" role="status">
                <LoaderCircle className="animate-spin" />
                <p>
                  {store.error
                    ? "Carnetul nu poate fi încărcat. Poți reîncerca sau te poți deconecta."
                    : "Se încarcă carnetul…"}
                </p>
              </div>
            ) : (
              <>
                {view === "overview" && (
                  <Overview
                    tasks={tasks}
                    onDetail={(id) => open("plan", id)}
                    onLog={(id) => open("event", id)}
                    onSchedule={(filter) => navigate("schedule", filter)}
                    disabled={disabled}
                  />
                )}
                {view === "schedule" && (
                  <Schedule
                    key={scheduleFilter}
                    initialFilter={scheduleFilter}
                    tasks={tasks}
                    onDetail={(id) => open("plan", id)}
                    onLog={(id) => open("event", id)}
                    disabled={disabled}
                  />
                )}
                {view === "history" && (
                  <History
                    state={store.state}
                    onEdit={(id) => open("event", undefined, id)}
                    onExport={download}
                    disabled={disabled}
                  />
                )}
                {view === "sources" && (
                  <Sources
                    configured={firebaseConfigured}
                    onExport={download}
                    onImport={() => fileInput.current?.click()}
                    onLogin={authenticate}
                    canUndo={store.canUndo}
                    onUndo={undo}
                    disabled={disabled}
                  />
                )}
              </>
            )}
            <footer>
              <span>Bandit / Carnet personal</span>
              <span>
                {store.saving ? (
                  "Salvare în curs…"
                ) : store.user ? (
                  <>
                    <Check />
                    {store.user.email}
                  </>
                ) : (
                  "Km sau timp — primul prag atins."
                )}
              </span>
            </footer>
          </div>
        </main>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => void upload(event.target.files?.[0])}
        className="sr-only"
        aria-label="Fișier backup CSV"
      />
      <Dialog
        open={Boolean(editor && editor.type !== "delete")}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        {editor && editor.type !== "delete" && (
          <DialogContent
            className="editor-dialog"
            showCloseButton={!store.saving}
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            {editor?.type === "event" && (
              <EventForm
                key={`${editor.type}-${editor.eventId || editor.taskId || ""}`}
                state={editor.state}
                taskId={editor.taskId}
                event={selectedEvent}
                busy={store.saving}
                onSave={save}
                onClose={close}
                onDelete={(id) => {
                  setFormError("");
                  setEditor({ ...editor, type: "delete", eventId: id });
                }}
              />
            )}
            {editor?.type === "plan" && (
              <PlanForm
                key={editor.taskId}
                state={editor.state}
                taskId={editor.taskId!}
                busy={store.saving}
                onSave={save}
                onClose={close}
                onLog={() => {
                  setFormError("");
                  setEditor({ ...editor, type: "event" });
                }}
              />
            )}
            {editor?.type === "km" && (
              <OdometerForm
                state={editor.state}
                busy={store.saving}
                onSave={save}
                onClose={close}
              />
            )}
            {editor?.type === "import" && editor.imported && (
              <>
                <p className="import-name">
                  Fișier: <strong>{editor.filename}</strong>
                </p>
                <div className="import-preview">
                  <strong>{km(editor.imported.vehicle.km)}</strong>
                  <span>
                    {editor.imported.events.length} intervenții ·{" "}
                    {Object.keys(editor.imported.overrides).length} planuri
                    personale
                  </span>
                </div>
                <p className="form-help">
                  Importul va înlocui carnetul{" "}
                  {store.user ? "contului tău" : "din acest browser"}. Exportă o
                  copie înainte pentru a păstra datele actuale.
                </p>
                <div className="form-actions">
                  <Button variant="outline" onClick={download}>
                    Exportă copia actuală
                  </Button>
                  <Button
                    disabled={store.saving}
                    onClick={() => void save(editor.imported!, true)}
                  >
                    {store.saving ? "Se importă…" : "Înlocuiește carnetul"}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        )}
      </Dialog>
      <AlertDialog
        open={editor?.type === "delete"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi intervenția?</AlertDialogTitle>
            <AlertDialogDescription>
              Scadența se va calcula din intervenția confirmată anterioară. Poți
              anula ștergerea din Fișă și date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={store.saving}>
              Renunță
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={store.saving}
              onClick={(event) => {
                event.preventDefault();
                if (editor) {
                  const next = structuredClone(editor.state);
                  next.events = next.events.filter(
                    (item) => item.id !== editor.eventId,
                  );
                  void save(next);
                }
              }}
            >
              Șterge intervenția
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {store.canUndo && (
        <Button
          variant="outline"
          size="sm"
          className="undo-floating"
          disabled={store.saving || !store.ready}
          onClick={undo}
        >
          <RotateCcw />
          Anulează ultima modificare
        </Button>
      )}
      <Toaster theme="light" richColors closeButton position="bottom-right" />
    </>
  );
}

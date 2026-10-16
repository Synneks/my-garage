import { useLanguagePreference } from "@/hooks/use-language-preference";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { TranslatedMessage } from "@/components/translated-message";
import { migrateNotebook, notebookTasks, removeTask } from "@/lib/garage";
import { LandingPage } from "@/components/landing-page";
import { AppError } from "@/lib/app-error";
import type { TranslationKey } from "@/i18n";
import { useTranslation } from "react-i18next";
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
  Plus,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/account-menu";
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
import {
  EventForm,
  OdometerForm,
  TaskForm,
  VehicleForm,
} from "@/components/notebook-forms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Overview,
  Schedule,
  Sources,
} from "@/components/notebook-views";
import { useNotebook } from "@/hooks/use-notebook";
import { TASKS } from "@/data";
import { evaluate, today } from "@/engine";
import { exportCsv, importCsv } from "@/csv";
import {
  appEnvironment,
  firebaseProjectId,
  firebaseMessage,
  login,
  logout,
} from "@/lib/firebase";
import { km } from "@/lib/format";
import type { Notebook } from "@/types";

type View = "overview" | "schedule" | "history" | "sources";
interface Editor {
  type:
    | "event"
    | "plan"
    | "task"
    | "km"
    | "import"
    | "delete"
    | "delete-task"
    | "vehicle"
    | "add-vehicle"
    | "delete-vehicle";
  state: Notebook;
  version: string;
  taskId?: string;
  eventId?: string;
  imported?: Notebook;
  filename?: string;
}
export default function App() {
  return (
    <ThemeProvider>
      <NotebookApp />
    </ThemeProvider>
  );
}

function NotebookApp() {
  const { t, i18n } = useTranslation();
  const nav = [
    {
      id: "overview" as const,
      icon: LayoutDashboard,
      label: t("nav.overview"),
    },
    { id: "schedule" as const, icon: ListChecks, label: t("nav.schedule") },
    { id: "history" as const, icon: HistoryIcon, label: t("nav.history") },
    { id: "sources" as const, icon: BookOpen, label: t("nav.sources") },
  ];
  const headings: Record<View, [string, string]> = {
    overview: [t("app.overview_title"), t("app.overview_description")],
    schedule: [t("nav.schedule"), t("app.schedule_description")],
    history: [t("nav.history"), t("app.history_description")],
    sources: [t("nav.sources"), t("app.sources_description")],
  };

  const store = useNotebook();
  const languagePreference = useLanguagePreference(store.user?.uid);
  useEffect(() => {
    document.documentElement.lang =
      i18n.resolvedLanguage === "ro" ? "ro" : "en";
    document.title = t("app.document_title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("app.document_description"));
  }, [t, i18n.resolvedLanguage]);
  const [view, setView] = useState<View>("overview");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [formError, setFormError] = useState<TranslationKey | "">("");
  const [authBusy, setAuthBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const displayedState = store.state;
  const tasks = notebookTasks(displayedState).map((task) =>
    evaluate(task, displayedState),
  );
  const disabled =
    !store.user || !store.ready || store.saving || !store.hasVehicle;
  const vehicleLabel = [store.state.vehicle.make, store.state.vehicle.model]
    .filter(Boolean)
    .join(" ");
  const deleting = editor?.type.startsWith("delete") ?? false;

  // An editor belongs to exactly one account; close it when that account changes.
  useEffect(() => {
    setEditor(null);
    setFormError("");
  }, [store.user?.uid, store.vehicleId]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [store.user?.uid]);
  function navigate(next: View, filter = "all") {
    setView(next);
    setScheduleFilter(filter);
    window.scrollTo(0, 0);
  }
  function open(type: Editor["type"], taskId?: string, eventId?: string) {
    if (!store.user || !store.ready || store.saving) return;
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
  async function save(next: Notebook) {
    if (!editor) return;
    try {
      if (editor.type === "add-vehicle") await store.createVehicle(next);
      else await store.commit(next, editor.version);
      setEditor(null);
      setFormError("");
      toast.success(<TranslatedMessage message="toast.saved_account" />);
    } catch (error) {
      setFormError(firebaseMessage(error));
    }
  }
  function download() {
    if (!store.hasVehicle) return;
    const url = URL.createObjectURL(
      new Blob([exportCsv(store.state)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `garage-${today()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(<TranslatedMessage message="toast.exported" />);
  }
  async function upload(file?: File) {
    if (!file || disabled) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new AppError("errors.csv_size");
      const imported = migrateNotebook(importCsv(await file.text(), TASKS));
      setFormError("");
      setEditor({
        type: "import",
        state: structuredClone(store.state),
        version: store.version,
        imported,
        filename: file.name,
      });
    } catch (error) {
      toast.error(<TranslatedMessage message={firebaseMessage(error)} />);
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  async function authenticate() {
    setAuthBusy(true);
    try {
      await login();
    } catch (error) {
      toast.error(<TranslatedMessage message={firebaseMessage(error)} />);
    } finally {
      setAuthBusy(false);
    }
  }
  async function signOut() {
    if (store.saving) return;
    setAuthBusy(true);
    try {
      await logout();
      toast.success(<TranslatedMessage message="toast.signed_out" />);
    } catch (error) {
      toast.error(<TranslatedMessage message={firebaseMessage(error)} />);
    } finally {
      setAuthBusy(false);
    }
  }
  async function initialize() {
    try {
      const local = store.localState();
      if (!local) return;
      await store.createVehicle(local);
      toast.success(<TranslatedMessage message="toast.initialized" />);
    } catch (error) {
      toast.error(<TranslatedMessage message={firebaseMessage(error)} />);
    }
  }
  async function undo() {
    try {
      await store.undoLast();
      toast.success(<TranslatedMessage message="toast.undone" />);
    } catch (error) {
      toast.error(<TranslatedMessage message={firebaseMessage(error)} />);
    }
  }
  const selectedEvent = editor?.state.events.find(
    (event) => event.id === editor.eventId,
  );
  const selectedTask =
    editor &&
    notebookTasks(editor.state).find((task) => task.id === editor.taskId);
  const title =
    editor?.type === "event"
      ? selectedEvent
        ? t("editor.edit_event")
        : t("editor.add_event")
      : editor?.type === "add-vehicle"
        ? t("garage.add_vehicle")
        : editor?.type === "vehicle"
          ? t("garage.edit_vehicle")
          : editor?.type === "task"
            ? t("garage.add_task")
            : editor?.type === "plan"
              ? selectedTask?.name || t("editor.plan")
              : editor?.type === "km"
                ? t("editor.odometer")
                : t("editor.import");
  const description =
    editor?.type === "event"
      ? t("editor.event_description")
      : editor?.type === "vehicle" || editor?.type === "add-vehicle"
        ? t("garage.vehicle_description")
        : editor?.type === "plan" || editor?.type === "task"
          ? t("garage.task_description")
          : editor?.type === "km"
            ? t("editor.odometer_description")
            : t("editor.import_description");

  if (!store.user) {
    return (
      <>
        <LandingPage
          onSignIn={authenticate}
          onLanguageChange={languagePreference.selectLanguage}
          busy={authBusy}
          ready={store.ready}
          development={appEnvironment === "development"}
          error={store.error}
        />
        <Toaster richColors closeButton position="bottom-right" />
      </>
    );
  }

  return (
    <>
      <div className="app-shell">
        <aside
          className={`sidebar ${appEnvironment === "development" ? "sidebar-development" : ""}`}
        >
          <button className="brand" onClick={() => navigate("overview")}>
            <span className="brand-mark">
              G<span>.</span>
            </span>
            <span>
              GARAGE<small>{t("app.brand")}</small>
            </span>
          </button>
          <p className="garage-label">{t("app.vehicle")}</p>
          <div className="vehicle-card">
            {store.hasVehicle ? (
              <>
                <p>
                  {store.state.vehicle.make} / {store.state.vehicle.year}
                </p>
                <h2>{store.state.vehicle.model}</h2>
              </>
            ) : (
              <p>{t("garage.no_vehicle")}</p>
            )}
          </div>
          <nav aria-label={t("nav.label")}>
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
          <div className="sidebar-footer">
            <div className="sidebar-language">
              <LanguageSelector onChange={languagePreference.selectLanguage} />
            </div>
            <div className="sidebar-bottom">
              <Separator className="sidebar-separator" />
              {!store.user && (
                <>
                  <div className="storage-label">
                    <CloudOff />
                    <span>{t("garage.guest_storage")}</span>
                  </div>
                  <p>{t("garage.account_storage")}</p>
                </>
              )}
              <Button
                variant="outline"
                onClick={download}
                disabled={!store.hasVehicle}
                className="sidebar-export"
              >
                <Download />
                {t("common.export_csv")}
              </Button>
            </div>
          </div>
        </aside>
        <main className="main-area">
          <header className="topbar">
            <div className="breadcrumb">
              {t("app.garage")}
              <span>/</span> {vehicleLabel || t("garage.no_vehicle")}
            </div>
            <div className="topbar-controls">
              <button
                className="odometer"
                onClick={() => open("km")}
                disabled={disabled}
              >
                <span>{t("app.odometer")}</span>
                <strong>{km(store.state.vehicle.km)}</strong>
                <small>{t("common.update")}</small>
              </button>
              <ModeToggle />
              {store.user ? (
                <AccountMenu
                  key={store.user.uid}
                  user={store.user}
                  disabled={authBusy || store.saving}
                  onSignOut={signOut}
                />
              ) : (
                <Button
                  variant="outline"
                  className="account-button"
                  disabled={authBusy || !store.ready}
                  onClick={authenticate}
                  aria-label={t(appEnvironment === "development" ? "auth.test" : "auth.google")}
                >
                  {authBusy ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <LogIn />
                  )}
                  <span>{t(appEnvironment === "development" ? "auth.test" : "auth.google")}</span>
                </Button>
              )}
            </div>
          </header>
          <div className="page-content">
            {languagePreference.syncState === "pending" && (
              <p className="language-sync" role="status">
                {t("language.pending")}
              </p>
            )}
            {languagePreference.syncState === "failed" && (
              <Alert className="notice" role="alert">
                <AlertDescription>
                  {t("language.failed")}{" "}
                  <Button variant="link" onClick={languagePreference.retry}>
                    {t("common.retry")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {store.user && store.ready && (
              <div className="vehicle-toolbar">
                {store.vehicles.length > 0 && (
                  <>
                    <Select
                      value={store.vehicleId}
                      onValueChange={store.selectVehicle}
                      disabled={store.saving}
                    >
                      <SelectTrigger aria-label={t("garage.select_vehicle")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {store.vehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.make} {vehicle.model} · {vehicle.year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => open("vehicle")}
                      disabled={disabled}
                    >
                      {t("garage.edit_vehicle")}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => open("add-vehicle")}
                  disabled={store.saving}
                >
                  <Plus />
                  {t("garage.add_vehicle")}
                </Button>
              </div>
            )}
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  {store.hasVehicle
                    ? `${vehicleLabel} · ${store.state.vehicle.year}`
                    : t("app.garage")}
                </p>
                <h1>{headings[view][0]}</h1>
                <p>{headings[view][1]}</p>
              </div>
              <div className="page-actions">
                {view === "schedule" && (
                  <Button onClick={() => open("task")} disabled={disabled}>
                    <Plus />
                    {t("garage.add_task")}
                  </Button>
                )}
                <Button
                  onClick={() =>
                    open(store.hasVehicle ? "event" : "add-vehicle")
                  }
                  disabled={!store.user || !store.ready || store.saving}
                  size="lg"
                >
                  <Plus />
                  {store.hasVehicle
                    ? t("app.add_event")
                    : t("garage.add_vehicle")}
                </Button>
              </div>
            </div>
            {appEnvironment === "development" && (
              <Alert className="notice">
                <Cloud />
                <AlertTitle>{t("app.development")}</AlertTitle>
                <AlertDescription>
                  {t("app.development_description", {
                    project: firebaseProjectId,
                  })}
                </AlertDescription>
              </Alert>
            )}
            {store.error && (
              <Alert variant="destructive" className="notice">
                <AlertTriangle />
                <AlertTitle>{t("app.save_attention")}</AlertTitle>
                <AlertDescription>
                  {t(store.error || "errors.unexpected")}
                  <Button
                    variant="link"
                    onClick={() => window.location.reload()}
                  >
                    {t("common.reload")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {!store.user && store.ready && (
              <div className="local-notice">
                <CloudOff />
                <span>
                  {t(
                    store.isPreview
                      ? "garage.preview_notice"
                      : "garage.sign_in_notice",
                  )}
                </span>
                {store.isPreview && (
                  <Button
                    variant="link"
                    onClick={authenticate}
                    disabled={authBusy}
                  >
                    {t(appEnvironment === "development" ? "auth.test" : "auth.google")}
                  </Button>
                )}
              </div>
            )}
            {store.user &&
              store.ready &&
              !store.hasVehicle &&
              store.hasLocal && (
                <Alert className="notice cloud-onboarding">
                  <Cloud />
                  <AlertTitle>{t("app.setup_log")}</AlertTitle>
                  <AlertDescription>
                    {t("garage.transfer_description")}
                    <div className="onboarding-actions">
                      <Button
                        disabled={store.saving}
                        onClick={() => initialize()}
                      >
                        {t("app.transfer")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={store.saving}
                        onClick={() => open("add-vehicle")}
                      >
                        {t("garage.add_vehicle")}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            {!store.ready ? (
              <div className="loading-state" role="status">
                <LoaderCircle className="animate-spin" />
                <p>{store.error ? t("app.load_failed") : t("app.loading")}</p>
              </div>
            ) : (
              <>
                {view !== "sources" && !store.hasVehicle && (
                  <div className="garage-empty">
                    <Gauge />
                    <h2>{t("garage.empty_title")}</h2>
                    <p>
                      {t(
                        store.user
                          ? "garage.empty_description"
                          : "garage.sign_in_notice",
                      )}
                    </p>
                    <Button
                      onClick={
                        store.user ? () => open("add-vehicle") : authenticate
                      }
                      disabled={authBusy || store.saving}
                    >
                      {store.user ? t("garage.add_vehicle") : t(appEnvironment === "development" ? "auth.test" : "auth.google")}
                    </Button>
                  </div>
                )}
                {store.hasVehicle && view === "overview" && (
                  <Overview
                    tasks={tasks}
                    onDetail={(id) => open("plan", id)}
                    onLog={(id) => open("event", id)}
                    onSchedule={(filter) => navigate("schedule", filter)}
                    disabled={disabled}
                  />
                )}
                {store.hasVehicle && view === "schedule" && (
                  <Schedule
                    key={`${store.vehicleId}-${scheduleFilter}`}
                    initialFilter={scheduleFilter}
                    tasks={tasks}
                    onDetail={(id) => open("plan", id)}
                    onLog={(id) => open("event", id)}
                    disabled={disabled}
                  />
                )}
                {store.hasVehicle && view === "history" && (
                  <History
                    state={displayedState}
                    onEdit={(id) => open("event", undefined, id)}
                    onExport={download}
                    disabled={disabled}
                  />
                )}
                {view === "sources" && (
                  <Sources
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
              <span>{t("app.footer")}</span>
              <span>
                {store.saving ? (
                  t("app.saving")
                ) : store.user ? (
                  <>
                    <Check />
                    {store.user.email}
                  </>
                ) : (
                  t("app.threshold")
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
        aria-label={t("import.file_label")}
      />
      <Dialog
        open={Boolean(editor && !deleting)}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        {editor && !deleting && (
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
                <AlertDescription>
                  {t(formError || "errors.unexpected")}
                </AlertDescription>
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
            {(editor?.type === "plan" || editor?.type === "task") && (
              <TaskForm
                key={editor.taskId || "new"}
                state={editor.state}
                taskId={editor.taskId}
                busy={store.saving}
                onSave={save}
                onClose={close}
                onDelete={() => {
                  setFormError("");
                  setEditor({ ...editor, type: "delete-task" });
                }}
                onLog={() => {
                  setFormError("");
                  setEditor({ ...editor, type: "event" });
                }}
              />
            )}
            {(editor?.type === "vehicle" || editor?.type === "add-vehicle") && (
              <VehicleForm
                state={editor.state}
                adding={editor.type === "add-vehicle"}
                busy={store.saving}
                onSave={save}
                onClose={close}
                onDelete={() => {
                  setFormError("");
                  setEditor({ ...editor, type: "delete-vehicle" });
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
                  {t("import.file")}
                  <strong>{editor.filename}</strong>
                </p>
                <div className="import-preview">
                  <strong>{km(editor.imported.vehicle.km)}</strong>
                  <span>
                    {t("import.count_note", {
                      events: t("counts.events", {
                        count: editor.imported.events.length,
                      }),
                      plans: t("counts.plans", {
                        count: Object.keys(editor.imported.overrides).length,
                      }),
                    })}
                  </span>
                </div>
                <p className="form-help">
                  {t(
                    store.user
                      ? "import.account_warning"
                      : "import.browser_warning",
                  )}
                </p>
                <div className="form-actions">
                  <Button variant="outline" onClick={download}>
                    {t("import.export_current")}
                  </Button>
                  <Button
                    disabled={store.saving}
                    onClick={() => void save(editor.imported!)}
                  >
                    {store.saving ? t("import.busy") : t("import.replace")}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        )}
      </Dialog>
      <AlertDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                editor?.type === "delete-task"
                  ? "garage.delete_task_title"
                  : editor?.type === "delete-vehicle"
                    ? "garage.delete_vehicle_title"
                    : "delete.title",
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                editor?.type === "delete-task"
                  ? "garage.delete_task_description"
                  : editor?.type === "delete-vehicle"
                    ? "garage.delete_vehicle_description"
                    : "delete.description",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(formError || "errors.unexpected")}
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={store.saving}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={store.saving}
              onClick={(event) => {
                event.preventDefault();
                if (editor) {
                  if (editor.type === "delete-task") {
                    void save(removeTask(editor.state, editor.taskId!));
                    return;
                  }
                  if (editor.type === "delete-vehicle") {
                    void store
                      .removeVehicle(editor.version)
                      .then(() => {
                        setEditor(null);
                        toast.success(
                          <TranslatedMessage message="toast.saved_account" />,
                        );
                      })
                      .catch((error) => setFormError(firebaseMessage(error)));
                    return;
                  }
                  const next = structuredClone(editor.state);
                  next.events = next.events.filter(
                    (item) => item.id !== editor.eventId,
                  );
                  void save(next);
                }
              }}
            >
              {t(
                editor?.type === "delete" ? "delete.confirm" : "common.delete",
              )}
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
          {t("common.undo")}
        </Button>
      )}
      <Toaster richColors closeButton position="bottom-right" />
    </>
  );
}

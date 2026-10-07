import { useLanguagePreference } from "@/hooks/use-language-preference";
import { LanguageSelector } from "@/components/language-selector";
import { TranslatedMessage } from "@/components/translated-message";
import { localizedTask, taskLabel } from "@/lib/task-labels";
import { AppError } from "@/lib/app-error.js";
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
  type: "event" | "plan" | "km" | "import" | "delete";
  state: Notebook;
  version: string;
  taskId?: string;
  eventId?: string;
  imported?: Notebook;
  filename?: string;
}
export default function App() {
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
  const tasks = TASKS.map((task) =>
    localizedTask(
      t,
      evaluate(task, store.state),
      Object.hasOwn(store.state.overrides[task.id] ?? {}, "notes"),
    ),
  );
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
        <TranslatedMessage
          message={store.user ? "toast.saved_account" : "toast.saved_browser"}
        />,
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
    toast.success(<TranslatedMessage message="toast.exported" />);
  }
  async function upload(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new AppError("errors.csv_size");
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
      toast.error(<TranslatedMessage message={firebaseMessage(error)} />);
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
  async function initialize(useLocal: boolean) {
    try {
      await store.commit(
        useLocal ? store.localState() : createInitialState(),
        store.version,
      );
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
  const selectedTask = TASKS.find((task) => task.id === editor?.taskId);
  const title =
    editor?.type === "event"
      ? selectedEvent
        ? t("editor.edit_event")
        : t("editor.add_event")
      : editor?.type === "plan"
        ? (selectedTask ? taskLabel(t, selectedTask.id) : "") ||
          t("editor.plan")
        : editor?.type === "km"
          ? t("editor.odometer")
          : t("editor.import");
  const description =
    editor?.type === "event"
      ? t("editor.event_description")
      : editor?.type === "plan"
        ? t("editor.plan_description")
        : editor?.type === "km"
          ? t("editor.odometer_description")
          : t("editor.import_description");

  return (
    <>
      <div className="app-shell">
        <aside
          className={`sidebar ${appEnvironment === "staging" ? "sidebar-staging" : ""}`}
        >
          <button className="brand" onClick={() => navigate("overview")}>
            <span className="brand-mark">
              B<span>.</span>
            </span>
            <span>
              BANDIT<small>{t("app.brand")}</small>
            </span>
          </button>
          <p className="garage-label">{t("app.vehicle")}</p>
          <div className="vehicle-card">
            <p>SUZUKI / 2005</p>
            <h2>
              Bandit <span>650 S</span>
            </h2>
            <span className="model-tag">GSF650S · K5</span>
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
              <div className="storage-label">
                {store.user ? <Cloud /> : <CloudOff />}
                <span>
                  {store.user ? t("storage.account") : t("storage.device")}
                </span>
              </div>
              <p>{store.user ? t("storage.sync") : t("storage.backup")}</p>
              <Button
                variant="outline"
                onClick={download}
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
              <span>/</span> Suzuki Bandit 650 S
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
                  aria-label={
                    firebaseConfigured ? t("auth.google") : t("auth.configure")
                  }
                >
                  {authBusy ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <LogIn />
                  )}
                  <span>
                    {firebaseConfigured
                      ? t("auth.google")
                      : t("auth.configure")}
                  </span>
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
                {t("app.add_event")}
              </Button>
            </div>
            {appEnvironment !== "production" && (
              <Alert className="notice">
                <Cloud />
                <AlertTitle>{t("app.staging")}</AlertTitle>
                <AlertDescription>
                  {t("app.staging_description", { project: firebaseProjectId })}
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
                  {firebaseConfigured
                    ? t("storage.local_configured")
                    : t("storage.local_unconfigured")}
                </span>
                {!firebaseConfigured && (
                  <Button variant="link" onClick={() => navigate("sources")}>
                    {t("app.view_setup")}
                  </Button>
                )}
              </div>
            )}
            {store.needsSetup && (
              <Alert className="notice cloud-onboarding">
                <Cloud />
                <AlertTitle>{t("app.setup_log")}</AlertTitle>
                <AlertDescription>
                  {t("app.onboarding", { email: store.user?.email ?? "" })}
                  <div className="onboarding-actions">
                    <Button
                      disabled={store.saving}
                      onClick={() => initialize(true)}
                    >
                      {t("app.transfer")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={store.saving}
                      onClick={() => initialize(false)}
                    >
                      {t("app.initial")}
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
                    onClick={() => void save(editor.imported!, true)}
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
        open={editor?.type === "delete"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.description")}
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
                  const next = structuredClone(editor.state);
                  next.events = next.events.filter(
                    (item) => item.id !== editor.eventId,
                  );
                  void save(next);
                }
              }}
            >
              {t("delete.confirm")}
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
      <Toaster theme="light" richColors closeButton position="bottom-right" />
    </>
  );
}

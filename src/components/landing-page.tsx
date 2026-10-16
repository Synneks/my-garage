import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CarFront,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  Cloud,
  Eye,
  Flag,
  Gauge,
  History,
  LoaderCircle,
  LockKeyhole,
  Motorbike,
  Wrench,
} from "lucide-react";
import type { Language, TranslationKey } from "@/i18n";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/language-selector";
import { ModeToggle } from "@/components/mode-toggle";
import { translatedPreviewNotebook } from "@/lib/preview-notebook.js";
import { dateLabel, km } from "@/lib/format";
import { evaluate } from "@/engine.js";
import type { EvaluatedTask } from "@/types";
import "@/landing.css";

const features = [
  { id: "watch", icon: Eye, number: "01" },
  { id: "mileage", icon: Gauge, number: "02" },
  { id: "history", icon: History, number: "03" },
] as const;
type Preview = (typeof features)[number]["id"];

interface LandingPageProps {
  onSignIn: () => void;
  onLanguageChange: (language: Language) => void;
  busy: boolean;
  ready: boolean;
  development: boolean;
  error: TranslationKey | "";
}

function StartButton({
  onSignIn,
  busy,
  ready,
}: Pick<LandingPageProps, "onSignIn" | "busy" | "ready">) {
  const { t } = useTranslation();
  return (
    <Button
      className="landing-start"
      size="lg"
      onClick={onSignIn}
      disabled={busy || !ready}
    >
      {busy && <LoaderCircle className="animate-spin" />}
      {t(busy ? "landing.signing_in" : "landing.start")}
      {!busy && <ArrowRight />}
    </Button>
  );
}

export function LandingPage({
  onSignIn,
  onLanguageChange,
  busy,
  ready,
  development,
  error,
}: LandingPageProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<Preview>("watch");
  const demo = translatedPreviewNotebook(t);
  const tasks = demo.tasks!.map((task) => evaluate(task, demo));
  const watched = tasks.filter((task) => task.priority === "watch");
  const milestones = tasks
    .filter(
      (task): task is EvaluatedTask & { dueKm: number; remainingKm: number } =>
        task.dueKm !== null && task.remainingKm !== null,
    )
    .sort((a, b) => a.dueKm - b.dueKm);
  const oilMilestone = milestones.find((task) => task.id === "demo-oil")!;
  const records = [...demo.events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="landing-page" id="top">
      <a className="landing-skip" href="#main">
        {t("landing.skip")}
      </a>
      <header className="landing-header landing-container">
        <a href="#top" className="landing-brand" aria-label={t("app.garage")}>
          <span className="landing-brand-mark" aria-hidden="true">
            G<span>.</span>
          </span>
          <span>
            GARAGE<small>{t("app.brand")}</small>
          </span>
        </a>
        <nav className="landing-nav" aria-label={t("nav.label")}>
          <a href="#features">{t("landing.nav_features")}</a>
          <a href="#how-it-works">{t("landing.nav_how")}</a>
        </nav>
        <div className="landing-controls">
          <LanguageSelector onChange={onLanguageChange} />
          <ModeToggle />
          <Button
            variant="ghost"
            className="landing-sign-in"
            aria-label={t(development ? "auth.test" : "auth.google")}
            onClick={onSignIn}
            disabled={busy || !ready}
          >
            <span>{t(development ? "auth.test" : "landing.sign_in")}</span>
            <ArrowUpRight />
          </Button>
        </div>
      </header>

      {development && (
        <p className="landing-environment landing-container">
          {t("app.development")}
        </p>
      )}
      {error && (
        <p className="landing-error landing-container" role="alert">
          {t(error)}
        </p>
      )}

      <main id="main" tabIndex={-1}>
        <section
          className="landing-hero landing-container"
          aria-labelledby="landing-title"
        >
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">
              <span />
              {t("landing.eyebrow")}
            </p>
            <h1 id="landing-title">
              {t("landing.title")} <em>{t("landing.title_accent")}</em>
            </h1>
            <p className="landing-intro">{t("landing.description")}</p>
            <div className="landing-hero-actions">
              <StartButton onSignIn={onSignIn} busy={busy} ready={ready} />
              <a href="#features" className="landing-text-link">
                {t("landing.explore")}
                <ArrowDown />
              </a>
            </div>
            <p className="landing-signup-note">
              <LockKeyhole />
              {t(development ? "auth.dev_note" : "landing.signup_note")}
            </p>
            <div className="landing-vehicle-note">
              <span aria-hidden="true">
                <CarFront />
                <Motorbike />
              </span>
              <p>
                {t("landing.vehicles")}
                <small>{t("landing.vehicles_note")}</small>
              </p>
            </div>
          </div>

          <div className="landing-showcase">
            <div className="landing-showcase-label">
              <span />
              {t("landing.live_preview")}
            </div>
            <div
              className="landing-demo"
              id="preview"
              role="region"
              aria-label={t("landing.demo_label")}
            >
              <div className="landing-demo-bar">
                <span className="landing-demo-brand">
                  G<span>.</span>
                </span>
                <span>{t("landing.sample_garage")}</span>
                <span className="landing-demo-tag">
                  {t("landing.fictional")}
                </span>
              </div>
              <div className="landing-demo-body">
                <div className="landing-demo-vehicle">
                  <span className="landing-car-icon">
                    <CarFront />
                  </span>
                  <div>
                    <small>{t("landing.vehicle_label")}</small>
                    <h2>{demo.vehicle.model}</h2>
                  </div>
                  <span className="landing-saved">
                    <Cloud />
                    <span>{t("landing.organized")}</span>
                  </span>
                </div>
                <div className="landing-demo-stats">
                  <div>
                    <span>{t("app.odometer")}</span>
                    <strong>{km(demo.vehicle.km)}</strong>
                  </div>
                  <div>
                    <span>{t("landing.next_at")}</span>
                    <strong>{km(milestones[0].dueKm)}</strong>
                  </div>
                </div>
                <div
                  className="landing-preview-tabs"
                  role="group"
                  aria-label={t("landing.preview_views")}
                >
                  {features.map(({ id, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={preview === id}
                      aria-controls="landing-preview-content"
                      onClick={() => setPreview(id)}
                    >
                      <Icon />
                      {t(`landing.${id}_tab`)}
                      {id === "watch" && <span>{watched.length}</span>}
                    </button>
                  ))}
                </div>
                <div
                  className="landing-preview-content"
                  id="landing-preview-content"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="landing-preview-heading">
                    <h3>{t(`landing.${preview}_preview_title`)}</h3>
                    <span>{t(`landing.${preview}_preview_note`)}</span>
                  </div>
                  {preview === "watch" && (
                    <ul className="landing-watch-list">
                      {watched.map((task) => (
                        <li key={task.id}>
                          <span className="landing-watch-icon">
                            <Eye />
                          </span>
                          <div>
                            <strong>{task.name}</strong>
                            <p>{task.notes}</p>
                          </div>
                          <span className="landing-status">
                            {t("statuses.watch")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {preview === "mileage" && (
                    <ol className="landing-mileage-list">
                      {milestones.slice(0, 3).map((task) => (
                        <li key={task.id}>
                          <span className="landing-mileage-dot" />
                          <div>
                            <strong>{task.name}</strong>
                            <span>
                              {t("format.remaining_km", {
                                distance: km(task.remainingKm),
                              })}
                            </span>
                          </div>
                          <strong>{km(task.dueKm)}</strong>
                        </li>
                      ))}
                    </ol>
                  )}
                  {preview === "history" && (
                    <ul className="landing-history-list">
                      {records.map((event) => (
                        <li key={event.id}>
                          <CircleCheck />
                          <div>
                            <strong>{event.taskName}</strong>
                            <span>
                              {event.action} · {dateLabel(event.date)}
                            </span>
                          </div>
                          <strong>{km(event.km)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="landing-demo-footer">
                  <CheckCheck />
                  {t("landing.demo_footer")}
                  <ChevronRight />
                </div>
              </div>
            </div>
            <div className="landing-showcase-caption">
              <span>↳</span>
              <p>{t("landing.demo_caption")}</p>
            </div>
          </div>
        </section>

        <div className="landing-benefit-strip">
          <div className="landing-container">
            <span>
              <Wrench />
              {t("landing.benefit_records")}
            </span>
            <span>
              <Flag />
              {t("landing.benefit_plans")}
            </span>
            <span>
              <Cloud />
              {t("landing.benefit_sync")}
            </span>
          </div>
        </div>

        <section
          className="landing-features landing-container"
          id="features"
          aria-labelledby="features-title"
        >
          <div className="landing-section-heading">
            <div>
              <p className="landing-eyebrow">{t("landing.features_eyebrow")}</p>
              <h2 id="features-title">{t("landing.features_title")}</h2>
            </div>
            <p>{t("landing.features_description")}</p>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ id, icon: Icon, number }) => (
              <article
                className={`landing-feature landing-feature-${id}`}
                key={id}
              >
                <div className="landing-feature-top">
                  <span>
                    <Icon />
                  </span>
                  <small>{number}</small>
                </div>
                <h3>{t(`landing.${id}_title`)}</h3>
                <p>{t(`landing.${id}_description`)}</p>
                <div
                  className="landing-feature-example"
                  aria-label={t("landing.example")}
                >
                  {id === "watch" && (
                    <>
                      <span className="landing-example-label">
                        <span className="landing-small-dot" />
                        {t("landing.watch_example_label")}
                      </span>
                      <strong>{watched[0].name}</strong>
                      <span>{watched[0].notes}</span>
                    </>
                  )}
                  {id === "mileage" && (
                    <>
                      <span className="landing-example-label">
                        {t("landing.mileage_example_label")}
                      </span>
                      <strong>
                        {km(oilMilestone.dueKm)}
                        <small>{oilMilestone.name}</small>
                      </strong>
                      <div className="landing-mileage-track">
                        <span />
                      </div>
                      <span>
                        {t("format.remaining_km", {
                          distance: km(oilMilestone.remainingKm),
                        })}
                      </span>
                    </>
                  )}
                  {id === "history" && (
                    <>
                      <span className="landing-example-label">
                        <Check />
                        {t("landing.history_example_label")}
                      </span>
                      <strong>
                        {records[0].taskName}
                        <small>{km(records[0].km)}</small>
                      </strong>
                      <span>{records[0].notes}</span>
                    </>
                  )}
                </div>
                <a
                  className="landing-feature-link"
                  href="#preview"
                  onClick={() => setPreview(id)}
                >
                  {t(`landing.${id}_link`)}
                  <ArrowUpRight />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section
          className="landing-how landing-container"
          id="how-it-works"
          aria-labelledby="how-title"
        >
          <div className="landing-how-intro">
            <p className="landing-eyebrow">{t("landing.how_eyebrow")}</p>
            <h2 id="how-title">{t("landing.how_title")}</h2>
            <p>{t("landing.how_description")}</p>
          </div>
          <ol className="landing-steps">
            {(["vehicle", "record", "plan"] as const).map((step, index) => (
              <li key={step}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{t(`landing.step_${step}_title`)}</h3>
                  <p>
                    {t(
                      development && step === "vehicle"
                        ? "landing.dev_step_vehicle_description"
                        : `landing.step_${step}_description`,
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="landing-cta landing-container"
          aria-labelledby="cta-title"
        >
          <div className="landing-cta-inner">
            <div className="landing-cta-route" aria-hidden="true">
              <span />
              <span />
              <Flag />
            </div>
            <p className="landing-eyebrow">{t("landing.cta_eyebrow")}</p>
            <h2 id="cta-title">{t("landing.cta_title")}</h2>
            <p>{t("landing.cta_description")}</p>
            <StartButton onSignIn={onSignIn} busy={busy} ready={ready} />
            <span className="landing-cta-note">
              {t(development ? "auth.dev_note" : "landing.cta_note")}
            </span>
          </div>
        </section>
      </main>
      <footer className="landing-footer landing-container">
        <a className="landing-footer-brand" href="#top">
          GARAGE<span>.</span>
        </a>
        <p>{t("landing.footer")}</p>
        <span>{t("landing.footer_note")}</span>
      </footer>
    </div>
  );
}

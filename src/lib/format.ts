import { i18n } from "@/i18n";

export const locale = () =>
  i18n.resolvedLanguage === "ro" ? "ro-RO" : "en-GB";
export const numberLabel = (value: number) =>
  new Intl.NumberFormat(locale()).format(value);
export const km = (value: number) => `${numberLabel(value)} km`;
export const dateLabel = (date: string | null | undefined) =>
  date
    ? new Intl.DateTimeFormat(locale(), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`))
    : "—";
export const monthsLabel = (count: number) =>
  i18n.t("format.months", { count });
export function remainingText(task: {
  remainingKm: number | null;
  days: number | null;
}) {
  const parts: string[] = [];
  if (task.remainingKm !== null)
    parts.push(
      i18n.t(
        task.remainingKm >= 0 ? "format.remaining_km" : "format.overdue_km",
        { distance: km(Math.abs(task.remainingKm)) },
      ),
    );
  if (task.days !== null)
    parts.push(
      i18n.t(task.days >= 0 ? "format.days" : "format.days_overdue", {
        count: Math.abs(task.days),
      }),
    );
  return parts.join(" · ") || i18n.t("format.no_deadline");
}

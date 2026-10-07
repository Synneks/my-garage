const number = new Intl.NumberFormat("ro-RO");
export const km = (value: number) => `${number.format(value)} km`;
export const dateLabel = (date: string | null | undefined) =>
  date ? date.split("-").reverse().join(".") : "—";
export function remainingText(task: {
  remainingKm: number | null;
  days: number | null;
}) {
  const parts = [];
  if (task.remainingKm !== null)
    parts.push(
      task.remainingKm >= 0
        ? `${km(task.remainingKm)} rămași`
        : `${km(-task.remainingKm)} depășire`,
    );
  if (task.days !== null)
    parts.push(
      task.days >= 0 ? `${task.days} zile` : `${-task.days} zile depășire`,
    );
  return parts.join(" · ") || "Fără termen fix";
}

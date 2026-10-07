import { categoryLabel } from "@/lib/task-labels";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS } from "@/engine.js";
import { km, dateLabel, remainingText } from "@/lib/format";
import type { EvaluatedTask, Status } from "@/types";

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={`status-badge tone-${STATUS[status].tone}`}
    >
      {t(`statuses.${status}`)}
    </Badge>
  );
}
export function Deadline({ task }: { task: EvaluatedTask }) {
  const { t } = useTranslation();
  return (
    <div className="deadline">
      {task.dueKm !== null && <strong>{km(task.dueKm)}</strong>}
      {task.dueDate && <span>{dateLabel(task.dueDate)}</span>}
      {task.dueKm === null && !task.dueDate && (
        <span>{t("table.undetermined")}</span>
      )}
    </div>
  );
}
interface Props {
  tasks: EvaluatedTask[];
  compact?: boolean;
  onDetail: (id: string) => void;
  onLog: (id: string) => void;
  disabled?: boolean;
}
export function MaintenanceTable({
  tasks,
  compact,
  onDetail,
  onLog,
  disabled,
}: Props) {
  const { t } = useTranslation();
  if (!tasks.length)
    return <div className="empty-state">{t("table.empty")}</div>;
  return (
    <Table className="maintenance-table">
      <TableHeader>
        <TableRow>
          <TableHead>{t("form.operation")}</TableHead>
          <TableHead>{t("table.status")}</TableHead>
          <TableHead>{t("table.next")}</TableHead>
          {!compact && <TableHead>{t("table.last")}</TableHead>}
          <TableHead>
            <span className="sr-only">{t("table.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell>
              <Button
                variant="link"
                className="task-link"
                onClick={() => onDetail(task.id)}
                disabled={disabled}
              >
                {task.name}
              </Button>
              <p className="metadata">
                {t(`actions.${task.action}`)} <span>/</span>{" "}
                {categoryLabel(t, task.category)}
              </p>
            </TableCell>
            <TableCell>
              <StatusBadge status={task.status} />
            </TableCell>
            <TableCell>
              <Deadline task={task} />
              <p className="metadata">{remainingText(task)}</p>
            </TableCell>
            {!compact && (
              <TableCell>
                {task.latest ? (
                  <>
                    <strong>{km(task.latest.km)}</strong>
                    <p className="metadata">{dateLabel(task.latest.date)}</p>
                  </>
                ) : (
                  <span className="metadata">{t("table.undocumented")}</span>
                )}
              </TableCell>
            )}
            <TableCell>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={disabled}
                onClick={() => onLog(task.id)}
                aria-label={t("table.log_label", {
                  task: task.name,
                  action: t(`actions.${task.action}`),
                })}
              >
                <Plus />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

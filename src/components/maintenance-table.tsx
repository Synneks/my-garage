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
import { ACTIONS } from "@/data.js";
import { STATUS } from "@/engine.js";
import { km, dateLabel, remainingText } from "@/lib/format";
import type { EvaluatedTask, Status } from "@/types";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge
      variant="outline"
      className={`status-badge tone-${STATUS[status].tone}`}
    >
      {STATUS[status].label}
    </Badge>
  );
}
export function Deadline({ task }: { task: EvaluatedTask }) {
  return (
    <div className="deadline">
      {task.dueKm !== null && <strong>{km(task.dueKm)}</strong>}
      {task.dueDate && <span>{dateLabel(task.dueDate)}</span>}
      {task.dueKm === null && !task.dueDate && (
        <span>După stare / de stabilit</span>
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
  if (!tasks.length)
    return (
      <div className="empty-state">Nicio operație pentru filtrele alese.</div>
    );
  return (
    <Table className="maintenance-table">
      <TableHeader>
        <TableRow>
          <TableHead>Operație</TableHead>
          <TableHead>Stare</TableHead>
          <TableHead>Următorul reper</TableHead>
          {!compact && <TableHead>Ultima intervenție</TableHead>}
          <TableHead>
            <span className="sr-only">Acțiuni</span>
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
                {ACTIONS[task.action]} <span>/</span> {task.category}
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
                  <span className="metadata">Nedocumentată</span>
                )}
              </TableCell>
            )}
            <TableCell>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={disabled}
                onClick={() => onLog(task.id)}
                aria-label={`Înregistrează: ${task.name} — ${ACTIONS[task.action]}`}
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

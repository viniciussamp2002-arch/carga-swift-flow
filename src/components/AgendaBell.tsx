import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAgendaLembretes } from "@/hooks/useAgendaLembretes";
import { REMINDER_LABEL, type ReminderKind } from "@/lib/agenda-reminders";
import { NOTA_STATUS_LABEL, fmtDate } from "@/lib/format";

const TONE: Record<ReminderKind, string> = { vencido: "text-destructive", amanha: "text-primary", aguardando: "text-muted-foreground" };

export function AgendaBell({ variant = "module" }: { variant?: "module" | "header" }) {
  const { data = [] } = useAgendaLembretes();
  const n = data.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size={variant === "header" ? "icon" : "sm"} variant={variant === "header" ? "ghost" : "outline"} className="relative h-9" aria-label={`Lembretes de Agendamento — ${n}`}>
          <Bell className="h-4 w-4" />{variant === "module" && <span className="ml-1">Lembretes de Agendamento — {n}</span>}
          {variant === "header" && n > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 font-bold">{n}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 text-foreground">
        <div className="px-3 py-2 border-b text-sm font-semibold">Lembretes de Agendamento ({n})</div>
        <div className="max-h-80 overflow-auto divide-y">
          {data.map((l) => (
            <Link key={l.id} to="/agendamentos" search={{ nf: l.numero }} className="block px-3 py-2 text-xs hover:bg-muted">
              <div className={`font-semibold ${TONE[l.kind]}`}>{REMINDER_LABEL[l.kind]}</div>
              <div><span className="font-mono font-semibold">NF {l.numero}</span> · {l.cliente}</div>
              <div className="text-muted-foreground">{l.cidade}{l.uf && `/${l.uf}`} · {l.data ? fmtDate(l.data + "T12:00") : "Sem data"}{l.horario && ` às ${l.horario}`} · {NOTA_STATUS_LABEL[l.situacao] ?? l.situacao}</div>
            </Link>
          ))}
          {n === 0 && <div className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma pendência de agendamento.</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

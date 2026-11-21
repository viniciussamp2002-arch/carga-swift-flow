import { Link } from "@tanstack/react-router";
import { Bell, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAgendaLembretes } from "@/hooks/useAgendaLembretes";
import { REMINDER_LABEL, type ReminderKind } from "@/lib/agenda-reminders";
import { NOTA_STATUS_LABEL, fmtDate } from "@/lib/format";

const TONE: Record<ReminderKind, string> = { vencido: "text-destructive", amanha: "text-primary", aguardando: "text-muted-foreground" };

export function AgendaBell({ variant = "module" }: { variant?: "module" | "header" }) {
  const { data = [] } = useAgendaLembretes();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const active = data.filter(l => !hidden.has(l.evento));
  const n = active.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size={variant === "header" ? "icon" : "sm"} variant={variant === "header" ? "ghost" : "outline"} className="relative h-9" aria-label={`Lembretes de Agendamento — ${n}`}>
          <Bell className="h-4 w-4" />{variant === "module" && <span className="ml-1">Lembretes de Agendamento — {n}</span>}
          {variant === "header" && n > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 font-bold">{n}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-24px)] p-0 text-foreground">
        <div className="px-3 py-2 border-b text-sm font-semibold">Lembretes de Agendamento ({n})</div>
        <div className="max-h-80 overflow-auto divide-y">
          {active.map((l) => (
            <div key={l.evento} className="flex items-start">
            <Link to="/agendamentos" search={{ nf: l.numero }} className="block flex-1 min-w-0 px-3 py-2 text-xs hover:bg-muted">
              <div className={`font-semibold ${TONE[l.kind]}`}>{REMINDER_LABEL[l.kind]}</div>
              <div><span className="font-mono font-semibold">NF {l.numero}</span> · {l.cliente}</div>
              <div className="text-muted-foreground">{l.cidade}{l.uf && `/${l.uf}`} · {l.data ? fmtDate(l.data + "T12:00") : "Sem data"}{l.horario && ` às ${l.horario}`} · {NOTA_STATUS_LABEL[l.situacao] ?? l.situacao}</div>
            </Link>
            <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8 mt-1 mr-1" aria-label={`Dispensar aviso da NF ${l.numero}`} title="Dispensar aviso" onClick={async () => {
              if (!user) return;
              setHidden(s => new Set(s).add(l.evento));
              const r = await supabase.from("notificacoes_dispensadas").insert({ user_id: user.id, evento_chave: l.evento });
              if (r.error && r.error.code !== "23505") { setHidden(s => { const next = new Set(s); next.delete(l.evento); return next; }); toast.error("Não foi possível dispensar o aviso"); }
              else await qc.invalidateQueries({ queryKey: ["agendamentos", "lembretes"] });
            }}><X className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          {n === 0 && <div className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma pendência de agendamento.</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

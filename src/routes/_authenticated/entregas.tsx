import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { NOTA_STATUS_COLOR, NOTA_STATUS_LABEL, fmtKg } from "@/lib/format";
import { diasRestantes, prazoBadge } from "@/lib/prazo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";

const searchSchema = z.object({ carga: z.string().optional() }).optional();
export const Route = createFileRoute("/_authenticated/entregas")({
  component: EntregasPage, validateSearch: searchSchema,
});

function EntregasPage() {
  const { canWrite } = useAuth();
  const search = Route.useSearch();
  const [cargaFilter, setCargaFilter] = useState(search?.carga ?? "all");
  const [dlg, setDlg] = useState<{ open: boolean; tipo: "entregue" | "nao_entregue" | "devolvida"; nota: any | null }>({ open: false, tipo: "entregue", nota: null });

  const { data: cargas = [] } = useQuery({
    queryKey: ["cargas-rota"],
    queryFn: async () => (await supabase.from("cargas").select("id,numero,status").eq("status", "em_rota").order("numero", { ascending: false })).data ?? [],
  });
  const { data: notas = [] } = useQuery({
    queryKey: ["entregas-notas", cargaFilter],
    queryFn: async () => {
      let q = supabase.from("notas_fiscais").select("*, cargas:carga_id(numero)").eq("status", "em_rota");
      if (cargaFilter !== "all") q = q.eq("carga_id", cargaFilter);
      return (await q.order("cidade")).data ?? [];
    },
  });

  const columns: DataTableColumn<any>[] = useMemo(() => [
    { key: "carga", header: "Carga", accessor: (n) => n.cargas?.numero ?? "", render: (n) => `#${n.cargas?.numero}` },
    { key: "nf", header: "NF", accessor: (n) => n.numero, render: (n) => <span className="font-mono">{n.numero}</span> },
    { key: "cliente", header: "Cliente", accessor: (n) => n.cliente },
    { key: "cidade", header: "Cidade/UF", accessor: (n) => `${n.cidade}/${n.uf}` },
    { key: "peso", header: "Peso", accessor: (n) => Number(n.peso ?? 0), align: "right", render: (n) => fmtKg(n.peso) },
    {
      key: "prazo", header: "Prazo", accessor: (n) => diasRestantes(n.data_limite) ?? 9999,
      render: (n) => { const d = diasRestantes(n.data_limite); const b = prazoBadge(d); return <StatusBadge className={b.className}>{b.label}</StatusBadge>; },
    },
    {
      key: "status", header: "Status", accessor: (n) => NOTA_STATUS_LABEL[n.status],
      render: (n) => <StatusBadge className={NOTA_STATUS_COLOR[n.status]}>{NOTA_STATUS_LABEL[n.status]}</StatusBadge>,
    },
    {
      key: "acoes", header: "Ações", accessor: () => "", filterable: false, sortable: false,
      render: (n) => canWrite && (
        <div className="flex gap-1.5">
          <Button size="sm" className="h-7 text-xs bg-success hover:bg-success/90 text-success-foreground"
            onClick={() => setDlg({ open: true, tipo: "entregue", nota: n })}>
            <Check className="h-3 w-3 mr-1" />Entregue
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => setDlg({ open: true, tipo: "nao_entregue", nota: n })}>
            <X className="h-3 w-3 mr-1" />Não entregue
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/40"
            onClick={() => setDlg({ open: true, tipo: "devolvida", nota: n })}>
            <RotateCcw className="h-3 w-3 mr-1" />Devolver
          </Button>
        </div>
      ),
    },
  ], [canWrite]);

  return (
    <div>
      <PageHeader
        title="Entregas em Rota" subtitle={`${notas.length} nota(s) aguardando entrega`}
        actions={
          <Select value={cargaFilter} onValueChange={setCargaFilter}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cargas em rota</SelectItem>
              {cargas.map((c: any) => <SelectItem key={c.id} value={c.id}>Carga #{c.numero}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <DataTable data={notas} columns={columns} rowKey={(n: any) => n.id} exportName="entregas" />
      <EntregaDialog state={dlg} onClose={() => setDlg({ ...dlg, open: false })} />
    </div>
  );
}

function EntregaDialog({ state, onClose }: any) {
  const qc = useQueryClient();
  const { open, tipo, nota } = state;
  const [data, setData] = useState(new Date().toISOString().slice(0, 16));
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      if (!nota) return;
      const novoStatus = tipo === "entregue" ? "entregue"
        : tipo === "nao_entregue" ? "disponivel" : "devolvida";
      const novoCarga = tipo === "nao_entregue" ? null : nota.carga_id;
      const { error } = await supabase.from("notas_fiscais").update({
        status: novoStatus, carga_id: novoCarga,
      }).eq("id", nota.id);
      if (error) throw error;
      await supabase.from("entregas").insert({
        nota_id: nota.id, carga_id: nota.carga_id,
        data_evento: new Date(data).toISOString(),
        resultado: tipo, motivo: motivo || null, observacao: obs || null,
      });
      await supabase.from("historico").insert({
        entidade: "nota", entidade_id: nota.id, acao: tipo,
        descricao: `NF ${nota.numero} marcada como ${NOTA_STATUS_LABEL[novoStatus]}${motivo ? ` — ${motivo}` : ""}`,
      });
    },
    onSuccess: () => { toast.success("Registrado"); qc.invalidateQueries(); onClose(); setMotivo(""); setObs(""); },
    onError: (e: any) => toast.error(e.message),
  });
  const titles: Record<string, string> = { entregue: "Marcar como entregue", nao_entregue: "Marcar como não entregue", devolvida: "Marcar como devolvida" };
  const motivos = ["Cliente ausente", "Endereço incorreto", "Recusa", "Sem agendamento", "Outros"];
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{titles[tipo]} {nota && `— NF ${nota.numero}`}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Data / Hora</Label>
            <Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          {(tipo === "nao_entregue" || tipo === "devolvida") && (
            <div className="space-y-1"><Label className="text-xs">Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{motivos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1"><Label className="text-xs">Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

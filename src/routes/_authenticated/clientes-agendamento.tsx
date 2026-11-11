import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DepositoTabs } from "@/components/DepositoTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { onlyDigits } from "@/lib/agenda";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes-agendamento")({
  head: () => ({ meta: [{ title: "Clientes com Agendamento Obrigatório — Transmerida" }, { name: "description", content: "Clientes que exigem agendamento para receber mercadorias" }] }),
  component: ClientesAgPage,
});

function ClientesAgPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [cnpj, setCnpj] = useState(""); const [nome, setNome] = useState("");
  const { data: rows = [] } = useQuery({
    queryKey: ["clientes-ag"],
    queryFn: async () => (await supabase.from("clientes_agendamento").select("*").order("nome")).data ?? [],
  });
  const { data: sugestoes = [] } = useQuery({
    queryKey: ["clientes-xml"],
    queryFn: async () => {
      const { data } = await supabase.from("notas_fiscais").select("cliente, cnpj_destinatario").not("cnpj_destinatario", "is", null).limit(5000);
      const m = new Map<string, string>(); (data ?? []).forEach((d) => m.set(onlyDigits(d.cnpj_destinatario), d.cliente));
      return Array.from(m.entries()).map(([c, n]) => ({ cnpj: c, nome: n })).sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["clientes-ag"] }); qc.invalidateQueries({ queryKey: ["agendamentos"] }); qc.invalidateQueries({ queryKey: ["notas"] }); };
  const add = useMutation({
    mutationFn: async () => {
      const c = onlyDigits(cnpj);
      if (c.length !== 14 && c.length !== 11) throw new Error("Informe um CNPJ (14 dígitos) ou CPF válido");
      const { error } = await supabase.from("clientes_agendamento").insert({ cnpj: c, nome: nome.trim() });
      if (error) throw new Error(error.code === "23505" ? "Cliente já cadastrado" : error.message);
      // notas já no depósito desse cliente passam a ter vínculo de agendamento
      await supabase.from("notas_fiscais").update({ cnpj_destinatario: c }).eq("cnpj_destinatario", c).eq("recebida", true).in("status", ["disponivel", "separacao", "carregamento"]);
    },
    onSuccess: () => { toast.success("Cliente adicionado"); setCnpj(""); setNome(""); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = async (r: any, ativo: boolean) => { const { error } = await supabase.from("clientes_agendamento").update({ ativo }).eq("id", r.id); if (error) toast.error(error.message); refresh(); };
  const del = async (r: any) => { const { error } = await supabase.from("clientes_agendamento").delete().eq("id", r.id); if (error) toast.error(error.message); refresh(); };
  const fmtC = (c: string) => c.length === 14 ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : c;

  return (
    <div>
      <DepositoTabs />
      <PageHeader title="Clientes com Agendamento Obrigatório" subtitle="Identificação pelo CNPJ do destinatário no XML. Notas recebidas desses clientes vão automaticamente para Agendamentos." />
      {isAdmin ? (
        <div className="mb-3 flex flex-wrap gap-2 items-end bg-card border rounded-md p-3">
          <div><div className="text-[11px] mb-1">Cliente dos XMLs importados</div>
            <select className="h-9 border rounded px-2 bg-background max-w-xs" value="" onChange={(e) => { const s = sugestoes.find((x) => x.cnpj === e.target.value); if (s) { setCnpj(s.cnpj); setNome(s.nome); } }}>
              <option value="">Escolher…</option>{sugestoes.map((s) => <option key={s.cnpj} value={s.cnpj}>{s.nome} — {fmtC(s.cnpj)}</option>)}
            </select></div>
          <div><div className="text-[11px] mb-1">CNPJ*</div><Input className="h-9 w-48" value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
          <div className="flex-1 min-w-[200px]"><div className="text-[11px] mb-1">Nome (ex.: Sendas)</div><Input className="h-9" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <Button className="h-9" disabled={add.isPending || !cnpj} onClick={() => add.mutate()}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
        </div>
      ) : <p className="mb-3 text-sm text-muted-foreground">Somente administradores podem alterar esta lista.</p>}
      <div className="bg-card border rounded-md overflow-auto">
        <table className="table-erp">
          <thead><tr><th>Cliente</th><th>CNPJ</th><th>Ativo</th><th></th></tr></thead>
          <tbody>
            {rows.map((r: any) => <tr key={r.id}><td className="font-semibold">{r.nome || "—"}</td><td className="font-mono">{fmtC(r.cnpj)}</td>
              <td><Switch checked={r.ativo} disabled={!isAdmin} onCheckedChange={(v) => toggle(r, v)} /></td>
              <td>{isAdmin && <button onClick={() => del(r)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

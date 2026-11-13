import { pageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DepositoTabs } from "@/components/DepositoTabs";
import { Input } from "@/components/ui/input";
import { CanhotoButtons, useCanhotosAprovados } from "@/components/Canhoto";
import { OcorrenciaBadge } from "@/components/Ocorrencias";
import { fmtKg, fmtBRL, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notas-entregues")({
  head: () => pageHead("Notas Entregues", "Notas fiscais entregues separadas por fornecedor, com canhoto aprovado."),
  component: NotasEntreguesPage,
});

function NotasEntreguesPage() {
  const canhotos = useCanhotosAprovados();
  const [q, setQ] = useState("");
  const [aba, setAba] = useState<string>("");
  const { data: notas = [] } = useQuery({
    queryKey: ["notas-entregues"],
    queryFn: async () => {
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("notas_fiscais")
          .select("*, cargas:carga_id(numero, motoristas:motorista_id(nome)), entregas(data_evento, resultado)")
          .eq("status", "entregue").order("updated_at", { ascending: false }).range(from, from + 999);
        if (error) throw error;
        all.push(...(data ?? [])); if (!data || data.length < 1000) break;
      }
      return all;
    },
  });
  const grupos = useMemo(() => {
    const m = new Map<string, { key: string; nome: string; cnpj: string; notas: any[] }>();
    for (const n of notas) {
      const cnpj = (n.cnpj_emissor ?? "").replace(/\D/g, "");
      const key = cnpj || n.fornecedor;
      if (!m.has(key)) m.set(key, { key, nome: n.fornecedor || "Sem fornecedor", cnpj, notas: [] });
      m.get(key)!.notas.push(n);
    }
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [notas]);
  const atual = grupos.find(g => g.key === aba) ?? grupos[0];
  const s = q.trim().toLowerCase();
  const lista = (atual?.notas ?? []).filter((n) => !s || [n.numero, n.cliente, n.cidade].some((v) => String(v ?? "").toLowerCase().includes(s)));
  const dataEntrega = (n: any) => {
    const e = (n.entregas ?? []).filter((x: any) => x.resultado === "entregue").sort((a: any, b: any) => b.data_evento.localeCompare(a.data_evento))[0];
    return canhotos.get(n.id)?.data_entrega ?? e?.data_evento;
  };
  return (
    <div>
      <DepositoTabs />
      <PageHeader title="Notas Entregues" subtitle={`${notas.length} nota(s) entregue(s) em ${grupos.length} fornecedor(es)`}
        actions={<Input className="h-9 w-64" placeholder="Buscar NF, cliente, cidade..." value={q} onChange={(e) => setQ(e.target.value)} />} />
      {grupos.length === 0 ? <div className="bg-card border rounded-md p-8 text-center text-muted-foreground">Nenhuma nota entregue ainda</div> : <>
        <nav className="mb-3 flex gap-1 flex-wrap">
          {grupos.map((g) => (
            <button key={g.key} onClick={() => setAba(g.key)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md border ${g.key === atual?.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              {g.nome} <span className="opacity-70">({g.notas.length})</span>
            </button>
          ))}
        </nav>
        {atual?.cnpj && <p className="text-xs text-muted-foreground mb-2">CNPJ {atual.cnpj}</p>}
        <div className="bg-card border rounded-md overflow-x-auto">
          <table className="table-erp">
            <thead><tr><th>Canhoto</th><th>NF</th><th>Cliente</th><th>Cidade</th><th>Carga</th><th>Motorista</th><th>Entregue em</th><th className="text-right">Peso</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {lista.map((n) => (
                <tr key={n.id}>
                  <td><CanhotoButtons canhoto={canhotos.get(n.id)} numero={n.numero} /></td>
                  <td className="font-mono">{n.numero}<OcorrenciaBadge nota={n} /></td>
                  <td>{n.cliente}</td><td>{n.cidade}{n.uf && `/${n.uf}`}</td>
                  <td>{n.cargas?.numero ? `#${n.cargas.numero}` : "—"}</td>
                  <td>{n.cargas?.motoristas?.nome ?? "—"}</td>
                  <td>{dataEntrega(n) ? fmtDate(dataEntrega(n)) : "—"}</td>
                  <td className="text-right">{fmtKg(n.peso)}</td><td className="text-right">{fmtBRL(n.valor)}</td>
                </tr>
              ))}
              {lista.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Nenhuma nota encontrada</td></tr>}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}

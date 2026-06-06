import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { fmtKg, fmtNum } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Card({ title, value, tone = "default" }: { title: string; value: React.ReactNode; tone?: string }) {
  const toneClass: Record<string, string> = {
    default: "border-border",
    primary: "border-primary/40 bg-primary/5",
    success: "border-success/40 bg-success/5",
    warning: "border-warning/40 bg-warning/5",
    destructive: "border-destructive/40 bg-destructive/5",
    info: "border-info/40 bg-info/5",
  };
  return (
    <div className={`border rounded-md p-3 bg-card ${toneClass[tone]}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [notas, veiculos, cargas, hoje] = await Promise.all([
        supabase.from("notas_fiscais").select("status", { count: "exact" }),
        supabase.from("veiculos").select("situacao"),
        supabase.from("cargas").select("status"),
        supabase.from("entregas").select("id, resultado, data_evento")
          .gte("data_evento", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);
      const count = (arr: any[] | null, key: string, val: string) =>
        (arr ?? []).filter((r) => r[key] === val).length;
      const n = notas.data ?? [];
      const v = veiculos.data ?? [];
      const c = cargas.data ?? [];
      const h = hoje.data ?? [];
      return {
        notasDisp: count(n, "status", "disponivel"),
        notasRota: count(n, "status", "em_rota"),
        notasEntreguesHoje: h.filter((x: any) => x.resultado === "entregue").length,
        notasPendentes: count(n, "status", "disponivel") + count(n, "status", "separacao") + count(n, "status", "carregamento"),
        notasDevolvidas: count(n, "status", "devolvida"),
        veicDisp: count(v, "situacao", "disponivel"),
        veicRota: count(v, "situacao", "em_rota"),
        veicManut: count(v, "situacao", "manutencao"),
        cargasSep: count(c, "status", "separacao"),
        cargasCarr: count(c, "status", "carregamento"),
        cargasRota: count(c, "status", "em_rota"),
      };
    },
  });

  const { data: charts } = useQuery({
    queryKey: ["dashboard-charts"],
    queryFn: async () => {
      const [porCidade, porFornecedor, porPeriodo] = await Promise.all([
        supabase.from("notas_fiscais").select("cidade, peso").eq("status", "entregue"),
        supabase.from("notas_fiscais").select("fornecedor, peso").eq("status", "entregue"),
        supabase.from("entregas").select("data_evento, resultado")
          .gte("data_evento", new Date(Date.now() - 30 * 86400000).toISOString())
          .eq("resultado", "entregue"),
      ]);
      const agg = (arr: any[] | null, key: string) => {
        const m = new Map<string, { qtd: number; peso: number }>();
        (arr ?? []).forEach((r) => {
          const k = r[key] || "—";
          const cur = m.get(k) ?? { qtd: 0, peso: 0 };
          cur.qtd++; cur.peso += Number(r.peso ?? 0);
          m.set(k, cur);
        });
        return Array.from(m.entries()).map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.qtd - a.qtd).slice(0, 8);
      };
      // periodo (últimos 14 dias)
      const dias = new Map<string, { qtd: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        dias.set(d, { qtd: 0 });
      }
      (porPeriodo.data ?? []).forEach((r: any) => {
        const d = r.data_evento.slice(0, 10);
        const cur = dias.get(d); if (cur) cur.qtd++;
      });
      return {
        cidades: agg(porCidade.data, "cidade"),
        fornecedores: agg(porFornecedor.data, "fornecedor"),
        periodo: Array.from(dias.entries()).map(([d, v]) => ({
          data: d.slice(5).replace("-", "/"), ...v,
        })),
      };
    },
  });

  const s = stats ?? {} as any;
  const chartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <div>
      <PageHeader title="Dashboard Operacional" subtitle="Visão geral em tempo real" />
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Card title="Notas disponíveis" value={fmtNum(s.notasDisp)} tone="info" />
        <Card title="Notas em rota" value={fmtNum(s.notasRota)} tone="primary" />
        <Card title="Entregues hoje" value={fmtNum(s.notasEntreguesHoje)} tone="success" />
        <Card title="Pendentes" value={fmtNum(s.notasPendentes)} tone="warning" />
        <Card title="Devolvidas" value={fmtNum(s.notasDevolvidas)} tone="destructive" />
        <Card title="Veículos disponíveis" value={fmtNum(s.veicDisp)} tone="success" />
        <Card title="Veículos em rota" value={fmtNum(s.veicRota)} tone="primary" />
        <Card title="Veículos em manutenção" value={fmtNum(s.veicManut)} tone="warning" />
        <Card title="Cargas em separação" value={fmtNum(s.cargasSep)} />
        <Card title="Cargas carregando" value={fmtNum(s.cargasCarr)} />
        <Card title="Cargas em rota" value={fmtNum(s.cargasRota)} tone="primary" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-md p-4 bg-card">
          <h3 className="text-sm font-semibold mb-3">Entregas por cidade</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={charts?.cidades ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="qtd" fill="var(--color-chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="border rounded-md p-4 bg-card">
          <h3 className="text-sm font-semibold mb-3">Entregas por fornecedor</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={charts?.fornecedores ?? []} dataKey="qtd" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {(charts?.fornecedores ?? []).map((_, i) => (
                  <Cell key={i} fill={chartColors[i % chartColors.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="border rounded-md p-4 bg-card lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">Entregas — últimos 14 dias</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={charts?.periodo ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="data" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="qtd" stroke="var(--color-chart-1)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="border rounded-md p-4 bg-card lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">Peso entregue por cidade</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts?.cidades ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(1)}t`} />
              <Tooltip formatter={(v: number) => fmtKg(v)} />
              <Bar dataKey="peso" fill="var(--color-chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

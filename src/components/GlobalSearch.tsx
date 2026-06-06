import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { NOTA_STATUS_LABEL } from "@/lib/format";

interface Hit {
  id: string; numero: string; cliente: string; cidade: string; status: string;
  carga_id: string | null;
  carga?: { numero: number } | null;
  motorista?: { nome: string } | null;
  veiculo?: { placa: string } | null;
}

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      const term = q.trim();
      const { data } = await supabase
        .from("notas_fiscais")
        .select("id,numero,cliente,cidade,status,carga_id, cargas:carga_id(numero, motoristas:motorista_id(nome), veiculos:veiculo_id(placa))")
        .or(`numero.ilike.%${term}%,cliente.ilike.%${term}%,cidade.ilike.%${term}%`)
        .limit(8);
      const mapped = (data ?? []).map((r: any) => ({
        id: r.id, numero: r.numero, cliente: r.cliente, cidade: r.cidade,
        status: r.status, carga_id: r.carga_id,
        carga: r.cargas ? { numero: r.cargas.numero } : null,
        motorista: r.cargas?.motoristas ?? null,
        veiculo: r.cargas?.veiculos ?? null,
      }));
      setHits(mapped);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 bg-muted rounded-md px-3 h-8">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Buscar nota, cliente ou cidade..."
          className="bg-transparent outline-none text-[13px] flex-1"
        />
      </div>
      {open && hits.length > 0 && (
        <div className="absolute top-9 left-0 right-0 bg-popover border border-border rounded-md shadow-lg z-50 max-h-96 overflow-auto">
          {hits.map((h) => (
            <Link
              key={h.id}
              to="/notas"
              search={{ q: h.numero }}
              className="block px-3 py-2 hover:bg-accent border-b border-border last:border-0"
            >
              <div className="flex justify-between text-[13px]">
                <span className="font-medium">NF {h.numero}</span>
                <span className="text-xs text-muted-foreground">{NOTA_STATUS_LABEL[h.status]}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {h.cliente} • {h.cidade}
                {h.carga && ` • Carga #${h.carga.numero}`}
                {h.motorista && ` • ${h.motorista.nome}`}
                {h.veiculo && ` • ${h.veiculo.placa}`}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

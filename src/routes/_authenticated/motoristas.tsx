import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { MOTORISTA_SIT_LABEL, fmtDate, fmtNum } from "@/lib/format";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/motoristas")({ component: MotPage });

const SIT_COLOR: Record<string, string> = {
  disponivel: "bg-success/15 text-success border-success/30",
  em_viagem: "bg-primary/15 text-primary border-primary/30",
  ferias: "bg-info/15 text-info border-info/30",
  afastado: "bg-warning/15 text-warning-foreground border-warning/40",
};

function MotPage() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data: motoristas = [] } = useQuery({
    queryKey: ["motoristas"],
    queryFn: async () => (await supabase.from("motoristas").select("*").order("nome")).data ?? [],
  });

  const upd = useMutation({
    mutationFn: async ({ id, situacao }: any) => {
      const { error } = await supabase.from("motoristas").update({ situacao }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["motoristas"] }),
  });

  return (
    <div>
      <PageHeader
        title="Motoristas"
        subtitle={`${fmtNum(motoristas.length)} cadastrados`}
        actions={canWrite && (
          <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Novo
          </Button>
        )}
      />
      <div className="bg-card border rounded-md overflow-hidden">
        <table className="table-erp">
          <thead>
            <tr>
              <th>Nome</th><th>CPF</th><th>CNH</th><th>Cat.</th><th>Validade</th>
              <th>Telefone</th><th>Situação</th><th></th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map((m: any) => (
              <tr key={m.id}>
                <td className="font-medium">{m.nome}</td>
                <td className="font-mono text-xs">{m.cpf}</td>
                <td className="font-mono text-xs">{m.cnh}</td>
                <td>{m.categoria}</td>
                <td>{fmtDate(m.validade_cnh)}</td>
                <td>{m.telefone}</td>
                <td>
                  {canWrite && m.situacao !== "em_viagem" ? (
                    <Select value={m.situacao} onValueChange={(s) => upd.mutate({ id: m.id, situacao: s })}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(MOTORISTA_SIT_LABEL).filter(([k]) => k !== "em_viagem").map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusBadge className={SIT_COLOR[m.situacao]}>{MOTORISTA_SIT_LABEL[m.situacao]}</StatusBadge>
                  )}
                </td>
                <td>
                  {canWrite && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEdit(m); setOpen(true); }}>Editar</Button>
                  )}
                </td>
              </tr>
            ))}
            {motoristas.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum motorista</td></tr>}
          </tbody>
        </table>
      </div>
      <MotDialog open={open} onOpenChange={setOpen} edit={edit} key={edit?.id ?? "new"} />
    </div>
  );
}

function MotDialog({ open, onOpenChange, edit }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(edit ?? {
    nome: "", cpf: "", cnh: "", categoria: "", validade_cnh: "", telefone: "", observacoes: "", situacao: "disponivel",
  });
  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, validade_cnh: form.validade_cnh || null };
      if (edit) {
        const { error } = await supabase.from("motoristas").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("motoristas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["motoristas"] }); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{edit ? "Editar" : "Novo"} Motorista</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Nome*", "nome"], ["CPF", "cpf"], ["CNH", "cnh"], ["Categoria", "categoria"],
            ["Validade CNH", "validade_cnh", "date"], ["Telefone", "telefone"],
          ].map(([l, k, type]) => (
            <div key={k} className="space-y-1">
              <Label className="text-[11px]">{l}</Label>
              <Input type={type as any ?? "text"} value={form[k as string] ?? ""} onChange={(e) => setForm({ ...form, [k as string]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.nome}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

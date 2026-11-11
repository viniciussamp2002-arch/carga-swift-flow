import { Link } from "@tanstack/react-router";
import { PageHeader } from "./PageHeader";
import { Button } from "@/components/ui/button";

export function ModulePlaceholder({ title, description, items }: { title: string; description: string; items: string[] }) {
  return (
    <div className="max-w-4xl">
      <PageHeader title={title} subtitle={description} />
      <div className="border rounded-md bg-card p-5">
        <div className="text-sm font-semibold mb-2">Módulo previsto para a próxima etapa</div>
        <p className="text-sm text-muted-foreground mb-4">Este módulo ainda não registra operações. Ele usará os mesmos registros de notas fiscais do sistema.</p>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Informações previstas</div>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm list-disc pl-5">
          {items.map((i) => <li key={i}>{i}</li>)}
        </ul>
        <Link to="/dashboard"><Button variant="outline" size="sm" className="mt-5">Voltar ao início</Button></Link>
      </div>
    </div>
  );
}

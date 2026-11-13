import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MODULES } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead("Início", "Módulos do sistema de gestão logística Transmerida"),
  component: Inicio,
});

function Inicio() {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="text-center mb-6 pb-4 border-b">
        <h1 className="text-2xl font-bold tracking-wide text-primary">TRANSMERIDA</h1>
        <p className="text-sm text-muted-foreground mt-1">Sistema de Gestão Logística</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to}
            className="flex flex-col items-center justify-center gap-3 h-28 rounded-md border bg-card text-card-foreground hover:border-primary hover:bg-muted transition-colors">
            <m.icon className="h-6 w-6 text-primary" />
            <span className="text-sm font-semibold">{m.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

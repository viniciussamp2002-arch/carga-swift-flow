import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { nome }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada com sucesso!");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao autenticar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar to-background p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg shadow-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-md bg-primary text-primary-foreground"><Truck className="h-5 w-5" /></div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Cross-Docking</div>
            <div className="text-base font-bold">TMS Operacional</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {mode === "login" ? "Acesse sua conta" : "Crie uma conta. O primeiro usuário será administrador."}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}

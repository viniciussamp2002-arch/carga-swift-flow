import { pageHead } from "@/lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { driverAccount } from "@/lib/accounts.functions";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => pageHead("Entrar", "Identificação de usuários da Transmerida."), component: AuthPage });

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const driverAuth = useServerFn(driverAccount);
  const [tipo, setTipo] = useState<"motorista" | "administracao">("administracao");
  const [telefone, setTelefone] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup" && password !== confirm) throw new Error("As senhas não coincidem");
      if (tipo === "motorista") {
        const result = await driverAuth({ data: { action: mode, cpf: email, password, nome, telefone } });
        if (result.session) { const { error } = await supabase.auth.setSession(result.session); if (error) throw error; }
        else setMessage("Solicitação registrada. Aguarde a aprovação do escritório.");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { nome }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage("Confirme o e-mail recebido. Seu acesso também depende da aprovação do administrador.");
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
          {mode === "login" ? "Acesse sua conta" : "Solicitação de cadastro"}
        </p>
        <div className="flex gap-2 mb-4"><Button type="button" variant={tipo === "administracao" ? "default" : "outline"} onClick={() => { setTipo("administracao"); setEmail(""); setMessage(""); }}>Administração</Button><Button type="button" variant={tipo === "motorista" ? "default" : "outline"} onClick={() => { setTipo("motorista"); setEmail(""); setMessage(""); }}>Motorista</Button></div>
        {message && <p role="status" className="text-sm mb-3 text-primary">{message}</p>}
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="login-id" className="text-xs">{tipo === "motorista" ? "CPF" : "E-mail"}</Label>
            <Input id="login-id" type={tipo === "motorista" ? "text" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={tipo === "motorista" || mode === "signup" ? 8 : 6} />
          </div>
          {mode === "signup" && <><Label htmlFor="confirm-password">Confirmar senha</Label><Input id="confirm-password" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} />{tipo === "motorista" && <><Label htmlFor="phone">Telefone</Label><Input id="phone" required value={telefone} onChange={e => setTelefone(e.target.value)} /></>}</>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "..." : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <Button variant="link"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </Button>
        {tipo === "administracao" ? <Button variant="link" className="w-full" onClick={async () => { if (!email) { toast.error("Informe seu e-mail"); return; } const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); if (error) toast.error(error.message); else setMessage("Confira seu e-mail para redefinir a senha."); }}>Esqueci minha senha</Button> : <p className="text-xs text-muted-foreground text-center mt-3">Recuperação de senha: entre em contato com o escritório.</p>}
      </div>
    </div>
  );
}

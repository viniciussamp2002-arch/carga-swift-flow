import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/page-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/reset-password")({ head: () => pageHead("Redefinir senha", "Recuperação de acesso da Transmerida."), component: ResetPassword });
function ResetPassword() {
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery") setRecovery(true);
    const { data } = supabase.auth.onAuthStateChange(event => { if (event === "PASSWORD_RECOVERY") setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  return <main className="max-w-sm mx-auto p-6"><h1 className="text-xl font-bold mb-4">Redefinir senha</h1>{!recovery ? <p>Abra o link de recuperação recebido por e-mail.</p> : <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (password !== confirm) { setMessage("As senhas não coincidem"); return; } setBusy(true); const { error } = await supabase.auth.updateUser({ password }); setMessage(error ? "Não foi possível redefinir a senha. Solicite um novo link." : "Senha atualizada."); setBusy(false); }}><Label htmlFor="new-pass">Nova senha</Label><Input id="new-pass" type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /><Label htmlFor="confirm-pass">Confirmar senha</Label><Input id="confirm-pass" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} /><Button disabled={busy}>Salvar senha</Button><p role="status">{message}</p></form>}</main>;
}
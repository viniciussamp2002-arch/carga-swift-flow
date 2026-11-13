import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizeCpf, validCpf } from "./cpf";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export const driverAccount = createServerFn({ method: "POST" })
  .inputValidator(z.object({ action: z.enum(["login", "signup"]), cpf: z.string().max(20), password: z.string().min(8).max(128), nome: z.string().max(150).optional(), telefone: z.string().max(30).optional() }))
  .handler(async ({ data }) => {
    const cpf = normalizeCpf(data.cpf);
    if (!validCpf(cpf)) throw new Error("CPF inválido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = getRequest().headers.get("cf-connecting-ip") ?? "unknown";
    const { data: limit, error: le } = await supabaseAdmin.rpc("limitar_acesso", { _chave: await hash(`${ip}:${cpf}:${data.action}`) });
    if (le || !limit) throw new Error("Muitas tentativas. Aguarde 15 minutos.");
    const { data: mapping } = await supabaseAdmin.from("login_motoristas").select("user_id,email_interno").eq("cpf", cpf).maybeSingle();
    if (data.action === "signup") {
      if (!data.nome?.trim() || !data.telefone?.trim()) throw new Error("Informe nome e telefone");
      // Same response prevents public CPF enumeration. Random internal identifiers never encode CPF.
      if (mapping) return { pending: true, session: null };
      const email = `${crypto.randomUUID()}@driver.transmerida.invalid`;
      const { data: account, error } = await supabaseAdmin.auth.admin.createUser({ email, password: data.password, email_confirm: true, user_metadata: { nome: data.nome } });
      if (error || !account.user) throw new Error("Não foi possível solicitar o cadastro");
      const { error: me } = await supabaseAdmin.from("login_motoristas").insert({ user_id: account.user.id, cpf, email_interno: email });
      if (me) { await supabaseAdmin.auth.admin.deleteUser(account.user.id); return { pending: true, session: null }; }
      const { error: pe } = await supabaseAdmin.from("profiles").update({ email: null, tipo_acesso: "motorista", telefone: data.telefone }).eq("id", account.user.id);
      if (pe) throw new Error("Solicitação registrada; atualização de contato pendente");
      return { pending: true, session: null };
    }
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!key || !url) throw new Error("Acesso indisponível");
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (h.get("Authorization") === `Bearer ${key}` && key.startsWith("sb_")) h.delete("Authorization"); h.set("apikey", key); return fetch(input, { ...init, headers: h }); } } });
    const { data: auth, error } = await client.auth.signInWithPassword({ email: mapping?.email_interno ?? `${crypto.randomUUID()}@driver.transmerida.invalid`, password: data.password });
    if (error || !auth.session || !mapping) throw new Error("CPF ou senha incorretos");
    const { data: profile } = await supabaseAdmin.from("profiles").select("status_acesso").eq("id", mapping.user_id).single();
    if (profile?.status_acesso !== "ativo") throw new Error("Cadastro pendente de aprovação ou acesso inativo. Procure o escritório.");
    // Only bearer credentials required by setSession; do not disclose the private email mapping.
    return { pending: false, session: { access_token: auth.session.access_token, refresh_token: auth.session.refresh_token } };
  });

export const resetDriverPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), password: z.string().min(8).max(128), motivo: z.string().min(3) }))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "administrador").maybeSingle();
    if (!role) throw new Error("Acesso não autorizado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mapping } = await supabaseAdmin.from("login_motoristas").select("user_id").eq("user_id", data.userId).maybeSingle();
    if (!mapping) throw new Error("Conta de motorista não encontrada");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error("Não foi possível redefinir a senha");
    await context.supabase.from("historico").insert({ entidade: "usuario", entidade_id: data.userId, acao: "recuperacao_acesso", descricao: data.motivo, user_id: context.userId });
    return { ok: true };
  });
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "administrador" | "operacional" | "consulta" | "motorista" | "conferente" | "financeiro";
interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: Role[];
  isAdmin: boolean;
  canWrite: boolean;
  isDriver: boolean;
  canFinance: boolean;
  canReceive: boolean;
  accessStatus: string;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [accessStatus, setAccessStatus] = useState("pendente");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let generation = 0;
    async function hydrate(s: Session | null) {
      const current = ++generation;
      setLoading(true);
      setRoles([]);
      setAccessStatus("pendente");
      setSession(s);
      setUser(null);
      if (!s) { setLoading(false); return; }
      try {
        const { data: identity } = await supabase.auth.getUser();
        if (!active || current !== generation) return;
        if (!identity.user) { setLoading(false); return; }
        const uid = identity.user.id;
        const [{ data: profile }, { data }] = await Promise.all([
          supabase.from("profiles").select("status_acesso").eq("id", uid).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", uid),
        ]);
        if (!active || current !== generation) return;
        setAccessStatus(profile?.status_acesso ?? "pendente");
        setRoles(profile?.status_acesso === "ativo" ? (data ?? []).map(r => r.role) : []);
        setUser(identity.user);
      } finally { if (active && current === generation) setLoading(false); }
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED") { setSession(s); return; }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setLoading(true);
        setTimeout(() => { if (active) void hydrate(s); }, 0);
      }
    });
    return () => { active = false; generation++; sub.subscription.unsubscribe(); };
  }, []);

  const isAdmin = roles.includes("administrador");
  const canWrite = isAdmin || roles.includes("operacional");
  const isDriver = !canWrite && roles.includes("motorista");

  return (
    <Ctx.Provider
      value={{
        user, session, loading, roles, isAdmin, canWrite, isDriver, accessStatus, canFinance: canWrite || roles.includes("financeiro"), canReceive: canWrite || roles.includes("conferente"),
        signOut: async () => { await supabase.auth.signOut(); },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

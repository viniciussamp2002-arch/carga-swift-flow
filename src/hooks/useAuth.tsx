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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getUser().then(async ({ data }) => {
      const { data: tokens } = await supabase.auth.getSession();
      setSession(tokens.session);
      setUser(data.user ?? null);
      if (data.user) loadRoles(data.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRoles(uid: string) {
    const { data: profile } = await supabase.from("profiles").select("status_acesso").eq("id", uid).maybeSingle();
    setAccessStatus(profile?.status_acesso ?? "pendente");
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((profile?.status_acesso === "ativo" ? data ?? [] : []).map((r) => r.role as Role));
  }

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

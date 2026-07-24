
-- 1) Private schema not exposed to PostgREST
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2) Recreate helper functions in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.can_write(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('administrador','operacional'));
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_write(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_write(uuid) TO authenticated, service_role;

-- 3) Update policies on cargas: read restricted to writers only
DROP POLICY IF EXISTS cargas_select_auth ON public.cargas;
DROP POLICY IF EXISTS cargas_write ON public.cargas;
CREATE POLICY cargas_select_privileged ON public.cargas
  FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY cargas_write ON public.cargas
  FOR ALL TO authenticated
  USING (private.can_write(auth.uid()))
  WITH CHECK (private.can_write(auth.uid()));

-- entregas
DROP POLICY IF EXISTS entregas_select_auth ON public.entregas;
DROP POLICY IF EXISTS entregas_write ON public.entregas;
CREATE POLICY entregas_select_privileged ON public.entregas
  FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY entregas_write ON public.entregas
  FOR ALL TO authenticated
  USING (private.can_write(auth.uid()))
  WITH CHECK (private.can_write(auth.uid()));

-- financeiro
DROP POLICY IF EXISTS "auth read financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "write financeiro" ON public.financeiro;
CREATE POLICY financeiro_select_privileged ON public.financeiro
  FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY financeiro_write ON public.financeiro
  FOR ALL TO authenticated
  USING (private.can_write(auth.uid()))
  WITH CHECK (private.can_write(auth.uid()));

-- fornecedores
DROP POLICY IF EXISTS "auth read fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "write fornecedores" ON public.fornecedores;
CREATE POLICY fornecedores_select_privileged ON public.fornecedores
  FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY fornecedores_write ON public.fornecedores
  FOR ALL TO authenticated
  USING (private.can_write(auth.uid()))
  WITH CHECK (private.can_write(auth.uid()));

-- veiculos
DROP POLICY IF EXISTS veiculos_select_auth ON public.veiculos;
DROP POLICY IF EXISTS veiculos_write ON public.veiculos;
CREATE POLICY veiculos_select_privileged ON public.veiculos
  FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY veiculos_write ON public.veiculos
  FOR ALL TO authenticated
  USING (private.can_write(auth.uid()))
  WITH CHECK (private.can_write(auth.uid()));

-- 4) Repoint remaining policies to private.* helpers
DROP POLICY IF EXISTS motoristas_select_privileged ON public.motoristas;
DROP POLICY IF EXISTS motoristas_write ON public.motoristas;
CREATE POLICY motoristas_select_privileged ON public.motoristas
  FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY motoristas_write ON public.motoristas
  FOR ALL TO authenticated
  USING (private.can_write(auth.uid()))
  WITH CHECK (private.can_write(auth.uid()));

DROP POLICY IF EXISTS notas_select_privileged ON public.notas_fiscais;
DROP POLICY IF EXISTS notas_write ON public.notas_fiscais;
CREATE POLICY notas_select_privileged ON public.notas_fiscais
  FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY notas_write ON public.notas_fiscais
  FOR ALL TO authenticated
  USING (private.can_write(auth.uid()))
  WITH CHECK (private.can_write(auth.uid()));

DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING ((auth.uid() = id) OR private.has_role(auth.uid(), 'administrador'::public.app_role));

DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_self_or_admin ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'administrador'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'administrador'::public.app_role));
CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'administrador'::public.app_role));

-- 5) Drop the old exposed public helpers now that policies no longer reference them
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.can_write(uuid);

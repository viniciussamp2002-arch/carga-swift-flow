
-- 1. Restrict EXECUTE on SECURITY DEFINER helpers (remove public/anon access)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated, service_role;

-- 2. Motoristas: restrict SELECT to admin/operacional
DROP POLICY IF EXISTS motoristas_select_auth ON public.motoristas;
CREATE POLICY motoristas_select_privileged ON public.motoristas
  FOR SELECT TO authenticated
  USING (public.can_write(auth.uid()));

-- 3. Notas fiscais: restrict SELECT to admin/operacional
DROP POLICY IF EXISTS notas_select_auth ON public.notas_fiscais;
CREATE POLICY notas_select_privileged ON public.notas_fiscais
  FOR SELECT TO authenticated
  USING (public.can_write(auth.uid()));

-- 4. Profiles: only own row, or admin
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'administrador'));

-- 5. User roles: only own rows, or admin
DROP POLICY IF EXISTS user_roles_select_auth ON public.user_roles;
CREATE POLICY user_roles_select_self_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

-- 6. Historico insert: force user_id = auth.uid()
DROP POLICY IF EXISTS historico_insert_auth ON public.historico;
CREATE POLICY historico_insert_self ON public.historico
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

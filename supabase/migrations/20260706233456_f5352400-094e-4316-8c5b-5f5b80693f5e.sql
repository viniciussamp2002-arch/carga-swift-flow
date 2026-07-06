
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_carga_sync_recursos() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_nota_gera_financeiro() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.tg_preserve_documented_note() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF OLD.carga_entrada_id IS NOT NULL AND (EXISTS(SELECT 1 FROM public.checklists_recebimento WHERE carga_entrada_id=OLD.carga_entrada_id) OR EXISTS(SELECT 1 FROM public.documentos_recebimento WHERE carga_entrada_id=OLD.carga_entrada_id) OR EXISTS(SELECT 1 FROM public.historico WHERE entidade_id=OLD.carga_entrada_id AND acao NOT IN ('criada','criacao','importacao'))) THEN RAISE EXCEPTION 'Nota vinculada a documentos ou histórico da carga: exclusão bloqueada'; END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.tg_preserve_documented_note() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_documented_note BEFORE DELETE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.tg_preserve_documented_note();
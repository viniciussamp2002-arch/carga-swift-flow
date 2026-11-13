CREATE FUNCTION public.tg_validate_recebimento_documento() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE recebido numeric; previsto numeric; answer text;
BEGIN
 IF COALESCE(btrim(NEW.dados->>'conferente'),'')='' OR COALESCE(NEW.dados->>'data','')='' THEN RAISE EXCEPTION 'Informe conferente e data do documento'; END IF;
 PERFORM (NEW.dados->>'data')::timestamptz;
 previsto:=(NEW.dados->>'volumes_previstos')::numeric;
 IF previsto IS NULL OR previsto<0 OR previsto<>trunc(previsto) THEN RAISE EXCEPTION 'Volumes previstos devem ser inteiros e não negativos'; END IF;
 IF TG_TABLE_NAME='checklists_recebimento' OR NEW.dados ? 'respostas' AND COALESCE(NEW.dados->>'volumes_recebidos','')<>'' THEN
  IF TG_TABLE_NAME='checklists_recebimento' THEN
   recebido:=(NEW.dados->>'volumes_recebidos')::numeric;
   IF recebido IS NULL OR recebido<0 OR recebido<>trunc(recebido) THEN RAISE EXCEPTION 'Informe volumes recebidos inteiros e não negativos'; END IF;
  END IF;
  FOR answer IN SELECT value FROM jsonb_each_text(COALESCE(NEW.dados->'respostas','{}'::jsonb)) LOOP
   IF answer NOT IN ('sim','nao','na','') THEN RAISE EXCEPTION 'Resposta de checklist inválida'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_validate_recebimento_documento() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_checklist BEFORE INSERT OR UPDATE ON public.checklists_recebimento FOR EACH ROW EXECUTE FUNCTION public.tg_validate_recebimento_documento();
CREATE TRIGGER validate_receiving_document BEFORE INSERT ON public.documentos_recebimento FOR EACH ROW EXECUTE FUNCTION public.tg_validate_recebimento_documento();
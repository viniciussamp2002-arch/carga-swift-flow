ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS grupo_importacao uuid;
CREATE INDEX IF NOT EXISTS notas_grupo_importacao_idx ON public.notas_fiscais(grupo_importacao);
CREATE OR REPLACE FUNCTION public.tg_validate_fiscal_keys() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE k text; keys_to_check text[];
BEGIN
 IF TG_OP='UPDATE' AND NEW.chave_nfe IS NOT DISTINCT FROM OLD.chave_nfe AND NEW.chaves_agrupadas IS NOT DISTINCT FROM OLD.chaves_agrupadas THEN RETURN NEW; END IF;
 keys_to_check := ARRAY(SELECT DISTINCT v FROM unnest(array_prepend(NEW.chave_nfe, NEW.chaves_agrupadas)) v WHERE v IS NOT NULL AND v <> '');
 FOREACH k IN ARRAY keys_to_check LOOP
  IF k !~ '^[0-9]{44}$' THEN RAISE EXCEPTION 'Chave de NF-e deve conter 44 dígitos' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF TG_OP='INSERT' AND cardinality(NEW.chaves_agrupadas)>1 THEN RAISE EXCEPTION 'Importe cada NF separadamente; agrupamento não pode fundir registros fiscais' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY(SELECT v FROM unnest(keys_to_check) v ORDER BY v) LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(k, 0));
  IF EXISTS (SELECT 1 FROM public.notas_fiscais n WHERE n.id<>NEW.id AND (n.chave_nfe=k OR k=ANY(n.chaves_agrupadas))) THEN RAISE EXCEPTION 'NF-e já cadastrada: %', k USING ERRCODE='23505'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_fiscal_keys BEFORE INSERT OR UPDATE OF chave_nfe, chaves_agrupadas ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.tg_validate_fiscal_keys();
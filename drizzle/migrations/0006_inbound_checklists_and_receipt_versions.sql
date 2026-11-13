CREATE TABLE public.checklists_recebimento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), carga_entrada_id uuid NOT NULL UNIQUE REFERENCES public.cargas_entrada(id) ON DELETE RESTRICT,
 dados jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(dados)='object'), versao integer NOT NULL DEFAULT 1,
 registrado_por uuid, registrado_por_nome text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.checklists_recebimento TO authenticated;
GRANT ALL ON public.checklists_recebimento TO service_role;
ALTER TABLE public.checklists_recebimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklist_rw ON public.checklists_recebimento FOR ALL TO authenticated USING(private.can_write(auth.uid())) WITH CHECK(private.can_write(auth.uid()));
CREATE TABLE public.documentos_recebimento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), carga_entrada_id uuid NOT NULL REFERENCES public.cargas_entrada(id) ON DELETE RESTRICT,
 tipo text NOT NULL CHECK(tipo IN ('checklist','recibo')), versao integer NOT NULL DEFAULT 1,
 dados jsonb NOT NULL CHECK(jsonb_typeof(dados)='object'), registrado_por uuid, registrado_por_nome text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(carga_entrada_id,tipo,versao)
);
GRANT SELECT, INSERT ON public.documentos_recebimento TO authenticated;
GRANT ALL ON public.documentos_recebimento TO service_role;
ALTER TABLE public.documentos_recebimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY documento_select ON public.documentos_recebimento FOR SELECT TO authenticated USING(private.can_write(auth.uid()));
CREATE POLICY documento_insert ON public.documentos_recebimento FOR INSERT TO authenticated WITH CHECK(private.can_write(auth.uid()));
CREATE FUNCTION public.tg_recebimento_documento_identidade() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE nome text; kg numeric; tarifa numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para salvar documentos'; END IF;
 SELECT COALESCE(NULLIF(p.nome,''),p.email) INTO nome FROM public.profiles p WHERE p.id=auth.uid();
 PERFORM 1 FROM public.cargas_entrada WHERE id=NEW.carga_entrada_id FOR UPDATE;
 NEW.registrado_por:=auth.uid(); NEW.registrado_por_nome:=nome;
 IF TG_TABLE_NAME='checklists_recebimento' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.carga_entrada_id IS DISTINCT FROM OLD.carga_entrada_id THEN RAISE EXCEPTION 'O vínculo da conferência não pode mudar'; END IF;
   NEW.versao:=OLD.versao+1; NEW.created_at:=OLD.created_at;
  ELSE NEW.versao:=1; END IF;
  NEW.updated_at:=now();
 ELSE
  SELECT COALESCE(max(versao),0)+1 INTO NEW.versao FROM public.documentos_recebimento WHERE carga_entrada_id=NEW.carga_entrada_id AND tipo=NEW.tipo;
  NEW.created_at:=now();
  IF NEW.tipo='recibo' THEN
   kg:=(NEW.dados->>'peso_kg')::numeric; tarifa:=(NEW.dados->>'tarifa')::numeric;
   IF kg IS NULL OR tarifa IS NULL OR kg<0 OR tarifa<0 THEN RAISE EXCEPTION 'Peso e tarifa devem ser válidos e não negativos'; END IF;
   NEW.dados:=NEW.dados || jsonb_build_object('toneladas',kg/1000,'valor_total',round(kg/1000*tarifa,2));
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_recebimento_documento_identidade() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER checklist_identity BEFORE INSERT OR UPDATE ON public.checklists_recebimento FOR EACH ROW EXECUTE FUNCTION public.tg_recebimento_documento_identidade();
CREATE TRIGGER documento_identity BEFORE INSERT ON public.documentos_recebimento FOR EACH ROW EXECUTE FUNCTION public.tg_recebimento_documento_identidade();
CREATE FUNCTION public.tg_recebimento_documento_historico() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='checklists_recebimento' THEN
  INSERT INTO public.documentos_recebimento(carga_entrada_id,tipo,dados) VALUES(NEW.carga_entrada_id,'checklist',NEW.dados);
 ELSE
  INSERT INTO public.historico(entidade,entidade_id,acao,descricao,user_id) VALUES('carga_entrada',NEW.carga_entrada_id,'documento',CASE WHEN NEW.tipo='checklist' THEN 'Checklist salvo' ELSE 'Recibo de descarga emitido' END || ' — versão ' || NEW.versao,auth.uid());
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_recebimento_documento_historico() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER checklist_audit AFTER INSERT OR UPDATE ON public.checklists_recebimento FOR EACH ROW EXECUTE FUNCTION public.tg_recebimento_documento_historico();
CREATE TRIGGER documento_audit AFTER INSERT ON public.documentos_recebimento FOR EACH ROW EXECUTE FUNCTION public.tg_recebimento_documento_historico();
CREATE INDEX documentos_recebimento_carga_idx ON public.documentos_recebimento(carga_entrada_id,created_at);
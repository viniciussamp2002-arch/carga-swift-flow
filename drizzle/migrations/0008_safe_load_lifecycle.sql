ALTER TABLE public.cargas_entrada ADD COLUMN situacao text NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa','cancelada','arquivada','excluida')), ADD COLUMN situacao_motivo text, ADD COLUMN situacao_em timestamptz, ADD COLUMN situacao_por uuid;
ALTER TABLE public.cargas ADD COLUMN situacao text NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa','cancelada','arquivada','excluida')), ADD COLUMN situacao_motivo text, ADD COLUMN situacao_em timestamptz, ADD COLUMN situacao_por uuid;
UPDATE public.cargas_entrada SET situacao='cancelada', situacao_motivo='Cancelamento anterior à implantação do controle de situação' WHERE status='cancelada';
CREATE FUNCTION private.inspect_load(_tipo text, _id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; ids uuid[]; blocks text[]='{}'; qty int;
BEGIN
 IF _tipo='entrada' THEN SELECT to_jsonb(x) INTO c FROM public.cargas_entrada x WHERE id=_id; SELECT array_agg(id),count(*) INTO ids,qty FROM public.notas_fiscais WHERE carga_entrada_id=_id;
 ELSIF _tipo='saida' THEN SELECT to_jsonb(x) INTO c FROM public.cargas x WHERE id=_id; SELECT array_agg(id),count(*) INTO ids,qty FROM public.notas_fiscais WHERE carga_id=_id;
 ELSE RAISE EXCEPTION 'Tipo de carga inválido'; END IF;
 IF c IS NULL THEN RAISE EXCEPTION 'Carga não encontrada'; END IF;
 ids:=coalesce(ids,'{}');
 IF (_tipo='entrada' AND (c->>'data_chegada' IS NOT NULL OR c->>'status' IN ('recebida','recebida_parcial'))) OR (_tipo='saida' AND (c->>'data_saida' IS NOT NULL OR c->>'data_finalizacao' IS NOT NULL OR c->>'status' IN ('em_rota','finalizada'))) THEN blocks:=array_append(blocks,'Movimentação da carga'); END IF;
 IF EXISTS(SELECT 1 FROM public.notas_fiscais WHERE id=ANY(ids) AND (recebida OR recebida_em IS NOT NULL OR status::text NOT IN ('disponivel','separacao','carregamento'))) THEN blocks:=array_append(blocks,'Recebimento ou movimentação de notas'); END IF;
 IF EXISTS(SELECT 1 FROM public.notas_fiscais WHERE id=ANY(ids) AND ((_tipo='entrada' AND carga_id IS NOT NULL) OR (_tipo='saida' AND carga_entrada_id IS NOT NULL))) THEN blocks:=array_append(blocks,'Notas compartilhadas com outra operação'); END IF;
 IF EXISTS(SELECT 1 FROM public.entregas WHERE nota_id=ANY(ids) OR (_tipo='saida' AND carga_id=_id)) THEN blocks:=array_append(blocks,'Entregas'); END IF;
 IF EXISTS(SELECT 1 FROM public.ocorrencias WHERE nota_id=ANY(ids) OR (_tipo='entrada' AND carga_entrada_id=_id) OR (_tipo='saida' AND carga_id=_id)) THEN blocks:=array_append(blocks,'Ocorrências e anexos'); END IF;
 IF EXISTS(SELECT 1 FROM public.financeiro WHERE nota_fiscal_id=ANY(ids)) THEN blocks:=array_append(blocks,'Financeiro'); END IF;
 IF EXISTS(SELECT 1 FROM public.agendamentos WHERE nota_id=ANY(ids)) THEN blocks:=array_append(blocks,'Agendamentos'); END IF;
 IF _tipo='entrada' AND (EXISTS(SELECT 1 FROM public.checklists_recebimento WHERE carga_entrada_id=_id) OR EXISTS(SELECT 1 FROM public.documentos_recebimento WHERE carga_entrada_id=_id)) THEN blocks:=array_append(blocks,'Checklist ou documentos emitidos'); END IF;
 IF EXISTS(SELECT 1 FROM public.historico WHERE (entidade_id=_id OR entidade_id=ANY(ids)) AND acao NOT IN ('criada','criacao','importacao','vinculo_carga')) THEN blocks:=array_append(blocks,'Histórico operacional'); END IF;
 RETURN jsonb_build_object('numero',coalesce(c->>'numero_transporte',c->>'numero'),'notas',qty,'status',c->>'status','situacao',c->>'situacao','bloqueios',to_jsonb(blocks),'pode_excluir',cardinality(blocks)=0 AND c->>'situacao'<>'excluida');
END $$;
REVOKE ALL ON FUNCTION private.inspect_load(text,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.inspecionar_carga(_tipo text,_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
 RETURN private.inspect_load(_tipo,_id);
END $$;
REVOKE ALL ON FUNCTION public.inspecionar_carga(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inspecionar_carga(text,uuid) TO authenticated;
CREATE FUNCTION public.tg_load_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inspection jsonb; kind text; action text;
BEGIN
 kind:=CASE WHEN TG_TABLE_NAME='cargas_entrada' THEN 'entrada' ELSE 'saida' END;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Utilize Excluir carga: notas e histórico devem ser preservados'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.situacao<>'ativa' OR (kind='entrada' AND NEW.status::text='cancelada') THEN RAISE EXCEPTION 'Cadastre uma carga ativa e utilize a ação Cancelar carga'; END IF;
  NEW.situacao_motivo:=NULL; NEW.situacao_em:=NULL; NEW.situacao_por:=NULL; RETURN NEW;
 END IF;
 IF NEW.situacao IS DISTINCT FROM OLD.situacao THEN
  IF auth.uid() IS NULL OR NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
  IF nullif(btrim(NEW.situacao_motivo),'') IS NULL THEN RAISE EXCEPTION 'Informe a justificativa'; END IF;
  IF OLD.situacao='excluida' OR NEW.situacao='ativa' THEN RAISE EXCEPTION 'Transição de situação não permitida'; END IF;
  IF NEW.situacao='cancelada' AND OLD.situacao<>'ativa' THEN RAISE EXCEPTION 'Somente cargas ativas podem ser canceladas'; END IF;
  IF NEW.situacao='excluida' THEN
   inspection:=private.inspect_load(kind,OLD.id);
   IF NOT (inspection->>'pode_excluir')::boolean THEN RAISE EXCEPTION 'Exclusão bloqueada: %. Utilize cancelamento ou arquivamento',inspection->'bloqueios'; END IF;
  END IF;
  NEW.status:=OLD.status; NEW.situacao_em:=clock_timestamp(); NEW.situacao_por:=auth.uid(); NEW.situacao_motivo:=btrim(NEW.situacao_motivo);
  action:=CASE NEW.situacao WHEN 'excluida' THEN 'exclusao_segura' WHEN 'cancelada' THEN 'cancelamento' ELSE 'arquivamento' END;
  INSERT INTO public.historico(entidade,entidade_id,acao,descricao,user_id) VALUES(CASE kind WHEN 'entrada' THEN 'carga_entrada' ELSE 'carga' END,OLD.id,action,format('Carga %s — %s. Justificativa: %s. Notas e registros preservados.',coalesce(to_jsonb(OLD)->>'numero_transporte',to_jsonb(OLD)->>'numero'),NEW.situacao,NEW.situacao_motivo),auth.uid());
 ELSE
  NEW.situacao_motivo:=OLD.situacao_motivo; NEW.situacao_em:=OLD.situacao_em; NEW.situacao_por:=OLD.situacao_por;
  IF OLD.situacao<>'ativa' AND to_jsonb(NEW)-'updated_at' IS DISTINCT FROM to_jsonb(OLD)-'updated_at' THEN RAISE EXCEPTION 'Carga inativa: dados e vínculos preservados para consulta'; END IF;
  IF kind='entrada' AND NEW.status::text='cancelada' AND OLD.status::text<>'cancelada' THEN RAISE EXCEPTION 'Utilize Cancelar carga com justificativa'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_load_lifecycle() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER load_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON public.cargas_entrada FOR EACH ROW EXECUTE FUNCTION public.tg_load_lifecycle();
CREATE TRIGGER load_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON public.cargas FOR EACH ROW EXECUTE FUNCTION public.tg_load_lifecycle();
CREATE FUNCTION public.alterar_situacao_carga(_tipo text,_id uuid,_acao text,_motivo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE state text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
 state:=CASE _acao WHEN 'excluir' THEN 'excluida' WHEN 'cancelar' THEN 'cancelada' WHEN 'arquivar' THEN 'arquivada' ELSE NULL END;
 IF state IS NULL THEN RAISE EXCEPTION 'Ação inválida'; END IF;
 IF _tipo='entrada' THEN
  PERFORM 1 FROM public.cargas_entrada WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carga não encontrada'; END IF;
  IF EXISTS(SELECT 1 FROM public.cargas_entrada WHERE id=_id AND situacao=state) THEN RAISE EXCEPTION 'Carga já está nesta situação'; END IF;
  UPDATE public.cargas_entrada SET situacao=state,situacao_motivo=_motivo WHERE id=_id;
 ELSIF _tipo='saida' THEN
  PERFORM 1 FROM public.cargas WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carga não encontrada'; END IF;
  IF EXISTS(SELECT 1 FROM public.cargas WHERE id=_id AND situacao=state) THEN RAISE EXCEPTION 'Carga já está nesta situação'; END IF;
  UPDATE public.cargas SET situacao=state,situacao_motivo=_motivo WHERE id=_id;
 ELSE RAISE EXCEPTION 'Tipo de carga inválido'; END IF;
 RETURN private.inspect_load(_tipo,_id);
END $$;
REVOKE ALL ON FUNCTION public.alterar_situacao_carga(text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.alterar_situacao_carga(text,uuid,text,text) TO authenticated;
CREATE FUNCTION public.tg_note_load_preservation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE nid uuid; cid uuid; state text; oldj jsonb; newj jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 FOR cid IN SELECT DISTINCT v FROM unnest(ARRAY[(oldj->>'carga_entrada_id')::uuid,(newj->>'carga_entrada_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT situacao INTO state FROM public.cargas_entrada WHERE id=cid FOR UPDATE;
  IF state<>'ativa' THEN RAISE EXCEPTION 'Carga de entrada inativa: notas preservadas para consulta'; END IF;
 END LOOP;
 FOR cid IN SELECT DISTINCT v FROM unnest(ARRAY[(oldj->>'carga_id')::uuid,(newj->>'carga_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT situacao INTO state FROM public.cargas WHERE id=cid FOR UPDATE;
  IF state<>'ativa' THEN RAISE EXCEPTION 'Carga de saída inativa: notas preservadas para consulta'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN
  nid:=OLD.id;
  IF OLD.recebida_em IS NOT NULL OR (OLD.recebida AND OLD.carga_entrada_id IS NOT NULL) OR OLD.carga_id IS NOT NULL OR OLD.status::text NOT IN ('disponivel') OR EXISTS(SELECT 1 FROM public.entregas WHERE nota_id=nid) OR EXISTS(SELECT 1 FROM public.financeiro WHERE nota_fiscal_id=nid) OR EXISTS(SELECT 1 FROM public.agendamentos WHERE nota_id=nid) OR EXISTS(SELECT 1 FROM public.ocorrencias WHERE nota_id=nid) OR EXISTS(SELECT 1 FROM public.historico WHERE entidade_id=nid AND acao NOT IN ('criada','criacao','importacao')) THEN RAISE EXCEPTION 'Nota com movimentação ou vínculos: exclusão bloqueada para preservar o histórico'; END IF;
  RETURN OLD;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_note_load_preservation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER note_load_preservation BEFORE INSERT OR UPDATE OR DELETE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.tg_note_load_preservation();
CREATE FUNCTION public.tg_lock_operational_load() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j jsonb; n public.notas_fiscais; cid uuid; state text;
BEGIN
 j:=to_jsonb(NEW);
 IF j->>'nota_id' IS NOT NULL OR j->>'nota_fiscal_id' IS NOT NULL THEN
  SELECT * INTO n FROM public.notas_fiscais WHERE id=coalesce(j->>'nota_id',j->>'nota_fiscal_id')::uuid FOR UPDATE;
 END IF;
 FOR cid IN SELECT DISTINCT v FROM unnest(ARRAY[n.carga_entrada_id,(j->>'carga_entrada_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT situacao INTO state FROM public.cargas_entrada WHERE id=cid FOR UPDATE;
  IF state='excluida' THEN RAISE EXCEPTION 'Carga excluída: não admite novos vínculos'; END IF;
  IF TG_TABLE_NAME IN ('checklists_recebimento','documentos_recebimento') AND state<>'ativa' THEN RAISE EXCEPTION 'Carga inativa: documentos anteriores disponíveis para consulta'; END IF;
 END LOOP;
 FOR cid IN SELECT DISTINCT v FROM unnest(ARRAY[n.carga_id,(j->>'carga_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT situacao INTO state FROM public.cargas WHERE id=cid FOR UPDATE;
  IF state='excluida' THEN RAISE EXCEPTION 'Carga excluída: não admite novos vínculos'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_lock_operational_load() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER lock_operational_load BEFORE INSERT OR UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.tg_lock_operational_load();
CREATE TRIGGER lock_operational_load BEFORE INSERT OR UPDATE ON public.entregas FOR EACH ROW EXECUTE FUNCTION public.tg_lock_operational_load();
CREATE TRIGGER lock_operational_load BEFORE INSERT OR UPDATE ON public.financeiro FOR EACH ROW EXECUTE FUNCTION public.tg_lock_operational_load();
CREATE TRIGGER lock_operational_load BEFORE INSERT OR UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.tg_lock_operational_load();
CREATE TRIGGER lock_operational_load BEFORE INSERT OR UPDATE ON public.checklists_recebimento FOR EACH ROW EXECUTE FUNCTION public.tg_lock_operational_load();
CREATE TRIGGER lock_operational_load BEFORE INSERT ON public.documentos_recebimento FOR EACH ROW EXECUTE FUNCTION public.tg_lock_operational_load();
COMMENT ON COLUMN public.cargas.situacao IS 'Independent operational lifecycle. Exclusion is non-destructive; fiscal records and history are retained.';
COMMENT ON COLUMN public.cargas_entrada.situacao IS 'Independent operational lifecycle. Exclusion is non-destructive; fiscal records and history are retained.';
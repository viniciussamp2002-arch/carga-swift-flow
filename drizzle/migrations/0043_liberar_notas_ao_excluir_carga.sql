CREATE OR REPLACE FUNCTION private.inspect_load(_tipo text, _id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c jsonb; ids uuid[]; blocks text[]='{}'; qty int;
BEGIN
 IF _tipo='entrada' THEN
  SELECT to_jsonb(x) INTO c FROM public.cargas_entrada x WHERE id=_id;
  SELECT array_agg(id),count(*) INTO ids,qty FROM public.notas_fiscais WHERE carga_entrada_id=_id;
 ELSIF _tipo='saida' THEN
  SELECT to_jsonb(x) INTO c FROM public.cargas x WHERE id=_id;
  SELECT array_agg(id),count(*) INTO ids,qty FROM public.notas_fiscais WHERE carga_id=_id;
 ELSE RAISE EXCEPTION 'Tipo de carga inválido'; END IF;
 IF c IS NULL THEN RAISE EXCEPTION 'Carga não encontrada'; END IF;
 ids:=coalesce(ids,'{}');
 IF _tipo='saida' THEN
  IF c->>'data_saida' IS NOT NULL OR c->>'data_finalizacao' IS NOT NULL OR c->>'status' IN ('em_rota','finalizada') THEN blocks:=array_append(blocks,'Carga em rota ou finalizada'); END IF;
  IF EXISTS(SELECT 1 FROM public.notas_fiscais WHERE id=ANY(ids) AND status::text NOT IN ('disponivel','separacao','carregamento')) THEN blocks:=array_append(blocks,'Nota com movimentação de entrega'); END IF;
  IF EXISTS(SELECT 1 FROM public.entregas WHERE nota_id=ANY(ids) OR carga_id=_id) THEN blocks:=array_append(blocks,'Entregas'); END IF;
  IF EXISTS(SELECT 1 FROM public.comprovantes WHERE carga_id=_id OR nota_id=ANY(ids) OR nota_envio_id=ANY(ids)) THEN blocks:=array_append(blocks,'Canhotos ou documentos enviados'); END IF;
  IF EXISTS(SELECT 1 FROM public.ocorrencias WHERE carga_id=_id OR (nota_id=ANY(ids) AND origem='entrega')) THEN blocks:=array_append(blocks,'Ocorrências de transporte ou entrega'); END IF;
  IF EXISTS(SELECT 1 FROM public.financeiro WHERE nota_fiscal_id=ANY(ids) AND (NOT previsao OR comprovante_id IS NOT NULL OR entrega_id IS NOT NULL OR estado_frete IN ('conferido','pronto_faturamento','faturado'))) THEN blocks:=array_append(blocks,'Financeiro confirmado'); END IF;
  IF EXISTS(SELECT 1 FROM public.devolucoes WHERE nota_origem_id=ANY(ids)) THEN blocks:=array_append(blocks,'Devoluções'); END IF;
 ELSE
  IF c->>'data_chegada' IS NOT NULL OR c->>'status' IN ('recebida','recebida_parcial') THEN blocks:=array_append(blocks,'Movimentação da carga'); END IF;
  IF EXISTS(SELECT 1 FROM public.notas_fiscais WHERE id=ANY(ids) AND (recebida OR recebida_em IS NOT NULL OR status::text NOT IN ('disponivel','separacao','carregamento'))) THEN blocks:=array_append(blocks,'Recebimento ou movimentação de notas'); END IF;
  IF EXISTS(SELECT 1 FROM public.notas_fiscais WHERE id=ANY(ids) AND carga_id IS NOT NULL) THEN blocks:=array_append(blocks,'Notas compartilhadas com outra operação'); END IF;
  IF EXISTS(SELECT 1 FROM public.entregas WHERE nota_id=ANY(ids)) THEN blocks:=array_append(blocks,'Entregas'); END IF;
  IF EXISTS(SELECT 1 FROM public.ocorrencias WHERE nota_id=ANY(ids) OR carga_entrada_id=_id) THEN blocks:=array_append(blocks,'Ocorrências e anexos'); END IF;
  IF EXISTS(SELECT 1 FROM public.financeiro WHERE nota_fiscal_id=ANY(ids)) THEN blocks:=array_append(blocks,'Financeiro'); END IF;
  IF EXISTS(SELECT 1 FROM public.agendamentos WHERE nota_id=ANY(ids)) THEN blocks:=array_append(blocks,'Agendamentos'); END IF;
  IF EXISTS(SELECT 1 FROM public.checklists_recebimento WHERE carga_entrada_id=_id) OR EXISTS(SELECT 1 FROM public.documentos_recebimento WHERE carga_entrada_id=_id) THEN blocks:=array_append(blocks,'Checklist ou documentos emitidos'); END IF;
  IF EXISTS(SELECT 1 FROM public.historico WHERE (entidade_id=_id OR entidade_id=ANY(ids)) AND acao NOT IN ('criada','criacao','importacao','vinculo_carga')) THEN blocks:=array_append(blocks,'Histórico operacional'); END IF;
 END IF;
 RETURN jsonb_build_object('numero',coalesce(c->>'numero_transporte',c->>'numero'),'notas',qty,'status',c->>'status','situacao',c->>'situacao','bloqueios',to_jsonb(blocks),'pode_excluir',cardinality(blocks)=0 AND c->>'situacao'<>'excluida');
END $$;

CREATE OR REPLACE FUNCTION public.tg_note_load_preservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE nid uuid; cid uuid; state text; oldj jsonb; newj jsonb; desfaz_cancelada boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 FOR cid IN SELECT DISTINCT v FROM unnest(ARRAY[(oldj->>'carga_entrada_id')::uuid,(newj->>'carga_entrada_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT situacao INTO state FROM public.cargas_entrada WHERE id=cid FOR UPDATE;
  IF state<>'ativa' AND NOT (TG_OP='UPDATE' AND state IN ('cancelada','arquivada') AND (oldj->>'recebida')::boolean AND (newj->>'recebida')::boolean AND oldj->>'carga_entrada_id'=newj->>'carga_entrada_id' AND oldj->>'recebida_em' IS NOT DISTINCT FROM newj->>'recebida_em' AND oldj->>'recebida_por' IS NOT DISTINCT FROM newj->>'recebida_por') THEN RAISE EXCEPTION 'Carga de entrada inativa: recebimento e vínculos preservados para consulta'; END IF;
 END LOOP;
 FOR cid IN SELECT DISTINCT v FROM unnest(ARRAY[(oldj->>'carga_id')::uuid,(newj->>'carga_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT situacao INTO state FROM public.cargas WHERE id=cid FOR UPDATE;
  desfaz_cancelada:=TG_OP='UPDATE' AND state='cancelada' AND (oldj->>'carga_id')::uuid=cid AND newj->>'carga_id' IS NULL AND oldj->>'status' IN ('separacao','carregamento') AND newj->>'status'='disponivel' AND (newj-'carga_id'-'status'-'updated_at')=(oldj-'carga_id'-'status'-'updated_at');
  IF state<>'ativa' AND NOT desfaz_cancelada THEN RAISE EXCEPTION 'Carga de saída inativa: notas preservadas para consulta'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN
  nid:=OLD.id;
  IF OLD.recebida_em IS NOT NULL OR (OLD.recebida AND OLD.carga_entrada_id IS NOT NULL) OR OLD.carga_id IS NOT NULL OR OLD.status::text NOT IN ('disponivel') OR EXISTS(SELECT 1 FROM public.entregas WHERE nota_id=nid) OR EXISTS(SELECT 1 FROM public.financeiro WHERE nota_fiscal_id=nid AND (NOT previsao OR comprovante_id IS NOT NULL OR entrega_id IS NOT NULL OR estado_frete IN ('conferido','pronto_faturamento','faturado'))) OR EXISTS(SELECT 1 FROM public.agendamentos WHERE nota_id=nid) OR EXISTS(SELECT 1 FROM public.ocorrencias WHERE nota_id=nid) OR EXISTS(SELECT 1 FROM public.historico WHERE entidade_id=nid AND acao NOT IN ('criada','criacao','importacao')) THEN RAISE EXCEPTION 'Nota com movimentação ou vínculos: exclusão bloqueada para preservar o histórico'; END IF;
  RETURN OLD;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.alterar_situacao_carga(_tipo text, _id uuid, _acao text, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE state text; c public.cargas; inspection jsonb; note_ids uuid[]; qty int;
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
  SELECT * INTO c FROM public.cargas WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carga não encontrada'; END IF;
  IF c.situacao=state THEN RAISE EXCEPTION 'Carga já está nesta situação'; END IF;
  IF _acao='excluir' THEN
   inspection:=private.inspect_load('saida',_id);
   IF NOT (inspection->>'pode_excluir')::boolean THEN RAISE EXCEPTION 'Exclusão bloqueada: %',inspection->'bloqueios'; END IF;
   SELECT array_agg(id) INTO note_ids FROM public.notas_fiscais WHERE carga_id=_id;
   note_ids:=coalesce(note_ids,'{}');
   UPDATE public.notas_fiscais SET carga_id=NULL,status='disponivel' WHERE carga_id=_id AND status IN ('separacao','carregamento');
   GET DIAGNOSTICS qty = ROW_COUNT;
   INSERT INTO public.historico(entidade,entidade_id,acao,descricao,user_id)
    SELECT 'nota',id,'desvinculo_carga','NF '||numero||' liberada da carga #'||c.numero||' e devolvida ao Depósito. Justificativa: '||btrim(_motivo),auth.uid() FROM public.notas_fiscais WHERE id=ANY(note_ids);
   IF qty>0 THEN INSERT INTO public.historico(entidade,entidade_id,acao,descricao,user_id) VALUES('carga',_id,'notas_liberadas',qty||' nota(s) devolvida(s) ao Depósito antes da exclusão da carga #'||c.numero,auth.uid()); END IF;
  END IF;
  UPDATE public.cargas SET situacao=state,situacao_motivo=_motivo WHERE id=_id;
 ELSE RAISE EXCEPTION 'Tipo de carga inválido'; END IF;
 RETURN private.inspect_load(_tipo,_id);
END $$;
REVOKE ALL ON FUNCTION public.alterar_situacao_carga(text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.alterar_situacao_carga(text,uuid,text,text) TO authenticated;
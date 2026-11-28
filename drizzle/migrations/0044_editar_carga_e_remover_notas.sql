CREATE FUNCTION public.remover_notas_carga_saida(_carga uuid, _notas uuid[], _motivo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cargas; ids uuid[]; qty int; total int;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(coalesce(_motivo,'')),'') IS NULL THEN RAISE EXCEPTION 'Informe o motivo da remoção'; END IF;
 SELECT array_agg(DISTINCT v) INTO ids FROM unnest(coalesce(_notas,'{}')) AS t(v);
 ids:=coalesce(ids,'{}');
 IF cardinality(ids)=0 THEN RAISE EXCEPTION 'Selecione ao menos uma nota'; END IF;
 SELECT * INTO c FROM public.cargas WHERE id=_carga FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Carga não encontrada'; END IF;
 IF c.situacao<>'ativa' OR c.status NOT IN ('separacao','carregamento') THEN RAISE EXCEPTION 'Somente notas de cargas ativas em montagem podem ser removidas'; END IF;
 PERFORM id FROM public.notas_fiscais WHERE id=ANY(ids) FOR UPDATE;
 SELECT count(*) INTO total FROM public.notas_fiscais WHERE id=ANY(ids) AND carga_id=_carga AND status IN ('separacao','carregamento');
 IF total<>cardinality(ids) THEN RAISE EXCEPTION 'Uma ou mais notas não pertencem a esta carga ou já foram movimentadas'; END IF;
 IF EXISTS(SELECT 1 FROM public.entregas WHERE carga_id=_carga OR nota_id=ANY(ids)) THEN RAISE EXCEPTION 'Remoção bloqueada: existem entregas registradas'; END IF;
 IF EXISTS(SELECT 1 FROM public.comprovantes WHERE carga_id=_carga OR nota_id=ANY(ids) OR nota_envio_id=ANY(ids)) THEN RAISE EXCEPTION 'Remoção bloqueada: existem canhotos ou documentos enviados'; END IF;
 IF EXISTS(SELECT 1 FROM public.ocorrencias WHERE carga_id=_carga OR (nota_id=ANY(ids) AND origem='entrega')) THEN RAISE EXCEPTION 'Remoção bloqueada: existem ocorrências de transporte ou entrega'; END IF;
 IF EXISTS(SELECT 1 FROM public.financeiro WHERE nota_fiscal_id=ANY(ids) AND (NOT previsao OR comprovante_id IS NOT NULL OR entrega_id IS NOT NULL OR estado_frete IN ('conferido','pronto_faturamento','faturado'))) THEN RAISE EXCEPTION 'Remoção bloqueada: existe financeiro confirmado'; END IF;
 IF EXISTS(SELECT 1 FROM public.devolucoes WHERE nota_origem_id=ANY(ids)) THEN RAISE EXCEPTION 'Remoção bloqueada: existem devoluções vinculadas'; END IF;
 UPDATE public.notas_fiscais SET carga_id=NULL,status='disponivel' WHERE id=ANY(ids);
 GET DIAGNOSTICS qty = ROW_COUNT;
 INSERT INTO public.historico(entidade,entidade_id,acao,descricao,user_id)
  SELECT 'nota',id,'desvinculo_carga','NF '||numero||' removida da carga #'||c.numero||' e devolvida ao Depósito. Motivo: '||btrim(_motivo),auth.uid() FROM public.notas_fiscais WHERE id=ANY(ids);
 INSERT INTO public.historico(entidade,entidade_id,acao,descricao,user_id) VALUES('carga',_carga,'notas_removidas',qty||' nota(s) removida(s) da carga #'||c.numero||'. Motivo: '||btrim(_motivo),auth.uid());
 RETURN qty;
END $$;
REVOKE ALL ON FUNCTION public.remover_notas_carga_saida(uuid,uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remover_notas_carga_saida(uuid,uuid[],text) TO authenticated;

CREATE FUNCTION public.editar_carga_saida(_id uuid, _motorista uuid, _veiculo uuid, _data date, _obs text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.cargas; antigo_m text; novo_m text; antiga_v text; nova_v text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.cargas WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Carga não encontrada'; END IF;
 IF c.situacao<>'ativa' OR c.status='finalizada' THEN RAISE EXCEPTION 'Somente cargas ativas e não finalizadas podem ser editadas'; END IF;
 IF _motorista IS NULL OR _veiculo IS NULL THEN RAISE EXCEPTION 'Selecione motorista e veículo'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.motoristas WHERE id=_motorista AND ativo) THEN RAISE EXCEPTION 'Motorista inválido ou inativo'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.veiculos WHERE id=_veiculo AND situacao<>'inativo') THEN RAISE EXCEPTION 'Veículo inválido ou inativo'; END IF;
 SELECT nome INTO antigo_m FROM public.motoristas WHERE id=c.motorista_id;
 SELECT nome INTO novo_m FROM public.motoristas WHERE id=_motorista;
 SELECT placa INTO antiga_v FROM public.veiculos WHERE id=c.veiculo_id;
 SELECT placa INTO nova_v FROM public.veiculos WHERE id=_veiculo;
 UPDATE public.cargas SET motorista_id=_motorista,veiculo_id=_veiculo,data_prevista_saida=_data,observacoes=coalesce(_obs,'') WHERE id=_id;
 IF c.status='em_rota' THEN
  IF c.motorista_id IS DISTINCT FROM _motorista AND c.motorista_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cargas WHERE id<>_id AND situacao='ativa' AND status='em_rota' AND motorista_id=c.motorista_id) THEN UPDATE public.motoristas SET situacao='disponivel' WHERE id=c.motorista_id; END IF;
  IF c.veiculo_id IS DISTINCT FROM _veiculo AND c.veiculo_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cargas WHERE id<>_id AND situacao='ativa' AND status='em_rota' AND veiculo_id=c.veiculo_id) THEN UPDATE public.veiculos SET situacao='disponivel' WHERE id=c.veiculo_id; END IF;
  UPDATE public.motoristas SET situacao='em_viagem' WHERE id=_motorista;
  UPDATE public.veiculos SET situacao='em_rota' WHERE id=_veiculo;
 END IF;
 INSERT INTO public.historico(entidade,entidade_id,acao,descricao,user_id) VALUES('carga',_id,'edicao','Carga #'||c.numero||' editada. Motorista: '||coalesce(antigo_m,'—')||' → '||novo_m||'; veículo: '||coalesce(antiga_v,'—')||' → '||nova_v||'.',auth.uid());
 RETURN jsonb_build_object('id',_id,'numero',c.numero);
END $$;
REVOKE ALL ON FUNCTION public.editar_carga_saida(uuid,uuid,uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.editar_carga_saida(uuid,uuid,uuid,date,text) TO authenticated;
COMMENT ON FUNCTION public.remover_notas_carga_saida(uuid,uuid[],text) IS 'Office-only transactional removal of assembly notes; preserves receipt, scheduling and audit history.';
COMMENT ON FUNCTION public.editar_carga_saida(uuid,uuid,uuid,date,text) IS 'Office-only edit of active outbound loads; route resource states remain synchronized.';
CREATE OR REPLACE FUNCTION public.tratar_devolucao(_documento uuid,_dados jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d devolucoes; p comprovantes; n notas_fiscais; x jsonb; fiscal jsonb; uid uuid:=auth.uid(); nid uuid; old devolucao_itens; bal numeric; new_item uuid; state text:=coalesce(_dados->>'documental','pendente');
BEGIN
  IF NOT private.can_write(uid) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  SELECT * INTO p FROM comprovantes WHERE id=_documento FOR UPDATE;
  IF NOT FOUND OR p.tipo_documento<>'devolucao' THEN RAISE EXCEPTION 'Documento não classificado como nota de devolução'; END IF;
  IF p.triagem<>'analisado' THEN UPDATE comprovantes SET triagem='analisado',updated_at=now() WHERE id=_documento; END IF;
  SELECT * INTO d FROM devolucoes WHERE comprovante_id=_documento FOR UPDATE;
  nid:=nullif(_dados->>'nota_origem_id','')::uuid;
  IF d.id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM devolucao_itens i WHERE i.devolucao_id=d.id AND i.ativo AND (
      EXISTS(SELECT 1 FROM devolucao_movimentos m WHERE m.item_id=i.id AND m.tipo='saida')
      OR EXISTS(SELECT 1 FROM devolucao_reservas r WHERE r.item_id=i.id AND r.status='ativa')
      OR EXISTS(SELECT 1 FROM devolucao_alocacoes a WHERE a.item_id=i.id))) THEN
      RAISE EXCEPTION 'Tratamento preservado: há pallet, reserva ou retirada registrada para estes produtos'; END IF;
    IF (_dados->>'versao')::int IS DISTINCT FROM d.versao THEN RAISE EXCEPTION 'Devolução alterada por outra pessoa; atualize'; END IF;
  END IF;
  IF nid IS NOT NULL THEN SELECT * INTO n FROM notas_fiscais WHERE id=nid; IF NOT FOUND THEN RAISE EXCEPTION 'Nota de origem não encontrada'; END IF; END IF;
  IF state='tratada' AND (nid IS NULL OR trim(coalesce(_dados->>'numero_nf',''))='' OR jsonb_array_length(coalesce(_dados->'itens','[]'))=0) THEN RAISE EXCEPTION 'Informe NF de devolução, origem e ao menos um produto'; END IF;
  IF d.id IS NULL THEN INSERT INTO devolucoes(comprovante_id,created_by) VALUES(_documento,uid) RETURNING * INTO d;
  ELSE
    FOR old IN SELECT * FROM devolucao_itens WHERE devolucao_id=d.id AND ativo LOOP
      SELECT coalesce(sum(CASE WHEN tipo='entrada' THEN quantidade ELSE -quantidade END),0) INTO bal FROM devolucao_movimentos WHERE item_id=old.id;
      IF bal>0 THEN INSERT INTO devolucao_movimentos(id,item_id,tipo,quantidade,unidade,motivo,observacoes,registrado_por) VALUES(gen_random_uuid(),old.id,'saida',bal,old.unidade,'Ajuste por reedição do tratamento','Saldo substituído pela nova versão; sem retirada física',uid); END IF;
    END LOOP;
    UPDATE devolucao_itens SET ativo=false WHERE devolucao_id=d.id AND ativo;
  END IF;
  UPDATE devolucoes SET nota_origem_id=nid,numero_nf=coalesce(_dados->>'numero_nf',''),data_documento=nullif(_dados->>'data_documento','')::date,documental=state,observacoes=coalesce(_dados->>'observacoes',''),versao=versao+1,updated_at=now() WHERE id=d.id;
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(_dados->'itens','[]')) LOOP
    fiscal:=NULL;
    SELECT value INTO fiscal FROM jsonb_array_elements(n.itens_xml) WHERE value->>'numero'=x->>'item_numero';
    IF fiscal IS NULL THEN RAISE EXCEPTION 'Produto inexistente no XML da nota de origem'; END IF;
    IF coalesce((x->>'quantidade')::numeric,0)<=0 THEN RAISE EXCEPTION 'Quantidade devolvida deve ser maior que zero'; END IF;
    IF trim(coalesce(x->>'unidade',''))='' OR trim(coalesce(x->>'motivo',''))='' THEN RAISE EXCEPTION 'Informe unidade e motivo por item'; END IF;
    IF x->>'motivo'='falta' AND coalesce((x->>'retorno_fisico')::boolean,true) THEN RAISE EXCEPTION 'Falta não cria retorno físico'; END IF;
    INSERT INTO devolucao_itens(devolucao_id,item_numero,codigo,descricao,quantidade_original,unidade_original,quantidade,unidade,motivo,lote,validade,observacoes,retorno_fisico)
      VALUES(d.id,fiscal->>'numero',fiscal->>'codigo',fiscal->>'descricao',(fiscal->>'quantidade')::numeric,fiscal->>'unidade',(x->>'quantidade')::numeric,upper(trim(x->>'unidade')),x->>'motivo',coalesce(x->>'lote',''),nullif(x->>'validade','')::date,coalesce(x->>'observacoes',''),coalesce((x->>'retorno_fisico')::boolean,true))
      RETURNING id INTO new_item;
    IF state='tratada' AND coalesce((x->>'retorno_fisico')::boolean,true) THEN
      INSERT INTO devolucao_movimentos(id,item_id,tipo,quantidade,unidade,motivo,registrado_por) VALUES(gen_random_uuid(),new_item,'entrada',(x->>'quantidade')::numeric,upper(trim(x->>'unidade')),'Entrada automática ao tratar devolução',uid);
    END IF;
  END LOOP;
  INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('devolucao',d.id,'tratamento',state,uid);
  RETURN d.id;
END $$;
REVOKE ALL ON FUNCTION public.tratar_devolucao(uuid,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.tratar_devolucao(uuid,jsonb) TO authenticated;
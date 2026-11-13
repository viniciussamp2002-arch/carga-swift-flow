CREATE OR REPLACE FUNCTION public.tg_note_load_preservation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE nid uuid; cid uuid; state text; oldj jsonb; newj jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 FOR cid IN SELECT DISTINCT v FROM unnest(ARRAY[(oldj->>'carga_entrada_id')::uuid,(newj->>'carga_entrada_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT situacao INTO state FROM public.cargas_entrada WHERE id=cid FOR UPDATE;
  IF state<>'ativa' AND NOT (TG_OP='UPDATE' AND state IN ('cancelada','arquivada') AND (oldj->>'recebida')::boolean AND (newj->>'recebida')::boolean AND oldj->>'carga_entrada_id'=newj->>'carga_entrada_id' AND oldj->>'recebida_em' IS NOT DISTINCT FROM newj->>'recebida_em' AND oldj->>'recebida_por' IS NOT DISTINCT FROM newj->>'recebida_por') THEN RAISE EXCEPTION 'Carga de entrada inativa: recebimento e vínculos preservados para consulta'; END IF;
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
COMMENT ON FUNCTION public.tg_note_load_preservation() IS 'Locks parent loads. Archiving a received inbound load never prevents downstream depot or delivery operations; original receipt identity and inbound linkage remain protected.';
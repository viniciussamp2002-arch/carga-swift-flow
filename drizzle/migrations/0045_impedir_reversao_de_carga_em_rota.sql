CREATE OR REPLACE FUNCTION public.tg_note_load_preservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE nid uuid; cid uuid; state text; load_status text; oldj jsonb; newj jsonb; desfaz_cancelada boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN oldj:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN newj:=to_jsonb(NEW); END IF;
 FOR cid IN SELECT DISTINCT v FROM unnest(ARRAY[(oldj->>'carga_entrada_id')::uuid,(newj->>'carga_entrada_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT situacao INTO state FROM public.cargas_entrada WHERE id=cid FOR UPDATE;
  IF state<>'ativa' AND NOT (TG_OP='UPDATE' AND state IN ('cancelada','arquivada') AND (oldj->>'recebida')::boolean AND (newj->>'recebida')::boolean AND oldj->>'carga_entrada_id'=newj->>'carga_entrada_id' AND oldj->>'recebida_em' IS NOT DISTINCT FROM newj->>'recebida_em' AND oldj->>'recebida_por' IS NOT DISTINCT FROM newj->>'recebida_por') THEN RAISE EXCEPTION 'Carga de entrada inativa: recebimento e vínculos preservados para consulta'; END IF;
 END LOOP;
 FOR cid IN SELECT DISTINCT v FROM unnest(ARRAY[(oldj->>'carga_id')::uuid,(newj->>'carga_id')::uuid]) v WHERE v IS NOT NULL ORDER BY v LOOP
  SELECT situacao,status::text INTO state,load_status FROM public.cargas WHERE id=cid FOR UPDATE;
  IF TG_OP='UPDATE' AND (oldj->>'carga_id')::uuid=cid AND newj->>'carga_id' IS NULL AND load_status IN ('em_rota','finalizada') THEN RAISE EXCEPTION 'Carga em rota ou finalizada: notas não podem ser removidas'; END IF;
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

CREATE FUNCTION public.tg_prevent_outbound_route_reversal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.status='em_rota' AND NEW.status IN ('separacao','carregamento') THEN RAISE EXCEPTION 'Carga em rota não pode retornar para montagem'; END IF;
 IF OLD.status='finalizada' AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Carga finalizada não pode mudar de status'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prevent_outbound_route_reversal BEFORE UPDATE OF status ON public.cargas FOR EACH ROW EXECUTE FUNCTION public.tg_prevent_outbound_route_reversal();
REVOKE ALL ON FUNCTION public.tg_prevent_outbound_route_reversal() FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.tg_prevent_outbound_route_reversal() IS 'Prevents route status rollback from bypassing the no-deletion rule for dispatched or finalized loads.';
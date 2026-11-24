ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS previsao_entrega date,
  ADD COLUMN IF NOT EXISTS previsao_entrega_original date,
  ADD COLUMN IF NOT EXISTS previsao_entrega_na_baixa date;
COMMENT ON COLUMN public.notas_fiscais.previsao_entrega IS 'Previsão de entrega ao cliente final, definida manualmente pelo escritório';
COMMENT ON COLUMN public.notas_fiscais.data_limite IS 'Prazo automático legado (recebimento + 5); não é a previsão ao cliente final';

CREATE OR REPLACE FUNCTION public.definir_previsao_entrega(_ids uuid[], _data date, _obs text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.can_write(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para definir previsões'; END IF;
  IF _data IS NULL OR coalesce(array_length(_ids,1),0) = 0 THEN RAISE EXCEPTION 'Informe a data e as notas'; END IF;
  FOR r IN SELECT id, previsao_entrega, status FROM public.notas_fiscais WHERE id = ANY(_ids) ORDER BY id FOR UPDATE LOOP
    IF r.status = 'entregue' THEN CONTINUE; END IF;
    UPDATE public.notas_fiscais SET previsao_entrega = _data,
      previsao_entrega_original = coalesce(previsao_entrega_original, _data)
    WHERE id = r.id;
    INSERT INTO public.historico(entidade, entidade_id, acao, user_id, descricao)
    VALUES ('nota', r.id, 'previsao_entrega', auth.uid(),
      'Previsão de entrega: ' || coalesce(to_char(r.previsao_entrega,'DD/MM/YYYY'),'sem previsão') || ' → ' || to_char(_data,'DD/MM/YYYY')
      || CASE WHEN nullif(trim(_obs),'') IS NOT NULL THEN ' | Obs: ' || trim(_obs) ELSE '' END);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.definir_previsao_entrega(uuid[], date, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.definir_previsao_entrega(uuid[], date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_previsao_entrega_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status IS DISTINCT FROM 'entregue' THEN
    NEW.previsao_entrega_na_baixa := OLD.previsao_entrega;
  END IF;
  IF NEW.previsao_entrega_original IS DISTINCT FROM OLD.previsao_entrega_original AND OLD.previsao_entrega_original IS NOT NULL THEN
    NEW.previsao_entrega_original := OLD.previsao_entrega_original;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_previsao_entrega_guard ON public.notas_fiscais;
CREATE TRIGGER tg_previsao_entrega_guard BEFORE UPDATE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.tg_previsao_entrega_guard();
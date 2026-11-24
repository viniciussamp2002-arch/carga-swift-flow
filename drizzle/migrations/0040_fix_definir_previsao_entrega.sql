CREATE OR REPLACE FUNCTION public.definir_previsao_entrega(_ids uuid[], _data date, _obs text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para definir previsões'; END IF;
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
END $function$;
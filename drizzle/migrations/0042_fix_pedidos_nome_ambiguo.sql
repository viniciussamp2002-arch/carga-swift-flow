CREATE OR REPLACE FUNCTION public.liberar_notas_pedido(_notas uuid[], _data date) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); _nome text; c int;
BEGIN
  IF NOT private.can_write(uid) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF _data IS NULL OR _data > (now() AT TIME ZONE 'America/Fortaleza')::date THEN RAISE EXCEPTION 'Data de disponibilidade inválida'; END IF;
  SELECT coalesce(nullif(pr.nome,''),pr.email) INTO _nome FROM profiles pr WHERE pr.id=uid;
  UPDATE notas_fiscais SET recebida=true, recebida_em=now(), recebida_por=uid, recebida_por_nome=_nome, data_chegada=_data
   WHERE id=ANY(_notas) AND origem='rancheiro' AND NOT recebida AND carga_entrada_id IS NULL;
  GET DIAGNOSTICS c = ROW_COUNT;
  INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) SELECT 'nota',u,'recebimento','Disponibilidade física confirmada em '||to_char(_data,'DD/MM/YYYY'),uid FROM unnest(_notas) u;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.faturar_pedidos(_notas jsonb, _vinculos jsonb, _completos uuid[], _disponivel boolean, _data_fisica date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); _nome text; x jsonb; chave text; nid uuid; criadas int:=0; existentes int:=0; v jsonb; p pedidos_fornecedor; ids uuid[]; ped uuid; mapa jsonb:='{}'; first_date date;
BEGIN
  IF NOT private.can_write(uid) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF _disponivel AND _data_fisica IS NULL THEN RAISE EXCEPTION 'Informe a data de disponibilidade física'; END IF;
  IF _data_fisica > (now() AT TIME ZONE 'America/Fortaleza')::date THEN RAISE EXCEPTION 'Data de disponibilidade física no futuro'; END IF;
  IF jsonb_array_length(coalesce(_vinculos,'[]'))=0 THEN RAISE EXCEPTION 'Vincule ao menos uma nota a um pedido'; END IF;
  SELECT coalesce(nullif(pr.nome,''),pr.email) INTO _nome FROM profiles pr WHERE pr.id=uid;
  PERFORM set_config('app.faturando','1',true);
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(_notas,'[]')) LOOP
    chave := x->>'chave_nfe';
    IF chave IS NULL OR chave !~ '^[0-9]{44}$' THEN RAISE EXCEPTION 'Chave de NF-e inválida'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(chave,0));
    nid := NULL;
    SELECT nf.id INTO nid FROM notas_fiscais nf WHERE nf.chave_nfe=chave OR chave=ANY(nf.chaves_agrupadas) LIMIT 1;
    IF nid IS NULL THEN
      INSERT INTO notas_fiscais(numero,serie,chave_nfe,data_emissao,cnpj_emissor,fornecedor,cnpj_destinatario,cliente,cidade,uf,peso,volumes,valor,cfops,itens_xml,origem,status,recebida,recebida_em,recebida_por,recebida_por_nome,data_chegada,created_by)
      VALUES(x->>'numero',x->>'serie',chave,nullif(x->>'data_emissao','')::date,x->>'cnpj_emissor',coalesce(x->>'fornecedor',''),x->>'cnpj_destinatario',coalesce(x->>'cliente',''),coalesce(x->>'cidade',''),nullif(x->>'uf',''),
        coalesce((x->>'peso')::numeric,0),coalesce((x->>'volumes')::int,0),coalesce((x->>'valor')::numeric,0),
        ARRAY(SELECT jsonb_array_elements_text(coalesce(x->'cfops','[]'))),coalesce(x->'itens_xml','[]'),
        'rancheiro','disponivel',_disponivel,CASE WHEN _disponivel THEN now() END,CASE WHEN _disponivel THEN uid END,CASE WHEN _disponivel THEN _nome END,
        coalesce(_data_fisica,(now() AT TIME ZONE 'America/Fortaleza')::date),uid) RETURNING id INTO nid;
      criadas:=criadas+1;
      INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('nota',nid,'importacao','NF importada pelo faturamento de pedido Rancheiro'||CASE WHEN _disponivel THEN ' (disponível fisicamente em '||to_char(_data_fisica,'DD/MM/YYYY')||')' ELSE ' (aguardando disponibilidade física)' END,uid);
    ELSE existentes:=existentes+1; END IF;
    mapa := mapa || jsonb_build_object(chave, nid);
  END LOOP;
  FOR v IN SELECT value FROM jsonb_array_elements(_vinculos) LOOP
    ped := (v->>'pedido')::uuid;
    nid := coalesce((mapa->>(v->>'chave'))::uuid, (SELECT nf.id FROM notas_fiscais nf WHERE nf.chave_nfe=v->>'chave' LIMIT 1));
    IF nid IS NULL THEN RAISE EXCEPTION 'Nota % não encontrada para vínculo', v->>'chave'; END IF;
    SELECT * INTO p FROM pedidos_fornecedor WHERE id=ped FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF p.status IN ('faturado','cancelado') THEN RAISE EXCEPTION 'Pedido % já está %', p.numero_pedido, p.status; END IF;
    INSERT INTO pedido_notas(pedido_id,nota_id,registrado_por,registrado_por_nome) VALUES(ped,nid,uid,_nome) ON CONFLICT DO NOTHING;
    ids := array_append(ids, ped);
  END LOOP;
  IF EXISTS(SELECT 1 FROM unnest(coalesce(_completos,'{}'::uuid[])) c WHERE c <> ALL(coalesce(ids,'{}'::uuid[]))) THEN RAISE EXCEPTION 'Pedido marcado como completo sem nota vinculada'; END IF;
  FOR ped IN SELECT DISTINCT u FROM unnest(ids) u LOOP
    SELECT min(n.data_emissao) INTO first_date FROM pedido_notas pn JOIN notas_fiscais n ON n.id=pn.nota_id WHERE pn.pedido_id=ped;
    UPDATE pedidos_fornecedor SET status=CASE WHEN ped=ANY(coalesce(_completos,'{}'::uuid[])) THEN 'faturado' ELSE 'parcial' END,
      data_faturamento=coalesce(data_faturamento,first_date,(now() AT TIME ZONE 'America/Fortaleza')::date), faturado_em=now(), faturado_por=uid, faturado_por_nome=_nome WHERE id=ped;
  END LOOP;
  RETURN jsonb_build_object('criadas',criadas,'existentes',existentes,'pedidos',cardinality(ARRAY(SELECT DISTINCT u FROM unnest(ids) u)));
END $$;

CREATE OR REPLACE FUNCTION public.tg_pedido_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE billing boolean := coalesce(current_setting('app.faturando', true),'')='1'; diff text;
BEGIN
  NEW.numero_pedido := trim(NEW.numero_pedido);
  IF NEW.numero_pedido='' THEN RAISE EXCEPTION 'Informe o número do pedido'; END IF;
  IF TG_OP='INSERT' THEN
    IF NOT billing THEN NEW.status := CASE WHEN NEW.status='cancelado' THEN 'cancelado' ELSE 'disponivel' END; NEW.faturado_em:=NULL; NEW.faturado_por:=NULL; NEW.faturado_por_nome:=NULL; END IF;
    NEW.created_by := auth.uid();
    RETURN NEW;
  END IF;
  NEW.updated_at := now(); NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.fornecedor := OLD.fornecedor; NEW.numero_pedido := OLD.numero_pedido;
  IF NOT billing THEN
    NEW.faturado_em:=OLD.faturado_em; NEW.faturado_por:=OLD.faturado_por; NEW.faturado_por_nome:=OLD.faturado_por_nome;
    IF OLD.status IN ('faturado','parcial') THEN NEW.status:=OLD.status; NEW.data_faturamento:=coalesce(OLD.data_faturamento, NEW.data_faturamento);
    ELSIF NEW.status NOT IN ('disponivel','cancelado') THEN NEW.status:=OLD.status; END IF;
  END IF;
  SELECT string_agg(a.key||': "'||coalesce(b.value#>>'{}','')||'" → "'||coalesce(a.value#>>'{}','')||'"', '; ') INTO diff
  FROM jsonb_each(to_jsonb(NEW)) a JOIN jsonb_each(to_jsonb(OLD)) b ON b.key=a.key
  WHERE a.key <> 'updated_at' AND a.value IS DISTINCT FROM b.value;
  IF diff IS NOT NULL THEN INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('pedido',NEW.id,CASE WHEN billing THEN 'faturamento' ELSE 'edicao' END,'Pedido '||NEW.numero_pedido||' — '||diff,auth.uid()); END IF;
  RETURN NEW;
END $$;
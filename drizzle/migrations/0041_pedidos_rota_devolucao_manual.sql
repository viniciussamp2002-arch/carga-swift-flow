CREATE TABLE public.pedidos_fornecedor(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fornecedor text NOT NULL DEFAULT 'RANCHEIRO',
 numero_pedido text NOT NULL,
 cliente text NOT NULL DEFAULT '',
 cnpj text NOT NULL DEFAULT '',
 rota text NOT NULL DEFAULT '',
 cidade text NOT NULL DEFAULT '',
 data_tela date,
 data_faturamento date,
 peso numeric NOT NULL DEFAULT 0,
 valor numeric NOT NULL DEFAULT 0,
 m3 numeric NOT NULL DEFAULT 0,
 status_fornecedor text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','parcial','faturado','cancelado')),
 faturado_em timestamptz, faturado_por uuid, faturado_por_nome text,
 observacoes text NOT NULL DEFAULT '',
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(fornecedor, numero_pedido));
GRANT SELECT, INSERT, UPDATE ON public.pedidos_fornecedor TO authenticated;
GRANT ALL ON public.pedidos_fornecedor TO service_role;
ALTER TABLE public.pedidos_fornecedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedidos_office_read ON public.pedidos_fornecedor FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY pedidos_office_insert ON public.pedidos_fornecedor FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid()));
CREATE POLICY pedidos_office_update ON public.pedidos_fornecedor FOR UPDATE TO authenticated USING (private.can_write(auth.uid())) WITH CHECK (private.can_write(auth.uid()));

CREATE TABLE public.pedido_notas(
 pedido_id uuid NOT NULL REFERENCES public.pedidos_fornecedor(id),
 nota_id uuid NOT NULL REFERENCES public.notas_fiscais(id),
 registrado_por uuid, registrado_por_nome text,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(pedido_id, nota_id));
GRANT SELECT ON public.pedido_notas TO authenticated;
GRANT ALL ON public.pedido_notas TO service_role;
ALTER TABLE public.pedido_notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedido_notas_office_read ON public.pedido_notas FOR SELECT TO authenticated USING (private.can_write(auth.uid()));

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
  SELECT string_agg(k||': "'||coalesce(o.value#>>'{}','')||'" → "'||coalesce(n.value#>>'{}','')||'"', '; ') INTO diff
  FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING(key) CROSS JOIN LATERAL (SELECT n.key AS k) z
  WHERE n.key NOT IN ('updated_at') AND n.value IS DISTINCT FROM o.value;
  IF diff IS NOT NULL THEN INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('pedido',NEW.id,CASE WHEN billing THEN 'faturamento' ELSE 'edicao' END,'Pedido '||NEW.numero_pedido||' — '||diff,auth.uid()); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pedido_guard BEFORE INSERT OR UPDATE ON public.pedidos_fornecedor FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_guard();

CREATE OR REPLACE FUNCTION public.faturar_pedidos(_notas jsonb, _vinculos jsonb, _completos uuid[], _disponivel boolean, _data_fisica date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); nome text; x jsonb; chave text; nid uuid; criadas int:=0; existentes int:=0; v jsonb; p pedidos_fornecedor; ids uuid[]; ped uuid; mapa jsonb:='{}'; first_date date;
BEGIN
  IF NOT private.can_write(uid) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF _disponivel AND _data_fisica IS NULL THEN RAISE EXCEPTION 'Informe a data de disponibilidade física'; END IF;
  IF _data_fisica > (now() AT TIME ZONE 'America/Fortaleza')::date THEN RAISE EXCEPTION 'Data de disponibilidade física no futuro'; END IF;
  IF jsonb_array_length(coalesce(_vinculos,'[]'))=0 THEN RAISE EXCEPTION 'Vincule ao menos uma nota a um pedido'; END IF;
  SELECT coalesce(nullif(nome,''),email) INTO nome FROM profiles WHERE id=uid;
  PERFORM set_config('app.faturando','1',true);
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(_notas,'[]')) LOOP
    chave := x->>'chave_nfe';
    IF chave !~ '^[0-9]{44}$' THEN RAISE EXCEPTION 'Chave de NF-e inválida'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(chave,0));
    SELECT id INTO nid FROM notas_fiscais WHERE chave_nfe=chave OR chave=ANY(chaves_agrupadas) LIMIT 1;
    IF nid IS NULL THEN
      INSERT INTO notas_fiscais(numero,serie,chave_nfe,data_emissao,cnpj_emissor,fornecedor,cnpj_destinatario,cliente,cidade,uf,peso,volumes,valor,cfops,itens_xml,origem,status,recebida,recebida_em,recebida_por,recebida_por_nome,data_chegada,created_by)
      VALUES(x->>'numero',x->>'serie',chave,nullif(x->>'data_emissao','')::date,x->>'cnpj_emissor',coalesce(x->>'fornecedor',''),x->>'cnpj_destinatario',coalesce(x->>'cliente',''),coalesce(x->>'cidade',''),nullif(x->>'uf',''),
        coalesce((x->>'peso')::numeric,0),coalesce((x->>'volumes')::int,0),coalesce((x->>'valor')::numeric,0),
        ARRAY(SELECT jsonb_array_elements_text(coalesce(x->'cfops','[]'))),coalesce(x->'itens_xml','[]'),
        'rancheiro','disponivel',_disponivel,CASE WHEN _disponivel THEN now() END,CASE WHEN _disponivel THEN uid END,CASE WHEN _disponivel THEN nome END,
        coalesce(_data_fisica,(now() AT TIME ZONE 'America/Fortaleza')::date),uid) RETURNING id INTO nid;
      criadas:=criadas+1;
      INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('nota',nid,'importacao','NF importada pelo faturamento de pedido Rancheiro'||CASE WHEN _disponivel THEN ' (disponível fisicamente em '||to_char(_data_fisica,'DD/MM/YYYY')||')' ELSE ' (aguardando disponibilidade física)' END,uid);
    ELSE existentes:=existentes+1; END IF;
    mapa := mapa || jsonb_build_object(chave, nid);
  END LOOP;
  FOR v IN SELECT value FROM jsonb_array_elements(_vinculos) LOOP
    ped := (v->>'pedido')::uuid; nid := coalesce((mapa->>(v->>'chave'))::uuid, (SELECT id FROM notas_fiscais WHERE chave_nfe=v->>'chave' LIMIT 1));
    IF nid IS NULL THEN RAISE EXCEPTION 'Nota % não encontrada para vínculo', v->>'chave'; END IF;
    SELECT * INTO p FROM pedidos_fornecedor WHERE id=ped FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF p.status IN ('faturado','cancelado') THEN RAISE EXCEPTION 'Pedido % já está %', p.numero_pedido, p.status; END IF;
    INSERT INTO pedido_notas(pedido_id,nota_id,registrado_por,registrado_por_nome) VALUES(ped,nid,uid,nome) ON CONFLICT DO NOTHING;
    ids := array_append(ids, ped);
  END LOOP;
  FOR ped IN SELECT DISTINCT u FROM unnest(ids) u LOOP
    SELECT min(n.data_emissao) INTO first_date FROM pedido_notas pn JOIN notas_fiscais n ON n.id=pn.nota_id WHERE pn.pedido_id=ped;
    UPDATE pedidos_fornecedor SET status=CASE WHEN ped=ANY(coalesce(_completos,'{}')) THEN 'faturado' ELSE 'parcial' END,
      data_faturamento=coalesce(data_faturamento,first_date,(now() AT TIME ZONE 'America/Fortaleza')::date), faturado_em=now(), faturado_por=uid, faturado_por_nome=nome WHERE id=ped;
  END LOOP;
  IF EXISTS(SELECT 1 FROM unnest(coalesce(_completos,'{}')) c WHERE c <> ALL(coalesce(ids,'{}'))) THEN RAISE EXCEPTION 'Pedido marcado como completo sem nota vinculada'; END IF;
  RETURN jsonb_build_object('criadas',criadas,'existentes',existentes,'pedidos',cardinality(ARRAY(SELECT DISTINCT u FROM unnest(ids) u)));
END $$;
REVOKE ALL ON FUNCTION public.faturar_pedidos(jsonb,jsonb,uuid[],boolean,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.faturar_pedidos(jsonb,jsonb,uuid[],boolean,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.liberar_notas_pedido(_notas uuid[], _data date) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); nome text; c int;
BEGIN
  IF NOT private.can_write(uid) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF _data IS NULL OR _data > (now() AT TIME ZONE 'America/Fortaleza')::date THEN RAISE EXCEPTION 'Data de disponibilidade inválida'; END IF;
  SELECT coalesce(nullif(nome,''),email) INTO nome FROM profiles WHERE id=uid;
  UPDATE notas_fiscais SET recebida=true, recebida_em=now(), recebida_por=uid, recebida_por_nome=nome, data_chegada=_data
   WHERE id=ANY(_notas) AND origem='rancheiro' AND NOT recebida AND carga_entrada_id IS NULL;
  GET DIAGNOSTICS c = ROW_COUNT;
  INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) SELECT 'nota',u,'recebimento','Disponibilidade física confirmada em '||to_char(_data,'DD/MM/YYYY'),uid FROM unnest(_notas) u;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.liberar_notas_pedido(uuid[],date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_notas_pedido(uuid[],date) TO authenticated;

CREATE OR REPLACE FUNCTION public.adicionar_rota_entrega(_notas uuid[], _carga uuid, _motorista uuid, _veiculo uuid, _data date, _obs text, _confirmar_em_rota boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); c cargas; n notas_fiscais; nid uuid; outra int; novo boolean:=false;
BEGIN
  IF NOT private.can_write(uid) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF coalesce(cardinality(_notas),0)=0 THEN RAISE EXCEPTION 'Selecione ao menos uma nota'; END IF;
  IF _carga IS NULL THEN
    IF _motorista IS NULL OR _veiculo IS NULL THEN RAISE EXCEPTION 'Informe motorista e veículo'; END IF;
    INSERT INTO cargas(motorista_id,veiculo_id,data_prevista_saida,observacoes,status,created_by) VALUES(_motorista,_veiculo,_data,coalesce(_obs,''),'separacao',uid) RETURNING * INTO c;
    novo:=true;
    INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('carga',c.id,'criada','Carga #'||c.numero||' criada pela rota de entrega do Depósito',uid);
  ELSE
    SELECT * INTO c FROM cargas WHERE id=_carga FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Carga não encontrada'; END IF;
    IF c.situacao<>'ativa' OR c.status='finalizada' THEN RAISE EXCEPTION 'Carga #% está finalizada ou cancelada', c.numero; END IF;
    IF c.status='em_rota' AND NOT _confirmar_em_rota THEN RAISE EXCEPTION 'Carga #% já está em rota; confirme a inclusão', c.numero; END IF;
  END IF;
  FOREACH nid IN ARRAY _notas LOOP
    SELECT * INTO n FROM notas_fiscais WHERE id=nid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Nota não encontrada'; END IF;
    IF n.carga_id=c.id THEN RAISE EXCEPTION 'NF % já está nesta carga', n.numero; END IF;
    IF n.carga_id IS NOT NULL THEN SELECT numero INTO outra FROM cargas WHERE id=n.carga_id; RAISE EXCEPTION 'NF % já está na carga #%', n.numero, outra; END IF;
    IF n.status IN ('entregue','devolvida') THEN RAISE EXCEPTION 'NF % já foi entregue', n.numero; END IF;
    IF NOT n.recebida THEN RAISE EXCEPTION 'NF % ainda não está disponível fisicamente', n.numero; END IF;
    IF EXISTS(SELECT 1 FROM entregas WHERE nota_id=nid AND resultado='entregue') THEN RAISE EXCEPTION 'NF % já possui entrega', n.numero; END IF;
    UPDATE notas_fiscais SET carga_id=c.id, status=(CASE c.status WHEN 'em_rota' THEN 'em_rota' WHEN 'carregamento' THEN 'carregamento' ELSE 'separacao' END)::nota_status WHERE id=nid;
    INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('nota',nid,'vinculo_carga','Nota adicionada à rota de entrega — carga #'||c.numero||coalesce(' • '||nullif(_obs,''),''),uid);
  END LOOP;
  IF NOT novo THEN INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('carga',c.id,'notas_adicionadas',cardinality(_notas)||' nota(s) adicionada(s) pelo Depósito',uid); END IF;
  RETURN jsonb_build_object('carga',c.id,'numero',c.numero,'nova',novo);
END $$;
REVOKE ALL ON FUNCTION public.adicionar_rota_entrega(uuid[],uuid,uuid,uuid,date,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adicionar_rota_entrega(uuid[],uuid,uuid,uuid,date,text,boolean) TO authenticated;

ALTER TABLE public.devolucoes ALTER COLUMN comprovante_id DROP NOT NULL;
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'motorista' CHECK (origem IN ('motorista','manual'));
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS fornecedor text NOT NULL DEFAULT '';
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS cliente text NOT NULL DEFAULT '';
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS numero_origem text NOT NULL DEFAULT '';
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS motorista_id uuid REFERENCES public.motoristas(id);
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS data_recebimento date;
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS anexo_path text;

CREATE OR REPLACE FUNCTION public.criar_devolucao_manual(_dados jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); d devolucoes; x jsonb; n notas_fiscais; nid uuid:=nullif(_dados->>'nota_origem_id','')::uuid; k int:=0; nf text:=trim(coalesce(_dados->>'numero_nf',''));
BEGIN
  IF NOT private.can_write(uid) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
  IF trim(coalesce(_dados->>'fornecedor',''))='' THEN RAISE EXCEPTION 'Informe o fornecedor'; END IF;
  IF jsonb_array_length(coalesce(_dados->'itens','[]'))=0 THEN RAISE EXCEPTION 'Adicione ao menos um produto'; END IF;
  IF nid IS NOT NULL THEN SELECT * INTO n FROM notas_fiscais WHERE id=nid; IF NOT FOUND THEN RAISE EXCEPTION 'Nota de origem não encontrada'; END IF; END IF;
  IF nf<>'' AND EXISTS(SELECT 1 FROM devolucoes WHERE numero_nf=nf AND (fornecedor=trim(_dados->>'fornecedor') OR nota_origem_id IS NOT DISTINCT FROM nid)) THEN RAISE EXCEPTION 'Já existe devolução com a NF %', nf; END IF;
  INSERT INTO devolucoes(origem,nota_origem_id,numero_nf,numero_origem,fornecedor,cliente,motorista_id,data_recebimento,data_documento,documental,observacoes,anexo_path,created_by)
   VALUES('manual',nid,nf,coalesce(n.numero,trim(coalesce(_dados->>'numero_origem',''))),trim(_dados->>'fornecedor'),trim(coalesce(_dados->>'cliente','')),nullif(_dados->>'motorista_id','')::uuid,nullif(_dados->>'data_recebimento','')::date,nullif(_dados->>'data_recebimento','')::date,'tratada',coalesce(_dados->>'observacoes',''),nullif(_dados->>'anexo_path',''),uid) RETURNING * INTO d;
  FOR x IN SELECT value FROM jsonb_array_elements(_dados->'itens') LOOP
    k:=k+1;
    IF trim(coalesce(x->>'descricao',''))='' OR coalesce((x->>'quantidade')::numeric,0)<=0 OR trim(coalesce(x->>'unidade',''))='' OR trim(coalesce(x->>'motivo',''))='' THEN RAISE EXCEPTION 'Produto %: informe descrição, quantidade, unidade e motivo', k; END IF;
    INSERT INTO devolucao_itens(devolucao_id,item_numero,codigo,descricao,quantidade_original,unidade_original,quantidade,unidade,motivo,lote,validade,observacoes,retorno_fisico)
     VALUES(d.id,coalesce(nullif(x->>'item_numero',''),'M'||k),coalesce(x->>'codigo',''),trim(x->>'descricao'),(x->>'quantidade')::numeric,upper(trim(x->>'unidade')),(x->>'quantidade')::numeric,upper(trim(x->>'unidade')),x->>'motivo',coalesce(x->>'lote',''),nullif(x->>'validade','')::date,coalesce(x->>'observacoes',''),CASE WHEN x->>'motivo'='falta' THEN false ELSE coalesce((x->>'retorno_fisico')::boolean,true) END);
  END LOOP;
  INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('devolucao',d.id,'criacao','Devolução D'||d.controle||' criada manualmente pelo escritório',uid);
  RETURN d.id;
END $$;
REVOKE ALL ON FUNCTION public.criar_devolucao_manual(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_devolucao_manual(jsonb) TO authenticated;
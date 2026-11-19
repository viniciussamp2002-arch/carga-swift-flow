CREATE OR REPLACE FUNCTION private.prepare_freight(_nota uuid, _motivo text DEFAULT ''::text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n notas_fiscais; f uuid; t tabelas_frete; km numeric; mem jsonb; calc uuid; st text; regras jsonb; candidates int; city text; destination_uf text; peso numeric;
BEGIN
SELECT * INTO n FROM notas_fiscais WHERE id=_nota FOR UPDATE;
IF EXISTS(SELECT 1 FROM financeiro WHERE nota_fiscal_id=_nota AND estado_frete IN ('conferido','pronto_faturamento','faturado')) THEN RAISE EXCEPTION 'Frete fechado: recálculo bloqueado'; END IF;
SELECT id INTO f FROM fornecedores WHERE cnpj=regexp_replace(coalesce(n.cnpj_emissor,''),'\D','','g');
city:=coalesce(nullif(n.destino_entrega_cidade,''),n.cidade);destination_uf:=coalesce(nullif(n.destino_entrega_uf,''),n.uf);peso:=coalesce(n.peso_frete,n.peso);
IF n.tabela_frete_id IS NOT NULL THEN SELECT * INTO t FROM tabelas_frete WHERE id=n.tabela_frete_id AND fornecedor_id=f AND ativo AND inicio<=coalesce(n.data_emissao,current_date) AND (fim IS NULL OR fim>=coalesce(n.data_emissao,current_date));
ELSE
SELECT count(*) INTO candidates FROM (SELECT DISTINCT ON (nome) * FROM tabelas_frete WHERE fornecedor_id=f AND inicio<=coalesce(n.data_emissao,current_date) AND (fim IS NULL OR fim>=coalesce(n.data_emissao,current_date)) ORDER BY nome,versao DESC,created_at DESC) x WHERE ativo;
IF candidates=1 THEN SELECT x.* INTO t FROM (SELECT DISTINCT ON (nome) * FROM tabelas_frete WHERE fornecedor_id=f AND inicio<=coalesce(n.data_emissao,current_date) AND (fim IS NULL OR fim>=coalesce(n.data_emissao,current_date)) ORDER BY nome,versao DESC,created_at DESC) x WHERE ativo LIMIT 1;END IF;
END IF;
SELECT d.km INTO km FROM distancias d WHERE lower(trim(d.cidade))=lower(trim(city)) AND upper(d.uf)=upper(destination_uf);
IF t.id IS NULL THEN st:=CASE WHEN candidates>1 THEN 'calculo_pendente' ELSE 'sem_tabela' END;mem:=jsonb_build_object('situacao',st,'total',NULL,'erro',CASE WHEN candidates>1 THEN 'Selecione o contrato aplicável' ELSE 'Sem tabela ativa aplicável' END);
ELSE regras:=jsonb_set(t.regras,'{operacoes}',coalesce((SELECT jsonb_agg(op-'uf'-'cidade') FROM jsonb_array_elements(coalesce(t.regras->'operacoes','[]')) op WHERE (nullif(op->>'uf','') IS NULL OR upper(op->>'uf')=upper(destination_uf)) AND (nullif(op->>'cidade','') IS NULL OR lower(op->>'cidade')=lower(city))),'[]'));mem:=public.simular_frete(regras,peso,n.valor,km);st:=mem->>'situacao'; END IF;
mem:=mem||jsonb_build_object('peso',peso,'valor_nf',n.valor,'origem','Teresina / PI','destino',city||' / '||coalesce(destination_uf,''),'fornecedor',n.fornecedor,'tabela',t.nome,'versao',t.versao,'data_referencia',coalesce(n.data_emissao,current_date),'distancia',km);
INSERT INTO calculos_frete(nota_id,tabela_id,situacao,total,memoria,motivo) VALUES(_nota,t.id,st,(mem->>'total')::numeric,mem,_motivo) RETURNING id INTO calc;
UPDATE financeiro SET fornecedor_id=f,calculo_id=calc,estado_frete=CASE WHEN st='pre_calculado' THEN 'aguardando_conferencia' ELSE st END,valor_base=coalesce((mem->>'base')::numeric,0),valor_ad_valorem=coalesce((mem->>'ad_valorem')::numeric,0),valor_tributos=coalesce((mem->>'tributos')::numeric,0),valor_taxa_extra=coalesce((mem->>'adicionais')::numeric,0),valor_frete=coalesce((mem->>'total')::numeric,0),distancia=km WHERE nota_fiscal_id=_nota; RETURN calc;
END $$;
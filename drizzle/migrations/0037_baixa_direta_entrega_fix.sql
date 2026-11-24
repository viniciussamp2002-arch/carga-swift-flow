CREATE OR REPLACE FUNCTION public.baixa_direta_entrega(_nota uuid, _data date, _motorista uuid, _veiculo uuid, _path text, _obs text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n notas_fiscais; c_id uuid; e_id uuid; resp text; placa_v text; mot text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 IF _data IS NULL OR _motorista IS NULL OR _veiculo IS NULL OR coalesce(_path,'')='' THEN RAISE EXCEPTION 'Data, motorista, placa e canhoto são obrigatórios'; END IF;
 IF _data > (now() AT TIME ZONE 'America/Fortaleza')::date THEN RAISE EXCEPTION 'Data de entrega não pode ser futura'; END IF;
 IF split_part(_path,'/',1)<>'escritorio' OR split_part(_path,'/',2)<>auth.uid()::text
    OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='comprovantes' AND o.name=_path) THEN
   RAISE EXCEPTION 'Canhoto não encontrado no armazenamento; baixa não concluída'; END IF;
 SELECT * INTO n FROM notas_fiscais WHERE id=_nota FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Nota inexistente'; END IF;
 IF n.status='entregue' OR EXISTS(SELECT 1 FROM entregas x WHERE x.nota_id=_nota AND x.resultado='entregue')
    OR EXISTS(SELECT 1 FROM comprovantes x WHERE x.nota_id=_nota AND x.status='aprovado' AND x.tipo_documento='canhoto') THEN
   RAISE EXCEPTION 'Nota já entregue: baixa duplicada bloqueada'; END IF;
 IF n.carga_id IS NOT NULL THEN RAISE EXCEPTION 'Nota vinculada a uma carga de saída: resolva o vínculo antes da baixa direta'; END IF;
 IF NOT n.recebida THEN RAISE EXCEPTION 'Nota ainda não recebida no depósito'; END IF;
 SELECT m.nome INTO mot FROM motoristas m WHERE m.id=_motorista AND m.ativo; IF mot IS NULL THEN RAISE EXCEPTION 'Motorista inválido ou inativo'; END IF;
 SELECT v.placa INTO placa_v FROM veiculos v WHERE v.id=_veiculo; IF placa_v IS NULL THEN RAISE EXCEPTION 'Veículo inválido'; END IF;
 SELECT p.nome INTO resp FROM profiles p WHERE p.id=auth.uid();
 INSERT INTO comprovantes(user_id,motorista_id,storage_path,capturado_em,nota_id,tipo_documento,triagem,observacoes_documento)
  VALUES(auth.uid(),_motorista,_path,now(),_nota,'canhoto','analisado',coalesce(_obs,'')) RETURNING id INTO c_id;
 INSERT INTO entregas(nota_id,carga_id,data_evento,resultado,observacao,registrado_por,modalidade,motorista_id,veiculo_id,registrado_por_nome)
  VALUES(_nota,NULL,(_data::timestamp + time '12:00') AT TIME ZONE 'America/Fortaleza','entregue',nullif(_obs,''),auth.uid(),'baixa_direta',_motorista,_veiculo,resp) RETURNING id INTO e_id;
 UPDATE comprovantes SET status='aprovado',data_entrega=(_data::timestamp + time '12:00') AT TIME ZONE 'America/Fortaleza',revisado_por=auth.uid(),revisado_por_nome=resp,revisado_em=now(),entrega_id=e_id WHERE id=c_id;
 UPDATE notas_fiscais SET status='entregue' WHERE id=_nota;
 INSERT INTO historico(entidade,entidade_id,acao,descricao,user_id) VALUES('nota',_nota,'baixa_direta',
  'Baixa direta pelo escritório; NF '||n.numero||' entregue em '||to_char(_data,'DD/MM/YYYY')||' — motorista '||mot||', placa '||placa_v||' — por '||coalesce(resp,'usuário'),auth.uid());
 RETURN e_id;
END $$;
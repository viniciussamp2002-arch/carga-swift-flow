ALTER TABLE public.motoristas ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;

CREATE OR REPLACE FUNCTION private.driver_id(_uid uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT m.id FROM public.motoristas m JOIN public.user_roles r ON r.user_id=m.user_id AND r.role='motorista' WHERE m.user_id=_uid LIMIT 1 $$;
REVOKE ALL ON FUNCTION private.driver_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.driver_id(uuid) TO authenticated;

CREATE POLICY motoristas_select_self ON public.motoristas FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cargas_select_driver ON public.cargas FOR SELECT TO authenticated USING (situacao='ativa' AND motorista_id IS NOT NULL AND motorista_id = private.driver_id(auth.uid()));
CREATE POLICY notas_select_driver ON public.notas_fiscais FOR SELECT TO authenticated USING (carga_id IN (SELECT c.id FROM public.cargas c WHERE c.situacao='ativa' AND c.motorista_id = private.driver_id(auth.uid())));

CREATE TABLE public.comprovantes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  motorista_id uuid NOT NULL REFERENCES public.motoristas(id),
  storage_path text NOT NULL UNIQUE,
  capturado_em timestamptz NOT NULL DEFAULT now(),
  nota_id uuid REFERENCES public.notas_fiscais(id),
  carga_id uuid REFERENCES public.cargas(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','identificado','nao_identificado','aprovado','rejeitado')),
  reconhecimento jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_entrega timestamptz,
  motivo_rejeicao text,
  revisado_por uuid,
  revisado_por_nome text,
  revisado_em timestamptz,
  entrega_id uuid REFERENCES public.entregas(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comprovantes_status_idx ON public.comprovantes(status);
CREATE INDEX comprovantes_nota_idx ON public.comprovantes(nota_id);
GRANT SELECT, INSERT, UPDATE ON public.comprovantes TO authenticated;
GRANT ALL ON public.comprovantes TO service_role;
ALTER TABLE public.comprovantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY comprovantes_driver_select ON public.comprovantes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY comprovantes_driver_insert ON public.comprovantes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND motorista_id = private.driver_id(auth.uid()) AND status='pendente' AND nota_id IS NULL AND revisado_por IS NULL AND entrega_id IS NULL AND storage_path LIKE auth.uid()::text || '/%');
CREATE POLICY comprovantes_office_select ON public.comprovantes FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY comprovantes_office_update ON public.comprovantes FOR UPDATE TO authenticated USING (private.can_write(auth.uid()) AND status NOT IN ('aprovado','rejeitado')) WITH CHECK (private.can_write(auth.uid()) AND status NOT IN ('aprovado','rejeitado'));
CREATE TRIGGER comprovantes_updated BEFORE UPDATE ON public.comprovantes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- approval/rejection only through RPC (status final values blocked in policy)
CREATE OR REPLACE FUNCTION public.aprovar_comprovante(_id uuid, _nota uuid, _data_entrega timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.comprovantes; n public.notas_fiscais; e_id uuid; nome text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.comprovantes WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comprovante não encontrado'; END IF;
  IF c.status IN ('aprovado','rejeitado') THEN RAISE EXCEPTION 'Comprovante já revisado'; END IF;
  SELECT * INTO n FROM public.notas_fiscais WHERE id=_nota FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota não encontrada'; END IF;
  IF n.carga_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.cargas WHERE id=n.carga_id AND motorista_id=c.motorista_id) THEN
    RAISE EXCEPTION 'A nota não pertence a uma carga deste motorista'; END IF;
  SELECT p.nome INTO nome FROM public.profiles p WHERE p.id=auth.uid();
  SELECT id INTO e_id FROM public.entregas WHERE nota_id=_nota AND resultado='entregue' ORDER BY created_at DESC LIMIT 1;
  IF e_id IS NULL THEN
    INSERT INTO public.entregas(nota_id, carga_id, data_evento, resultado, observacao, registrado_por)
    VALUES (_nota, n.carga_id, COALESCE(_data_entrega, c.capturado_em), 'entregue', 'Comprovante aprovado pelo escritório', auth.uid()) RETURNING id INTO e_id;
  END IF;
  UPDATE public.notas_fiscais SET status='entregue' WHERE id=_nota AND status <> 'entregue';
  UPDATE public.comprovantes SET status='aprovado', nota_id=_nota, carga_id=n.carga_id, data_entrega=COALESCE(_data_entrega, c.capturado_em),
    revisado_por=auth.uid(), revisado_por_nome=nome, revisado_em=now(), entrega_id=e_id WHERE id=_id;
  INSERT INTO public.historico(entidade, entidade_id, acao, descricao, user_id)
  VALUES ('nota', _nota, 'comprovante_aprovado', 'Canhoto aprovado; NF ' || n.numero || ' entregue', auth.uid());
  RETURN e_id;
END $$;

CREATE OR REPLACE FUNCTION public.rejeitar_comprovante(_id uuid, _motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.comprovantes; nome text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.can_write(auth.uid()) THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(_motivo,''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo da rejeição'; END IF;
  SELECT * INTO c FROM public.comprovantes WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comprovante não encontrado'; END IF;
  IF c.status IN ('aprovado','rejeitado') THEN RAISE EXCEPTION 'Comprovante já revisado'; END IF;
  SELECT p.nome INTO nome FROM public.profiles p WHERE p.id=auth.uid();
  UPDATE public.comprovantes SET status='rejeitado', motivo_rejeicao=trim(_motivo), revisado_por=auth.uid(), revisado_por_nome=nome, revisado_em=now() WHERE id=_id;
  INSERT INTO public.historico(entidade, entidade_id, acao, descricao, user_id)
  VALUES ('comprovante', _id, 'comprovante_rejeitado', 'Canhoto rejeitado: ' || trim(_motivo), auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.aprovar_comprovante(uuid,uuid,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rejeitar_comprovante(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_comprovante(uuid,uuid,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rejeitar_comprovante(uuid,text) TO authenticated;

CREATE POLICY comprovantes_obj_driver_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='comprovantes' AND (storage.foldername(name))[1] = auth.uid()::text AND private.driver_id(auth.uid()) IS NOT NULL);
CREATE POLICY comprovantes_obj_driver_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='comprovantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY comprovantes_obj_office_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='comprovantes' AND private.can_write(auth.uid()));
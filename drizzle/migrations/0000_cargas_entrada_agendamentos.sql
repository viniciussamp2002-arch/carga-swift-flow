CREATE TYPE public.entrada_status AS ENUM ('prevista','em_transito','recebida_parcial','recebida','cancelada');
CREATE TYPE public.agendamento_status AS ENUM ('nao_solicitado','solicitado','aguardando_confirmacao','confirmado','reagendado','cancelado');
CREATE TYPE public.recebimento_cliente_status AS ENUM ('aguardando_entrada','entrada_realizada','entrada_recusada');

CREATE TABLE public.cargas_entrada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_transporte text NOT NULL DEFAULT '',
  transportadora text NOT NULL DEFAULT '',
  fornecedor text NOT NULL DEFAULT '',
  motorista text,
  placa text,
  data_carregamento date,
  previsao_chegada date,
  data_chegada timestamptz,
  recebido_por uuid,
  recebido_por_nome text,
  obs_recebimento text,
  status public.entrada_status NOT NULL DEFAULT 'prevista',
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargas_entrada TO authenticated;
GRANT ALL ON public.cargas_entrada TO service_role;
ALTER TABLE public.cargas_entrada ENABLE ROW LEVEL SECURITY;
CREATE POLICY cargas_entrada_rw ON public.cargas_entrada FOR ALL TO authenticated
  USING (private.can_write(auth.uid())) WITH CHECK (private.can_write(auth.uid()));
CREATE TRIGGER cargas_entrada_upd BEFORE UPDATE ON public.cargas_entrada FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.notas_fiscais
  ADD COLUMN carga_entrada_id uuid REFERENCES public.cargas_entrada(id),
  ADD COLUMN recebida boolean NOT NULL DEFAULT true,
  ADD COLUMN recebida_em timestamptz,
  ADD COLUMN recebida_por uuid,
  ADD COLUMN recebida_por_nome text,
  ADD COLUMN cfops text[] NOT NULL DEFAULT '{}';
CREATE INDEX notas_carga_entrada_idx ON public.notas_fiscais(carga_entrada_id);
CREATE INDEX notas_cnpj_dest_idx ON public.notas_fiscais(cnpj_destinatario);

CREATE TABLE public.clientes_agendamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL UNIQUE,
  nome text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_agendamento TO authenticated;
GRANT ALL ON public.clientes_agendamento TO service_role;
ALTER TABLE public.clientes_agendamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY clientes_ag_select ON public.clientes_agendamento FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY clientes_ag_admin ON public.clientes_agendamento FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'administrador')) WITH CHECK (private.has_role(auth.uid(),'administrador'));

CREATE TABLE public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL UNIQUE REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  data_solicitacao timestamptz,
  solicitante text,
  data_agendada date,
  horario text,
  protocolo text,
  status public.agendamento_status NOT NULL DEFAULT 'nao_solicitado',
  status_recebimento public.recebimento_cliente_status NOT NULL DEFAULT 'aguardando_entrada',
  data_entrada date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY agendamentos_rw ON public.agendamentos FOR ALL TO authenticated
  USING (private.can_write(auth.uid())) WITH CHECK (private.can_write(auth.uid()));
CREATE TRIGGER agendamentos_upd BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Nota recebida de cliente configurado -> vínculo de agendamento (sem duplicar)
CREATE OR REPLACE FUNCTION public.tg_nota_agendamento() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.recebida AND NEW.cnpj_destinatario IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clientes_agendamento c
    WHERE c.ativo AND regexp_replace(c.cnpj,'\D','','g') = regexp_replace(NEW.cnpj_destinatario,'\D','','g')
  ) THEN
    INSERT INTO public.agendamentos(nota_id) VALUES (NEW.id) ON CONFLICT (nota_id) DO NOTHING;
    IF NOT NEW.agendamento THEN
      UPDATE public.notas_fiscais SET agendamento = true WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER nota_agendamento_aiu AFTER INSERT OR UPDATE OF recebida, cnpj_destinatario ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.tg_nota_agendamento();

-- Confirmação de chegada (idempotente)
CREATE OR REPLACE FUNCTION public.confirmar_chegada(_carga uuid, _quando timestamptz, _obs text, _notas uuid[])
RETURNS public.entrada_status LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c public.cargas_entrada; total int; recebidas int; st public.entrada_status; nome text;
BEGIN
  SELECT * INTO c FROM public.cargas_entrada WHERE id = _carga FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carga de entrada não encontrada'; END IF;
  IF c.status IN ('recebida','cancelada') THEN RAISE EXCEPTION 'Carga já % — nada a confirmar', c.status; END IF;
  SELECT coalesce(nullif(p.nome,''), p.email) INTO nome FROM public.profiles p WHERE p.id = auth.uid();
  UPDATE public.notas_fiscais SET recebida = true, recebida_em = _quando, recebida_por = auth.uid(),
    recebida_por_nome = nome, data_chegada = (_quando AT TIME ZONE 'America/Sao_Paulo')::date
  WHERE carga_entrada_id = _carga AND recebida = false AND id = ANY(_notas);
  SELECT count(*), count(*) FILTER (WHERE recebida) INTO total, recebidas FROM public.notas_fiscais WHERE carga_entrada_id = _carga;
  st := CASE WHEN recebidas >= total THEN 'recebida'::public.entrada_status ELSE 'recebida_parcial'::public.entrada_status END;
  UPDATE public.cargas_entrada SET status = st, data_chegada = coalesce(data_chegada, _quando), recebido_por = auth.uid(),
    recebido_por_nome = nome, obs_recebimento = coalesce(_obs, obs_recebimento) WHERE id = _carga;
  INSERT INTO public.historico(entidade, entidade_id, acao, descricao, user_id)
  VALUES ('carga_entrada', _carga, 'chegada', format('Chegada confirmada: %s de %s nota(s) recebida(s)', recebidas, total), auth.uid());
  RETURN st;
END $$;
REVOKE EXECUTE ON FUNCTION public.confirmar_chegada(uuid, timestamptz, text, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.confirmar_chegada(uuid, timestamptz, text, uuid[]) TO authenticated;
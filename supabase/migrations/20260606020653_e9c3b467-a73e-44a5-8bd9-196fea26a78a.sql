
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('administrador', 'operacional', 'consulta');
CREATE TYPE public.veiculo_situacao AS ENUM ('disponivel', 'em_rota', 'manutencao', 'inativo');
CREATE TYPE public.motorista_situacao AS ENUM ('disponivel', 'em_viagem', 'ferias', 'afastado');
CREATE TYPE public.carga_status AS ENUM ('separacao', 'carregamento', 'em_rota', 'finalizada');
CREATE TYPE public.nota_status AS ENUM ('disponivel', 'separacao', 'carregamento', 'em_rota', 'entregue', 'nao_entregue', 'devolvida');
CREATE TYPE public.entrega_resultado AS ENUM ('entregue', 'nao_entregue', 'devolvida');

-- =========================
-- UPDATED_AT helper
-- =========================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.can_write(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('administrador','operacional'));
$$;

CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

-- =========================
-- Handle new user: profile + first user becomes admin
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'administrador');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'consulta')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- VEICULOS
-- =========================
CREATE TABLE public.veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa TEXT NOT NULL UNIQUE,
  modelo TEXT NOT NULL DEFAULT '',
  marca TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  capacidade_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  ano INTEGER,
  situacao public.veiculo_situacao NOT NULL DEFAULT 'disponivel',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;
GRANT ALL ON public.veiculos TO service_role;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "veiculos_select_auth" ON public.veiculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "veiculos_write" ON public.veiculos FOR ALL TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE TRIGGER trg_veiculos_updated BEFORE UPDATE ON public.veiculos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- MOTORISTAS
-- =========================
CREATE TABLE public.motoristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  cnh TEXT,
  categoria TEXT,
  validade_cnh DATE,
  telefone TEXT,
  observacoes TEXT,
  situacao public.motorista_situacao NOT NULL DEFAULT 'disponivel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motoristas TO authenticated;
GRANT ALL ON public.motoristas TO service_role;
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "motoristas_select_auth" ON public.motoristas FOR SELECT TO authenticated USING (true);
CREATE POLICY "motoristas_write" ON public.motoristas FOR ALL TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE TRIGGER trg_motoristas_updated BEFORE UPDATE ON public.motoristas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- CARGAS
-- =========================
CREATE SEQUENCE public.cargas_numero_seq START 1;
CREATE TABLE public.cargas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL UNIQUE DEFAULT nextval('public.cargas_numero_seq'),
  motorista_id UUID REFERENCES public.motoristas(id) ON DELETE SET NULL,
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
  data_prevista_saida DATE,
  data_saida TIMESTAMPTZ,
  data_finalizacao TIMESTAMPTZ,
  observacoes TEXT,
  status public.carga_status NOT NULL DEFAULT 'separacao',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargas TO authenticated;
GRANT ALL ON public.cargas TO service_role;
ALTER TABLE public.cargas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cargas_select_auth" ON public.cargas FOR SELECT TO authenticated USING (true);
CREATE POLICY "cargas_write" ON public.cargas FOR ALL TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE TRIGGER trg_cargas_updated BEFORE UPDATE ON public.cargas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- NOTAS FISCAIS
-- =========================
CREATE TABLE public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  serie TEXT,
  chave_nfe TEXT UNIQUE,
  data_emissao DATE,
  cliente TEXT NOT NULL DEFAULT '',
  cnpj_destinatario TEXT,
  cidade TEXT NOT NULL DEFAULT '',
  uf TEXT,
  regiao TEXT,
  peso NUMERIC(12,3) NOT NULL DEFAULT 0,
  volumes INTEGER NOT NULL DEFAULT 0,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  fornecedor TEXT NOT NULL DEFAULT '',
  cnpj_emissor TEXT,
  agendamento BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  status public.nota_status NOT NULL DEFAULT 'disponivel',
  carga_id UUID REFERENCES public.cargas(id) ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'xml'
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notas_status ON public.notas_fiscais(status);
CREATE INDEX idx_notas_cidade ON public.notas_fiscais(cidade);
CREATE INDEX idx_notas_carga ON public.notas_fiscais(carga_id);
CREATE INDEX idx_notas_fornecedor ON public.notas_fiscais(fornecedor);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notas_select_auth" ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "notas_write" ON public.notas_fiscais FOR ALL TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE TRIGGER trg_notas_updated BEFORE UPDATE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================
-- ENTREGAS (tentativas)
-- =========================
CREATE TABLE public.entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id UUID NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  carga_id UUID REFERENCES public.cargas(id) ON DELETE SET NULL,
  data_evento TIMESTAMPTZ NOT NULL DEFAULT now(),
  resultado public.entrega_resultado NOT NULL,
  motivo TEXT,
  observacao TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_entregas_nota ON public.entregas(nota_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas TO authenticated;
GRANT ALL ON public.entregas TO service_role;
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entregas_select_auth" ON public.entregas FOR SELECT TO authenticated USING (true);
CREATE POLICY "entregas_write" ON public.entregas FOR ALL TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));

-- =========================
-- HISTORICO operacional
-- =========================
CREATE TABLE public.historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,         -- 'nota', 'carga', 'veiculo', 'motorista'
  entidade_id UUID,
  acao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_historico_entidade ON public.historico(entidade, entidade_id);
CREATE INDEX idx_historico_created ON public.historico(created_at DESC);
GRANT SELECT, INSERT ON public.historico TO authenticated;
GRANT ALL ON public.historico TO service_role;
ALTER TABLE public.historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historico_select_auth" ON public.historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "historico_insert_auth" ON public.historico FOR INSERT TO authenticated WITH CHECK (true);

-- =========================
-- Trigger: status automático de veículo/motorista conforme carga
-- =========================
CREATE OR REPLACE FUNCTION public.tg_carga_sync_recursos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Quando carga vira em_rota: vincula
  IF NEW.status = 'em_rota' AND (OLD.status IS DISTINCT FROM 'em_rota') THEN
    IF NEW.veiculo_id IS NOT NULL THEN
      UPDATE public.veiculos SET situacao = 'em_rota' WHERE id = NEW.veiculo_id;
    END IF;
    IF NEW.motorista_id IS NOT NULL THEN
      UPDATE public.motoristas SET situacao = 'em_viagem' WHERE id = NEW.motorista_id;
    END IF;
  END IF;
  -- Quando finaliza: libera
  IF NEW.status = 'finalizada' AND OLD.status IS DISTINCT FROM 'finalizada' THEN
    IF NEW.veiculo_id IS NOT NULL THEN
      UPDATE public.veiculos SET situacao = 'disponivel' WHERE id = NEW.veiculo_id;
    END IF;
    IF NEW.motorista_id IS NOT NULL THEN
      UPDATE public.motoristas SET situacao = 'disponivel' WHERE id = NEW.motorista_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_carga_sync
AFTER UPDATE OF status ON public.cargas
FOR EACH ROW EXECUTE FUNCTION public.tg_carga_sync_recursos();

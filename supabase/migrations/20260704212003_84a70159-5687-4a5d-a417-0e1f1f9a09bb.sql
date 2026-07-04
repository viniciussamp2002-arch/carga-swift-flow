
-- 1) Prazo das notas
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS data_chegada date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS data_limite  date;

-- Backfill + trigger para manter data_limite = data_chegada + 5 dias
UPDATE public.notas_fiscais SET data_limite = (data_chegada + 5) WHERE data_limite IS NULL;

CREATE OR REPLACE FUNCTION public.tg_nota_prazo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.data_chegada IS NULL THEN NEW.data_chegada := CURRENT_DATE; END IF;
  NEW.data_limite := (NEW.data_chegada + 5);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_nota_prazo ON public.notas_fiscais;
CREATE TRIGGER trg_nota_prazo BEFORE INSERT OR UPDATE OF data_chegada
ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.tg_nota_prazo();

-- 2) Fornecedores com regras de cálculo de frete
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text UNIQUE NOT NULL,
  nome text NOT NULL,
  tipo_calculo text NOT NULL DEFAULT 'por_tonelada'
    CHECK (tipo_calculo IN ('por_tonelada','por_kg','por_volume','fixo','por_nf')),
  valor_base numeric(12,4) NOT NULL DEFAULT 0,
  icms_percent numeric(6,3) NOT NULL DEFAULT 0,
  desconto_percent numeric(6,3) NOT NULL DEFAULT 0,
  valor_minimo numeric(12,2) NOT NULL DEFAULT 0,
  pedagio numeric(12,2) NOT NULL DEFAULT 0,
  taxa_extra numeric(12,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT ALL ON public.fornecedores TO service_role;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "write fornecedores" ON public.fornecedores FOR ALL TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Financeiro (fretes por nota entregue)
CREATE TABLE IF NOT EXISTS public.financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_id uuid NOT NULL UNIQUE REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  data_entrega date,
  valor_base numeric(12,2) NOT NULL DEFAULT 0,
  valor_icms numeric(12,2) NOT NULL DEFAULT 0,
  valor_desconto numeric(12,2) NOT NULL DEFAULT 0,
  valor_pedagio numeric(12,2) NOT NULL DEFAULT 0,
  valor_taxa_extra numeric(12,2) NOT NULL DEFAULT 0,
  valor_frete numeric(12,2) NOT NULL DEFAULT 0,
  regiao text,
  situacao text NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente','faturado','recebido')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro TO authenticated;
GRANT ALL ON public.financeiro TO service_role;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read financeiro" ON public.financeiro FOR SELECT TO authenticated USING (true);
CREATE POLICY "write financeiro" ON public.financeiro FOR ALL TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));
CREATE TRIGGER trg_financeiro_updated BEFORE UPDATE ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_financeiro_situacao ON public.financeiro(situacao);
CREATE INDEX IF NOT EXISTS idx_financeiro_data ON public.financeiro(data_entrega DESC);

-- 4) Trigger: quando nota vira 'entregue', calcula frete e insere/atualiza financeiro
CREATE OR REPLACE FUNCTION public.tg_nota_gera_financeiro()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f public.fornecedores%ROWTYPE;
  v_base numeric(12,2) := 0;
  v_icms numeric(12,2) := 0;
  v_desc numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_regiao text;
BEGIN
  IF NEW.status = 'entregue' AND (OLD.status IS DISTINCT FROM 'entregue') THEN
    SELECT * INTO f FROM public.fornecedores WHERE cnpj = NEW.cnpj_emissor LIMIT 1;
    IF FOUND THEN
      v_base := CASE f.tipo_calculo
        WHEN 'por_tonelada' THEN (COALESCE(NEW.peso,0)/1000.0) * f.valor_base
        WHEN 'por_kg'       THEN COALESCE(NEW.peso,0) * f.valor_base
        WHEN 'por_volume'   THEN COALESCE(NEW.volumes,0) * f.valor_base
        WHEN 'fixo'         THEN f.valor_base
        WHEN 'por_nf'       THEN f.valor_base
        ELSE 0 END;
      IF v_base < f.valor_minimo THEN v_base := f.valor_minimo; END IF;
      v_icms := ROUND(v_base * f.icms_percent / 100.0, 2);
      v_desc := ROUND(v_base * f.desconto_percent / 100.0, 2);
      v_total := v_base + v_icms - v_desc + f.pedagio + f.taxa_extra;
    END IF;
    -- região simples por UF
    v_regiao := CASE
      WHEN NEW.uf IN ('SP','RJ','MG','ES') THEN 'Sudeste'
      WHEN NEW.uf IN ('PR','SC','RS')      THEN 'Sul'
      WHEN NEW.uf IN ('MT','MS','GO','DF') THEN 'Centro-Oeste'
      WHEN NEW.uf IN ('BA','PE','CE','PB','RN','AL','SE','PI','MA') THEN 'Nordeste'
      WHEN NEW.uf IN ('AM','PA','AC','RO','RR','AP','TO') THEN 'Norte'
      ELSE NULL END;

    INSERT INTO public.financeiro (nota_fiscal_id, fornecedor_id, data_entrega,
      valor_base, valor_icms, valor_desconto, valor_pedagio, valor_taxa_extra,
      valor_frete, regiao, situacao)
    VALUES (NEW.id, f.id, CURRENT_DATE,
      v_base, v_icms, v_desc, COALESCE(f.pedagio,0), COALESCE(f.taxa_extra,0),
      v_total, v_regiao, 'pendente')
    ON CONFLICT (nota_fiscal_id) DO UPDATE SET
      fornecedor_id = EXCLUDED.fornecedor_id,
      data_entrega = EXCLUDED.data_entrega,
      valor_base = EXCLUDED.valor_base,
      valor_icms = EXCLUDED.valor_icms,
      valor_desconto = EXCLUDED.valor_desconto,
      valor_pedagio = EXCLUDED.valor_pedagio,
      valor_taxa_extra = EXCLUDED.valor_taxa_extra,
      valor_frete = EXCLUDED.valor_frete,
      regiao = EXCLUDED.regiao,
      updated_at = now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_nota_gera_financeiro ON public.notas_fiscais;
CREATE TRIGGER trg_nota_gera_financeiro AFTER UPDATE OF status ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.tg_nota_gera_financeiro();

-- 5) Índice pra data_limite
CREATE INDEX IF NOT EXISTS idx_notas_data_limite ON public.notas_fiscais(data_limite);

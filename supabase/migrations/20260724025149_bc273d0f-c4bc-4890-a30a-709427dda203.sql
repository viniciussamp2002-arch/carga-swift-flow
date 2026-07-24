ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS chaves_agrupadas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS numeros_agrupados text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_notas_chaves_agrupadas ON public.notas_fiscais USING GIN (chaves_agrupadas);
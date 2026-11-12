CREATE TYPE public.ocorrencia_tipo AS ENUM ('falta','avaria','sobra','divergencia_volumes','outros');
CREATE TYPE public.ocorrencia_status AS ENUM ('aberta','em_analise','resolvida');
CREATE TABLE public.ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL DEFAULT 'recebimento' CHECK (origem IN ('recebimento','entrega')),
  nota_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE RESTRICT,
  chave_nfe text,
  carga_entrada_id uuid REFERENCES public.cargas_entrada(id) ON DELETE SET NULL,
  tipo public.ocorrencia_tipo NOT NULL,
  quantidade numeric,
  unidade text,
  descricao text NOT NULL DEFAULT '',
  data_ocorrencia timestamptz NOT NULL DEFAULT now(),
  status public.ocorrencia_status NOT NULL DEFAULT 'aberta',
  anexo_path text,
  registrado_por uuid DEFAULT auth.uid(),
  registrado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ocorrencias_nota_idx ON public.ocorrencias(nota_id);
GRANT SELECT, INSERT, UPDATE ON public.ocorrencias TO authenticated;
GRANT ALL ON public.ocorrencias TO service_role;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY ocorrencias_select ON public.ocorrencias FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE POLICY ocorrencias_insert ON public.ocorrencias FOR INSERT TO authenticated WITH CHECK (private.can_write(auth.uid()));
CREATE POLICY ocorrencias_update ON public.ocorrencias FOR UPDATE TO authenticated USING (private.can_write(auth.uid())) WITH CHECK (private.can_write(auth.uid()));
CREATE TRIGGER ocorrencias_updated BEFORE UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY ocorrencias_files_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ocorrencias' AND private.can_write(auth.uid()));
CREATE POLICY ocorrencias_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ocorrencias' AND private.can_write(auth.uid()));
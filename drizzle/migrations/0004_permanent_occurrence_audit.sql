ALTER TYPE public.ocorrencia_tipo ADD VALUE IF NOT EXISTS 'produto_vencido';
ALTER TYPE public.ocorrencia_tipo ADD VALUE IF NOT EXISTS 'produto_recusado';
ALTER TYPE public.ocorrencia_tipo ADD VALUE IF NOT EXISTS 'entrega_nao_realizada';
ALTER TYPE public.ocorrencia_tipo ADD VALUE IF NOT EXISTS 'devolucao';
ALTER TYPE public.ocorrencia_tipo ADD VALUE IF NOT EXISTS 'lacre_violado';
ALTER TYPE public.ocorrencia_tipo ADD VALUE IF NOT EXISTS 'divergencia_documental';
ALTER TABLE public.ocorrencias ADD COLUMN etapa text NOT NULL DEFAULT 'recebimento' CHECK (etapa IN ('recebimento','conferencia','deposito','transporte','tentativa_entrega','pos_entrega'));
ALTER TABLE public.ocorrencias ADD COLUMN carga_id uuid REFERENCES public.cargas(id) ON DELETE RESTRICT;
ALTER TABLE public.ocorrencias ADD COLUMN resolucao text NOT NULL DEFAULT '';
ALTER TABLE public.ocorrencias ADD COLUMN observacao_posterior text NOT NULL DEFAULT '';
ALTER TABLE public.ocorrencias ADD COLUMN resolvida_em timestamptz;
ALTER TABLE public.ocorrencias ADD COLUMN resolvida_por uuid;
UPDATE public.ocorrencias SET etapa = 'tentativa_entrega' WHERE origem = 'entrega';
CREATE TABLE public.ocorrencia_eventos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ocorrencia_id uuid NOT NULL REFERENCES public.ocorrencias(id) ON DELETE RESTRICT,
 nota_id uuid NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE RESTRICT,
 acao text NOT NULL,
 anterior jsonb,
 atual jsonb NOT NULL,
 usuario_id uuid,
 usuario_nome text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ocorrencia_eventos TO authenticated;
GRANT ALL ON public.ocorrencia_eventos TO service_role;
ALTER TABLE public.ocorrencia_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY ocorrencia_eventos_select ON public.ocorrencia_eventos FOR SELECT TO authenticated USING (private.can_write(auth.uid()));
CREATE INDEX ocorrencia_eventos_nota_idx ON public.ocorrencia_eventos(nota_id, created_at);
INSERT INTO public.ocorrencia_eventos(ocorrencia_id, nota_id, acao, atual, usuario_id, usuario_nome, created_at)
SELECT id, nota_id, 'registro_anterior', to_jsonb(o), registrado_por, registrado_por_nome, created_at FROM public.ocorrencias o;
CREATE FUNCTION public.tg_ocorrencia_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); actor_name text;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.nota_id IS DISTINCT FROM OLD.nota_id THEN RAISE EXCEPTION 'A nota fiscal da ocorrência não pode ser alterada'; END IF;
 IF actor IS NOT NULL THEN
  IF NOT private.can_write(actor) THEN RAISE EXCEPTION 'Sem permissão para alterar ocorrências'; END IF;
  SELECT COALESCE(NULLIF(p.nome,''),p.email) INTO actor_name FROM public.profiles p WHERE p.id = actor;
 END IF;
 IF TG_OP = 'INSERT' THEN
  NEW.registrado_por := actor;
  NEW.registrado_por_nome := COALESCE(actor_name, NEW.registrado_por_nome);
 END IF;
 IF NEW.status = 'resolvida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
  IF btrim(NEW.resolucao) = '' THEN RAISE EXCEPTION 'Informe a solução adotada para resolver a ocorrência'; END IF;
  NEW.resolvida_em := now(); NEW.resolvida_por := actor;
 END IF;
 IF TG_OP = 'UPDATE' AND NEW.status <> 'resolvida' THEN NEW.resolvida_em := NULL; NEW.resolvida_por := NULL; END IF;
 IF TG_OP = 'UPDATE' AND to_jsonb(NEW) - 'updated_at' IS NOT DISTINCT FROM to_jsonb(OLD) - 'updated_at' THEN RETURN NEW; END IF;
 INSERT INTO public.ocorrencia_eventos(ocorrencia_id, nota_id, acao, anterior, atual, usuario_id, usuario_nome)
 VALUES (NEW.id, NEW.nota_id, CASE WHEN TG_OP = 'INSERT' THEN 'criacao' WHEN NEW.status = 'resolvida' AND OLD.status IS DISTINCT FROM NEW.status THEN 'resolucao' ELSE 'alteracao' END,
 CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW), actor, actor_name);
 INSERT INTO public.historico(entidade, entidade_id, acao, descricao, user_id)
 VALUES ('ocorrencia', NEW.nota_id, CASE WHEN TG_OP = 'INSERT' THEN 'criacao' ELSE 'alteracao' END, 'Ocorrência ' || NEW.id || ' — ' || NEW.tipo::text || ' — ' || NEW.status::text, actor);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_ocorrencia_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ocorrencia_audit AFTER INSERT OR UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.tg_ocorrencia_audit();
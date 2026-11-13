CREATE FUNCTION public.tg_ocorrencia_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); actor_name text;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.nota_id IS DISTINCT FROM OLD.nota_id THEN RAISE EXCEPTION 'A nota fiscal da ocorrência não pode ser alterada'; END IF;
 IF actor IS NOT NULL THEN
  IF NOT private.can_write(actor) THEN RAISE EXCEPTION 'Sem permissão para alterar ocorrências'; END IF;
  SELECT COALESCE(NULLIF(p.nome,''),p.email) INTO actor_name FROM public.profiles p WHERE p.id = actor;
 END IF;
 IF TG_OP = 'INSERT' THEN NEW.registrado_por := actor; NEW.registrado_por_nome := COALESCE(actor_name, NEW.registrado_por_nome); END IF;
 IF TG_OP = 'UPDATE' THEN
  NEW.registrado_por := OLD.registrado_por; NEW.registrado_por_nome := OLD.registrado_por_nome; NEW.created_at := OLD.created_at;
  NEW.resolvida_em := OLD.resolvida_em; NEW.resolvida_por := OLD.resolvida_por;
 END IF;
 IF NEW.status = 'resolvida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
  IF btrim(NEW.resolucao) = '' THEN RAISE EXCEPTION 'Informe a solução adotada para resolver a ocorrência'; END IF;
  NEW.resolvida_em := now(); NEW.resolvida_por := actor;
 END IF;
 IF NEW.status <> 'resolvida' THEN NEW.resolvida_em := NULL; NEW.resolvida_por := NULL; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_ocorrencia_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ocorrencia_identity BEFORE INSERT OR UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.tg_ocorrencia_identity();
CREATE OR REPLACE FUNCTION public.tg_nota_registra_fornecedor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := regexp_replace(coalesce(NEW.cnpj_emissor,''), '\D', '', 'g');
BEGIN
  IF length(c) IN (11,14) AND coalesce(trim(NEW.fornecedor),'') <> '' THEN
    INSERT INTO public.fornecedores(cnpj, nome) VALUES (c, trim(NEW.fornecedor)) ON CONFLICT (cnpj) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_nota_registra_fornecedor() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER nota_registra_fornecedor AFTER INSERT ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.tg_nota_registra_fornecedor();
INSERT INTO public.fornecedores(cnpj, nome)
SELECT DISTINCT ON (regexp_replace(cnpj_emissor,'\D','','g')) regexp_replace(cnpj_emissor,'\D','','g'), trim(fornecedor)
FROM public.notas_fiscais WHERE length(regexp_replace(coalesce(cnpj_emissor,''),'\D','','g')) IN (11,14) AND trim(fornecedor) <> ''
ON CONFLICT (cnpj) DO NOTHING;
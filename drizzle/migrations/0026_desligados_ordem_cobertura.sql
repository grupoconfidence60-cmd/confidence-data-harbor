ALTER TABLE public.posto_planilha ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;
UPDATE public.posto_planilha p SET ordem = s.rn FROM (SELECT id, row_number() OVER (PARTITION BY posto_id, mes ORDER BY created_at) AS rn FROM public.posto_planilha) s WHERE s.id = p.id;

ALTER TABLE public.ferias ADD COLUMN IF NOT EXISTS cobertura text;

CREATE OR REPLACE FUNCTION public.retirar_desligado_planilha() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.situacao = 'desligado' OR NEW.arquivado) AND NOT (OLD.situacao = 'desligado' OR OLD.arquivado) THEN
    UPDATE public.posto_planilha SET removido = true, updated_at = now()
     WHERE colaborador_id = NEW.id AND removido = false AND mes >= date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.retirar_desligado_planilha() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_retirar_desligado_planilha ON public.colaboradores;
CREATE TRIGGER trg_retirar_desligado_planilha AFTER UPDATE OF situacao, arquivado ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.retirar_desligado_planilha();

UPDATE public.posto_planilha pp SET removido = true, updated_at = now()
  FROM public.colaboradores c
 WHERE c.id = pp.colaborador_id AND (c.situacao = 'desligado' OR c.arquivado) AND pp.removido = false
   AND pp.mes >= date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;

DROP POLICY IF EXISTS "ferias insert" ON public.ferias;
CREATE POLICY "ferias insert" ON public.ferias FOR INSERT TO authenticated WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[])
  OR EXISTS (SELECT 1 FROM public.colaboradores c WHERE c.id = ferias.colaborador_id AND (c.user_id = auth.uid()
     OR (public.has_role(auth.uid(),'supervisor') AND (c.supervisor_id = auth.uid() OR c.posto_id IS NULL OR public.supervisiona_posto(c.posto_id, auth.uid())))))
);

CREATE OR REPLACE FUNCTION public.definir_cobertura(_ferias_id uuid, _nome text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  SELECT public.has_any_role(auth.uid(), ARRAY['admin','gestor','rh']::public.app_role[])
      OR (public.has_role(auth.uid(),'supervisor') AND (c.supervisor_id = auth.uid() OR c.posto_id IS NULL OR public.supervisiona_posto(c.posto_id, auth.uid())))
    INTO ok
    FROM public.ferias f JOIN public.colaboradores c ON c.id = f.colaborador_id WHERE f.id = _ferias_id;
  IF NOT coalesce(ok, false) THEN RAISE EXCEPTION 'Sem permissão para informar a cobertura'; END IF;
  UPDATE public.ferias SET cobertura = nullif(btrim(left(_nome, 120)), ''), updated_at = now() WHERE id = _ferias_id;
END $$;
REVOKE ALL ON FUNCTION public.definir_cobertura(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_cobertura(uuid, text) TO authenticated;
ALTER TABLE public.ferias ADD COLUMN tipo text NOT NULL DEFAULT 'ferias';
ALTER TABLE public.ferias ADD CONSTRAINT ferias_tipo_check CHECK (tipo IN ('ferias','abono'));
COMMENT ON COLUMN public.ferias.tipo IS 'ferias = férias completas (30 dias); abono = abono pecuniário (20 dias)';

CREATE OR REPLACE FUNCTION public.encerrar_ferias_vencidas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  n integer;
BEGIN
  -- Only employees currently marked 'ferias' whose approved FULL vacation already ended
  -- and who have no approved full vacation covering today. Abono rows never change
  -- the employee's situation, and other statuses are untouched.
  UPDATE public.colaboradores c
     SET situacao = 'ativo'
   WHERE c.situacao = 'ferias'
     AND EXISTS (SELECT 1 FROM public.ferias f
                  WHERE f.colaborador_id = c.id
                    AND f.tipo = 'ferias'
                    AND f.status IN ('aprovada','em_gozo','concluida')
                    AND f.data_fim < hoje)
     AND NOT EXISTS (SELECT 1 FROM public.ferias f
                      WHERE f.colaborador_id = c.id
                        AND f.tipo = 'ferias'
                        AND f.status IN ('aprovada','em_gozo')
                        AND f.data_fim >= hoje);
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.ferias SET status = 'concluida'
   WHERE status IN ('aprovada','em_gozo') AND data_fim < hoje;
  RETURN n;
END;
$function$;
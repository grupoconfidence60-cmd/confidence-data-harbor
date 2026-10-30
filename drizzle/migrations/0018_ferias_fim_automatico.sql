CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.encerrar_ferias_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  n integer;
BEGIN
  -- Only employees currently marked 'ferias' whose approved vacation already ended
  -- and who have no approved vacation covering today. Other statuses are untouched.
  UPDATE public.colaboradores c
     SET situacao = 'ativo'
   WHERE c.situacao = 'ferias'
     AND EXISTS (SELECT 1 FROM public.ferias f
                  WHERE f.colaborador_id = c.id
                    AND f.status IN ('aprovada','em_gozo','concluida')
                    AND f.data_fim < hoje)
     AND NOT EXISTS (SELECT 1 FROM public.ferias f
                      WHERE f.colaborador_id = c.id
                        AND f.status IN ('aprovada','em_gozo')
                        AND f.data_fim >= hoje);
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.ferias SET status = 'concluida'
   WHERE status IN ('aprovada','em_gozo') AND data_fim < hoje;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.encerrar_ferias_vencidas() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('encerrar-ferias-vencidas', '5 3 * * *', 'SELECT public.encerrar_ferias_vencidas()');

SELECT public.encerrar_ferias_vencidas();
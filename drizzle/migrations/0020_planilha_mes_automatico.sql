CREATE OR REPLACE FUNCTION public.gerar_planilha_mes(_mes date DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE alvo date := date_trunc('month', coalesce(_mes, (now() AT TIME ZONE 'America/Sao_Paulo')::date))::date; n integer;
BEGIN
  INSERT INTO public.posto_planilha (posto_id, colaborador_id, mes, paridade, turno, hora_inicio, hora_fim, ajustes, observacoes, removido, escala_tipo, posicao)
  SELECT p.posto_id, p.colaborador_id, alvo, p.paridade, p.turno, p.hora_inicio, p.hora_fim, '{}'::jsonb, p.observacoes, false, p.escala_tipo, p.posicao
  FROM public.posto_planilha p
  JOIN public.colaboradores c ON c.id = p.colaborador_id AND NOT c.arquivado AND c.situacao <> 'desligado'
  WHERE p.mes = (alvo - interval '1 month')::date AND NOT p.removido
    AND NOT EXISTS (SELECT 1 FROM public.posto_planilha x WHERE x.posto_id = p.posto_id AND x.mes = alvo);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.gerar_planilha_mes(date) FROM PUBLIC, anon, authenticated;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['colaboradores','postos','ocorrencias','ferias','comunicados','comunicado_leituras','materiais','material_entregas','material_movimentacoes','visitas','inspecoes','documentos','funcoes','notificacoes'] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t)
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
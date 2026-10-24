DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='presencas') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.presencas; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='posto_planilha') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.posto_planilha; END IF;
END $$;
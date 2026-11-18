CREATE OR REPLACE FUNCTION public.sincronizar_intermitente_posto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _origem_reserva boolean;
  _destino_nome text;
  _destino_intermitentes boolean;
BEGIN
  IF OLD.posto_id IS NOT DISTINCT FROM NEW.posto_id THEN
    RETURN NEW;
  END IF;

  SELECT OLD.posto_id IS NULL OR EXISTS (
    SELECT 1 FROM public.postos p
    WHERE p.id = OLD.posto_id AND lower(p.tipo) = 'intermitentes'
  ) INTO _origem_reserva;

  SELECT p.nome, lower(p.tipo) = 'intermitentes'
  INTO _destino_nome, _destino_intermitentes
  FROM public.postos p
  WHERE p.id = NEW.posto_id;

  IF NEW.posto_id IS NULL OR _destino_intermitentes THEN
    NEW.disponibilidade_status := 'disponivel';
    NEW.disponibilidade_detalhe := NULL;
  ELSIF _origem_reserva THEN
    NEW.disponibilidade_status := 'ocupado';
    NEW.disponibilidade_detalhe := _destino_nome;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sincronizar_intermitente_posto ON public.colaboradores;
CREATE TRIGGER sincronizar_intermitente_posto
BEFORE UPDATE OF posto_id ON public.colaboradores
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_intermitente_posto();
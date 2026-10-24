import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Converte endereço em coordenadas usando o serviço público Nominatim (OpenStreetMap). */
export const geocodeEndereco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endereco: string; cidade: string }) => input)
  .handler(async ({ data }) => {
    const q = [data.endereco, data.cidade, "Brasil"].filter(Boolean).join(", ");
    if (!q.trim() || q === "Brasil") return null;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "confidence-gestao/1.0" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const hit = json[0];
    if (!hit) return null;
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), descricao: hit.display_name };
  });

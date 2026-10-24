export const ESCALA_OPTIONS = [
  { value: "par", label: "12x36 · Par" },
  { value: "impar", label: "12x36 · Ímpar" },
  { value: "5x2", label: "5x2 · Segunda a sexta" },
  { value: "6x1", label: "6x1 · Segunda a sábado" },
  { value: "diaria", label: "Todos os dias" },
  { value: "livre", label: "Personalizada" },
] as const;
export function escalaLabel(value: string) {
  return ESCALA_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
export function escalaFromJornada(value: string | null | undefined) {
  return ESCALA_OPTIONS.find((option) => option.value === value)?.value ?? "livre";
}
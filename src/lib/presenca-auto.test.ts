import { describe, it, expect } from "vitest";
import { statusAutomatico } from "./presenca-auto";

const base = { data: "2026-10-24", inicio: "06:00", agora: new Date("2026-10-24T10:00:00") };
describe("presença automática pela escala", () => {
  it("escalado sem ponto após 15 min de tolerância vira falta", () => {
    expect(statusAutomatico({ ...base, scheduled: "T" })).toBe("falta");
    expect(statusAutomatico({ ...base, scheduled: "T", agora: new Date("2026-10-24T06:10:00") })).toBe("aguardando");
  });
  it("ponto dentro da tolerância é presente; depois é atraso", () => {
    expect(statusAutomatico({ ...base, scheduled: "T", entrada: "2026-10-24T06:14:00" })).toBe("presente");
    expect(statusAutomatico({ ...base, scheduled: "T", entrada: "2026-10-24T06:20:00" })).toBe("atraso");
  });
  it("folga da escala e registro manual prevalecem", () => {
    expect(statusAutomatico({ ...base, scheduled: "F" })).toBe("folga");
    expect(statusAutomatico({ ...base, scheduled: "T", manual: "atestado" })).toBe("registrado");
  });
});

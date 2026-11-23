const CHRISTMAS_START = new Date(2026, 10, 23, 0, 0, 0, 0);
// Limite exclusivo: toda a última hora de 25/12 permanece decorada.
const CHRISTMAS_END = new Date(2026, 11, 26, 0, 0, 0, 0);

export function isChristmasDecorationsActive(date: Date): boolean {
  return date >= CHRISTMAS_START && date < CHRISTMAS_END;
}

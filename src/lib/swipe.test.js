import { describe, it, expect } from "vitest";
import { swipeShouldOpen } from "./swipe.js";

const W = 128;
const info = (x) => ({ offset: { x } });

describe("swipeShouldOpen", () => {
  it("arrastre lento: decide la distancia (más de la mitad del ancho abre)", () => {
    expect(swipeShouldOpen(info(-40), W, 600)).toBe(false);
    expect(swipeShouldOpen(info(-80), W, 900)).toBe(true);
  });
  it("flick (más de 0,11 px/ms): decide la dirección aunque sea corto", () => {
    expect(swipeShouldOpen(info(-40), W, 130)).toBe(true);
    expect(swipeShouldOpen(info(70), W, 100)).toBe(false);
  });
  it("menos de 8px no es flick, aunque sea instantáneo", () => {
    expect(swipeShouldOpen(info(-6), W, 1)).toBe(false);
  });
  it("una duración 0 no divide por cero", () => {
    expect(swipeShouldOpen(info(-20), W, 0)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { evaluateFormula, getFormulaVariables } from "../shared/formulaMath";

describe("user-defined arithmetic formulas", () => {
  it("extracts variables and evaluates precedence, parentheses, powers and unary signs", () => {
    expect(getFormulaVariables("N_can / N_tong * V_tong")).toEqual(["N_can", "N_tong", "V_tong"]);
    expect(evaluateFormula("N_can / N_tong * V_tong", { N_can: 10, N_tong: 20, V_tong: 2 })).toBe(1);
    expect(evaluateFormula("-(a + b)^2", { a: 2, b: 3 })).toBe(-25);
    expect(evaluateFormula("2^3^2", {})).toBe(512);
  });
  it("accepts a structural formula even if placeholder inputs might divide by zero", () => {
    expect(getFormulaVariables("a/(b-b)")).toEqual(["a", "b"]);
    expect(() => evaluateFormula("a/(b-b)", { a: 1, b: 2 })).toThrow(/0/);
  });
  it("rejects unsupported code and incomplete input", () => {
    expect(() => getFormulaVariables("process.exit(1)")).toThrow();
    expect(() => getFormulaVariables("a + ")).toThrow();
    expect(() => evaluateFormula("a+b", { a: 1 })).toThrow();
  });
});

import { useMemo, useState } from "react";
import "./special.css";
import { evaluateFormula, getFormulaVariables } from "@shared/formulaMath";
import { parseLocaleNumber } from "@/lib/numberInput";

export function CustomCalculator({ name, formula, description, config }: { name: string; formula: string; description: string; config?: unknown }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [lastResult, setLastResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const units = config && typeof config === "object" ? config as { inputUnits?: Record<string, string>; outputUnit?: string; variables?: { key: string; label: string; unit: string }[] } : {};
  const variables = useMemo(() => {
    try { return getFormulaVariables(formula); }
    catch (cause) { return cause instanceof Error ? cause.message : "Công thức không hợp lệ."; }
  }, [formula]);
  const run = () => {
    if (typeof variables === "string") return setError(variables);
    try {
      const input = Object.fromEntries(variables.map(variable => [variable, values[variable]?.trim() ? parseLocaleNumber(values[variable]) : NaN]));
      const result = evaluateFormula(formula, input);
      setLastResult(result);
      setError(null);
    } catch (cause) {
      setLastResult(null);
      setError(cause instanceof Error ? cause.message : "Không thể tính công thức này.");
    }
  };
  return <section className="content-panel custom-calculator"><span className="panel-index">CUSTOM FORMULA / LIVE CALCULATOR</span><h2>{name}</h2><p>{description}</p><code>{formula}</code>{typeof variables === "string" ? <p className="custom-error">{variables}. Tạo tool mới với tên biến không dấu để tính trực tiếp.</p> : <><div className="custom-fields">{variables.map(variable => { const item = units.variables?.find(candidate => candidate.key === variable); return <label key={variable}>{item?.label || variable}{(item?.unit || units.inputUnits?.[variable]) && <small>{item?.unit || units.inputUnits?.[variable]}</small>}<input type="text" inputMode="decimal" value={values[variable] ?? ""} onChange={event => { setValues(current => ({ ...current, [variable]: event.target.value })); setLastResult(null); }} placeholder={`Nhập ${item?.label || variable}`} /></label>; })}</div><button className="primary-cta custom-run" onClick={run}>Tính kết quả</button>{error && <p className="custom-error" role="alert">{error}</p>}{lastResult !== null && <div className="custom-answer">Kết quả: <strong>{new Intl.NumberFormat("vi-VN", { maximumSignificantDigits: 8 }).format(lastResult)} {units.outputUnit ?? ""}</strong></div>}<p className="custom-unit-note">Dấu “,” hoặc “.” đều được hiểu là dấu thập phân; không dùng dấu chấm để phân cách hàng nghìn.</p></>}</section>;
}

type Token = { text: string; kind: "number" | "name" | "symbol" };

function tokenize(formula: string): Token[] {
  if (formula.length > 160) throw new Error("Công thức quá dài.");
  const tokens: Token[] = [];
  let index = 0;
  const pattern = /\s*([A-Za-z_][A-Za-z0-9_]*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+\-*/^])/y;
  while (index < formula.length) {
    if (!formula.slice(index).trim()) break;
    pattern.lastIndex = index;
    const match = pattern.exec(formula);
    if (!match) throw new Error(`Ký tự không hợp lệ ở vị trí ${index + 1}. Dùng số, tên biến ASCII, + - * / ^ và dấu ngoặc.`);
    const text = match[1];
    tokens.push({ text, kind: /^[A-Za-z_]/.test(text) ? "name" : /^[0-9.]/.test(text) ? "number" : "symbol" });
    index = pattern.lastIndex;
    if (tokens.length > 100) throw new Error("Công thức có quá nhiều thành phần.");
  }
  if (!tokens.length) throw new Error("Công thức không được để trống.");
  return tokens;
}

export function getFormulaVariables(formula: string): string[] {
  const tokens = tokenize(formula);
  // Also parse with placeholder values: malformed formulas must never be saved.
  evaluateTokens(tokens, Object.fromEntries(tokens.filter(token => token.kind === "name").map(token => [token.text, 1])), true);
  return [...new Set(tokens.filter(token => token.kind === "name").map(token => token.text))];
}

function evaluateTokens(tokens: Token[], values: Record<string, number>, syntaxOnly = false): number {
  let cursor = 0;
  const accept = (symbol: string) => tokens[cursor]?.text === symbol && !!++cursor;
  const expression = (): number => {
    let left = product();
    while (tokens[cursor]?.text === "+" || tokens[cursor]?.text === "-") {
      const operator = tokens[cursor++].text;
      const right = product();
      left = operator === "+" ? left + right : left - right;
    }
    return left;
  };
  const product = (): number => {
    let left = unary();
    while (tokens[cursor]?.text === "*" || tokens[cursor]?.text === "/") {
      const operator = tokens[cursor++].text;
      const right = unary();
      if (operator === "/" && right === 0 && !syntaxOnly) throw new Error("Không thể chia cho 0.");
      left = operator === "*" ? left * right : left / (syntaxOnly && right === 0 ? 1 : right);
    }
    return left;
  };
  const unary = (): number => {
    if (accept("+")) return unary();
    if (accept("-")) return -unary();
    return power();
  };
  const power = (): number => {
    const base = primary();
    return accept("^") ? Math.pow(base, unary()) : base;
  };
  const primary = (): number => {
    const token = tokens[cursor++];
    if (!token) throw new Error("Công thức chưa hoàn chỉnh.");
    if (token.text === "(") {
      const result = expression();
      if (!accept(")")) throw new Error("Thiếu dấu ngoặc đóng.");
      return result;
    }
    if (token.kind === "number") return Number(token.text);
    if (token.kind === "name") {
      if (!Object.prototype.hasOwnProperty.call(values, token.text) || !Number.isFinite(values[token.text]))
        throw new Error(`Chưa nhập giá trị số hợp lệ cho ${token.text}.`);
      return values[token.text];
    }
    throw new Error(`Thành phần ${token.text} không hợp lệ.`);
  };
  const result = expression();
  if (cursor !== tokens.length) throw new Error("Công thức có thành phần thừa hoặc thiếu toán tử.");
  if (!Number.isFinite(result) && !syntaxOnly) throw new Error("Kết quả không hữu hạn.");
  return result;
}

export function evaluateFormula(formula: string, values: Record<string, number>): number {
  return evaluateTokens(tokenize(formula), values);
}

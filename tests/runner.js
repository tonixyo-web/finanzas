const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assertEqual(actual, expected, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} esperado ${e}, obtenido ${a}`.trim());
}

export function assertTrue(cond, msg = "condición falsa") {
  if (!cond) throw new Error(msg);
}

export function assertThrows(fn, msg = "se esperaba una excepción") {
  try { fn(); } catch { return; }
  throw new Error(msg);
}

export async function runAll() {
  const results = [];
  for (const t of tests) {
    try {
      await t.fn();
      results.push({ name: t.name, ok: true });
    } catch (err) {
      results.push({ name: t.name, ok: false, error: err.message });
    }
  }
  return results;
}

// argumenty.js — wspólne czytanie argumentów narzędzi: plik + opcje `--nazwa wartość` + przełączniki.

/**
 * @param {string[]} argv argumenty bez `node skrypt`
 * @param {string[]} [flagi] przełączniki bez wartości (np. 'arkusz'): nie zjadają następnego słowa
 * @returns {{plik:string|undefined, opt:(n:string, d?:any)=>any, wiele:(n:string)=>string[]}}
 */
export function argumenty(argv, flagi = []) {
  const prz = new Set(flagi), opcje = new Map(); let plik;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { plik ??= a; continue; }
    const n = a.slice(2);
    if (prz.has(n)) { opcje.set(n, [true]); continue; }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`opcja --${n} wymaga wartości`);
    opcje.set(n, [...(opcje.get(n) ?? []), v]); i++;
  }
  return { plik, opt: (n, d) => opcje.get(n)?.at(-1) ?? d, wiele: (n) => opcje.get(n) ?? [] };
}

/** Argumenty bieżącego polecenia; zły wiersz poleceń kończy program komunikatem, nie śladem stosu. */
export function zWiersza(flagi = []) {
  try { return argumenty(process.argv.slice(2), flagi); } catch (e) { console.error(`błąd: ${e.message}`); process.exit(1); }
}

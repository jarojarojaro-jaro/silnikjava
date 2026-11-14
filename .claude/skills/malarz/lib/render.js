// render.js — odtworzenie obrazu z listy pociągnięć w dowolnej skali (Node i przeglądarka).

import { Pedzel, odtworz, plotno, oswietl, BAJTY } from './pedzel.js';

/**
 * Maluje pierwsze `ile` pociągnięć w skali S (px na jednostkę) i zwraca RGBA 8-bit.
 * @param {object} n nagłówek pliku obrazu @param {Uint8Array} bajty
 * @param {{ile?:number, swiatlo?:boolean|object}} [o] swiatlo: false = czysty kolor, obiekt = własne ustawienia
 * @returns {{px:Uint8ClampedArray, w:number, h:number, C:Float32Array, Hb:Float32Array}}
 */
export function renderuj(n, bajty, S, o = {}) {
  const P = Pedzel(n.W, n.H, S, null, n.cechy), ile = Math.min(o.ile ?? Infinity, bajty.length / BAJTY);
  const C = plotno(P.PW, P.PH, n.grunt), Hb = new Float32Array(P.PW * P.PH);
  odtworz(P, C, bajty, 0, ile, Hb);
  const sw = o.swiatlo === false ? { sila: 0 } : typeof o.swiatlo === 'object' ? o.swiatlo : n.swiatlo;
  const px = oswietl(C, Hb, P.PW, P.PH, S, new Uint8ClampedArray(P.PW * P.PH * 4), sw);
  return { px, w: P.PW, h: P.PH, C, Hb };
}

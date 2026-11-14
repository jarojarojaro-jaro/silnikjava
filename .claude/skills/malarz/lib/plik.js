// plik.js — obraz jako plik: nagłówek (rozmiar, grunt/papier, styl, etapy) + lista pociągnięć pędzla
// albo śladów narzędzi suchych (base64).
// Zwykły tekst JSON: nie ma w nim pikseli, tylko pociągnięcia pędzla w kolejności malowania.

import { BAJTY } from './pedzel.js';

/**
 * @param {{W:number,H:number,grunt:number[],tytul?:string,autor?:string,styl:string,cechy:object,swiatlo:object,etapy:Array<{nazwa:string,nr:string,pedzel:number,koniec:number}>}} naglowek
 * @param {Uint8Array} bajty rekordy pociągnięć
 */
export function doTekstu(naglowek, bajty) {
  const b64 = typeof Buffer !== 'undefined' ? Buffer.from(bajty).toString('base64') : btoa(String.fromCharCode(...bajty));
  const rys = naglowek.rodzaj === 'rysunek';
  return JSON.stringify({ format: 'malarz/1', ...naglowek, ...(rys ? { slady: b64 } : { ile: bajty.length / BAJTY, pociagniecia: b64 }) });
}

/** Odczytuje plik obrazu: { naglowek, bajty }. Obraz olejny ma `pociagniecia`, rysunek — `slady`. */
export function zTekstu(tekst) {
  const o = JSON.parse(tekst);
  if (o.format !== 'malarz/1') throw new Error('to nie jest plik obrazu malarza (format malarz/1)');
  const { pociagniecia, slady, ...naglowek } = o, b64 = naglowek.rodzaj === 'rysunek' ? slady : pociagniecia;
  let bajty;
  if (typeof Buffer !== 'undefined') bajty = new Uint8Array(Buffer.from(b64, 'base64'));
  else { const s = atob(b64); bajty = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bajty[i] = s.charCodeAt(i); }
  if (naglowek.rodzaj !== 'rysunek' && bajty.length !== naglowek.ile * BAJTY) throw new Error('lista pociągnięć ma złą długość');
  return { naglowek, bajty };
}

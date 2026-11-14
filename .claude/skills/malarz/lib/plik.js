// plik.js — obraz jako plik: nagłówek (rozmiar, grunt, styl, etapy) + lista pociągnięć (base64).
// Zwykły tekst JSON: nie ma w nim pikseli, tylko pociągnięcia pędzla w kolejności malowania.

import { BAJTY } from './pedzel.js';

/**
 * @param {{W:number,H:number,grunt:number[],tytul?:string,autor?:string,styl:string,cechy:object,swiatlo:object,etapy:Array<{nazwa:string,nr:string,pedzel:number,koniec:number}>}} naglowek
 * @param {Uint8Array} bajty rekordy pociągnięć
 */
export function doTekstu(naglowek, bajty) {
  const b64 = typeof Buffer !== 'undefined' ? Buffer.from(bajty).toString('base64') : btoa(String.fromCharCode(...bajty));
  return JSON.stringify({ format: 'malarz/1', ...naglowek, ile: bajty.length / BAJTY, pociagniecia: b64 });
}

/** Odczytuje plik obrazu: { naglowek, bajty }. */
export function zTekstu(tekst) {
  const o = JSON.parse(tekst);
  if (o.format !== 'malarz/1') throw new Error('to nie jest plik obrazu malarza (format malarz/1)');
  const { pociagniecia, ...naglowek } = o;
  let bajty;
  if (typeof Buffer !== 'undefined') bajty = new Uint8Array(Buffer.from(pociagniecia, 'base64'));
  else { const s = atob(pociagniecia); bajty = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bajty[i] = s.charCodeAt(i); }
  if (bajty.length !== naglowek.ile * BAJTY) throw new Error('lista pociągnięć ma złą długość');
  return { naglowek, bajty };
}

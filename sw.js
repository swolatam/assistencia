// -------- sw.js v2 --------
/* ═══════════════════════════════════════════════════════════════
   SERVICE WORKER — o app guardado no celular

   Faz o app instalado abrir sem sinal. Só cuida dos ARQUIVOS do app
   (HTML, CSS, JS, ícones): os dados (rascunhos, fila) ficam no
   IndexedDB pelo armazem.js, e a ponte com o Apps Script nunca passa
   por aqui (é um iframe de outro endereço, o script.google.com).

   Estratégia: REDE PRIMEIRO, com prazo. Com sinal, o técnico sempre
   recebe a versão publicada mais nova, e ela fica guardada; sem sinal
   (ou se a rede não responder em 4 s), abre a guardada. Assim não
   existe número de versão para lembrar de subir a cada publicação, nem
   técnico preso numa versão velha. (O GitHub Pages deixa o navegador
   reaproveitar um arquivo por até 10 min: publicação nova pode levar
   esse tempo para chegar.)

   Resposta redirecionada ou de outro lugar nunca é guardada no lugar
   do app.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const CACHE = 'sistema-os';
const PRAZO = 4000;

// A casca do app. './' e não 'index.html': toda página do app é a
// mesma, e é com './' que o técnico abre o app instalado.
const CASCA = [
  './', 'rat.css', 'config.js', 'servidor.js', 'armazem.js', 'fila.js', 'rat.js',
  'manifest.webmanifest', 'icones/icone-192.png', 'icones/icone-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // um por um: arquivo que falta (ex.: config.js no Live Server) não
  // pode impedir de guardar o resto
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CASCA.map(u => c.add(u).catch(() => {})))));
});

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(redePrimeiro(req));
  else if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(guardadoPrimeiro(req));
});

function comPrazo(promessa, ms) {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error('sem resposta')), ms);
    promessa.then(r => { clearTimeout(t); ok(r); }, erro => { clearTimeout(t); falha(erro); });
  });
}

async function redePrimeiro(req) {
  const cache = await caches.open(CACHE);
  const chave = req.mode === 'navigate' ? './' : req;   // toda página do app é a mesma
  const daRede = fetch(req);
  try {
    const res = await comPrazo(daRede, PRAZO);
    // só guarda resposta boa e do próprio app
    if (res.ok && res.type === 'basic' && !res.redirected) cache.put(chave, res.clone());
    return res;
  } catch (e) {
    const guardado = await cache.match(chave, { ignoreSearch: true });
    if (guardado) {
      // a rede estava lenta: a resposta dela ainda atualiza o guardado
      daRede.then(res => { if (res.ok && res.type === 'basic' && !res.redirected) cache.put(chave, res); })
            .catch(() => {});
      return guardado;
    }
    throw e;
  }
}

// Fonte do Google: muda nunca. Guardada, sem sinal o app fica com a
// mesma letra; sem ela, cai na Arial.
async function guardadoPrimeiro(req) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(req);
  if (guardado) return guardado;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
// -------- sw.js v2 --------

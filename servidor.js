// -------- servidor.js v3 --------
/* ═══════════════════════════════════════════════════════════════
   SERVIDOR — a única porta do app para o servidor

   As telas e a fila de envio só conhecem Servidor.inicio() e
   Servidor.finalizar(). O que tem do outro lado mora só aqui. Três
   caminhos, nesta ordem:
     • gas:   a página servida pelo Apps Script (google.script.run);
     • ponte: o app instalado (GitHub Pages). O endereço /exec vem do
              config.js, que o publicar.py escreve na hora de publicar;
     • local: Live Server, com o servidor de mentira do dados-exemplo.js.
   Fora do seu computador e sem config.js, NÃO cai nos dados de
   exemplo: o técnico veria O.S. inventadas achando que são reais.

   A ponte: fetch direto no Apps Script dá 401, porque o login Google
   não vai junto (o app só abre para contas kalmarglobal.com). Então o
   app abre o /exec?ponte=1 num iframe escondido. O iframe vai COM o
   login do técnico, e a página dele (paginaPonte_, no Codigo.gs) chama
   o google.script.run e devolve a resposta por postMessage. Quem é o
   técnico o Google diz pelo e-mail, como na página do Apps Script.

   Toda chamada tem prazo. Sinal que cai no meio deixa a chamada
   pendurada para sempre, e uma chamada pendurada travaria a fila de
   envio inteira atrás dela.
   ═══════════════════════════════════════════════════════════════ */
window.Servidor = (function () {
  'use strict';

  const PRAZO_INICIO    = 60 * 1000;
  const PRAZO_FINALIZAR = 120 * 1000;   // gera o PDF e manda e-mail: costuma levar 10–20 s
  const PRAZO_PONTE     = 25 * 1000;    // para o iframe abrir e dizer "pronta"

  const temGas   = !!(window.google && google.script && google.script.run);
  const urlPonte = ((window.CONFIG || {}).ponte || '').trim();
  const local    = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const modo     = temGas ? 'gas' : urlPonte ? 'ponte' : (local && window.API_LOCAL) ? 'local' : 'nenhum';

  function chamarGas(metodo, ...args) {
    return new Promise((ok, falha) => {
      google.script.run
        .withSuccessHandler(ok)
        .withFailureHandler(e => falha(new Error((e && e.message) || String(e))))[metodo](...args);
    });
  }

  // ── Ponte ──────────────────────────────────────────────────────
  // A página do Apps Script roda num subdomínio do googleusercontent,
  // dentro do iframe do script.google.com.
  const ORIGEM_GOOGLE = /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/;

  let ponte = null;            // { iframe, janela, origem, pronta, aoFicarPronta }
  let seq = 0;
  const esperando = new Map(); // id da chamada → { ok, falha }

  // A mensagem veio de dentro do NOSSO iframe? (outra aba ou iframe
  // velho não conta). Subir pelos parent é permitido entre origens.
  function deDentro(janela, p) {
    let w = janela;
    for (let i = 0; w && i < 6; i++) {
      if (w === p.iframe.contentWindow) return true;
      if (w === w.parent) break;
      w = w.parent;
    }
    return false;
  }

  window.addEventListener('message', ev => {
    if (!ponte || !ORIGEM_GOOGLE.test(ev.origin)) return;
    const m = ev.data || {};
    if (m.ponte === 'pronta' && !ponte.janela && deDentro(ev.source, ponte)) {
      ponte.janela = ev.source;
      ponte.origem = ev.origin;
      ponte.aoFicarPronta();
    } else if (m.ponte === 'resposta' && ev.source === ponte.janela) {
      const p = esperando.get(m.id);
      if (!p) return;
      esperando.delete(m.id);
      if (m.ok) { p.ok(m.dados); return; }
      const erro = new Error(m.erro || 'Erro no servidor.');
      erro.tipo = m.tipo || '';
      p.falha(erro);
    }
  });

  // Sem sinal o iframe não abre; sem login Kalmar (ou com a sessão
  // vencida) o Google mostra a tela de login, que não abre em iframe.
  // Nos dois casos ele nunca diz "pronta".
  function erroPonte() {
    if (navigator.onLine === false) return new Error('Sem sinal.');
    const erro = new Error('Não consegui entrar no servidor com a sua conta Kalmar.');
    erro.tipo = 'login';
    return erro;
  }

  function fecharPonte(p) {
    if (ponte !== p) return;
    p.iframe.remove();
    ponte = null;
  }

  function abrirPonte() {
    if (ponte) return ponte.pronta;
    const iframe = document.createElement('iframe');
    iframe.hidden = true;
    iframe.title = 'servidor';
    iframe.src = urlPonte + '?ponte=1&origem=' + encodeURIComponent(location.origin);
    const p = { iframe, janela: null, origem: '' };
    p.pronta = new Promise((ok, falha) => {
      p.aoFicarPronta = ok;
      setTimeout(() => falha(erroPonte()), PRAZO_PONTE);
    });
    // não abriu: some, e a próxima chamada tenta um iframe novo
    p.pronta.catch(() => fecharPonte(p));
    ponte = p;
    document.body.appendChild(iframe);
    return p.pronta;
  }

  async function chamarPonte(metodo, args, prazo) {
    await abrirPonte();
    const p = ponte;
    const id = ++seq;
    return new Promise((ok, falha) => {
      const timer = setTimeout(() => {
        esperando.delete(id);
        fecharPonte(p);   // pode ter morrido: na próxima, abre outra
        falha(new Error('O servidor não respondeu a tempo.'));
      }, prazo);
      esperando.set(id, {
        ok:    d => { clearTimeout(timer); ok(d); },
        falha: e => { clearTimeout(timer); falha(e); }
      });
      p.janela.postMessage({ ponte: 'chamar', id, metodo, args }, p.origem);
    });
  }

  function comPrazo(promessa, ms) {
    let timer = 0;
    const estourou = new Promise((ok, falha) => {
      timer = setTimeout(() => falha(new Error('O servidor não respondeu a tempo.')), ms);
    });
    return Promise.race([promessa, estourou]).finally(() => clearTimeout(timer));
  }

  const semServidor = () => Promise.reject(new Error('Este app está sem servidor configurado (falta o config.js).'));

  const base = {
    gas:    { inicio: () => chamarGas('apiInicio'), finalizar: r => chamarGas('apiFinalizar', r) },
    ponte:  { inicio: () => chamarPonte('inicio', [], PRAZO_INICIO),
              finalizar: r => chamarPonte('finalizar', [r], PRAZO_FINALIZAR) },
    local:  window.API_LOCAL,
    nenhum: { inicio: semServidor, finalizar: semServidor }
  }[modo];

  return {
    modo,
    pedeCodigo: false,   // o código de técnico era do modo api (sem uso)
    // onde o técnico entra com a conta Kalmar quando a ponte não abre
    urlEntrar: modo === 'ponte' ? urlPonte : '',
    inicio:    () => comPrazo(base.inicio(), PRAZO_INICIO + PRAZO_PONTE),
    finalizar: r  => comPrazo(base.finalizar(r), PRAZO_FINALIZAR + PRAZO_PONTE)
  };
})();
// -------- servidor.js v3 --------

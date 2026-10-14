// -------- fila.js v2 --------
/* ═══════════════════════════════════════════════════════════════
   FILA DE ENVIO — relatório fechado e toque do relógio saem daqui,
   com ou sem sinal

   "Finalizar" não fala direto com o servidor: grava o relatório na
   fila (no aparelho) e a fila manda. Sem sinal, ele espera e sai
   sozinho quando a conexão volta; o técnico não precisa ficar
   tocando em "enviar".

   Dois tipos de item, na ordem em que nasceram:
     relatorio  o relatório fechado (Servidor.finalizar)
     toque      um toque do relógio da O.S. (Servidor.apontar), que vai
                para a aba Apontamentos. Leva a hora do celular no
                envio, para o servidor conferir o relógio do aparelho.
   Item da fila antiga, sem tipo, é relatório.

   Mandar duas vezes não estraga nada: o id nasce no celular, e o
   servidor reconhece um id que já fechou (devolve "repetido" e não
   manda e-mail de novo). Por isso, na dúvida, a fila tenta de novo.

   Quando tenta: ao abrir o app, quando o celular avisa que a conexão
   voltou, quando o app volta para a frente da tela e a cada 30 s.
   Depois de cada falha, a espera dobra (15 s, 30 s, 1 min… até 10).
   Falhou por falta de conexão (sem sinal, sem login, sem resposta), a
   rodada para ali: os outros itens dariam no mesmo, e cada um ainda
   esperaria o prazo inteiro.
   Por enquanto só com o app aberto: fechado, sai na próxima abertura.

   LGPD: a fila guarda as assinaturas em PNG só até o servidor
   confirmar. Confirmou, o item sai do aparelho; a lista de enviados
   guarda só a O.S., o cliente e o link do PDF.
   ═══════════════════════════════════════════════════════════════ */
window.Fila = (function () {
  'use strict';

  const ESPERA_MIN   = 15 * 1000;
  const ESPERA_MAX   = 10 * 60 * 1000;
  const RELOGIO      = 30 * 1000;
  const MAX_ENVIADOS = 10;

  let itens = [];          // na ordem em que foram fechados
  let enviados = [];       // o mais recente primeiro
  let servidor = null;
  let aoMudar = () => {};  // algo mudou: a tela redesenha
  let aoEnviar = () => {}; // um item saiu sem o técnico estar olhando

  // Um envio de cada vez: dois ao mesmo tempo poderiam mandar o mesmo item.
  let corrente = Promise.resolve();
  let tentativaMarcada = false;
  function emSerie(fn) {
    const p = corrente.then(fn);
    corrente = p.catch(() => {});
    return p;
  }

  const msgErro = e => String((e && e.message) || e).replace(/^(Exception|Error):\s*/i, '');
  const semFlags = item => { const c = Object.assign({}, item); delete c.enviando; delete c.semConexao; return c; };

  async function iniciar(opcoes) {
    servidor = opcoes.servidor;
    aoMudar  = opcoes.aoMudar  || aoMudar;
    aoEnviar = opcoes.aoEnviar || aoEnviar;
    itens = (await Armazem.fila.todos()).sort((a, b) => a.criadoEm - b.criadoEm);
    enviados = (await Armazem.pref.ler('enviados')) || [];

    window.addEventListener('online', () => { aoMudar(); tentar(true); });
    window.addEventListener('offline', () => aoMudar());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tentar(false);
    });
    setInterval(() => tentar(false), RELOGIO);
    tentar(false);
  }

  // Grava ANTES de qualquer tentativa: daqui em diante o relatório
  // assinado não depende mais da memória da página.
  async function por(envio, tipo) {
    const item = { id: envio.id, tipo: tipo || 'relatorio', envio, criadoEm: Date.now(),
                   tentativas: 0, proximaEm: 0, ultimoErro: '' };
    await Armazem.fila.gravar(item);
    itens = itens.filter(i => i.id !== item.id).concat(item);
    aoMudar();
    return item;
  }

  // O toque sai na hora, sem esperar o relógio de 30 s da fila.
  async function porToque(toque) {
    const item = await por(toque, 'toque');
    tentar(true);
    return item;
  }

  const ehToque = item => item.tipo === 'toque';
  const semConexao = e => !!(e && (e.rede || e.tipo === 'login')) || navigator.onLine === false;

  // Devolve a resposta do servidor, ou null se não foi (o item fica na
  // fila com o erro anotado e a hora da próxima tentativa). Toque que
  // chegou devolve { toque: true }: não entra em "enviados".
  async function enviarUm(item) {
    item.enviando = true;
    aoMudar();
    let res;
    try {
      const envio = JSON.parse(JSON.stringify(item.envio));
      res = ehToque(item)
        ? await servidor.apontar(Object.assign(envio, { enviadoEm: Date.now() }))
        : await servidor.finalizar(envio);
    } catch (e) {
      item.tentativas++;
      item.ultimoErro = navigator.onLine === false ? 'Sem sinal.' : msgErro(e);
      item.proximaEm = Date.now() + Math.min(ESPERA_MIN * Math.pow(2, item.tentativas - 1), ESPERA_MAX);
      item.enviando = false;
      item.semConexao = semConexao(e);
      try { await Armazem.fila.gravar(semFlags(item)); } catch (erro) { /* fica a anotação só na memória */ }
      aoMudar();
      return null;
    }

    // Chegou. Se apagar daqui falhar, o pior é mandar de novo, e o
    // servidor responde "repetido".
    itens = itens.filter(i => i !== item);
    try { await Armazem.fila.apagar(item.id); } catch (e) { /* idem */ }
    if (ehToque(item)) { aoMudar(); return { toque: true }; }
    const feito = {
      id: item.id, os: item.envio.os, cliente: item.envio.cliente,
      pdf: (res && res.pdf) || '', erroEmail: (res && res.erroEmail) || '',
      repetido: !!(res && res.repetido), em: Date.now()
    };
    enviados = [feito].concat(enviados.filter(e => e.id !== item.id)).slice(0, MAX_ENVIADOS);
    try { await Armazem.pref.gravar('enviados', enviados); } catch (e) { /* é só o histórico */ }
    aoMudar();
    return Object.assign({ enviadoPara: (res && res.enviadoPara) || '' }, feito);
  }

  // Tenta tudo o que já está na hora. forcar: ignora a espera (a
  // conexão voltou, ou o técnico pediu).
  function tentar(forcar) {
    if (tentativaMarcada && !forcar) return corrente;
    tentativaMarcada = true;
    return emSerie(async () => {
      tentativaMarcada = false;
      for (const item of itens.slice()) {
        if (navigator.onLine === false) break;
        if (!forcar && item.proximaEm > Date.now()) continue;
        const feito = await enviarUm(item);
        if (feito && !feito.toque) aoEnviar(feito);
        if (!feito && item.semConexao) break;
      }
    });
  }

  // Tenta este item já (é o que o "Finalizar" chama). Se ele já tinha
  // saído por outro caminho, devolve o registro do envio.
  function enviarAgora(id) {
    return emSerie(async () => {
      const item = itens.find(i => i.id === id);
      return item ? enviarUm(item) : (enviados.find(e => e.id === id) || null);
    });
  }

  return {
    iniciar,
    por,
    porToque,
    tentar,
    enviarAgora,
    lista:    () => itens.filter(i => !ehToque(i)),   // relatórios esperando
    toques:   () => itens.filter(ehToque),            // toques do relógio esperando
    enviados: () => enviados.slice()
  };
})();
// -------- fila.js v2 --------

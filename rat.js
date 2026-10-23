// -------- rat.js v7 --------
/* ═══════════════════════════════════════════════════════════════
   ASSISTÊNCIA TÉCNICA — lógica da página (as telas)

   Quatro telas, sempre nesta ordem:
     inicio → preencher → revisar (lê e assina) → enviado

   As telas não falam com o servidor nem com o armazenamento direto:
     servidor.js  a única porta para o servidor (Servidor)
     armazem.js   o que fica guardado no aparelho (Armazem)
     fila.js      a fila de envio (Fila)
     relogio.js   as horas de serviço de cada O.S. (Relogio)
   Roda igual no Live Server (dados-exemplo.js) e no Apps Script.
   Fonte (build.py junta os cinco em appscript/logica.html).

   O relógio é separado do relatório: tocar numa O.S. pergunta se é
   para INICIAR o serviço (o relógio começa a contar), e o relatório
   abre depois, pelo "Finalizar serviço" ou pelo "Preencher
   relatório". "Só o relatório" continua existindo; aí, na hora de
   enviar, o técnico informa o início e o fim com justificativa.

   Vários relatórios em andamento ao mesmo tempo, cada um com o seu
   rascunho, guardado no celular a cada toque. Abrir outra O.S. nunca
   mexe na que estava aberta. Caiu o sinal, fechou o navegador sem
   querer: ao abrir de novo, está tudo lá.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Carimbo de versão. O build.py troca isto pela versão do
     logica.html que gerou ("logica v4"), e o app mostra no pé da tela
     inicial. Serve para uma pergunta que já custou horas: "o que está
     no ar é o código novo ou o antigo?". No Live Server continua
     __VERSAO__ e aparece como "local". */
  const VERSAO = 'site v4';

  const MAX_NA_LISTA     = 60;
  const MAX_ENVIADOS     = 5;      // quantos "enviados" a tela inicial mostra

  // ── Utilidades ─────────────────────────────────────────────────
  const pad     = n => String(n).padStart(2, '0');
  const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const br      = iso => /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(0, 10).split('-').reverse().join('/') : (iso || '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const $  = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const horimetro = h => /^\d+([.,]\d+)?$/.test(String(h || '').trim()) ? `${String(h).trim()} h` : String(h || '');
  // "14/09/2026" ou "14/09/2026 a 15/09/2026"
  const periodo = (de, ate) => br(de) + (ate && ate !== de ? ' a ' + br(ate) : '');
  const plural  = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  // "hoje 14:32", "ontem 09:10", "12/09 16:00"
  function quando(ms) {
    if (!ms) return '';
    const d = new Date(ms), hoje = new Date(), ontem = new Date(Date.now() - 864e5);
    const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const mesmoDia = (a, b) => a.toDateString() === b.toDateString();
    if (mesmoDia(d, hoje))  return 'hoje ' + hora;
    if (mesmoDia(d, ontem)) return 'ontem ' + hora;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hora}`;
  }

  /* ── Erro na tela ─────────────────────────────────────────────────
     Erro de JS some no console, e ninguém abre console num celular no
     pátio: o app só "trava" e não sobra pista nenhuma. Aqui ele
     aparece escrito, o técnico tira um print e manda. */
  function mostrarErroFatal(texto) {
    const caixa = $('#erro-fatal'), txt = $('#erro-fatal-txt');
    if (!caixa || !txt) return;
    txt.textContent = (txt.textContent ? txt.textContent + '\n\n' : '') + texto;
    caixa.hidden = false;
  }

  function pegarErros() {
    window.addEventListener('error', e => {
      mostrarErroFatal((e.message || 'erro') +
        (e.filename ? '\n' + String(e.filename).split('/').pop() + ':' + e.lineno : ''));
    });
    // promessa que falhou sem catch — é o caso dos handlers async
    window.addEventListener('unhandledrejection', e => {
      const m = e.reason && (e.reason.stack || e.reason.message) || e.reason;
      mostrarErroFatal(String(m));
    });
    $('#erro-fatal-fechar').addEventListener('click', () => {
      $('#erro-fatal').hidden = true;
      $('#erro-fatal-txt').textContent = '';
    });
  }

  /* Zerar o celular. Apaga SÓ o que este app guardou neste aparelho: os
     rascunhos, a fila de envio, o nome do técnico, a assinatura
     lembrada e a lista de O.S. em cache. Não toca em nada no servidor:
     relatório já enviado continua enviado. É a saída quando alguma
     coisa trava, e por isso a pergunta conta o que ainda NÃO saiu. */
  async function zerarCelular() {
    const naFila = Fila.lista().length;
    const abertos = S.rascunhos.length;
    const relogios = (Relogio.atual() ? 1 : 0) + Relogio.pausadas().length;
    const toques = Fila.toques().length;
    const perde = [
      abertos && plural(abertos, 'relatório em andamento', 'relatórios em andamento'),
      naFila && plural(naFila, 'relatório assinado que AINDA NÃO SAIU', 'relatórios assinados que AINDA NÃO SAÍRAM'),
      relogios && plural(relogios, 'relógio de O.S. aberto', 'relógios de O.S. abertos'),
      toques && plural(toques, 'registro de horário que ainda não subiu', 'registros de horário que ainda não subiram')
    ].filter(Boolean);
    if (!await perguntar(
      'Apagar o que este app guardou NESTE celular? ' +
      (perde.length ? `Isso apaga ${perde.join(' e ')}. ` : '') +
      'Também somem sua assinatura lembrada e a lista de O.S. guardada. ' +
      'Nada do que já foi enviado se perde.', 'Zerar este celular')) return;
    await Armazem.zerar();
    location.reload();
  }

  /* ── Pergunta de sim ou não ───────────────────────────────────────
     NUNCA use confirm() aqui. O Apps Script serve esta página dentro de
     um iframe de outra origem, e o Chrome bloqueia confirm() nesse caso
     desde a versão 92: ele devolve false na hora, sem mostrar nada e
     sem erro no console. Todo "if (!confirm(...)) return;" virava botão
     morto — clicava e não acontecia nada. Esta pergunta é desenhada na
     própria página, então funciona igual no Live Server e no Apps
     Script. Devolve uma promessa: quem chama usa await. */
  let responderPergunta = null;

  function perguntar(texto, textoSim) {
    const caixa = $('#pergunta'), sim = $('#pergunta-sim');
    $('#pergunta-txt').textContent = texto;
    sim.textContent = textoSim || 'Confirmar';
    caixa.hidden = false;
    document.body.classList.add('sem-rolagem');
    sim.focus();
    return new Promise(ok => { responderPergunta = ok; });
  }

  function fecharPergunta(resposta) {
    if (!responderPergunta) return;
    const responder = responderPergunta;
    responderPergunta = null;
    $('#pergunta').hidden = true;
    document.body.classList.remove('sem-rolagem');
    responder(resposta);
  }

  function prepararPergunta() {
    $('#pergunta-sim').addEventListener('click', () => fecharPergunta(true));
    $('#pergunta-nao').addEventListener('click', () => fecharPergunta(false));
    // clicar fora e Esc são "não"; nunca "sim", porque todas estas
    // perguntas são sobre apagar alguma coisa
    $('#pergunta').addEventListener('click', e => {
      if (e.target === $('#pergunta')) fecharPergunta(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (responderPergunta) fecharPergunta(false);
      else if (responderCaixa) fecharCaixa(null);
    });
  }

  /* ── Caixa com formulário ─────────────────────────────────────────
     Irmã da pergunta, para o que precisa de campo: motivo da pausa,
     correção de horário, iniciar a O.S. Quem abre monta o conteúdo e
     liga os botões; a caixa devolve uma promessa com o que o botão
     mandou (null = fechou sem salvar). O conteúdo é sempre um elemento
     novo, para os eventos de uma caixa não sobrarem na seguinte. */
  let responderCaixa = null;

  function abrirCaixa(html, montar) {
    if (responderCaixa) fecharCaixa(null);
    const corpo = document.createElement('div');
    corpo.innerHTML = html;
    $('#caixa-cartao').replaceChildren(corpo);
    $('#caixa').hidden = false;
    document.body.classList.add('sem-rolagem');
    return new Promise(ok => {
      responderCaixa = ok;
      if (montar) montar(corpo);
    });
  }

  function fecharCaixa(valor) {
    if (!responderCaixa) return;
    const responder = responderCaixa;
    responderCaixa = null;
    $('#caixa').hidden = true;
    if ($('#pergunta').hidden && !paisagem) document.body.classList.remove('sem-rolagem');
    responder(valor);
  }

  function erroCaixa(msg) {
    const el = $('#caixa-cartao .erro');
    if (!el) { toast(msg); return; }
    el.textContent = msg;
    el.hidden = false;
  }

  function prepararCaixa() {
    $('#caixa').addEventListener('click', e => {
      if (e.target === $('#caixa') || e.target.closest('[data-fechar]')) fecharCaixa(null);
    });
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  const msgErro = e => String((e && e.message) || e).replace(/^(Exception|Error):\s*/i, '');

  // ── Estado ─────────────────────────────────────────────────────
  // Tudo começa vazio e é preenchido do aparelho em iniciar().
  const S = {
    inicio: { tecnicos: [], voce: null, ordens: [], avisoOrdens: '' },
    rascunhos: [],             // todos os relatórios em andamento neste celular
    r: null,                   // o que está aberto agora (um dos rascunhos)
    tecnicoEscolhido: '',      // nome escolhido, quando o e-mail não identifica
    codigo: '',                // código do técnico (app instalado: Servidor.pedeCodigo)
    assinaturaLembrada: null,  // traços da assinatura do técnico, se ele pediu
    inicioFalhou: false,       // a lista de O.S. não veio: tenta de novo quando o app volta
    tela: 'inicio'
  };

  // O id nasce aqui, no celular: se o envio for repetido depois de uma
  // queda de sinal, o servidor reconhece o id e não manda e-mail duplicado.
  function novoId() {
    const d = new Date();
    return `AT-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
           `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  const maqVazia = (base = {}) => ({ modelo: base.modelo || '', serie: base.serie || '', frota: '', horimetro: '', descricao: '' });

  // dataFim só existe quando o atendimento passou de um dia (14 a 15/09).
  // Em branco — o normal — o relatório fala de um dia só.
  function novoRascunho(o = {}) {
    return {
      id: novoId(),
      os: o.os || '', cliente: o.cliente || '', data: hojeIso(), dataFim: '',
      servico: o.descricao || '',   // o que a O.S. pediu
      descricaoGeral: '',           // o que foi feito, valendo para o atendimento todo
      // o que a O.S. dizia (só o que veio preenchido vira campo travado, com lápis) e as correções feitas
      origem: { cliente: o.cliente || '', servico: o.descricao || '' }, corr: {},
      maquinas: [Object.assign(maqVazia({ modelo: o.modelo, serie: o.serie }), { orig: { modelo: o.modelo || '', serie: o.serie || '' } })],
      responsavel: { nome: '', documento: '', email: '' },
      assinaturas: { tecnico: null, cliente: null },   // traços, não imagem: redesenha em qualquer tamanho
      relogio: o.relogio || '',     // o relógio da O.S. (relogio.js), quando o relatório nasceu dele
      etapa: 'preencher',
      criadoEm: Date.now(), atualizadoEm: Date.now()
    };
  }

  /* Grava 250 ms depois do último toque. Quem foi mexido fica marcado
     e é gravado mesmo que, nesse meio-tempo, o técnico tenha trocado de
     relatório. Descartar tira a marca ANTES de apagar, senão a gravação
     atrasada traria o rascunho de volta. */
  const sujos = new Set();
  let salvarTimer = 0;
  function salvar() {
    if (!S.r) return;
    S.r.atualizadoEm = Date.now();
    sujos.add(S.r);
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(gravarSujos, 250);
  }

  function gravarSujos() {
    clearTimeout(salvarTimer);
    const lista = Array.from(sujos);
    sujos.clear();
    return Promise.all(lista.map(r => Armazem.rascunhos.gravar(r)
      .catch(e => mostrarErroFatal('Não consegui guardar o rascunho neste celular: ' + msgErro(e)))));
  }

  async function tirarRascunho(r) {
    sujos.delete(r);
    S.rascunhos = S.rascunhos.filter(x => x !== r);
    if (S.r === r) S.r = null;
    await Armazem.rascunhos.apagar(r.id);
  }

  const lerCaminho = (obj, cam) => cam.split('.').reduce((o, k) => (o ? o[k] : ''), obj);
  function gravarCaminho(obj, cam, v) {
    const ks = cam.split('.'); const ult = ks.pop();
    ks.reduce((o, k) => (o[k] = o[k] || {}), obj)[ult] = v;
  }

  // ── Técnico ────────────────────────────────────────────────────
  function tecnicoAtual() {
    if (S.inicio.voce) return S.inicio.voce;
    return S.inicio.tecnicos.find(t => t.nome === S.tecnicoEscolhido) || null;
  }

  function renderEu() {
    const eu = $('#eu');
    if (S.inicio.voce) {
      eu.innerHTML = `<div><div class="eu__rotulo">Técnico</div><div class="eu__nome">${esc(S.inicio.voce.nome)}</div></div>` +
        (Servidor.pedeCodigo ? '<button type="button" class="btn btn--mini" id="btn-trocar-tec">Trocar</button>' : '');
      if (Servidor.pedeCodigo) $('#btn-trocar-tec').addEventListener('click', trocarTecnico);
      return;
    }
    if (Servidor.pedeCodigo) { renderCodigo(); return; }
    const atual = tecnicoAtual();
    const fora = S.inicio.emailDesconhecido;
    eu.innerHTML = `<div><label class="eu__rotulo" for="sel-tec">Técnico</label>
      <select class="campo" id="sel-tec">
        <option value="">Escolha seu nome…</option>
        ${S.inicio.tecnicos.map(t => `<option${atual && atual.nome === t.nome ? ' selected' : ''}>${esc(t.nome)}</option>`).join('')}
      </select>
      ${fora ? `<p class="aviso eu__aviso">Seu e-mail <b>${esc(fora)}</b> não está na aba Tecnicos da planilha.
        Peça para incluírem — sem isso o relatório não fecha.</p>` : ''}</div>`;
    $('#sel-tec').addEventListener('change', e => {
      S.tecnicoEscolhido = e.target.value;
      Armazem.pref.gravar('tecnico', e.target.value);
      e.target.classList.remove('falta');
    });
  }

  /* App instalado: fora do Google o servidor não sabe quem está do
     outro lado, então o técnico digita o código dele (aba Tecnicos)
     uma vez, e o celular lembra. Código errado não abre a lista de O.S. */
  function renderCodigo() {
    $('#eu').innerHTML = `<form class="eu__codigo" id="form-codigo">
        <label class="eu__rotulo" for="f-codigo">Seu código de técnico</label>
        <div class="eu__linha">
          <input class="campo" id="f-codigo" value="${esc(S.codigo)}" placeholder="Ex.: BR-K7Q2XM"
                 autocomplete="off" autocapitalize="characters" spellcheck="false">
          <button type="submit" class="btn btn--primario">Entrar</button>
        </div>
        <p class="vazio">Quem passa o código é o seu supervisor.</p>
      </form>`;
    $('#form-codigo').addEventListener('submit', async e => {
      e.preventDefault();
      const c = $('#f-codigo').value.trim();
      if (!c) { $('#f-codigo').classList.add('falta'); $('#f-codigo').focus(); return; }
      S.codigo = c;
      await Armazem.pref.gravar('codigo', c);
      carregarInicio();
    });
  }

  /* Outro técnico vai usar este celular. Os rascunhos e a fila ficam:
     cada relatório na fila já leva o código de quem o fechou. */
  async function trocarTecnico() {
    if (!await perguntar('Sair deste celular como ' + S.inicio.voce.nome + '? Os relatórios em andamento e ' +
                         'os da fila de envio continuam aqui.', 'Trocar técnico')) return;
    S.codigo = '';
    S.inicio = { tecnicos: [], voce: null, ordens: [], avisoOrdens: '' };
    await Promise.all([Armazem.pref.apagar('codigo'), Armazem.pref.apagar('inicio')]);
    renderInicio();
    $('#f-codigo').focus();
  }

  function exigirTecnico() {
    if (tecnicoAtual()) return true;
    if (Servidor.pedeCodigo) {
      toast('Digite o seu código de técnico primeiro.');
      const campo = $('#f-codigo');
      if (campo) { campo.classList.add('falta'); campo.focus(); }
      return false;
    }
    const sel = $('#sel-tec');
    toast(S.inicio.tecnicos.length ? 'Escolha seu nome primeiro.' : 'A lista de técnicos ainda não carregou.');
    if (sel) { sel.classList.add('falta'); sel.focus(); }
    return false;
  }

  // ── Tela 1: fila, em andamento e escolher a O.S. ───────────────
  function renderInicio() {
    renderEu();
    renderRelogio();
    renderFila();
    renderAndamento();
    renderOrdens();
    renderEnviados();
  }

  /* Fila de envio: relatórios fechados e assinados que ainda não
     chegaram ao servidor. Fica no topo porque é o que não pode se
     perder: enquanto houver item aqui, o cliente não recebeu o PDF. */
  function renderFila() {
    const itens = Fila.lista();
    $('#fila').hidden = !itens.length;
    if (!itens.length) return;
    $('#fila-txt').textContent = navigator.onLine === false
      ? 'Sem sinal. Saem sozinhos quando a conexão voltar, com o app aberto; se fechar, saem na próxima vez que abrir.'
      : 'Saem sozinhos assim que o servidor responder.';
    $('#lista-fila').innerHTML = itens.map(i => {
      const estado = i.enviando ? 'Enviando…'
        : i.ultimoErro ? `Não foi: ${i.ultimoErro} Tenta de novo ${quando(i.proximaEm)}.`
        : 'Esperando para enviar.';
      return `<div class="ordem ordem--fila">
        <span class="ordem__cab"><span class="ordem__os">${esc(i.envio.os)}</span><span class="ordem__data">fechado ${esc(quando(i.criadoEm))}</span></span>
        <span class="ordem__cliente">${esc(i.envio.cliente || '—')}</span>
        <span class="ordem__selo">${esc(estado)}</span>
      </div>`;
    }).join('');
  }

  // Cada O.S. com o seu rascunho; o mexido por último primeiro.
  function renderAndamento() {
    const lista = S.rascunhos.slice().sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
    $('#andamento').hidden = !lista.length;
    $('#lista-andamento').innerHTML = lista.map(r => {
      const etapa = r.etapa !== 'revisar' ? 'preenchendo'
        : r.assinaturas.cliente ? 'cliente já assinou' : 'na revisão';
      const rel = relogioDoRascunho(r);
      const horas = rel ? ` · ${duracao(rel.minutos)} de serviço` : '';
      return `<div class="rascunho">
        <button type="button" class="ordem rascunho__abrir" data-abrir="${esc(r.id)}">
          <span class="ordem__cab"><span class="ordem__os">${esc(r.os || 'sem O.S.')}</span><span class="ordem__data">${esc(quando(r.atualizadoEm))}</span></span>
          <span class="ordem__cliente">${esc(r.cliente || '—')}</span>
          <span class="ordem__extra">${plural(r.maquinas.length, 'máquina', 'máquinas')} · ${etapa}${esc(horas)}</span>
        </button>
        <button type="button" class="btn btn--mini rascunho__descartar" data-descartar="${esc(r.id)}"
          aria-label="Descartar o relatório da O.S. ${esc(r.os || 'sem número')}">Descartar</button>
      </div>`;
    }).join('');
  }

  // Os últimos que chegaram ao servidor, para o técnico conferir.
  function renderEnviados() {
    const lista = Fila.enviados().slice(0, MAX_ENVIADOS);
    $('#enviados').hidden = !lista.length;
    $('#lista-enviados').innerHTML = lista.map(e => `<li class="enviado">
        <span class="enviado__txt"><b>${esc(e.os)}</b> · ${esc(e.cliente || '—')} · ${esc(quando(e.em))}</span>
        ${e.pdf ? `<a class="enviado__pdf" href="${esc(e.pdf)}" target="_blank" rel="noopener">PDF</a>` : ''}
      </li>`).join('');
  }

  function abrirRascunho(r) {
    S.r = r;
    ir(r.etapa === 'revisar' ? 'revisar' : 'preencher');
  }

  async function descartar(id) {
    const r = S.rascunhos.find(x => x.id === id);
    if (!r) return;
    const rel = relogioDoRascunho(r);
    if (!await perguntar(`Descartar o relatório da O.S. ${r.os || 'sem número'}? ` +
                         'O que foi digitado e assinado será apagado.' +
                         (rel ? ' Os horários marcados no relógio continuam na planilha.' : ''), 'Descartar')) return;
    await tirarRascunho(r);
    if (rel && rel.estado === 'finalizado') await Relogio.arquivar(rel.id);
    renderAndamento();
    renderOrdens();
  }

  /* A lista mostra só o que está PENDENTE: O.S. com a coluna
     "Assistencia" preenchida na planilha já foi encerrada pelo
     supervisor e sai da frente. Ela não some de vez, porém — quem
     precisa lançar um segundo atendimento acha digitando o número da
     O.S. na busca. Por número e só por número: buscar pelo cliente
     traria de volta o histórico inteiro dele. */
  function renderOrdens() {
    const termo = semAcento($('#busca').value.trim());
    const todas = S.inicio.ordens || [];
    const pendentes = todas.filter(o => !o.feito);
    const achadas = termo
      ? todas.filter(o => o.feito
          ? semAcento(o.os).includes(termo)
          : semAcento([o.os, o.cliente, o.serie, o.modelo, o.descricao].join(' ')).includes(termo))
      : pendentes;

    const caixa = $('#ordens');
    if (!todas.length) {
      caixa.innerHTML = Servidor.pedeCodigo && !S.inicio.voce
        ? '<p class="vazio">Entre com o seu código de técnico para ver as O.S.</p>'
        : document.body.classList.contains('carregando')
        ? '<p class="vazio">Carregando as O.S.…</p>'
        : '<p class="vazio">Nenhuma O.S. na lista. Use o botão abaixo para digitar.</p>';
      return;
    }
    if (!achadas.length) {
      caixa.innerHTML = termo
        ? '<p class="vazio">Nada encontrado com esse termo. Se a O.S. já foi encerrada, digite o número dela.</p>'
        : '<p class="vazio">Nenhuma O.S. em aberto. Para um segundo atendimento, digite o número da O.S. na busca.</p>';
      return;
    }

    // fechadas por último: quem está com uma O.S. em aberto vê a dela primeiro
    const ordenadas = achadas.slice().sort((a, b) => (a.feito ? 1 : 0) - (b.feito ? 1 : 0));

    caixa.innerHTML = ordenadas.slice(0, MAX_NA_LISTA).map(o => {
      const extra = [o.modelo, o.serie ? 'S/N ' + o.serie : '', o.descricao].filter(Boolean).join(' · ');
      const rel = Relogio.daOs(o.os);
      const selo = rel ? SELO_RELOGIO[rel.estado] || ''
        : rascunhoDa(o.os) ? 'Em andamento neste celular · toque para continuar'
        : o.feito ? 'Já encerrada · novo relatório sai como v2' : '';
      return `<button type="button" class="ordem${o.feito ? ' ordem--feita' : ''}" data-i="${todas.indexOf(o)}">
        <span class="ordem__cab"><span class="ordem__os">${esc(o.os)}</span><span class="ordem__data">${esc(br(o.data))}</span></span>
        <span class="ordem__cliente">${esc(o.cliente || '—')}</span>
        ${extra ? `<span class="ordem__extra">${esc(extra)}</span>` : ''}
        ${selo ? `<span class="ordem__selo">${selo}</span>` : ''}
      </button>`;
    }).join('') + (ordenadas.length > MAX_NA_LISTA
      ? `<p class="vazio">Mostrando ${MAX_NA_LISTA} de ${ordenadas.length}. Digite para filtrar.</p>` : '');
  }

  const rascunhoDa = os => (os ? S.rascunhos.find(r => r.os.trim() === os) : null);

  /* Tocar numa O.S.:
       • com relógio pausado, retoma; correndo, avisa; serviço
         finalizado, abre o relatório;
       • com relatório aberto no celular (sem relógio), continua nele:
         dois rascunhos da mesma O.S. só confundem;
       • senão, pergunta se é para iniciar o serviço agora (ou só o
         relatório).

     O relatório começa do zero, sempre: da O.S. vêm só cliente, modelo
     e série (o que a planilha sabe da máquina), nunca nada do relatório
     anterior. O segundo atendimento é um relatório novo, não uma
     correção do primeiro — o servidor é que numera o v2. */
  async function comecar(ordem) {
    const rel = ordem.os ? Relogio.daOs(ordem.os) : null;
    if (rel) {
      if (rel.estado === 'pausada') {
        if (await perguntar(`Retomar o serviço da O.S. ${ordem.os}?`, 'Retomar')) await acaoRelogio('retomar', rel.id);
      } else if (rel.estado === 'finalizado') {
        abrirRelatorioDo(rel.id);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast('Esta O.S. já está em serviço.');
      }
      return;
    }
    const aberto = rascunhoDa(ordem.os);
    if (aberto) { abrirRascunho(aberto); return; }
    if (!exigirTecnico()) return;
    if (ordem.feito &&
        !await perguntar(`A O.S. ${ordem.os} já foi encerrada. Começar um novo atendimento para ela? ` +
                 'O relatório sai como v2, em branco, sem nada do atendimento anterior.', 'Começar')) return;
    await perguntarInicio(ordem);
  }

  function novoRelatorio(ordem) {
    S.r = novoRascunho(ordem);
    S.rascunhos.push(S.r);
    salvar();
    ir('preencher');
    if (!ordem.os) setTimeout(() => $('#f-os').focus(), 50);
  }

  /* Iniciar o serviço agora? Vale para a O.S. da lista e para a
     digitada ("Digitar a O.S.", que pede o número aqui mesmo). */
  async function perguntarInicio(ordem) {
    const digitar = !ordem.os;
    const atual = Relogio.atual();
    const escolha = await abrirCaixa(`
      <p class="modal__txt">${digitar ? '<b>Digitar a O.S.</b>'
        : `<b>O.S. ${esc(ordem.os)}</b><br>${esc(ordem.cliente || '')}`}</p>
      ${digitar ? `<div class="cp"><label for="cx-os">Número da O.S.</label>
        <input class="campo" id="cx-os" autocomplete="off"></div>` : ''}
      <p class="modal__txt">Iniciar o serviço agora, às ${hhmm(Date.now())}?
        ${atual ? `<br><span class="caixa__nota">A O.S. ${esc(atual.os)}, que está ${atual.estado === 'almoco' ? 'no almoço' : 'em serviço'}, vai ser pausada.</span>` : ''}</p>
      <p class="erro" hidden></p>
      <div class="modal__acoes">
        <button type="button" class="btn btn--fantasma" data-fechar>Cancelar</button>
        <button type="button" class="btn btn--fantasma" data-escolha="relatorio">Só o relatório</button>
        <button type="button" class="btn btn--acento" data-escolha="iniciar">Iniciar serviço</button>
      </div>`, corpo => {
      corpo.addEventListener('click', e => {
        const b = e.target.closest('[data-escolha]');
        if (!b) return;
        const os = digitar ? corpo.querySelector('#cx-os').value.trim() : ordem.os;
        if (!os && b.dataset.escolha === 'iniciar') { erroCaixa('Digite o número da O.S.'); return; }
        fecharCaixa({ acao: b.dataset.escolha, os });
      });
      if (digitar) setTimeout(() => corpo.querySelector('#cx-os').focus(), 50);
    });
    if (!escolha) return;

    let dados = ordem;
    if (digitar && escolha.os) {
      // digitou uma O.S. que já está na lista ou no celular: segue o caminho dela
      dados = S.inicio.ordens.find(o => o.os === escolha.os) || { os: escolha.os };
      const ja = Relogio.daOs(dados.os) || rascunhoDa(dados.os);
      if (ja) { comecar(dados); return; }
    }
    if (escolha.acao === 'relatorio') { novoRelatorio(dados); return; }
    await acaoRelogio('iniciar', '', dados);
  }

  // ── Relógio da O.S. (relogio.js) ───────────────────────────────
  const MOTIVOS_PAUSA = ['Aguardando peça', 'Aguardando cliente', 'Fim do expediente'];
  const ESTADOS = { servico: 'Em serviço', almoco: 'No almoço', pausada: 'Pausada',
                    finalizado: 'Serviço finalizado', cancelado: 'Cancelado' };
  const SELO_RELOGIO = {
    servico: 'Em serviço agora', almoco: 'No almoço', pausada: 'Pausada · toque para retomar',
    finalizado: 'Serviço finalizado · toque para o relatório'
  };
  const correndo = rel => rel && (rel.estado === 'servico' || rel.estado === 'almoco');

  const hhmm = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  // 227 → "3h47"; 45 → "45 min"
  const duracao = min => (min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${pad(min % 60)}`);
  // ms ↔ valor do <input type="datetime-local"> (hora local do celular)
  const paraCampo = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hhmm(ms)}`; };
  const doCampo = v => { const ms = v ? new Date(v).getTime() : NaN; return isNaN(ms) ? 0 : ms; };

  // O relógio do relatório: o de onde ele nasceu, ou o da O.S. dele
  const relogioDoRascunho = r => (r.relogio && Relogio.resumo(r.relogio)) || Relogio.daOs((r.os || '').trim());

  /* Cartão do topo: a O.S. em serviço agora, com os botões grandes. As
     pausadas ficam logo abaixo, cada uma com os seus botões. */
  function renderRelogio() {
    const a = Relogio.atual();
    const cartao = $('#relogio');
    cartao.hidden = !a;
    if (a) {
      const id = esc(a.id);
      cartao.className = 'cartao relogio' + (a.esquecido ? ' relogio--esquecido' : a.estado === 'almoco' ? ' relogio--almoco' : '');
      cartao.innerHTML = `
        <div class="relogio__cab">
          <span class="relogio__estado">${ESTADOS[a.estado]}</span>
          <span class="relogio__total" aria-label="tempo em serviço">${duracao(a.minutos)}</span>
        </div>
        <div class="relogio__os">O.S. ${esc(a.os)}</div>
        <div class="relogio__cliente">${esc(a.cliente || '—')}</div>
        <div class="relogio__desde">${a.estado === 'almoco' ? 'no almoço desde' : 'desde'} ${esc(quando(a.desde))}</div>
        ${a.esquecido ? `<div class="erro relogio__alerta"><span>Correndo há ${duracao(Math.round((Date.now() - a.desde) / 60000))} direto. Esqueceu de pausar?</span>
          <button type="button" class="btn btn--mini" data-rel="esquecido" data-id="${id}">Corrigir</button></div>` : ''}
        <div class="relogio__btns">
          ${a.estado === 'almoco'
            ? `<button type="button" class="btn btn--primario" data-rel="volta" data-id="${id}">Voltar do almoço</button>`
            : `<button type="button" class="btn btn--fantasma" data-rel="almoco" data-id="${id}">Almoço</button>`}
          <button type="button" class="btn btn--fantasma" data-rel="pausar" data-id="${id}">Pausar</button>
        </div>
        <button type="button" class="btn btn--acento btn--largo" data-rel="finalizar" data-id="${id}">Finalizar serviço</button>
        <div class="relogio__links">
          <button type="button" class="ligacao" data-rel="relatorio" data-id="${id}">Preencher relatório ›</button>
          <button type="button" class="ligacao" data-rel="ajustar" data-id="${id}">Ajustar horários ›</button>
        </div>
        ${Relogio.tambemAtivos().map(o => `<div class="relogio__outro">
          <span>Também em serviço (começou em outro aparelho): <b>O.S. ${esc(o.os)}</b>, desde ${esc(quando(o.desde))}</span>
          <span class="pausada__btns">
            <button type="button" class="btn btn--mini" data-rel="pausar" data-id="${esc(o.id)}">Pausar</button>
            <button type="button" class="btn btn--mini" data-rel="finalizar" data-id="${esc(o.id)}">Finalizar</button>
            <button type="button" class="btn btn--mini" data-rel="ajustar" data-id="${esc(o.id)}">Horários</button>
          </span></div>`).join('')}`;
    }

    const pausadas = Relogio.pausadas();
    $('#pausadas').hidden = !pausadas.length;
    $('#lista-pausadas').innerHTML = pausadas.map(p => {
      const id = esc(p.id);
      return `<div class="ordem ordem--pausada">
        <span class="ordem__cab"><span class="ordem__os">${esc(p.os)}</span><span class="ordem__data">desde ${esc(quando(p.desde))}</span></span>
        <span class="ordem__cliente">${esc(p.cliente || '—')}</span>
        <span class="ordem__extra">${esc(p.motivo || 'Pausada')} · ${duracao(p.minutos)} em serviço</span>
        <span class="pausada__btns">
          <button type="button" class="btn btn--mini btn--forte" data-rel="retomar" data-id="${id}">Retomar</button>
          <button type="button" class="btn btn--mini" data-rel="finalizar" data-id="${id}">Finalizar</button>
          <button type="button" class="btn btn--mini" data-rel="relatorio" data-id="${id}">Relatório</button>
          <button type="button" class="btn btn--mini" data-rel="ajustar" data-id="${id}">Horários</button>
        </span>
      </div>`;
    }).join('');
    renderToquesFila();
  }

  // Toques do relógio que ainda não chegaram à planilha
  function renderToquesFila() {
    const n = Fila.toques().length;
    const el = $('#toques-fila');
    el.hidden = !n;
    el.textContent = !n ? '' : plural(n, 'registro de horário esperando', 'registros de horário esperando') +
      ' para subir para a planilha.' + (navigator.onLine === false ? ' Sem sinal: sobem quando a conexão voltar.' : '');
  }

  // Faixa fina no relatório: o estado do relógio desta O.S.
  function renderFaixa() {
    const r = S.r;
    const rel = r && relogioDoRascunho(r);
    $$('.faixa-relogio').forEach(el => {
      el.classList.toggle('faixa-relogio--sem', !rel);
      el.textContent = !r ? ''
        : !rel ? 'Sem horário marcado: na hora de enviar, informe o início e o fim do serviço.'
        : `${ESTADOS[rel.estado]}${correndo(rel) ? ' desde ' + quando(rel.desde) : ''} · ${duracao(rel.minutos)} em serviço`;
    });
  }

  // Um toque de cada vez: dedo nervoso não marca almoço duas vezes.
  let relogioOcupado = false;
  async function acaoRelogio(acao, id, dados) {
    if (relogioOcupado) return;
    relogioOcupado = true;
    try {
      if (acao === 'iniciar') {
        const res = await Relogio.iniciar(dados, (tecnicoAtual() || {}).nome);
        toast(res.pausou ? `Serviço iniciado. A O.S. ${res.pausou} foi pausada.`
                         : `Serviço da O.S. ${dados.os} iniciado às ${hhmm(Date.now())}.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (acao === 'almoco')    { await Relogio.almoco(id); toast('Bom almoço. Na volta, toque em "Voltar do almoço".'); }
      if (acao === 'volta')     await Relogio.voltar(id);
      if (acao === 'pausar')    await pausarRelogio(id);
      if (acao === 'retomar') {
        const res = await Relogio.retomar(id);
        toast(res.pausou ? `Retomado. A O.S. ${res.pausou} foi pausada.` : 'Serviço retomado.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (acao === 'finalizar') await finalizarServico(id);
      if (acao === 'relatorio') abrirRelatorioDo(id);
      if (acao === 'ajustar')   await ajustarHorarios(id);
      if (acao === 'esquecido') await corrigirEsquecido(Relogio.resumo(id));
    } catch (e) {
      toast(msgErro(e));
    } finally {
      relogioOcupado = false;
      if (S.tela === 'inicio') renderInicio();
    }
  }

  async function pausarRelogio(id) {
    const rel = Relogio.resumo(id);
    const motivo = await abrirCaixa(`
      <p class="modal__txt"><b>Pausar a O.S. ${esc(rel.os)}</b><br>Por quê?</p>
      <div class="opcoes">
        ${MOTIVOS_PAUSA.map((m, i) => `<label class="marcar opcao"><input type="radio" name="motivo" value="${esc(m)}"${i ? '' : ' checked'}> ${esc(m)}</label>`).join('')}
        <label class="marcar opcao"><input type="radio" name="motivo" value=""> Outro</label>
        <input class="campo" id="cx-outro" placeholder="Qual?" maxlength="120" autocomplete="off" hidden>
      </div>
      <p class="erro" hidden></p>
      <div class="modal__acoes">
        <button type="button" class="btn btn--fantasma" data-fechar>Cancelar</button>
        <button type="button" class="btn btn--primario" id="cx-ok">Pausar</button>
      </div>`, corpo => {
      const outro = corpo.querySelector('#cx-outro');
      const marcado = () => corpo.querySelector('[name=motivo]:checked').value;
      corpo.addEventListener('change', () => { outro.hidden = !!marcado(); if (!outro.hidden) outro.focus(); });
      corpo.querySelector('#cx-ok').addEventListener('click', () => {
        const v = marcado() || outro.value.trim();
        if (!v) { erroCaixa('Escreva o motivo.'); return; }
        fecharCaixa(v);
      });
    });
    if (motivo) await Relogio.pausar(id, motivo);
  }

  async function finalizarServico(id) {
    const rel = Relogio.resumo(id);
    if (!await perguntar(`Finalizar o serviço da O.S. ${rel.os} agora, às ${hhmm(Date.now())}? ` +
                         'Depois vem o relatório.', 'Finalizar serviço')) return;
    await Relogio.finalizar(id);
    abrirRelatorioDo(id);
  }

  // O relatório da O.S. deste relógio: o que já está aberto no celular, ou um novo
  function abrirRelatorioDo(id) {
    const ordem = Relogio.ordem(id);
    if (!ordem) return;
    const aberto = rascunhoDa(ordem.os);
    if (aberto) {
      aberto.relogio = id;
      abrirRascunho(aberto);
      return;
    }
    novoRelatorio(Object.assign(ordem, { relogio: id }));
  }

  /* Formulário de horário com justificativa: corrigir um toque, incluir
     um esquecido, dizer que horas parou, lançar início e fim. Quem
     chama diz os campos e o que fazer ao salvar; a recusa do relógio
     (hora no futuro, ordem que não fecha, cruzou com outra O.S.)
     aparece na própria caixa, e ela continua aberta. */
  function formHora(o) {
    const tipos = o.tipos || [];
    return abrirCaixa(`
      <p class="modal__txt"><b>${esc(o.titulo)}</b>${o.texto ? '<br>' + esc(o.texto) : ''}</p>
      ${tipos.length ? `<div class="cp"><label for="cx-tipo">O que foi</label>
        <select class="campo" id="cx-tipo">${tipos.map(t => `<option value="${t}">${esc(Relogio.NOMES[t])}</option>`).join('')}</select></div>
        <div class="cp" id="cx-motivo-cp" hidden><label for="cx-motivo">Motivo da pausa</label>
        <select class="campo" id="cx-motivo">${MOTIVOS_PAUSA.concat('Outro').map(m => `<option>${esc(m)}</option>`).join('')}</select></div>` : ''}
      ${(o.escolhas || []).length ? `<div class="opcoes">${o.escolhas.map((e, i) =>
        `<label class="marcar opcao"><input type="radio" name="cx-escolha" value="${e.valor}"${i ? '' : ' checked'}> ${esc(e.rotulo)}</label>`).join('')}</div>` : ''}
      ${o.horas.map((h, i) => `<div class="cp"><label for="cx-hora${i}">${esc(h.rotulo)}</label>
        <input class="campo" id="cx-hora${i}" type="datetime-local" value="${paraCampo(h.hora)}"></div>`).join('')}
      <div class="cp"><label for="cx-just">Justificativa</label>
        <textarea class="campo" id="cx-just" rows="2" maxlength="300" placeholder="Ex.: esqueci de marcar na hora"></textarea></div>
      <p class="erro" hidden></p>
      <div class="modal__acoes">
        <button type="button" class="btn btn--fantasma" data-fechar>${esc(o.textoNao || 'Voltar')}</button>
        <button type="button" class="btn btn--primario" id="cx-ok">${esc(o.textoOk || 'Salvar')}</button>
      </div>`, corpo => {
      const q = sel => corpo.querySelector(sel);
      if (tipos.length) q('#cx-tipo').addEventListener('change', () => { q('#cx-motivo-cp').hidden = q('#cx-tipo').value !== 'pausa'; });
      let salvando = false;
      q('#cx-ok').addEventListener('click', async () => {
        if (salvando) return;
        const horas = o.horas.map((h, i) => doCampo(q('#cx-hora' + i).value));
        if (horas.some(h => !h)) { erroCaixa('Preencha a data e a hora.'); return; }
        const escolha = q('[name=cx-escolha]:checked');
        salvando = true;
        try {
          const res = await o.salvar({
            horas, just: q('#cx-just').value.trim(),
            tipo: tipos.length ? q('#cx-tipo').value : '',
            motivo: tipos.length && q('#cx-tipo').value === 'pausa' ? q('#cx-motivo').value : '',
            escolha: escolha ? escolha.value : ''
          });
          fecharCaixa(res || true);
        } catch (e) {
          erroCaixa(msgErro(e));
        } finally {
          salvando = false;
        }
      });
    });
  }

  /* Ajustar horários: a lista dos toques desta O.S., cada um com o seu
     "Corrigir", e "incluir um esquecido". A correção não apaga o
     original: vira um registro novo, com a justificativa. */
  async function ajustarHorarios(id) {
    for (;;) {
      const rel = Relogio.resumo(id);
      if (!rel) return;
      const escolha = await abrirCaixa(`
        <p class="modal__txt"><b>Horários da O.S. ${esc(rel.os)}</b><br>
          <span class="caixa__nota">${duracao(rel.minutos)} em serviço · ${esc(ESTADOS[rel.estado].toLowerCase())}</span></p>
        <ul class="toques">${rel.toques.map(t => `<li class="toque">
            <span class="toque__hora">${esc(quando(t.hora))}</span>
            <span class="toque__tipo">${esc(Relogio.NOMES[t.tipo])}${t.motivo ? ' · ' + esc(t.motivo) : ''}
              ${t.corrigido || t.justificativa ? '<span class="toque__marca">corrigido</span>' : ''}</span>
            <button type="button" class="btn btn--mini" data-escolha="corrigir:${esc(t.id)}">Corrigir</button>
          </li>`).join('')}</ul>
        <button type="button" class="btn btn--fantasma btn--largo" data-escolha="incluir">+ Incluir um registro esquecido</button>
        <div class="modal__acoes caixa__rodape">
          <button type="button" class="ligacao" data-escolha="cancelar">Iniciei por engano: cancelar</button>
          <button type="button" class="btn btn--primario" data-fechar>Fechar</button>
        </div>`, corpo => corpo.addEventListener('click', e => {
          const b = e.target.closest('[data-escolha]');
          if (b) fecharCaixa(b.dataset.escolha);
        }));
      if (!escolha) return;

      if (escolha === 'cancelar') {
        if (await perguntar(`Cancelar o relógio da O.S. ${rel.os}? Ele sai deste celular; na planilha os ` +
                            'horários ficam, marcados como cancelados.', 'Cancelar o relógio')) {
          await Relogio.cancelar(id);
          toast(`Relógio da O.S. ${rel.os} cancelado.`);
          return;
        }
      } else if (escolha === 'incluir') {
        await formHora({
          titulo: `Incluir um registro na O.S. ${rel.os}`,
          tipos: ['almoco', 'volta', 'pausa', 'retomada', 'fim'],
          horas: [{ rotulo: 'Quando', hora: Date.now() }],
          salvar: d => Relogio.incluir(id, d.tipo, d.horas[0], d.just, d.motivo)
        });
      } else {
        const t = rel.toques.find(x => 'corrigir:' + x.id === escolha);
        if (t) await formHora({
          titulo: `Corrigir: ${Relogio.NOMES[t.tipo]} da O.S. ${rel.os}`,
          texto: `Está marcado ${quando(t.hora)}. Qual é a hora certa?`,
          horas: [{ rotulo: 'Hora certa', hora: t.hora }],
          salvar: d => Relogio.ajustar(id, t.id, d.horas[0], d.just)
        });
      }
    }
  }

  // Relógio correndo há mais de 12 h: que horas ele parou?
  function corrigirEsquecido(rel) {
    if (!rel) return null;
    return formHora({
      titulo: `O.S. ${rel.os}: o relógio está correndo desde ${quando(rel.desde)}`,
      texto: 'Que horas você parou?',
      escolhas: [{ valor: 'pausa', rotulo: 'Pausei: volto a esta O.S. depois' },
                 { valor: 'fim', rotulo: 'Terminei o serviço' }],
      horas: [{ rotulo: 'Parei em', hora: rel.desde }],
      textoNao: 'Depois',
      salvar: d => (d.escolha === 'fim'
        ? Relogio.incluir(rel.id, 'fim', d.horas[0], d.just)
        : Relogio.incluir(rel.id, 'pausa', d.horas[0], d.just, 'Fim do expediente'))
    });
  }

  // Pergunta uma vez por abertura (ou volta do app para a frente);
  // "Depois" deixa o cartão vermelho até ele corrigir.
  const esquecidoVisto = new Set();
  async function conferirEsquecidos() {
    if (responderCaixa || responderPergunta || paisagem || S.tela !== 'inicio') return;
    const e = Relogio.esquecidos().find(x => !esquecidoVisto.has(x.id));
    if (!e) return;
    esquecidoVisto.add(e.id);
    await acaoRelogio('esquecido', e.id);
  }

  // ── Tela 2: preencher ──────────────────────────────────────────
  function preencherCampos() {
    $$('[data-campo]').forEach(el => { el.value = lerCaminho(S.r, el.dataset.campo) || ''; el.classList.remove('falta'); });
    aplicarTravas();
    renderMaquinas();
  }

  /* ── Corrigir dado da O.S. (lápis) ────────────────────────────────
     Cliente, serviço solicitado e modelo/série da máquina vêm da O.S.: ficam
     travados. Se estiver errado, o técnico toca no lápis, escreve o valor certo
     e POR QUE estava errado. O valor corrigido vai para o relatório; o motivo
     vai só para o sistema (coluna "Correções da O.S." da aba Relatorios, que
     a NewSimova lê para avisar o gestor) e NUNCA para o PDF nem para o e-mail.
     Rascunho antigo, O.S. digitada à mão e máquina acrescentada ficam livres. */
  const NOME_CAMPO = { cliente: 'Cliente', servico: 'Serviço solicitado', modelo: 'Modelo', serie: 'Série' };
  const lapis = (k, i) => `<button type="button" class="lapis" data-corrigir="${k}"${i == null ? '' : ` data-maq="${i}"`} ` +
    `aria-label="Corrigir ${NOME_CAMPO[k].toLowerCase()}">✎</button>`;
  const marcaCorrigido = c => (c ? '<span class="corrigido">corrigido</span>' : '');
  const travadoMaq = (m, k) => !!(m.orig && m.orig[k]);

  function aplicarTravas() {
    [['cliente', '#f-cliente'], ['servico', '#f-servico']].forEach(([k, sel]) => {
      const campo = $(sel), rot = campo.closest('.cp').querySelector('label');
      rot.querySelectorAll('.lapis, .corrigido').forEach(n => n.remove());
      const trava = !!(S.r.origem && S.r.origem[k]);
      campo.readOnly = trava;
      campo.classList.toggle('trava', trava);
      if (trava) rot.insertAdjacentHTML('beforeend', ' ' + lapis(k) + marcaCorrigido(S.r.corr && S.r.corr[k]));
    });
  }

  async function corrigirCampo(k, i) {
    const alvo = i == null ? S.r : S.r.maquinas[i];
    if (!alvo) return;
    const origem = i == null ? S.r.origem[k] : alvo.orig[k];
    const atual = alvo[k];
    const nome = NOME_CAMPO[k] + (i == null ? '' : ` (máquina ${i + 1})`);
    const entrada = k === 'servico'
      ? `<textarea class="campo" id="cx-novo" rows="3" maxlength="2000">${esc(atual)}</textarea>`
      : `<input class="campo" id="cx-novo" value="${esc(atual)}" maxlength="120" autocomplete="off">`;
    const res = await abrirCaixa(`
      <p class="modal__txt"><b>Corrigir: ${esc(nome)}</b><br>
        <span class="caixa__nota">O motivo fica só no sistema da Kalmar. O cliente não vê.</span></p>
      <div class="cp"><label>Está assim na O.S.</label><div class="texto">${esc(origem)}</div></div>
      <div class="cp"><label for="cx-novo">Valor correto</label>${entrada}</div>
      <div class="cp"><label for="cx-motivo">Por que está errado?</label>
        <textarea class="campo" id="cx-motivo" rows="2" maxlength="300" placeholder="Ex.: a plaqueta da máquina tem outro número"></textarea></div>
      <p class="erro" hidden></p>
      <div class="modal__acoes">
        <button type="button" class="btn btn--fantasma" data-fechar>Cancelar</button>
        <button type="button" class="btn btn--primario" id="cx-ok">Salvar correção</button>
      </div>`, corpo => {
      corpo.querySelector('#cx-ok').addEventListener('click', () => {
        const novo = corpo.querySelector('#cx-novo').value.trim();
        const motivo = corpo.querySelector('#cx-motivo').value.trim();
        if (!novo) { erroCaixa('Escreva o valor correto.'); return; }
        if (novo !== origem && motivo.length < 5) { erroCaixa('Explique por que está errado (pelo menos 5 letras).'); return; }
        fecharCaixa({ novo, motivo });
      });
      setTimeout(() => corpo.querySelector('#cx-novo').focus(), 50);
    });
    if (!res) return;
    const corr = alvo.corr = alvo.corr || {};
    if (res.novo === origem) delete corr[k];     // voltou ao que a O.S. dizia: não há correção
    else corr[k] = { de: origem, para: res.novo, motivo: res.motivo, em: Date.now() };
    alvo[k] = res.novo;
    salvar();
    preencherCampos();
    toast('Corrigido. O motivo vai só para o sistema.');
  }

  // As correções de verdade (valor final ≠ o da O.S.), para o servidor gravar na planilha.
  function listarCorrecoes(r) {
    const out = [];
    const junta = (alvo, maquina, campos) => campos.forEach(k => {
      const c = alvo.corr && alvo.corr[k];
      if (c && alvo[k] !== c.de) out.push({ campo: k, maquina, de: c.de, para: String(alvo[k]).trim(), motivo: c.motivo });
    });
    junta(r, '', ['cliente', 'servico']);
    r.maquinas.forEach((m, i) => junta(m, i + 1, ['modelo', 'serie']));
    return out;
  }

  function renderMaquinas() {
    const lista = S.r.maquinas;
    $('#maquinas').innerHTML = lista.map((m, i) => `
      <div class="cartao maq" data-maq="${i}">
        <div class="maq__cab">
          <span class="maq__titulo">Máquina ${i + 1}</span>
          ${lista.length > 1 ? `<button type="button" class="btn btn--mini" data-remover="${i}">Remover</button>` : ''}
        </div>
        <div class="cp">
          <label for="m${i}-modelo">Modelo${travadoMaq(m, 'modelo') ? ' ' + lapis('modelo', i) + marcaCorrigido(m.corr && m.corr.modelo) : ''}</label>
          <input class="campo${travadoMaq(m, 'modelo') ? ' trava' : ''}" id="m${i}-modelo" data-k="modelo" value="${esc(m.modelo)}" autocomplete="off"${travadoMaq(m, 'modelo') ? ' readonly' : ''} placeholder="Ex.: Kalmar K2Ti Port">
        </div>
        <div class="grade-3">
          <div class="cp">
            <label for="m${i}-frota">Frota</label>
            <input class="campo" id="m${i}-frota" data-k="frota" value="${esc(m.frota)}" autocomplete="off">
          </div>
          <div class="cp">
            <label for="m${i}-serie">Série${travadoMaq(m, 'serie') ? ' ' + lapis('serie', i) + marcaCorrigido(m.corr && m.corr.serie) : ''}</label>
            <input class="campo${travadoMaq(m, 'serie') ? ' trava' : ''}" id="m${i}-serie" data-k="serie" value="${esc(m.serie)}" autocomplete="off"${travadoMaq(m, 'serie') ? ' readonly' : ''}>
          </div>
          <div class="cp">
            <label for="m${i}-horimetro">Horímetro</label>
            <input class="campo" id="m${i}-horimetro" data-k="horimetro" value="${esc(m.horimetro)}" inputmode="decimal" autocomplete="off">
          </div>
        </div>
        <div class="cp">
          <label for="m${i}-descricao">O que foi feito nesta máquina <span class="opcional">opcional</span></label>
          <textarea class="campo" id="m${i}-descricao" data-k="descricao" rows="4"
            placeholder="Defeito encontrado, o que foi verificado e o que foi feito. Sem nada de especial, deixe em branco — vale a descrição do serviço lá em cima.">${esc(m.descricao)}</textarea>
        </div>
      </div>`).join('');
  }

  // Cada campo que falta ganha contorno e a mensagem diz qual é.
  // Devolve o primeiro, para a tela rolar até ele.
  function validarPreencher() {
    const faltas = [];
    const marcar = (el, msg) => { el.classList.add('falta'); faltas.push({ el, msg }); };

    if (!S.r.os.trim())      marcar($('#f-os'), 'Falta a O.S.');
    if (!S.r.data)           marcar($('#f-data'), 'Falta a data do atendimento.');
    if (S.r.dataFim && S.r.data && S.r.dataFim < S.r.data) {
      marcar($('#f-data-fim'), 'A data final é anterior à do atendimento.');
    }
    if (!S.r.cliente.trim()) marcar($('#f-cliente'), 'Falta o cliente.');
    S.r.maquinas.forEach((m, i) => {
      const n = `Máquina ${i + 1}: `;
      if (!m.serie.trim() && !m.frota.trim()) marcar($(`#m${i}-frota`), n + 'informe a frota ou a série.');
      if (!m.horimetro.trim()) marcar($(`#m${i}-horimetro`), n + 'falta o horímetro.');
    });

    /* O que foi feito é obrigatório UMA vez, não uma por máquina: ou a
       descrição geral do serviço, ou o texto de alguma máquina. Sem
       isso o relatório sairia dizendo só que alguém esteve lá. */
    if (!(S.r.descricaoGeral || '').trim() && !S.r.maquinas.some(m => m.descricao.trim())) {
      marcar($('#f-descricao'), 'Escreva a descrição do serviço, ou o que foi feito em pelo menos uma máquina.');
    }
    return faltas;
  }

  // ── Tela 3: ler e assinar ──────────────────────────────────────
  function renderLeitura() {
    const r = S.r, t = tecnicoAtual() || {};
    $('#leitura').innerHTML = `
      <dl>
        <dt>O.S.</dt><dd>${esc(r.os)}</dd>
        <dt>Cliente</dt><dd>${esc(r.cliente)}</dd>
        <dt>Data</dt><dd>${esc(periodo(r.data, r.dataFim))}</dd>
        <dt>Técnico</dt><dd>${esc(t.nome || '—')}${t.cargo ? ` · ${esc(t.cargo)}` : ''}</dd>
      </dl>
      ${r.servico.trim() ? `<div class="leitura__servico"><span class="leitura__rotulo">Serviço solicitado</span>
        <div class="texto">${esc(r.servico.trim())}</div></div>` : ''}
      ${(r.descricaoGeral || '').trim() ? `<div class="leitura__servico"><span class="leitura__rotulo">Descrição do serviço</span>
        <div class="texto">${esc(r.descricaoGeral.trim())}</div></div>` : ''}
      ${r.maquinas.map((m, i) => {
        const ident = [m.frota && 'Frota ' + m.frota, m.serie && 'S/N ' + m.serie, m.horimetro && 'Horímetro ' + horimetro(m.horimetro)]
          .filter(Boolean).join(' · ');
        return `<div class="leitura__maq">
          <div class="leitura__maq-titulo">${i + 1}. ${esc(m.modelo || 'Equipamento')}</div>
          <div class="leitura__maq-ident">${esc(ident)}</div>
          ${m.descricao.trim() ? `<div class="leitura__maq-desc">${esc(m.descricao.trim())}</div>` : ''}
        </div>`;
      }).join('')}`;
  }

  /* Área de assinatura. Guarda os TRAÇOS (pontos de 0 a 1), não a
     imagem: assim a assinatura sobrevive ao celular girar, redesenha
     no tamanho que for e cabe no rascunho guardado no aparelho. A imagem
     só é gerada na hora de enviar. */
  class Assinatura {
    constructor(caixa, aoMudar) {
      this.caixa = caixa;
      this.canvas = caixa.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.tracos = [];
      this.atual = null;
      this.aoMudar = aoMudar;
      this.quadro = 0;

      const c = this.canvas;
      c.addEventListener('pointerdown', e => {
        if (e.button > 0) return;
        e.preventDefault();
        try { c.setPointerCapture(e.pointerId); } catch (erro) { /* sem captura, o traço só para na borda */ }
        this.atual = [this.ponto(e)];
        this.tracos.push(this.atual);
        this.pedirDesenho();
      });
      c.addEventListener('pointermove', e => {
        if (!this.atual) return;
        e.preventDefault();
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        (evs.length ? evs : [e]).forEach(ev => this.atual.push(this.ponto(ev)));
        this.pedirDesenho();
      });
      const soltar = () => {
        if (!this.atual) return;
        this.atual = null;
        this.estado();
        $('#erro-envio').hidden = true;
        this.aoMudar(this.tracos);
      };
      c.addEventListener('pointerup', soltar);
      c.addEventListener('pointercancel', soltar);

      // A tela começa escondida (largura 0); o observer ajusta quando ela
      // aparece e quando o celular gira.
      new ResizeObserver(() => this.ajustar()).observe(c);
    }

    /* Onde o dedo encostou, de 0 a 1 dentro da caixa.

       No painel deitado a caixa está girada 90° por CSS, e aí o
       retângulo que o navegador informa não serve para nada: ele
       devolve a "sombra" do elemento girado, com largura e altura
       trocadas. Como o giro é sempre 90° e é nosso, desfazemos na mão:
       um ponto que na tela está mais para baixo está, no papel, mais
       para a direita. */
    ponto(e) {
      const palco = this.caixa.closest('.paisagem__palco--girado');
      if (palco) {
        const tela = palco.parentNode.getBoundingClientRect();
        const cx = tela.left + tela.width / 2, cy = tela.top + tela.height / 2;
        const px = (e.clientY - cy) + palco.offsetWidth / 2;    // x no papel
        const py = (cx - e.clientX) + palco.offsetHeight / 2;   // y no papel
        let ox = 0, oy = 0;
        for (let n = this.caixa; n && n !== palco; n = n.offsetParent) { ox += n.offsetLeft; oy += n.offsetTop; }
        return [+((px - ox) / this.caixa.offsetWidth).toFixed(4),
                +((py - oy) / this.caixa.offsetHeight).toFixed(4)];
      }
      const b = this.canvas.getBoundingClientRect();
      return [+((e.clientX - b.left) / b.width).toFixed(4), +((e.clientY - b.top) / b.height).toFixed(4)];
    }

    // offsetWidth em vez do retângulo: é a medida do layout, e o giro
    // do painel deitado não mexe nela.
    ajustar() {
      const w = this.canvas.offsetWidth, h = this.canvas.offsetHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.desenhar();
    }

    pedirDesenho() {
      if (this.quadro) return;
      this.quadro = requestAnimationFrame(() => { this.quadro = 0; this.desenhar(); });
    }

    desenhar(ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, fundo) {
      ctx.clearRect(0, 0, w, h);
      if (fundo) { ctx.fillStyle = fundo; ctx.fillRect(0, 0, w, h); }
      ctx.strokeStyle = ctx.fillStyle = '#2C112D';
      ctx.lineWidth = w / 140;
      ctx.lineCap = ctx.lineJoin = 'round';
      this.tracos.forEach(tr => {
        const p = tr.map(([x, y]) => [x * w, y * h]);
        if (p.length === 1) {
          ctx.beginPath(); ctx.arc(p[0][0], p[0][1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
          return;
        }
        // curva pelos pontos médios: sem isso a assinatura sai "quebrada"
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i < p.length - 1; i++) {
          ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
        }
        ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
        ctx.stroke();
      });
    }

    // Um toque solto não é assinatura
    vazia() { return this.tracos.reduce((n, t) => n + t.length, 0) < 6; }

    estado() {
      this.caixa.classList.toggle('assinada', !this.vazia());
      if (!this.vazia()) this.caixa.classList.remove('falta');
    }

    carregar(tracos) {
      this.tracos = Array.isArray(tracos) ? tracos.map(t => t.slice()) : [];
      this.desenhar();
      this.estado();
    }

    limpar() {
      this.tracos = [];
      this.desenhar();
      this.estado();
      this.aoMudar(null);
    }

    // Fundo branco: o conversor de PDF não garante transparência
    paraPng() {
      const c = document.createElement('canvas');
      c.width = 750; c.height = 300;
      this.desenhar(c.getContext('2d'), c.width, c.height, '#FFFFFF');
      return c.toDataURL('image/png');
    }
  }

  let padTec, padCli;

  /* O rótulo da dobra diz o que tem lá dentro, já que fechada não se vê
     a assinatura. É o único jeito de o técnico conferir sem abrir. */
  function estadoDobraTec() {
    const el = $('#dobra-tecnico-estado');
    const ok = !padTec.vazia();
    el.textContent = ok ? 'assinada ✓' : 'falta assinar';
    el.className = 'dobra__estado ' + (ok ? 'dobra__estado--ok' : 'dobra__estado--falta');
  }

  function lembrarAssinatura(tracos) {
    S.assinaturaLembrada = tracos || null;
    if (tracos) Armazem.pref.gravar('assinatura', tracos);
    else Armazem.pref.apagar('assinatura');
  }

  function prepararAssinaturas() {
    padTec = new Assinatura($('#ass-tecnico'), tracos => {
      S.r.assinaturas.tecnico = tracos;
      salvar();
      estadoDobraTec();
      if ($('#lembrar').checked && tracos) lembrarAssinatura(tracos);
    });
    padCli = new Assinatura($('#ass-cliente'), tracos => {
      S.r.assinaturas.cliente = tracos;
      salvar();
    });
    $('#lembrar').addEventListener('change', e => {
      if (!e.target.checked) lembrarAssinatura(null);
      else if (S.r && S.r.assinaturas.tecnico) lembrarAssinatura(S.r.assinaturas.tecnico);
    });
    $$('[data-limpar]').forEach(b => b.addEventListener('click', () => {
      (b.dataset.limpar === 'tecnico' ? padTec : padCli).limpar();
    }));
    prepararPaisagem();
  }

  /* ── Assinar com o celular deitado ────────────────────────────────
     Em pé sobra pouca largura para uma assinatura, e travar a tela em
     paisagem de verdade só dá no Android — no iPhone o navegador não
     deixa. Então o giro é de mentira: o painel é que vira 90°, e o
     celular continua achando que está em pé.

     A caixa de assinatura é MUDADA DE LUGAR para dentro do painel e
     volta ao fechar. É a mesma caixa, o mesmo pad, os mesmos traços —
     nada é copiado e não há o que sincronizar. Os traços são guardados
     de 0 a 1, então o que foi escrito pequeno reaparece grande, e o
     contrário também. */
  let paisagem = null;

  function medirPalco() {
    const tela = $('#paisagem').getBoundingClientRect();
    const palco = $('#paisagem-palco');
    // girou de verdade (rotação automática ligada)? então não giramos nós
    const girar = tela.height > tela.width;
    palco.classList.toggle('paisagem__palco--girado', girar);
    palco.style.width  = (girar ? tela.height : tela.width) + 'px';
    palco.style.height = (girar ? tela.width : tela.height) + 'px';
    $('#paisagem-titulo').textContent = paisagem.titulo + (girar ? ' · vire o celular para a esquerda' : '');

    // a caixa ocupa o que sobrou, sempre em 5:2 — proporção diferente
    // da de lá de baixo deixaria a assinatura achatada
    const area = $('#paisagem-area'), caixa = paisagem.pad.caixa;
    const larg = Math.min(area.clientWidth, area.clientHeight * 2.5);
    caixa.style.width  = Math.floor(larg) + 'px';
    caixa.style.height = Math.floor(larg / 2.5) + 'px';
  }

  function abrirPaisagem(pad, titulo) {
    if (paisagem) return;
    const caixa = pad.caixa;
    paisagem = { pad, titulo, pai: caixa.parentNode, antes: caixa.nextSibling, historico: false };
    $('#paisagem-area').appendChild(caixa);
    $('#paisagem').hidden = false;
    document.body.classList.add('sem-rolagem');
    medirPalco();
    // o botão Voltar do Android fecha o painel em vez de sair do relatório
    try { history.pushState({ at: 'paisagem' }, ''); paisagem.historico = true; } catch (e) { /* sem histórico, só o Pronto fecha */ }
  }

  function fecharPaisagem() {
    if (!paisagem) return;
    const { pad, pai, antes, historico } = paisagem;
    paisagem = null;
    pad.caixa.style.width = pad.caixa.style.height = '';   // volta ao tamanho do CSS
    pai.insertBefore(pad.caixa, antes);
    $('#paisagem').hidden = true;
    document.body.classList.remove('sem-rolagem');
    if (historico) { try { history.back(); } catch (e) { /* nada a desfazer */ } }
  }

  function prepararPaisagem() {
    $$('[data-deitar]').forEach(b => b.addEventListener('click', () => {
      const tec = b.dataset.deitar === 'tecnico';
      abrirPaisagem(tec ? padTec : padCli, tec ? 'Assinatura do técnico' : 'Assinatura do responsável');
    }));
    $('#paisagem-pronto').addEventListener('click', fecharPaisagem);
    $('#paisagem-limpar').addEventListener('click', () => paisagem && paisagem.pad.limpar());
    window.addEventListener('resize', () => { if (paisagem) medirPalco(); });
    window.addEventListener('popstate', () => {
      if (!paisagem) return;
      paisagem.historico = false;      // o navegador já voltou; não voltar de novo
      fecharPaisagem();
    });
  }

  function abrirRevisao() {
    /* Guardar a assinatura do técnico é opção dele e nasce DESLIGADA: a
       assinatura lembrada vira um carimbo no celular, e isso tem que ser
       escolha consciente. Quem marcou uma vez já recebe a dele pronta. */
    if (!S.r.assinaturas.tecnico && S.assinaturaLembrada) {
      S.r.assinaturas.tecnico = S.assinaturaLembrada;
      salvar();
    }
    $('#lembrar').checked = !!S.assinaturaLembrada;
    renderLeitura();
    $$('#tela-revisar [data-campo]').forEach(el => { el.value = lerCaminho(S.r, el.dataset.campo) || ''; el.classList.remove('falta'); });
    renderEmails();
    padTec.carregar(S.r.assinaturas.tecnico);
    padCli.carregar(S.r.assinaturas.cliente);
    // já assinada, a dobra nasce fechada: o celular vai para a mão do
    // cliente mostrando a parte dele, não a assinatura do técnico.
    estadoDobraTec();
    $('#dobra-tecnico').open = padTec.vazia();
    $('#erro-envio').hidden = true;
  }

  // ── Finalizar ──────────────────────────────────────────────────
  const emailValido = s => s.split(/[,;\s]+/).filter(Boolean).every(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  /* E-mails do cliente: o primeiro é o do responsável; "+ Adicionar outro
     e-mail" põe mais gente para receber o PDF. No rascunho e no envio
     continuam num texto só ("a@x; b@y"), que o servidor já separa. */
  function renderEmails() {
    const lista = (S.r.responsavel.email || '').split(/[,;\s]+/).filter(Boolean);
    $('#f-resp-email').value = lista[0] || '';
    $('#f-resp-email').classList.remove('falta');
    $('#emails-extra').innerHTML = lista.slice(1).map(campoEmailExtra).join('');
  }
  function campoEmailExtra(v) {
    return `<div class="email-extra">
      <input class="campo campo-email" type="email" value="${esc(v || '')}" inputmode="email" autocomplete="off"
             autocapitalize="off" spellcheck="false" aria-label="Outro e-mail para receber o PDF">
      <button type="button" class="btn btn--mini" data-tirar-email>Tirar</button></div>`;
  }
  function juntarEmails() {
    S.r.responsavel.email = $$('#tela-revisar .campo-email').map(el => el.value.trim()).filter(Boolean).join('; ');
    $('#erro-envio').hidden = true;
    salvar();
  }

  async function finalizar() {
    const erro = $('#erro-envio');
    erro.hidden = true;
    const faltas = [];
    const marcar = (el, msg) => { el.classList.add('falta'); faltas.push({ el, msg }); };

    const r = S.r, t = tecnicoAtual();
    if (padTec.vazia()) marcar($('#ass-tecnico'), 'Falta a assinatura do técnico.');
    if (!r.responsavel.nome.trim()) marcar($('#f-resp-nome'), 'Falta o nome do responsável.');
    $$('#tela-revisar .campo-email').forEach(el => {
      if (el.value.trim() && !emailValido(el.value)) marcar(el, 'Tem e-mail do cliente incompleto.');
    });
    if (padCli.vazia()) marcar($('#ass-cliente'), 'Falta a assinatura do responsável do cliente.');
    if (!t) faltas.push({ el: null, msg: 'Volte ao início e identifique-se como técnico.' });

    if (faltas.length) {
      erro.textContent = faltas.map(f => f.msg).join(' ');
      erro.hidden = false;
      const alvo = faltas.find(f => f.el);
      if (alvo) {
        const dobra = alvo.el.closest('details');   // o que falta não pode estar escondido
        if (dobra) dobra.open = true;
        alvo.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (!r.responsavel.email.trim() &&
        !await perguntar('Sem e-mail do cliente, o PDF vai só para você e para a equipe. Enviar assim?',
                         'Enviar assim')) {
      $('#f-resp-email').focus();
      return;
    }

    /* As horas (relogio.js). O tempo do relatório não conta: relógio
       que ainda corre (ou está pausado) termina aqui, com a pergunta.
       Sem relógio nenhum (esqueceu de iniciar, ou foi "só o
       relatório"), ele informa início e fim, com justificativa. */
    let rel = relogioDoRascunho(r);
    try {
      if (rel && rel.estado !== 'finalizado') {
        if (!await perguntar(`O relógio da O.S. ${r.os.trim()} ainda está ${rel.estado === 'pausada' ? 'pausado' : 'correndo'}. ` +
                             `Finalizar o serviço agora, às ${hhmm(Date.now())}, e enviar?`, 'Finalizar e enviar')) return;
        await Relogio.finalizar(rel.id);
        rel = Relogio.resumo(rel.id);
      }
      if (!rel) {
        const m = r.maquinas[0] || {};
        const ordem = { os: r.os.trim(), cliente: r.cliente.trim(), modelo: m.modelo, serie: m.serie, descricao: r.servico };
        let de = new Date(r.data + 'T08:00').getTime();
        if (!(de < Date.now())) de = Date.now() - 3600e3;
        const novo = await formHora({
          titulo: `A O.S. ${ordem.os} não tem horário marcado`,
          texto: 'Informe quando o serviço começou e quando terminou.',
          horas: [{ rotulo: 'Início', hora: de }, { rotulo: 'Fim', hora: Date.now() }],
          textoNao: 'Cancelar', textoOk: 'Salvar e enviar',
          salvar: d => Relogio.lancarPorFora(ordem, t.nome, d.horas[0], d.horas[1], d.just)
        });
        if (!novo) return;
        r.relogio = novo.id;
        rel = Relogio.resumo(novo.id);
      }
    } catch (e) {
      erro.textContent = msgErro(e);
      erro.hidden = false;
      return;
    }

    const envio = {
      id: r.id, os: r.os.trim(), cliente: r.cliente.trim(),
      data: r.data, dataFim: (r.dataFim || '').trim(), servico: r.servico.trim(),
      descricaoGeral: (r.descricaoGeral || '').trim(),
      maquinas: r.maquinas.map(m => ({
        modelo: m.modelo.trim(), serie: m.serie.trim(), frota: m.frota.trim(),
        horimetro: m.horimetro.trim(), descricao: m.descricao.trim()
      })),
      tecnico: { nome: t.nome },
      responsavel: {
        nome: r.responsavel.nome.trim(), documento: r.responsavel.documento.trim(), email: r.responsavel.email.trim()
      },
      assinaturas: { tecnico: padTec.paraPng(), cliente: padCli.paraPng() },
      horas: rel.minutos,     // minutos em serviço, já com as correções
      relogio: rel.id,
      correcoes: listarCorrecoes(r)   // só para o sistema: nunca vai para o PDF nem para o e-mail
    };
    // o código de quem fechou vai junto para a fila: se outro técnico
    // entrar neste celular antes de o sinal voltar, o relatório continua
    // saindo no nome certo
    if (Servidor.pedeCodigo) envio.codigo = S.codigo;

    /* Fechou, está fechado ("como papel"): o relatório vai para a fila
       de envio, gravada no aparelho, e o rascunho sai. Nessa ordem, para
       que o relatório assinado nunca exista só na memória da página.
       Com o rascunho saem os traços da assinatura do cliente; o PNG
       dela fica na fila só até o servidor confirmar (LGPD). */
    const btn = $('#btn-finalizar');
    btn.disabled = true; btn.textContent = 'Enviando…';
    document.body.classList.add('carregando');
    try {
      try {
        await Fila.por(envio);
      } catch (e) {
        erro.textContent = `Não consegui guardar o relatório neste celular: ${msgErro(e)} ` +
                           'Ele continua aqui, aberto; tente de novo.';
        erro.hidden = false;
        erro.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      await tirarRascunho(r);
      // os toques já estão na fila: o relógio terminado sai do celular
      try { await Relogio.arquivar(rel.id); } catch (e) { /* fica na lista; não atrapalha o envio */ }
      const res = await Fila.enviarAgora(envio.id);
      if (res) mostrarEnviado(res); else mostrarNaFila();
    } finally {
      btn.disabled = false; btn.textContent = 'Finalizar e enviar';
      document.body.classList.remove('carregando');
    }
  }

  // ── Tela 4: enviado (ou guardado na fila) ──────────────────────
  function mostrarNaFila() {
    $('#feito-marca').textContent = '↑';
    $('#t-enviado').textContent = 'Relatório fechado, na fila';
    $('#feito-txt').textContent = navigator.onLine === false
      ? 'Sem sinal agora. O relatório e as assinaturas estão guardados na fila deste celular.'
      : 'O servidor não respondeu agora. O relatório e as assinaturas estão guardados na fila deste celular.';
    const aviso = $('#feito-aviso');
    aviso.hidden = false;
    aviso.textContent = 'Ele sai sozinho quando a conexão voltar, com o app aberto. Se fechar o app, ' +
                        'sai na próxima vez que abrir. Acompanhe em "Fila de envio", no início.';
    $('#feito-pdf').hidden = true;
    ir('enviado');
  }

  function mostrarEnviado(res) {
    $('#feito-marca').textContent = '✓';
    $('#t-enviado').textContent = 'Relatório fechado';
    $('#feito-txt').innerHTML = res.repetido
      ? 'Este relatório já tinha sido fechado antes — nada foi enviado de novo.'
      : res.enviadoPara
        ? `O PDF foi enviado para <b>${esc(res.enviadoPara)}</b>.`
        : 'O PDF foi salvo.';
    const aviso = $('#feito-aviso');
    aviso.hidden = !res.erroEmail;
    if (res.erroEmail) aviso.textContent = `${res.erroEmail} Abra o PDF e encaminhe ao cliente.`;
    const link = $('#feito-pdf');
    link.hidden = !res.pdf;
    link.href = res.pdf || '#';
    ir('enviado');
  }

  // ── Navegação ──────────────────────────────────────────────────
  /* ir() é síncrona de propósito: a pergunta de "voltar para editar
     apaga a assinatura do cliente" mora no botão que dispara a volta
     (o handler de [data-ir]), não aqui. Assim ninguém precisa esperar
     uma promessa só para trocar de tela. */
  function ir(tela) {
    S.tela = tela;
    if (tela === 'inicio') S.r = null;     // o rascunho fica guardado na lista de "em andamento"
    if (S.r && (tela === 'preencher' || tela === 'revisar')) { S.r.etapa = tela; salvar(); }
    ['inicio', 'preencher', 'revisar', 'enviado'].forEach(n => { $(`#tela-${n}`).hidden = n !== tela; });

    if (tela === 'inicio')    renderInicio();
    if (tela === 'preencher') preencherCampos();
    if (tela === 'revisar')   abrirRevisao();
    if (tela === 'preencher' || tela === 'revisar') renderFaixa();

    $('#topo-sub').textContent = S.r && tela !== 'inicio'
      ? [S.r.os && 'O.S. ' + S.r.os, S.r.cliente].filter(Boolean).join(' · ') || 'Relatório de atendimento'
      : 'Relatório de atendimento';
    window.scrollTo(0, 0);
  }

  // ── Eventos ────────────────────────────────────────────────────
  function ligarEventos() {
    $('#busca').addEventListener('input', renderOrdens);
    $('#ordens').addEventListener('click', e => {
      const b = e.target.closest('.ordem');
      if (b) comecar(S.inicio.ordens[+b.dataset.i]);
    });
    $('#btn-manual').addEventListener('click', () => comecar({}));
    // botões do relógio (cartão do topo e pausadas), por delegação
    $('#tela-inicio').addEventListener('click', e => {
      const b = e.target.closest('[data-rel]');
      if (b) acaoRelogio(b.dataset.rel, b.dataset.id);
    });
    $('#lista-andamento').addEventListener('click', e => {
      const abrir = e.target.closest('[data-abrir]');
      const desc  = e.target.closest('[data-descartar]');
      if (abrir) { const r = S.rascunhos.find(x => x.id === abrir.dataset.abrir); if (r) abrirRascunho(r); }
      if (desc) descartar(desc.dataset.descartar);
    });
    $('#btn-fila-tentar').addEventListener('click', () => {
      toast(navigator.onLine === false ? 'Sem sinal: tento assim que a conexão voltar.' : 'Tentando enviar…');
      Fila.tentar(true);
    });
    // o que foi digitado vai para o aparelho já, sem esperar os 250 ms,
    // quando o app sai da frente (o celular pode matar a página depois)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') gravarSujos();
    });

    // campos fixos (atendimento e responsável)
    $$('[data-campo]').forEach(el => el.addEventListener('input', () => {
      gravarCaminho(S.r, el.dataset.campo, el.value);
      el.classList.remove('falta');
      $('#erro-envio').hidden = true;     // a lista de faltas ficaria mentindo
      salvar();
    }));

    // e-mails do cliente (os extras são redesenhados, então por delegação)
    $('#tela-revisar').addEventListener('input', e => {
      if (!e.target.classList.contains('campo-email')) return;
      e.target.classList.remove('falta');
      juntarEmails();
    });
    $('#btn-mais-email').addEventListener('click', () => {
      $('#emails-extra').insertAdjacentHTML('beforeend', campoEmailExtra(''));
      $$('#emails-extra .campo-email').pop().focus();
    });
    $('#emails-extra').addEventListener('click', e => {
      const b = e.target.closest('[data-tirar-email]');
      if (!b) return;
      b.closest('.email-extra').remove();
      juntarEmails();
    });

    // lápis: corrigir dado que veio da O.S. (cliente, serviço, modelo e série da máquina)
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-corrigir]');
      if (b && S.r) corrigirCampo(b.dataset.corrigir, b.dataset.maq == null ? null : +b.dataset.maq);
    });

    // campos das máquinas (a lista é redesenhada, então por delegação)
    $('#maquinas').addEventListener('input', e => {
      const el = e.target.closest('[data-k]');
      if (!el) return;
      const i = +el.closest('[data-maq]').dataset.maq;
      S.r.maquinas[i][el.dataset.k] = el.value;
      el.classList.remove('falta');
      if (el.dataset.k === 'serie' || el.dataset.k === 'frota') {
        $(`#m${i}-frota`).classList.remove('falta');
      }
      salvar();
    });
    $('#maquinas').addEventListener('click', async e => {
      const b = e.target.closest('[data-remover]');
      if (!b) return;
      const i = +b.dataset.remover;
      const m = S.r.maquinas[i];
      if ((m.frota || m.serie || m.horimetro || m.descricao) &&
          !await perguntar(`Remover a máquina ${i + 1}?`, 'Remover')) return;
      S.r.maquinas.splice(i, 1);
      salvar();
      renderMaquinas();
    });
    $('#btn-add-maq').addEventListener('click', () => {
      const ult = S.r.maquinas[S.r.maquinas.length - 1];
      S.r.maquinas.push(maqVazia({ modelo: ult && ult.modelo }));   // frota da mesma O.S. costuma ser o mesmo modelo
      salvar();
      renderMaquinas();
      const n = S.r.maquinas.length - 1;
      $(`[data-maq="${n}"]`).scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => $(`#m${n}-frota`).focus({ preventScroll: true }), 300);
    });

    $('#btn-revisar').addEventListener('click', () => {
      const faltas = validarPreencher();
      if (faltas.length) {
        toast(faltas[0].msg + (faltas.length > 1 ? ` (e mais ${faltas.length - 1})` : ''));
        faltas[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      ir('revisar');
    });
    $('#btn-finalizar').addEventListener('click', finalizar);
    $('#btn-novo').addEventListener('click', () => ir('inicio'));
    $('#btn-zerar').addEventListener('click', zerarCelular);
    $$('[data-ir]').forEach(b => b.addEventListener('click', async () => {
      // o cliente assinou o texto que está aí; editar depois disso pede assinatura nova
      if (S.tela === 'revisar' && b.dataset.ir === 'preencher' && S.r && S.r.assinaturas.cliente) {
        if (!await perguntar('Voltar para editar apaga a assinatura do cliente. Continuar?',
                             'Voltar e editar')) return;
        S.r.assinaturas.cliente = null;
      }
      ir(b.dataset.ir);
    }));
  }

  // ── Início ─────────────────────────────────────────────────────
  async function carregarInicio() {
    const aviso = $('#aviso-ordens');
    // app instalado sem código: nem pergunta ao servidor, que recusaria
    if (Servidor.pedeCodigo && !S.codigo) {
      aviso.hidden = true;
      if (S.tela === 'inicio') { renderEu(); renderOrdens(); }
      return;
    }
    const cache = S.inicio.ordens.length || S.inicio.tecnicos.length;   // veio do aparelho em iniciar()
    document.body.classList.add('carregando');
    renderOrdens();
    S.inicioFalhou = false;
    try {
      S.inicio = await Servidor.inicio(S.codigo);
      // Os relógios do técnico (de qualquer aparelho) entram na gaveta do relógio e
      // não no cache da lista de O.S.
      const doServidor = S.inicio.relogios || [];
      delete S.inicio.relogios;
      Armazem.pref.gravar('inicio', S.inicio);
      try { await Relogio.mesclar(doServidor); } catch (e) { mostrarErroFatal('Relógios do servidor: ' + msgErro(e)); }
      aviso.hidden = !S.inicio.avisoOrdens;
      aviso.textContent = S.inicio.avisoOrdens || '';
    } catch (e) {
      aviso.hidden = false;
      if (e.tipo === 'codigo') {
        // código errado (ou apagado da planilha): esquece e pede de novo
        S.codigo = '';
        S.inicio = { tecnicos: [], voce: null, ordens: [], avisoOrdens: '' };
        Armazem.pref.apagar('codigo');
        Armazem.pref.apagar('inicio');
        aviso.textContent = msgErro(e);
      } else {
        aviso.textContent = cache
          ? 'Sem conexão com o servidor: mostrando a lista de O.S. da última vez.'
          : `Não consegui carregar as O.S. (${msgErro(e)}). Dá para digitar a O.S. à mão.`;
      }
      // App instalado sem login Kalmar (ou com a sessão vencida): o
      // login não abre escondido, então vai numa aba. Ao voltar para o
      // app, carregarInicio tenta de novo (ver iniciar).
      if (e.tipo === 'login' && Servidor.urlEntrar) {
        aviso.textContent = msgErro(e) + ' ';
        const a = document.createElement('a');
        a.href = Servidor.urlEntrar;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Entrar com a conta Kalmar';
        aviso.appendChild(a);
      }
      S.inicioFalhou = true;
    } finally {
      document.body.classList.remove('carregando');
      if (S.tela === 'inicio') { renderEu(); renderOrdens(); }
    }
  }

  /* Primeiro o que está no aparelho (rascunhos, fila, técnico, última
     lista de O.S.): abre na hora, com ou sem sinal. Depois a fila
     começa a mandar o que ficou pendente, e a lista de O.S. é buscada
     no servidor. */
  async function iniciar() {
    await Armazem.abrir();
    const [rascunhos, tecnico, assinatura, inicio, codigo] = await Promise.all([
      Armazem.rascunhos.todos(), Armazem.pref.ler('tecnico'),
      Armazem.pref.ler('assinatura'), Armazem.pref.ler('inicio'), Armazem.pref.ler('codigo')
    ]);
    S.rascunhos = rascunhos;
    S.tecnicoEscolhido = tecnico || '';
    S.codigo = codigo || '';
    S.assinaturaLembrada = assinatura || null;
    if (inicio) S.inicio = inicio;
    $('#aviso-memoria').hidden = Armazem.duravel;

    await Fila.iniciar({
      servidor: Servidor,
      aoMudar: () => { if (S.tela === 'inicio') { renderFila(); renderEnviados(); renderToquesFila(); } },
      aoEnviar: feito => toast(`O.S. ${feito.os} enviada${feito.erroEmail ? ', mas o e-mail falhou' : ''}.`)
    });
    await Relogio.iniciarModulo({
      fila: Fila,
      aoMudar: () => { if (S.tela === 'inicio') { renderRelogio(); renderOrdens(); } else renderFaixa(); }
    });
    ir('inicio');
    carregarInicio();
    registrarServiceWorker();
    conferirEsquecidos();

    // o total do relógio anda sozinho na tela
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (S.tela === 'inicio') renderRelogio(); else renderFaixa();
    }, 30 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') esquecidoVisto.clear();
      else { if (S.tela === 'inicio') renderRelogio(); conferirEsquecidos(); }
    });

    // A lista de O.S. não veio (sem sinal, ou foi entrar com a conta
    // Kalmar noutra aba): tenta de novo quando o sinal ou o app voltam.
    const deNovo = () => { if (S.inicioFalhou && !document.body.classList.contains('carregando')) carregarInicio(); };
    window.addEventListener('online', deNovo);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') deNovo(); });
  }

  /* O service worker (sw.js) guarda o app no celular: com ele o app
     instalado abre sem sinal. Na página do Apps Script não existe (ela
     roda num iframe do Google, onde não dá para registrar). */
  function registrarServiceWorker() {
    if (Servidor.modo === 'gas' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').catch(() => { /* sem ele o app funciona, só não abre offline */ });
  }

  /* pegarErros() vem PRIMEIRO: se algo abaixo quebrar, o erro aparece
     na tela em vez de sumir no console. */
  pegarErros();
  $('#carimbo').textContent = 'versão ' + (VERSAO.indexOf('__') === 0 ? 'local (Live Server)' : VERSAO);
  ligarEventos();
  prepararPergunta();
  prepararCaixa();
  prepararAssinaturas();
  iniciar();
})();
// -------- rat.js v7 --------

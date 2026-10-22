// -------- relogio.js v2 --------
/* ═══════════════════════════════════════════════════════════════
   RELÓGIO DA O.S. — as horas de serviço, marcadas no celular

   O técnico toca Iniciar na O.S. e o celular guarda a hora. Durante
   o dia: Almoço / Volta, Pausar (com motivo) / Retomar, e no fim
   Finalizar serviço. O relógio é separado do relatório: iniciar não
   abre relatório nenhum, e o tempo preenchendo e colhendo assinatura
   não conta (o Finalizar serviço vem antes).

   Cada toque vai para a fila de envio na hora em que acontece, e a
   fila manda para a aba Apontamentos da planilha (sem sinal, espera).
   Vale a hora do celular: o servidor só confere se o relógio dele
   estava muito diferente do de lá.

   Regras:
     • uma O.S. com o relógio correndo por vez: iniciar ou retomar
       outra pausa a que estava rodando (motivo "Outra O.S.");
     • qualquer toque pode ser corrigido, e um esquecido incluído
       depois, sempre com justificativa escrita. A correção é um toque
       novo ("ajuste") que aponta para o original: nada se apaga, nem
       aqui nem na planilha;
     • correndo há mais de 12 h direto, o relógio é dado como
       esquecido: a tela pergunta que horas ele parou.

   Guardado no Armazém (gaveta relogios), um registro por relógio:
     { id, os, cliente, ordem, tecnico, toques: [...], criadoEm }
   O estado e o total não são guardados: saem da lista de toques, já
   com as correções aplicadas.
   ═══════════════════════════════════════════════════════════════ */
window.Relogio = (function () {
  'use strict';

  const ESQUECIDO = 12 * 3600 * 1000;
  const FOLGA_FUTURO = 60 * 1000;     // relógio do celular arredonda: 1 min de folga
  const MIN_JUSTIFICATIVA = 10;

  // De qual estado cada toque pode sair, e para onde vai
  const PASSOS = {
    inicio:    { de: [null],                          para: 'servico' },
    almoco:    { de: ['servico'],                     para: 'almoco' },
    volta:     { de: ['almoco'],                      para: 'servico' },
    pausa:     { de: ['servico', 'almoco'],           para: 'pausada' },
    retomada:  { de: ['pausada'],                     para: 'servico' },
    fim:       { de: ['servico', 'almoco', 'pausada'], para: 'finalizado' },
    cancelado: { de: ['servico', 'almoco', 'pausada'], para: 'cancelado' }
  };
  const ATIVO = ['servico', 'almoco'];

  const NOMES = {
    inicio: 'Início', almoco: 'Almoço', volta: 'Volta do almoço', pausa: 'Pausa',
    retomada: 'Retomada', fim: 'Fim do serviço', cancelado: 'Cancelado'
  };

  let relogios = [];
  let fila = null;
  let aoMudar = () => {};

  const pad = n => String(n).padStart(2, '0');
  function novoId(prefixo) {
    const d = new Date();
    return `${prefixo}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
           `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  // ── Leitura: estado e total a partir dos toques ────────────────
  // Os toques "de verdade" (sem os ajustes), cada um com a hora que
  // vale agora: a da última correção, se houver.
  function linhaDoTempo(r) {
    const corrigida = {};
    r.toques.filter(t => t.tipo === 'ajuste').forEach(a => { corrigida[a.corrige] = a.hora; });
    return r.toques.filter(t => t.tipo !== 'ajuste')
      .map(t => Object.assign({}, t, { hora: corrigida[t.id] != null ? corrigida[t.id] : t.hora,
                                        corrigido: corrigida[t.id] != null }))
      .sort((a, b) => a.hora - b.hora || a.criadoEm - b.criadoEm);
  }

  // Repassa os toques na ordem da hora. Devolve o estado, os trechos
  // (de, ate, estado) e o primeiro problema, se a sequência não fecha
  // (ex.: uma correção que pôs a volta do almoço antes do almoço).
  function repassar(lista, agora) {
    let estado = null, desde = 0, erro = '';
    const trechos = [];
    lista.forEach(t => {
      const passo = PASSOS[t.tipo];
      if (!passo) return;
      if (!erro && passo.de.indexOf(estado) < 0) {
        erro = estado === null ? 'O primeiro registro tem de ser o Início.'
             : `${NOMES[t.tipo]} às ${hhmm(t.hora)} não combina: nessa hora o relógio estava ${nomeEstado(estado)}.`;
      }
      if (estado) trechos.push({ de: desde, ate: t.hora, estado });
      estado = passo.para;
      desde = t.hora;
    });
    if (ATIVO.indexOf(estado) >= 0 || estado === 'pausada') trechos.push({ de: desde, ate: agora, estado, aberto: true });
    return { estado, desde, trechos, erro };
  }

  const nomeEstado = e => ({ servico: 'em serviço', almoco: 'no almoço', pausada: 'pausada',
                             finalizado: 'serviço finalizado', cancelado: 'cancelado' }[e] || e);
  const hhmm = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  function resumo(r, agora = Date.now()) {
    const tempo = linhaDoTempo(r);
    const { estado, desde, trechos } = repassar(tempo, agora);
    const servico = trechos.filter(t => t.estado === 'servico').reduce((s, t) => s + (t.ate - t.de), 0);
    const ultimaPausa = tempo.filter(t => t.tipo === 'pausa').pop();
    return {
      id: r.id, os: r.os, cliente: r.cliente, estado, desde,
      minutos: Math.max(0, Math.round(servico / 60000)),
      inicio: tempo.length ? tempo[0].hora : 0,
      motivo: estado === 'pausada' && ultimaPausa ? ultimaPausa.motivo : '',
      esquecido: ATIVO.indexOf(estado) >= 0 && agora - desde > ESQUECIDO,
      toques: tempo
    };
  }

  // ── Gravar ─────────────────────────────────────────────────────
  // O toque vai para o relógio E para a fila. Primeiro grava no
  // aparelho, e só então a memória (e a tela) muda: toque que não
  // gravou não aparece como marcado. Se a fila não gravar, o relógio já
  // gravou: o toque fica no celular e a hora está certa; só a planilha
  // não fica sabendo dele. Por isso a fila vem depois.
  async function registrar(r, dados) {
    const t = Object.assign({ id: novoId('TQ'), criadoEm: Date.now(), motivo: '' }, dados);
    await Armazem.relogios.gravar(Object.assign({}, r, { toques: r.toques.concat(t) }));
    r.toques.push(t);
    if (relogios.indexOf(r) < 0) relogios.push(r);
    await fila.porToque(Object.assign({}, t, { relogio: r.id, os: r.os, cliente: r.cliente, tecnico: { nome: r.tecnico } }));
    aoMudar();
    return t;
  }

  // Em serviço ou no almoço, o mais recente primeiro. Normalmente é um só; dois
  // aparecem quando o técnico começou em dois aparelhos sem sinal (ver mesclar).
  const ativos = () => relogios.filter(r => ATIVO.indexOf(resumo(r).estado) >= 0)
    .sort((a, b) => resumo(b).desde - resumo(a).desde);
  const ativo = () => ativos()[0] || null;

  // Uma O.S. por vez: quem estava rodando pausa, com a mesma hora.
  async function pausarOutra(exceto, hora, os) {
    let primeira = null;
    for (const a of ativos()) {
      if (a === exceto) continue;
      await registrar(a, { tipo: 'pausa', hora, motivo: 'Outra O.S. (' + os + ')' });
      primeira = primeira || a;
    }
    return primeira;
  }

  // O relógio da O.S. que ainda não terminou (em serviço, almoço ou pausada)
  const daOs = os => relogios.find(r => r.os === os && ['finalizado', 'cancelado'].indexOf(resumo(r).estado) < 0) || null;

  // ── O que as telas chamam ──────────────────────────────────────
  async function iniciar(ordem, tecnico) {
    const os = String(ordem.os || '').trim();
    if (!os) throw new Error('Falta o número da O.S.');
    if (!tecnico) throw new Error('Identifique-se como técnico primeiro.');
    const ja = daOs(os);
    if (ja) return retomar(ja.id);
    const agora = Date.now();
    const r = {
      id: novoId('RL'), os, cliente: ordem.cliente || '', tecnico,
      ordem: { os, cliente: ordem.cliente || '', modelo: ordem.modelo || '', serie: ordem.serie || '', descricao: ordem.descricao || '' },
      toques: [], criadoEm: agora
    };
    const pausada = await pausarOutra(r, agora, os);
    await registrar(r, { tipo: 'inicio', hora: agora });
    return { relogio: r, pausou: pausada && pausada.os };
  }

  async function retomar(id) {
    const r = relogios.find(x => x.id === id);
    if (!r) throw new Error('Esse relógio não está mais neste celular.');
    const est = resumo(r).estado;
    if (ATIVO.indexOf(est) >= 0) return { relogio: r, pausou: null };
    if (est !== 'pausada') throw new Error('Esse serviço já terminou.');
    const agora = Date.now();
    const pausada = await pausarOutra(r, agora, r.os);
    await registrar(r, { tipo: 'retomada', hora: agora });
    return { relogio: r, pausou: pausada && pausada.os };
  }

  // Almoço, volta, pausa e fim valem para o relógio que está rodando
  // (ou o indicado). Toque fora de hora (ex.: Volta sem ter saído
  // para o almoço) é recusado com a explicação.
  async function tocar(id, tipo, motivo) {
    const r = relogios.find(x => x.id === id);
    if (!r) throw new Error('Esse relógio não está mais neste celular.');
    const est = resumo(r).estado;
    if (PASSOS[tipo].de.indexOf(est) < 0) throw new Error(`${NOMES[tipo]} não combina com o relógio ${nomeEstado(est)}.`);
    await registrar(r, { tipo, hora: Date.now(), motivo: motivo || '' });
    return r;
  }

  /* Correção de um toque, ou inclusão de um que ele esqueceu. A
     sequência inteira é refeita com a hora nova e tem de continuar
     fazendo sentido; o intervalo em serviço não pode cruzar o de outra
     O.S. dele. Devolve o motivo da recusa, ou '' se aceitou. */
  function conferir(r, candidato, justificativa) {
    if (String(justificativa || '').trim().length < MIN_JUSTIFICATIVA) {
      return `Escreva a justificativa (pelo menos ${MIN_JUSTIFICATIVA} letras).`;
    }
    const agora = Date.now();
    if (!(candidato.hora > 0)) return 'Hora inválida.';
    if (candidato.hora > agora + FOLGA_FUTURO) return 'A hora não pode ser no futuro.';
    const teste = Object.assign({}, r, { toques: r.toques.concat(candidato) });
    const { erro, trechos } = repassar(linhaDoTempo(teste), agora);
    if (erro) return erro;
    const meus = trechos.filter(t => ATIVO.indexOf(t.estado) >= 0);
    for (const outro of relogios) {
      if (outro.id === r.id) continue;
      const deles = repassar(linhaDoTempo(outro), agora).trechos.filter(t => ATIVO.indexOf(t.estado) >= 0);
      for (const a of meus) for (const b of deles) {
        if (a.de < b.ate && b.de < a.ate) {
          return `Esse horário cruza com a O.S. ${outro.os} (${hhmm(b.de)}–${hhmm(b.ate)}).`;
        }
      }
    }
    return '';
  }

  async function ajustar(id, idToque, hora, justificativa) {
    const r = relogios.find(x => x.id === id);
    if (!r) throw new Error('Esse relógio não está mais neste celular.');
    const alvo = linhaDoTempo(r).find(t => t.id === idToque);
    if (!alvo) throw new Error('Esse registro não existe.');
    const ajuste = { id: novoId('TQ'), tipo: 'ajuste', corrige: idToque, hora, horaOriginal: alvo.hora,
                     justificativa: String(justificativa).trim(), criadoEm: Date.now() };
    const recusa = conferir(r, ajuste, justificativa);
    if (recusa) throw new Error(recusa);
    await registrar(r, ajuste);
    return r;
  }

  async function incluir(id, tipo, hora, justificativa, motivo) {
    const r = relogios.find(x => x.id === id);
    if (!r) throw new Error('Esse relógio não está mais neste celular.');
    if (!PASSOS[tipo]) throw new Error('Registro desconhecido.');
    const toque = { id: novoId('TQ'), tipo, hora, motivo: motivo || '', justificativa: String(justificativa).trim(),
                    criadoEm: Date.now() };
    const recusa = conferir(r, toque, justificativa);
    if (recusa) throw new Error(recusa);
    await registrar(r, toque);
    return r;
  }

  /* Relatório fechado sem o relógio ter sido usado (ele esqueceu de
     tudo): início e fim digitados, com justificativa. Cria o relógio
     já finalizado. */
  async function lancarPorFora(ordem, tecnico, de, ate, justificativa) {
    const r = {
      id: novoId('RL'), os: ordem.os, cliente: ordem.cliente || '', tecnico,
      ordem: Object.assign({}, ordem), toques: [], criadoEm: Date.now()
    };
    const ini = { id: novoId('TQ'), tipo: 'inicio', hora: de, motivo: '', justificativa, criadoEm: Date.now() };
    const fim = { id: novoId('TQ'), tipo: 'fim', hora: ate, motivo: '', justificativa, criadoEm: Date.now() + 1 };
    if (!(ate > de)) throw new Error('O fim tem de ser depois do início.');
    // confere o par: o início sozinho seria um relógio correndo até agora
    const recusa = conferir(Object.assign({}, r, { toques: [ini] }), fim, justificativa);
    if (recusa) throw new Error(recusa);
    await registrar(r, ini);
    await registrar(r, fim);
    return r;
  }

  // O relatório desta O.S. foi para a fila: o relógio terminado sai
  // do celular (os toques já estão na fila ou na planilha). O id fica
  // anotado por 30 dias: até o relatório chegar à planilha, o servidor
  // ainda devolve esse relógio e ele não pode voltar para a tela.
  async function arquivar(id) {
    relogios = relogios.filter(r => r.id !== id);
    await Armazem.relogios.apagar(id);
    try {
      const corte = Date.now() - 30 * 864e5;
      const lista = (await Armazem.pref.ler('arquivados')) || {};
      Object.keys(lista).forEach(k => { if (lista[k] < corte) delete lista[k]; });
      lista[id] = Date.now();
      await Armazem.pref.gravar('arquivados', lista);
    } catch (e) { /* sem a anotação, no pior caso o relógio reaparece uma vez */ }
    aoMudar();
  }

  /* O relógio é do técnico, não do aparelho. O servidor devolve os
     relógios dele (refeitos da aba Apontamentos) ao abrir o app; aqui eles
     são juntados com os do aparelho: relógio novo entra, relógio que já
     existe ganha os toques que faltam. Nada local é apagado (um toque que
     ainda está na fila deste aparelho continua valendo). */
  async function mesclar(remotos) {
    const arquivados = (await Armazem.pref.ler('arquivados')) || {};
    let mudou = false;
    for (const rem of remotos || []) {
      if (!rem || !rem.id || arquivados[rem.id] || !Array.isArray(rem.toques) || !rem.toques.length) continue;
      const local = relogios.find(r => r.id === rem.id);
      if (local) {
        const tem = new Set(local.toques.map(t => t.id));
        const faltam = rem.toques.filter(t => !tem.has(t.id));
        if (!faltam.length) continue;
        await Armazem.relogios.gravar(Object.assign({}, local, { toques: local.toques.concat(faltam) }));
        faltam.forEach(t => local.toques.push(t));
      } else {
        const r = {
          id: rem.id, os: rem.os, cliente: rem.cliente || '', tecnico: rem.tecnico || '',
          ordem: Object.assign({ os: rem.os, cliente: rem.cliente || '', modelo: '', serie: '', descricao: '' }, rem.ordem || {}),
          toques: rem.toques.slice(), criadoEm: Math.min.apply(null, rem.toques.map(t => t.criadoEm || t.hora))
        };
        await Armazem.relogios.gravar(r);
        relogios.push(r);
      }
      mudou = true;
    }
    if (mudou) aoMudar();
  }

  async function iniciarModulo(opcoes) {
    fila = opcoes.fila;
    aoMudar = opcoes.aoMudar || aoMudar;
    relogios = (await Armazem.relogios.todos()).sort((a, b) => a.criadoEm - b.criadoEm);
  }

  const lista = () => relogios.map(r => resumo(r));

  return {
    NOMES,
    iniciarModulo,
    iniciar,
    retomar,
    almoco:    id => tocar(id, 'almoco'),
    voltar:    id => tocar(id, 'volta'),
    pausar:    (id, motivo) => tocar(id, 'pausa', motivo),
    finalizar: id => tocar(id, 'fim'),
    // iniciou por engano: o "cancelado" vai para a planilha (nada some
    // de lá) e o relógio sai do celular
    cancelar:  async id => { await tocar(id, 'cancelado'); await arquivar(id); },
    ajustar,
    incluir,
    lancarPorFora,
    arquivar,
    // o que a tela mostra
    mesclar,
    atual:      () => { const a = ativo(); return a ? resumo(a) : null; },
    // também em serviço (começou em outro aparelho): a tela lista, sem pausar sozinha
    tambemAtivos: () => ativos().slice(1).map(r => resumo(r)),
    pausadas:   () => lista().filter(r => r.estado === 'pausada'),
    terminados: () => lista().filter(r => r.estado === 'finalizado' || r.estado === 'cancelado'),
    esquecidos: () => lista().filter(r => r.esquecido),
    daOs:       os => { const r = daOs(os) || relogios.filter(x => x.os === os).pop(); return r ? resumo(r) : null; },
    resumo:     id => { const r = relogios.find(x => x.id === id); return r ? resumo(r) : null; },
    ordem:      id => { const r = relogios.find(x => x.id === id); return r ? Object.assign({}, r.ordem) : null; }
  };
})();
// -------- relogio.js v2 --------

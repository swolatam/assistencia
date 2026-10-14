// -------- armazem.js v1 --------
/* ═══════════════════════════════════════════════════════════════
   ARMAZÉM — o que fica guardado no aparelho

   Tudo o que o app guarda no celular passa por aqui, e só por aqui:
   as telas não sabem que existe IndexedDB. Três gavetas:
     rascunhos  um por relatório em andamento — vários ao mesmo tempo,
                cada O.S. com o seu
     fila       relatórios fechados que ainda não chegaram ao servidor
     prefs      técnico escolhido, assinatura lembrada, última lista de
                O.S. e os últimos enviados

   IndexedDB e não localStorage: cabe muito mais (a fila leva as
   assinaturas em PNG até o servidor confirmar) e grava em transação.

   A versão anterior guardava UM rascunho no localStorage
   (at.rascunho). Na primeira abertura ele é trazido para cá, junto com
   as preferências, e só então sai do localStorage: o relatório que
   estava aberto no celular não se perde na troca de versão.

   Sem IndexedDB (navegador muito restrito), guarda só na memória: o
   app funciona, mas fechar a aba perde tudo. Aí duravel fica false e
   a tela avisa.
   ═══════════════════════════════════════════════════════════════ */
window.Armazem = (function () {
  'use strict';

  const BANCO = 'sistema-os';
  const GAVETAS = ['rascunhos', 'fila', 'prefs'];
  const ANTIGAS = { rascunho: 'at.rascunho', tecnico: 'at.tecnico', assinatura: 'at.assinatura', inicio: 'at.inicio' };

  let db = null;
  let memoria = null;     // só quando não há IndexedDB
  let abrindo = null;

  const copia = v => (v == null ? v : JSON.parse(JSON.stringify(v)));

  function pedido(r) {
    return new Promise((ok, falha) => {
      r.onsuccess = () => ok(r.result);
      r.onerror = () => falha(r.error);
    });
  }

  function abrirBanco() {
    return new Promise((ok, falha) => {
      const r = indexedDB.open(BANCO, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('rascunhos')) d.createObjectStore('rascunhos', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('fila'))      d.createObjectStore('fila', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('prefs'))     d.createObjectStore('prefs');
      };
      r.onsuccess = () => {
        const d = r.result;
        d.onversionchange = () => d.close();   // outra aba subiu a versão do banco: esta solta
        ok(d);
      };
      r.onerror = () => falha(r.error);
      r.onblocked = () => falha(new Error('o banco do app está preso por outra aba'));
    });
  }

  // Só resolve quando a transação termina: aí está gravado de verdade.
  function gravando(gaveta, fn) {
    const tx = db.transaction(gaveta, 'readwrite');
    fn(tx.objectStore(gaveta));
    return new Promise((ok, falha) => {
      tx.oncomplete = () => ok();
      tx.onerror = tx.onabort = () => falha(tx.error || new Error('não gravou no aparelho'));
    });
  }

  async function migrar() {
    let ls;
    try { ls = window.localStorage; if (!ls) return; } catch (e) { return; }
    const lerLs = k => { try { return JSON.parse(ls.getItem(k)); } catch (e) { return null; } };

    const r = lerLs(ANTIGAS.rascunho);
    if (r && r.id) {
      r.atualizadoEm = r.atualizadoEm || Date.now();
      await gravando('rascunhos', loja => loja.put(r));
    }
    for (const k of ['tecnico', 'assinatura', 'inicio']) {
      const v = lerLs(ANTIGAS[k]);
      if (v != null) await gravando('prefs', loja => loja.put(v, k));
    }
    Object.values(ANTIGAS).forEach(k => { try { ls.removeItem(k); } catch (e) { /* fica lá, inofensivo */ } });
  }

  function abrir() {
    if (!abrindo) abrindo = (async () => {
      try {
        db = await abrirBanco();
      } catch (e) {
        memoria = { rascunhos: new Map(), fila: new Map(), prefs: new Map() };
        return;
      }
      await migrar();
      // pede para o navegador não apagar estes dados quando faltar espaço
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* tanto faz */ }
    })();
    return abrindo;
  }

  async function todos(gaveta) {
    await abrir();
    if (memoria) return Array.from(memoria[gaveta].values()).map(copia);
    return pedido(db.transaction(gaveta).objectStore(gaveta).getAll());
  }

  async function ler(gaveta, chave) {
    await abrir();
    if (memoria) return copia(memoria[gaveta].get(chave));
    return pedido(db.transaction(gaveta).objectStore(gaveta).get(chave));
  }

  // chave só nas prefs; rascunhos e fila usam o próprio id
  async function gravar(gaveta, valor, chave) {
    await abrir();
    const k = chave === undefined ? valor.id : chave;
    if (memoria) { memoria[gaveta].set(k, copia(valor)); return; }
    await gravando(gaveta, loja => (chave === undefined ? loja.put(valor) : loja.put(valor, chave)));
  }

  async function apagar(gaveta, chave) {
    await abrir();
    if (memoria) { memoria[gaveta].delete(chave); return; }
    await gravando(gaveta, loja => loja.delete(chave));
  }

  async function zerar() {
    await abrir();
    if (memoria) GAVETAS.forEach(g => memoria[g].clear());
    else for (const g of GAVETAS) await gravando(g, loja => loja.clear());
    try { Object.values(ANTIGAS).forEach(k => localStorage.removeItem(k)); } catch (e) { /* sem localStorage */ }
  }

  return {
    abrir,
    zerar,
    get duravel() { return !memoria; },
    rascunhos: { todos: () => todos('rascunhos'), gravar: r => gravar('rascunhos', r), apagar: id => apagar('rascunhos', id) },
    fila:      { todos: () => todos('fila'),      gravar: i => gravar('fila', i),      apagar: id => apagar('fila', id) },
    pref:      { ler: k => ler('prefs', k), gravar: (k, v) => gravar('prefs', v, k), apagar: k => apagar('prefs', k) }
  };
})();
// -------- armazem.js v1 --------

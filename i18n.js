// -------- i18n.js v3 --------
/* ═══════════════════════════════════════════════════════════════
   IDIOMA DA TELA (português do Brasil e espanhol)

   O português é a fonte: no código a frase em português É a chave,
   assim `tx('Salvar')` mostra "Salvar" em PT-BR e "Guardar" em ES.
   Frase que não está no dicionário aparece em português (nunca fica
   em branco). {nome} é buraco que o código preenche:
       tx('A O.S. {os} já foi encerrada.', { os: '123' })

   O HTML fixo do index.html NÃO leva marcação: o tradutor percorre os
   textos da página e troca os que estão no dicionário (também
   placeholder, aria-label e title). A chave é o texto com os espaços
   e quebras de linha reduzidos a um espaço só.

   O que NÃO se traduz aqui: o que vai para a planilha (tipos de toque,
   motivos de pausa, "Outra O.S. (…)") continua em português, porque o
   NewSimova lê esses textos; só o rótulo na tela é traduzido.

   Qual idioma: o que ficou guardado neste aparelho; no 1º acesso, o do
   navegador (es-* = espanhol); depois que o servidor reconhece o
   técnico, vale a coluna Idioma da aba Tecnicos dele (definir()).

   py conferir_idiomas.py confere se todo tx('…') e todo texto do
   index.html têm tradução.
   ═══════════════════════════════════════════════════════════════ */
window.I18n = (function () {
  'use strict';

  const CHAVE_LOCAL = 'sistema-os-idioma';

  const ES = {
    // ── Utilidades ──
    'hoje': 'hoy',
    'ontem': 'ayer',
    '{de} a {ate}': '{de} al {ate}',
    ' e ': ' y ',
    'Outra O.S. ({os})': 'Otra OS ({os})',
    'relatório em andamento': 'informe en curso',
    'relatórios em andamento': 'informes en curso',
    'relatório assinado que AINDA NÃO SAIU': 'informe firmado que AÚN NO SALIÓ',
    'relatórios assinados que AINDA NÃO SAÍRAM': 'informes firmados que AÚN NO SALIERON',
    'relógio de O.S. aberto': 'reloj de OS abierto',
    'relógios de O.S. abertos': 'relojes de OS abiertos',
    'registro de horário que ainda não subiu': 'registro de horario que aún no se envió',
    'registros de horário que ainda não subiram': 'registros de horario que aún no se enviaron',
    'registro de horário esperando': 'registro de horario esperando',
    'registros de horário esperando': 'registros de horario esperando',
    'máquina': 'equipo',
    'máquinas': 'equipos',
    ' para subir para a planilha.': ' para subir a la planilla.',
    ' Sem sinal: sobem quando a conexão voltar.': ' Sin señal: suben cuando vuelva la conexión.',

    // ── Iguais nos dois idiomas (listados para o conferir_idiomas.py não achar que faltam) ──
    'Abrir PDF': 'Abrir PDF',
    'Cancelado': 'Cancelado',
    'cancelado': 'cancelado',
    'Cancelar': 'Cancelar',
    'Cliente': 'Cliente',
    'Descartar': 'Descartar',
    'desde': 'desde',
    'Documento': 'Documento',
    'Finalizar': 'Finalizar',
    'Modelo': 'Modelo',
    'opcional': 'opcional',
    'Pausa': 'Pausa',
    'Pausada': 'Pausada',
    'pausada': 'pausado',
    'Pausadas': 'Pausadas',
    'Pausar': 'Pausar',
    'Técnico': 'Técnico',

    // ── Erros e avisos gerais ──
    'Não consegui guardar o rascunho neste celular: ': 'No pude guardar el borrador en este celular: ',
    'Apagar o que este app guardou NESTE celular?': '¿Borrar lo que esta app guardó EN ESTE celular?',
    'Isso apaga {lista}.': 'Esto borra {lista}.',
    'Também somem sua assinatura lembrada e a lista de O.S. guardada.': 'También se borran su firma recordada y la lista de OS guardada.',
    'Nada do que já foi enviado se perde.': 'Nada de lo ya enviado se pierde.',
    'Zerar este celular': 'Borrar datos del celular',
    'Confirmar': 'Confirmar',

    // ── Técnico ──
    'Escolha seu nome…': 'Elija su nombre…',
    'Seu e-mail <b>{email}</b> não está na aba Tecnicos da planilha. Peça para incluírem — sem isso o relatório não fecha.':
      'Su correo <b>{email}</b> no está en la hoja Tecnicos de la planilla. Pida que lo incluyan: sin eso el informe no se cierra.',
    'Escolha seu nome primeiro.': 'Primero elija su nombre.',
    'A lista de técnicos ainda não carregou.': 'La lista de técnicos aún no cargó.',

    // ── Tela inicial ──
    'Sem sinal. Saem sozinhos quando a conexão voltar, com o app aberto; se fechar, saem na próxima vez que abrir.':
      'Sin señal. Salen solos cuando vuelva la conexión, con la app abierta; si la cierra, salen la próxima vez que la abra.',
    'Saem sozinhos assim que o servidor responder.': 'Salen solos apenas el servidor responda.',
    'Enviando…': 'Enviando…',
    'Não foi: {erro} Tenta de novo {quando}.': 'No salió: {erro} Reintenta {quando}.',
    'Esperando para enviar.': 'Esperando para enviar.',
    'fechado {quando}': 'cerrado {quando}',
    'preenchendo': 'completando',
    'cliente já assinou': 'el cliente ya firmó',
    'na revisão': 'en revisión',
    '{t} de serviço': '{t} de servicio',
    'sem O.S.': 'sin OS',
    'Descartar o relatório da O.S. {os}': 'Descartar el informe de la OS {os}',
    'sem número': 'sin número',
    'Descartar o relatório da O.S. {os}? O que foi digitado e assinado será apagado.':
      '¿Descartar el informe de la OS {os}? Lo digitado y firmado se borrará.',
    ' Os horários marcados no relógio continuam na planilha.': ' Los horarios marcados en el reloj siguen en la planilla.',
    'Carregando as O.S.…': 'Cargando las OS…',
    'Nada encontrado com esse termo. Se a O.S. já foi encerrada, digite o número dela.':
      'No se encontró nada con ese término. Si la OS ya fue cerrada, escriba su número.',
    'Nenhuma O.S. em aberto. Para um segundo atendimento, digite o número da O.S. na busca.':
      'Ninguna OS abierta. Para una segunda atención, escriba el número de la OS en la búsqueda.',
    'Em andamento neste celular · toque para continuar': 'En curso en este celular · toque para continuar',
    'Já encerrada · novo relatório sai como v2': 'Ya cerrada · un nuevo informe sale como v2',
    'Mostrando {max} de {total}. Digite para filtrar.': 'Mostrando {max} de {total}. Escriba para filtrar.',
    'Em serviço agora': 'En servicio ahora',
    'No almoço': 'En almuerzo',
    'Pausada · toque para retomar': 'Pausada · toque para reanudar',
    'Serviço finalizado · toque para o relatório': 'Servicio finalizado · toque para el informe',
    'Em serviço': 'En servicio',
    'Serviço finalizado': 'Servicio finalizado',

    // ── Começar, iniciar ──
    'Retomar o serviço da O.S. {os}?': '¿Reanudar el servicio de la OS {os}?',
    'Retomar': 'Reanudar',
    'Esta O.S. já está em serviço.': 'Esta OS ya está en servicio.',
    'A O.S. {os} já foi encerrada. Começar um novo atendimento para ela? O relatório sai como v2, em branco, sem nada do atendimento anterior.':
      'La OS {os} ya fue cerrada. ¿Comenzar una nueva atención para ella? El informe sale como v2, en blanco, sin nada de la atención anterior.',
    'Começar': 'Comenzar',
    'Digitar a O.S.': 'Digitar la OS',
    'O.S. {os}': 'OS {os}',
    'Número da O.S.': 'Número de la OS',
    'Iniciar o serviço agora, às {hora}?': '¿Iniciar el servicio ahora, a las {hora}?',
    'A O.S. {os}, que está no almoço, vai ser pausada.': 'La OS {os}, que está en almuerzo, será pausada.',
    'A O.S. {os}, que está em serviço, vai ser pausada.': 'La OS {os}, que está en servicio, será pausada.',
    'Só o relatório': 'Solo el informe',
    'Iniciar serviço': 'Iniciar servicio',
    'Digite o número da O.S.': 'Escriba el número de la OS.',

    // ── Relógio ──
    'Aguardando peça': 'Esperando repuesto',
    'Aguardando cliente': 'Esperando cliente',
    'Fim do expediente': 'Fin de la jornada',
    'Outro': 'Otro',
    'tempo em serviço': 'tiempo en servicio',
    'no almoço desde': 'en almuerzo desde',
    'Correndo há {t} direto. Esqueceu de pausar?': 'Corriendo hace {t} seguidas. ¿Olvidó pausar?',
    'Corrigir': 'Corregir',
    'Voltar do almoço': 'Volver del almuerzo',
    'Almoço': 'Almuerzo',
    'Finalizar serviço': 'Finalizar servicio',
    'Preencher relatório ›': 'Completar informe ›',
    'Ajustar horários ›': 'Ajustar horarios ›',
    'Também em serviço (começou em outro aparelho): <b>O.S. {os}</b>, desde {quando}':
      'También en servicio (comenzó en otro equipo): <b>OS {os}</b>, desde {quando}',
    'Horários': 'Horarios',
    'Relatório': 'Informe',
    '{t} em serviço': '{t} en servicio',
    'Sem horário marcado: na hora de enviar, informe o início e o fim do serviço.':
      'Sin horario marcado: al enviar, indique el inicio y el fin del servicio.',
    'Serviço iniciado. A O.S. {os} foi pausada.': 'Servicio iniciado. La OS {os} fue pausada.',
    'Serviço da O.S. {os} iniciado às {hora}.': 'Servicio de la OS {os} iniciado a las {hora}.',
    'Bom almoço. Na volta, toque em "Voltar do almoço".': 'Buen almuerzo. Al volver, toque "Volver del almuerzo".',
    'Retomado. A O.S. {os} foi pausada.': 'Reanudado. La OS {os} fue pausada.',
    'Serviço retomado.': 'Servicio reanudado.',
    'Pausar a O.S. {os}': 'Pausar la OS {os}',
    'Por quê?': '¿Por qué?',
    'Qual?': '¿Cuál?',
    'Escreva o motivo.': 'Escriba el motivo.',
    'Finalizar o serviço da O.S. {os} agora, às {hora}? Depois vem o relatório.':
      '¿Finalizar el servicio de la OS {os} ahora, a las {hora}? Después viene el informe.',

    // ── Formulário de horário ──
    'O que foi': 'Qué fue',
    'Motivo da pausa': 'Motivo de la pausa',
    'Justificativa': 'Justificación',
    'Ex.: esqueci de marcar na hora': 'Ej.: olvidé marcar a tiempo',
    'Voltar': 'Volver',
    'Salvar': 'Guardar',
    'Preencha a data e a hora.': 'Complete la fecha y la hora.',
    'Horários da O.S. {os}': 'Horarios de la OS {os}',
    'corrigido': 'corregido',
    '+ Incluir um registro esquecido': '+ Incluir un registro olvidado',
    'Iniciei por engano: cancelar': 'Inicié por error: cancelar',
    'Fechar': 'Cerrar',
    'Cancelar o relógio da O.S. {os}? Ele sai deste celular; na planilha os horários ficam, marcados como cancelados.':
      '¿Cancelar el reloj de la OS {os}? Sale de este celular; en la planilla los horarios quedan, marcados como cancelados.',
    'Cancelar o relógio': 'Cancelar el reloj',
    'Relógio da O.S. {os} cancelado.': 'Reloj de la OS {os} cancelado.',
    'Incluir um registro na O.S. {os}': 'Incluir un registro en la OS {os}',
    'Quando': 'Cuándo',
    'Corrigir: {nome} da O.S. {os}': 'Corregir: {nome} de la OS {os}',
    'Está marcado {quando}. Qual é a hora certa?': 'Está marcado {quando}. ¿Cuál es la hora correcta?',
    'Hora certa': 'Hora correcta',
    'O.S. {os}: o relógio está correndo desde {quando}': 'OS {os}: el reloj está corriendo desde {quando}',
    'Que horas você parou?': '¿A qué hora paró?',
    'Pausei: volto a esta O.S. depois': 'Pausé: vuelvo a esta OS después',
    'Terminei o serviço': 'Terminé el servicio',
    'Parei em': 'Paré a las',
    'Depois': 'Después',

    // ── Corrigir dado da O.S. ──
    'Serviço solicitado': 'Servicio solicitado',
    'Série': 'Serie',
    'Corrigir {campo}': 'Corregir {campo}',
    ' (máquina {n})': ' (equipo {n})',
    'Corrigir: {nome}': 'Corregir: {nome}',
    'O motivo fica só no sistema da Kalmar. O cliente não vê.': 'El motivo queda solo en el sistema de Kalmar. El cliente no lo ve.',
    'Está assim na O.S.': 'Así está en la OS',
    'Valor correto': 'Valor correcto',
    'Por que está errado?': '¿Por qué está equivocado?',
    'Ex.: a plaqueta da máquina tem outro número': 'Ej.: la placa del equipo tiene otro número',
    'Salvar correção': 'Guardar corrección',
    'Escreva o valor correto.': 'Escriba el valor correcto.',
    'Explique por que está errado (pelo menos 5 letras).': 'Explique por qué está equivocado (al menos 5 letras).',
    'Corrigido. O motivo vai só para o sistema.': 'Corregido. El motivo va solo al sistema.',

    // ── Preencher ──
    'Máquina {n}': 'Equipo {n}',
    'Remover': 'Quitar',
    'Frota': 'Flota',
    'Horímetro': 'Horómetro',
    'O que foi feito nesta máquina': 'Qué se hizo en este equipo',
    'Defeito encontrado, o que foi verificado e o que foi feito. Sem nada de especial, deixe em branco — vale a descrição do serviço lá em cima.':
      'Falla encontrada, qué se verificó y qué se hizo. Si no hay nada especial, déjelo en blanco: vale la descripción del servicio de arriba.',
    'Falta a O.S.': 'Falta la OS.',
    'Falta a data do atendimento.': 'Falta la fecha de la atención.',
    'A data final é anterior à do atendimento.': 'La fecha final es anterior a la de la atención.',
    'Falta o cliente.': 'Falta el cliente.',
    'Máquina {n}: informe a frota ou a série.': 'Equipo {n}: indique la flota o la serie.',
    'Máquina {n}: falta o horímetro.': 'Equipo {n}: falta el horómetro.',
    'Escreva a descrição do serviço, ou o que foi feito em pelo menos uma máquina.':
      'Escriba la descripción del servicio, o lo que se hizo en al menos un equipo.',

    // ── Leitura e assinatura ──
    'Data': 'Fecha',
    'Descrição do serviço': 'Descripción del servicio',
    'Equipamento': 'Equipo',
    'assinada ✓': 'firmada ✓',
    'falta assinar': 'falta firmar',
    ' · vire o celular para a esquerda': ' · gire el celular hacia la izquierda',
    'Assinatura do técnico': 'Firma del técnico',
    'Assinatura do responsável': 'Firma del responsable',
    'Também enviar para {email} (contato da O.S.)': 'También enviar a {email} (contacto de la OS)',
    'Outro e-mail para receber o PDF': 'Otro correo para recibir el PDF',
    'Tirar': 'Quitar',

    // ── Finalizar ──
    'Falta a assinatura do técnico.': 'Falta la firma del técnico.',
    'Falta o nome do responsável.': 'Falta el nombre del responsable.',
    'Tem e-mail do cliente incompleto.': 'Hay un correo del cliente incompleto.',
    'Falta a assinatura do responsável do cliente.': 'Falta la firma del responsable del cliente.',
    'Volte ao início e identifique-se como técnico.': 'Vuelva al inicio e identifíquese como técnico.',
    'Sem e-mail do cliente, o PDF vai só para você e para a equipe. Enviar assim?':
      'Sin correo del cliente, el PDF va solo a usted y al equipo. ¿Enviar así?',
    'Enviar assim': 'Enviar así',
    'O relógio da O.S. {os} ainda está {estado}. Finalizar o serviço agora, às {hora}, e enviar?':
      'El reloj de la OS {os} aún está {estado}. ¿Finalizar el servicio ahora, a las {hora}, y enviar?',
    'pausado': 'pausado',
    'correndo': 'corriendo',
    'Finalizar e enviar': 'Finalizar y enviar',
    'A O.S. {os} não tem horário marcado': 'La OS {os} no tiene horario marcado',
    'Informe quando o serviço começou e quando terminou.': 'Indique cuándo comenzó el servicio y cuándo terminó.',
    'Início': 'Inicio',
    'Fim': 'Fin',
    'Salvar e enviar': 'Guardar y enviar',
    'Não consegui guardar o relatório neste celular:': 'No pude guardar el informe en este celular:',
    'Ele continua aqui, aberto; tente de novo.': 'Sigue aquí, abierto; intente de nuevo.',

    // ── Enviado ──
    'Relatório fechado, na fila': 'Informe cerrado, en cola',
    'Relatório fechado': 'Informe cerrado',
    'Sem sinal agora. O relatório e as assinaturas estão guardados na fila deste celular.':
      'Sin señal por ahora. El informe y las firmas están guardados en la cola de este celular.',
    'O servidor não respondeu agora. O relatório e as assinaturas estão guardados na fila deste celular.':
      'El servidor no respondió por ahora. El informe y las firmas están guardados en la cola de este celular.',
    'Ele sai sozinho quando a conexão voltar, com o app aberto. Se fechar o app, sai na próxima vez que abrir. Acompanhe em "Fila de envio", no início.':
      'Sale solo cuando vuelva la conexión, con la app abierta. Si cierra la app, sale la próxima vez que la abra. Siga el avance en "Cola de envío", en el inicio.',
    'Este relatório já tinha sido fechado antes — nada foi enviado de novo.': 'Este informe ya había sido cerrado antes: no se envió nada de nuevo.',
    'O PDF foi enviado para <b>{para}</b>.': 'El PDF fue enviado a <b>{para}</b>.',
    'O PDF foi salvo.': 'El PDF fue guardado.',
    '{erro} Abra o PDF e encaminhe ao cliente.': '{erro} Abra el PDF y reenvíelo al cliente.',
    'Relatório de atendimento': 'Informe de atención',

    // ── Eventos e início ──
    'Sem sinal: tento assim que a conexão voltar.': 'Sin señal: lo intento apenas vuelva la conexión.',
    'Tentando enviar…': 'Intentando enviar…',
    ' (e mais {n})': ' (y {n} más)',
    'Remover a máquina {n}?': '¿Quitar el equipo {n}?',
    'Voltar para editar apaga a assinatura do cliente. Continuar?': 'Volver a editar borra la firma del cliente. ¿Continuar?',
    'Voltar e editar': 'Volver y editar',
    'Relógios do servidor: ': 'Relojes del servidor: ',
    'Sem conexão com o servidor: mostrando a lista de O.S. da última vez.': 'Sin conexión con el servidor: mostrando la lista de OS de la última vez.',
    'Não consegui carregar as O.S. ({erro}). Dá para digitar a O.S. à mão.': 'No pude cargar las OS ({erro}). Se puede escribir la OS a mano.',
    'Entrar com a conta Kalmar': 'Ingresar con la cuenta Kalmar',
    'O.S. {os} enviada.': 'OS {os} enviada.',
    'O.S. {os} enviada, mas o e-mail falhou.': 'OS {os} enviada, pero el correo falló.',
    'Projeto {v}': 'Proyecto {v}',
    'Há relatório, horário ou relógio pendente neste celular: termine antes de trocar de país.':
      'Hay un informe, horario o reloj pendiente en este celular: termine antes de cambiar de país.',

    // ── relogio.js ──
    'Volta do almoço': 'Vuelta del almuerzo',
    'Retomada': 'Reanudación',
    'Fim do serviço': 'Fin del servicio',
    'O primeiro registro tem de ser o Início.': 'El primer registro debe ser el Inicio.',
    '{nome} às {hora} não combina: nessa hora o relógio estava {estado}.': '{nome} a las {hora} no corresponde: a esa hora el reloj estaba {estado}.',
    'em serviço': 'en servicio',
    'no almoço': 'en almuerzo',
    'serviço finalizado': 'servicio finalizado',
    'Falta o número da O.S.': 'Falta el número de la OS.',
    'Identifique-se como técnico primeiro.': 'Identifíquese primero como técnico.',
    'Esse relógio não está mais neste celular.': 'Ese reloj ya no está en este celular.',
    'Esse serviço já terminou.': 'Ese servicio ya terminó.',
    '{nome} não combina com o relógio {estado}.': '{nome} no corresponde con el reloj {estado}.',
    'Escreva a justificativa (pelo menos {n} letras).': 'Escriba la justificación (al menos {n} letras).',
    'Hora inválida.': 'Hora inválida.',
    'A hora não pode ser no futuro.': 'La hora no puede ser en el futuro.',
    'Esse horário cruza com a O.S. {os} ({de}–{ate}).': 'Ese horario se cruza con la OS {os} ({de}–{ate}).',
    'Esse registro não existe.': 'Ese registro no existe.',
    'Registro desconhecido.': 'Registro desconocido.',
    'O fim tem de ser depois do início.': 'El fin debe ser posterior al inicio.',

    // ── servidor.js, fila.js, armazem.js ──
    'Sem sinal.': 'Sin señal.',
    'Não consegui entrar no servidor com a sua conta Kalmar.': 'No pude entrar al servidor con su cuenta Kalmar.',
    'O servidor não respondeu a tempo.': 'El servidor no respondió a tiempo.',
    'Erro no servidor.': 'Error en el servidor.',
    'Este app está sem servidor configurado (falta o config.js).': 'Esta app no tiene servidor configurado (falta config.js).',
    'o banco do app está preso por outra aba': 'la base de la app está bloqueada por otra pestaña',
    'não gravou no aparelho': 'no se guardó en el equipo',

    // ── HTML fixo (index.html) ──
    'Assistência técnica · Kalmar': 'Asistencia técnica · Kalmar',
    'Assistência técnica': 'Asistencia técnica',
    'Este navegador não deixa o app guardar nada no celular: não feche esta aba antes de o relatório sair.':
      'Este navegador no deja que la app guarde nada en el celular: no cierre esta pestaña antes de que salga el informe.',
    'Fila de envio': 'Cola de envío',
    'Tentar enviar agora': 'Intentar enviar ahora',
    'Em andamento': 'En curso',
    'Escolha a O.S.': 'Elija la OS',
    'Buscar O.S., cliente ou série': 'Buscar OS, cliente o serie',
    'Buscar O.S., cliente, série…': 'Buscar OS, cliente, serie…',
    'Aparecem as O.S. em aberto. Segundo atendimento? Digite o número da O.S.': 'Aparecen las OS abiertas. ¿Segunda atención? Escriba el número de la OS.',
    'Enviados deste celular': 'Enviados desde este celular',
    'Zerar os dados deste celular': 'Borrar los datos de este celular',
    '‹ Início · o rascunho fica guardado': '‹ Inicio · el borrador queda guardado',
    'Atendimento': 'Atención',
    'O.S.': 'OS',
    'Data do atendimento': 'Fecha de la atención',
    'Até': 'Hasta',
    'durou mais de um dia': 'duró más de un día',
    'o que foi feito no geral': 'qué se hizo en general',
    'O que foi feito no atendimento como um todo. Detalhe de uma máquina específica vai no cartão dela, abaixo.':
      'Qué se hizo en la atención en general. El detalle de un equipo específico va en su tarjeta, abajo.',
    'Máquinas': 'Equipos',
    '+ Adicionar máquina': '+ Agregar equipo',
    'Revisar e assinar': 'Revisar y firmar',
    '‹ Editar': '‹ Editar',
    'Leia com o cliente': 'Lea con el cliente',
    'Área para o técnico assinar com o dedo': 'Área para que el técnico firme con el dedo',
    'Assine aqui com o dedo': 'Firme aquí con el dedo',
    'Lembrar minha assinatura neste celular': 'Recordar mi firma en este celular',
    '⤢ Deitado': '⤢ Horizontal',
    'Limpar': 'Borrar',
    'Responsável do cliente': 'Responsable del cliente',
    'Nome': 'Nombre',
    'E-mail para receber o PDF': 'Correo para recibir el PDF',
    '+ Adicionar outro e-mail': '+ Agregar otro correo',
    'Ao assinar, confirmo que li este relatório.': 'Al firmar, confirmo que leí este informe.',
    'Área para o responsável do cliente assinar com o dedo': 'Área para que el responsable del cliente firme con el dedo',
    'Voltar ao início': 'Volver al inicio',
    'Pronto': 'Listo',
    'Erro no aplicativo': 'Error en la aplicación',
    'Nenhuma O.S. na lista. Use o botão abaixo para abrir uma O.S. nova.': 'Ninguna OS en la lista. Use el botón de abajo para abrir una OS nueva.',
    'Não achou? Abrir O.S. nova': '¿No la encontró? Abrir OS nueva',
    'O.S. de outros técnicos': 'OS de otros técnicos',
    'Com {nomes}': 'Con {nomes}',
    'ninguém ainda': 'nadie aún',
    'Esperando o número da O.S. · pode trabalhar normalmente': 'Esperando el número de la OS · puede trabajar normalmente',
    'A O.S. ainda não tem número de verdade (o NewSimova dá o número quando houver sinal). O relatório e as assinaturas estão guardados e saem sozinhos, com o número certo, assim que ele chegar.': 'La OS aún no tiene número definitivo (el NewSimova lo da cuando haya señal). El informe y las firmas están guardados y salen solos, con el número correcto, apenas llegue.',
    'pedido de O.S. nova que ainda não recebeu o número': 'pedido de OS nueva que aún no recibió el número',
    'pedidos de O.S. nova que ainda não receberam o número': 'pedidos de OS nueva que aún no recibieron el número',
    'Ainda não baixei a lista de clientes. Abra o app com sinal uma vez para poder abrir O.S.': 'Aún no descargué la lista de clientes. Abra la app con señal una vez para poder abrir OS.',
    'Abrir O.S. nova': 'Abrir OS nueva',
    'A O.S. nasce como Solicitada; o gestor confere e programa.': 'La OS nace como Solicitada; el gestor la revisa y la programa.',
    'Comece a digitar o nome': 'Empiece a escribir el nombre',
    'Local': 'Lugar',
    '(não sei)': '(no sé)',
    'Tipo de serviço': 'Tipo de servicio',
    'O que vai fazer': 'Qué va a hacer',
    'Série da máquina (se souber)': 'Serie de la máquina (si la sabe)',
    'Abrir O.S.': 'Abrir OS',
    'Abrindo…': 'Abriendo…',
    'Escolha o cliente da lista.': 'Elija el cliente de la lista.',
    'Descreva o que vai fazer (poucas palavras bastam).': 'Describa lo que va a hacer (bastan pocas palabras).',
    'O.S. {os} aberta.': 'OS {os} abierta.',
    'Sem sinal: a O.S. recebe o número quando o sinal voltar. Pode trabalhar normalmente.': 'Sin señal: la OS recibe el número cuando vuelva la señal. Puede trabajar normalmente.',
    'A O.S. {de} agora é a {para}.': 'La OS {de} ahora es la {para}.',
    'Relógio da O.S.: ': 'Reloj de la OS: ',
    'Aguardando o número da O.S.': 'Esperando el número de la OS',
    'pedido {quando}': 'pedido {quando}',
    'Não consegui baixar a lista de clientes: {erro}': 'No pude descargar la lista de clientes: {erro}',
  };

  const DICIONARIOS = { ES };

  function normalizar(i) { return /^es/i.test(String(i || '')) ? 'ES' : 'PT-BR'; }

  function lerGuardado() {
    try { return localStorage.getItem(CHAVE_LOCAL) || ''; } catch (e) { return ''; }
  }

  let idioma = lerGuardado()
    ? normalizar(lerGuardado())
    : normalizar(/^es/i.test(navigator.language || '') ? 'ES' : 'PT-BR');
  const ouvintes = [];

  function t(pt, vars) {
    const dic = DICIONARIOS[idioma];
    let s = (dic && Object.prototype.hasOwnProperty.call(dic, pt)) ? dic[pt] : pt;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : vars[k]));
    return s;
  }

  // ── HTML fixo ──
  const chaveHtml = s => String(s).replace(/\s+/g, ' ').trim();
  const originaisTexto = new WeakMap();   // nó de texto → texto em português
  const originaisAttr = new WeakMap();    // elemento → { atributo: valor em português }
  const ATRIBUTOS = ['placeholder', 'aria-label', 'title'];

  function traduzirTexto(no) {
    const pai = no.parentNode;
    if (!pai || /^(SCRIPT|STYLE)$/.test(pai.nodeName)) return;
    let orig = originaisTexto.get(no);
    if (orig == null) { orig = no.nodeValue; originaisTexto.set(no, orig); }
    const chave = chaveHtml(orig);
    if (!chave) return;
    const dic = DICIONARIOS[idioma];
    const novo = dic && Object.prototype.hasOwnProperty.call(dic, chave) ? dic[chave] : chave;
    const ini = orig.match(/^\s*/)[0], fim = orig.match(/\s*$/)[0];
    const texto = (dic && dic[chave]) ? ini + novo + fim : orig;
    if (no.nodeValue !== texto) no.nodeValue = texto;
  }

  function traduzirAtributos(el) {
    ATRIBUTOS.forEach(a => {
      if (!el.hasAttribute || !el.hasAttribute(a)) return;
      let mapa = originaisAttr.get(el);
      if (!mapa) { mapa = {}; originaisAttr.set(el, mapa); }
      if (mapa[a] == null) mapa[a] = el.getAttribute(a);
      const chave = chaveHtml(mapa[a]);
      const dic = DICIONARIOS[idioma];
      const novo = dic && Object.prototype.hasOwnProperty.call(dic, chave) ? dic[chave] : mapa[a];
      if (el.getAttribute(a) !== novo) el.setAttribute(a, novo);
    });
  }

  function traduzir(raiz) {
    raiz = raiz || document;
    const alvo = raiz === document ? document.documentElement : raiz;
    const w = document.createTreeWalker(alvo, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const nos = [];
    for (let n = w.currentNode; n; n = w.nextNode()) nos.push(n);
    nos.forEach(n => { if (n.nodeType === 3) traduzirTexto(n); else traduzirAtributos(n); });
    if (raiz === document) document.documentElement.lang = idioma === 'ES' ? 'es' : 'pt-BR';
  }

  function definir(novo) {
    novo = normalizar(novo);
    try { localStorage.setItem(CHAVE_LOCAL, novo); } catch (e) { /* sem guardar, vale só nesta abertura */ }
    if (novo === idioma) return;
    idioma = novo;
    traduzir(document);
    ouvintes.forEach(fn => { try { fn(idioma); } catch (e) { /* um ouvinte não derruba os outros */ } });
  }

  return {
    t,
    traduzir,
    definir,
    normalizar,
    idioma: () => idioma,
    aoMudar: fn => { ouvintes.push(fn); },
    // para o conferir_idiomas.py e para testes
    dicionario: () => ES
  };
})();
// -------- i18n.js v3 --------

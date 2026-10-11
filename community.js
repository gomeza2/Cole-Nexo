(function (global) {
  'use strict';

  const URL = String(global.NEXO_SUPABASE_URL || '').trim();
  const KEY = String(global.NEXO_SUPABASE_PUBLISHABLE_KEY || '').trim();
  const configured = Boolean(URL && KEY && /^https:\/\/.+\.supabase\.co\/?$/.test(URL));
  let client = null;
  let user = null;
  let initialized = false;
  let currentRoom = null;
  let roomChannel = null;
  let roomHeartbeat = null;
  let roomClock = null;
  let localDemoTimer = null;
  let roomFinishingAtZero = false;
  let localDuration = 25;
  let localRemaining = 1500;
  let localEndsAt = null;
  let localRunning = false;
  let activeReportId = '';
  let localAlias = '';
  let localAvatar = '';
  const avatarSet = ['✳','☼','◌','✦','❋','◇','☁','✧'];

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function setStatus(message, bad) {
    const status = document.querySelector('#community-status');
    if (status) {
      status.textContent = String(message || '');
      status.classList.toggle('is-error', Boolean(bad));
    }
  }

  function getClient() {
    if (!configured || !global.supabase || typeof global.supabase.createClient !== 'function') return null;
    try {
      return global.supabase.createClient(URL.replace(/\/$/, ''), KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
        realtime: { params: { eventsPerSecond: 5 } }
      });
    } catch (error) {
      return null;
    }
  }

  function randomNumber(max) {
    try {
      const bytes = new Uint32Array(1);
      global.crypto.getRandomValues(bytes);
      return bytes[0] % max;
    } catch (error) {
      return Math.floor(Math.random() * max);
    }
  }

  function ensureLocalPersona() {
    if (!localAlias) {
      const adjectives = ['Brisa','Cometa','Río','Nube','Marea','Luna','Píxel','Bosque','Chispa','Norte'];
      localAlias = adjectives[randomNumber(adjectives.length)] + ' ' + String(10 + randomNumber(89));
      localAvatar = avatarSet[randomNumber(avatarSet.length)];
    }
  }

  function renderHub() {
    const root = document.querySelector('#app-view');
    if (!root) return;
    ensureLocalPersona();
    root.innerHTML = [
      '<section class="page-content community-page">',
      '<div class="content-heading community-heading"><div><p class="eyebrow">NEXO / COMUNIDAD SEGURA</p><h2>Compartir espacio,<br><em>sin competir.</em></h2><p>Un lugar para concentrarse en compañía o compartir una idea que te dejó pensando. No hay chat privado ni ranking de productividad.</p></div><span class="agenda-date">FASE 02 · COMUNIDAD</span></div>',
      '<div class="community-safety-note"><span aria-hidden="true">◇</span><p><strong>Un espacio con cuidado.</strong> Las salas no muestran tu correo ni nombre real. Las publicaciones del muro son seudónimas y sólo aparecen después de una revisión. No compartas teléfonos, direcciones, escuela ni otros datos personales.</p></div>',
      '<div id="community-auth-area"></div>',
      '<p class="community-status" id="community-status" role="status" aria-live="polite"></p>',
      '<div class="community-grid">',
      '<section class="tool-panel community-focus-panel"><div class="community-section-heading"><div><p class="section-label">01 / SALAS DE ENFOQUE</p><h3>Un bloque, en compañía.</h3><p class="muted">Pomodoro compartido, avatares sencillos y un temporizador sincronizado. Sin mensajes privados ni presión por quién trabaja más.</p></div><span class="community-sticker" aria-hidden="true">◌</span></div><div id="community-room-tools"></div><div id="community-room-stage"></div></section>',
      '<section class="tool-panel community-wall-panel"><div class="community-section-heading"><div><p class="section-label">02 / MURO DE DESCUBRIMIENTOS</p><h3>Ideas que vale la pena pasar.</h3><p class="muted">Una idea, pregunta o aprendizaje breve. Texto solamente; el contenido se revisa antes de publicarse.</p></div><span class="community-sticker community-sticker-lilac" aria-hidden="true">✧</span></div><div id="community-wall-tools"></div><div id="community-wall-list"></div><div id="community-moderation-queue"></div></section>',
      '</div>',
      '<details class="community-rules"><summary>Reglas simples para cuidar el espacio</summary><ul><li>Compartí ideas, no datos personales propios ni de otras personas.</li><li>No se permiten acoso, insultos, contenido sexual, amenazas ni invitaciones a encuentros privados.</li><li>Podés reportar una publicación u ocultar un alias en cualquier momento.</li><li>Los aportes nuevos quedan pendientes hasta que una persona moderadora los apruebe.</li><li>Las salas son para enfocar; no incluyen chat, cámara ni micrófono.</li></ul></details>',
      '</section>',
      '<dialog id="community-report-dialog" class="community-report-dialog"><div class="community-dialog-top"><div><p class="section-label">CUIDEMOS EL MURO</p><h3>¿Qué querés reportar?</h3></div><button type="button" class="icon-btn" data-community-action="close-report" aria-label="Cerrar">×</button></div><p class="muted">El reporte es privado y lo revisa el equipo moderador.</p><label class="field" for="community-report-reason">Motivo<select id="community-report-reason"><option value="bullying">Acoso o insultos</option><option value="private_info">Datos personales</option><option value="unsafe">Contenido inseguro</option><option value="spam">Spam o repetición</option><option value="other">Otro motivo</option></select></label><div class="button-row"><button type="button" class="btn btn-quiet" data-community-action="close-report">Cancelar</button><button type="button" class="btn btn-dark" data-community-action="confirm-report">Enviar reporte</button></div></dialog>'
    ].join('');

    renderAuthArea();
    renderRoomArea();
    renderWallArea();
    if (client && user) {
      loadWall();
      if (user.app_metadata && user.app_metadata.nexo_role === 'moderator') loadModerationQueue();
    }
  }

  function renderAuthArea() {
    const area = document.querySelector('#community-auth-area');
    if (!area) return;
    if (!configured) {
      area.innerHTML = '<div class="community-connection-card"><div><span class="community-connection-pill">VISTA LOCAL</span><h3>La comunidad online aún no está conectada.</h3><p>Podés probar el temporizador y explorar ejemplos marcados como muestra. Las salas compartidas y el muro real se activan al conectar un proyecto Supabase y ejecutar el esquema de la Fase 2.</p></div><span class="community-connection-icon" aria-hidden="true">⌁</span></div>';
      return;
    }
    if (!client) {
      area.innerHTML = '<div class="community-connection-card"><div><span class="community-connection-pill is-warning">REVISAR CONFIGURACIÓN</span><h3>No pudimos inicializar Supabase.</h3><p>Revisá la URL del proyecto y la clave publishable en community-config.js. Nunca uses una clave secret o service_role en el navegador.</p></div></div>';
      return;
    }
    if (!user) {
      area.innerHTML = '<div class="community-connection-card"><div><span class="community-connection-pill">ACCESO A LA COMUNIDAD</span><h3>Entrá para cuidar tu espacio.</h3><p>Usamos una cuenta para limitar abusos y permitir reportes; el muro público no muestra tu cuenta ni tu correo.</p></div><div class="community-auth-buttons"><button type="button" class="btn btn-dark" data-community-action="login-google">Continuar con Google</button><button type="button" class="btn btn-outline" data-community-action="login-discord">Continuar con Discord</button></div></div>';
      return;
    }
    area.innerHTML = '<div class="community-connection-card is-connected"><div class="community-connection-copy"><span class="community-connection-pill is-connected">SESIÓN ACTIVA</span><h3>Estás dentro; usá un alias, no datos personales.</h3><p>La identidad de acceso queda privada. En el muro sólo se muestra un alias aleatorio para ayudar a moderar, reportar y bloquear.</p><div class="community-diagnostics-actions"><button type="button" class="btn btn-outline" data-community-action="diagnostics">Comprobar conexión</button><button type="button" class="btn btn-quiet" data-community-action="logout">Cerrar sesión</button></div><div class="community-diagnostics-results" id="community-diagnostics-results" aria-live="polite"><p>Podés verificar la sesión y la RPC del muro antes de probar las salas con otra cuenta.</p></div></div></div>';
  }

  function renderRoomArea() {
    const tools = document.querySelector('#community-room-tools');
    const stage = document.querySelector('#community-room-stage');
    if (!tools || !stage) return;
    stage.innerHTML = '';
    if (!configured) {
      tools.innerHTML = [
        '<div class="community-demo-banner"><span>DEMO LOCAL · SOLO VOS</span><p>Este reloj de muestra no está conectado con otras personas.</p></div>',
        '<div class="community-demo-room"><div class="community-room-orbit" aria-hidden="true">◌</div><p class="community-eyebrow">UNA PAUSA COMPARTIDA, POR AHORA EN MODO LOCAL</p><strong id="community-demo-clock">25:00</strong><p id="community-demo-status">Listo cuando vos estés.</p><div class="community-duration-row"><label for="community-demo-duration">Duración</label><select id="community-demo-duration"><option value="5">5 min</option><option value="15">15 min</option><option value="25" selected>25 min</option><option value="45">45 min</option></select></div><div class="community-room-actions"><button class="btn btn-dark" type="button" data-community-action="demo-start">Empezar</button><button class="btn btn-quiet" type="button" data-community-action="demo-pause">Pausar</button><button class="btn btn-outline" type="button" data-community-action="demo-reset">Reiniciar</button></div></div>'
      ].join('');
      updateDemoClock();
      return;
    }
    if (!user) {
      tools.innerHTML = '<div class="community-login-required"><span aria-hidden="true">◌</span><p>Iniciá sesión para crear una sala privada o unirte con un código. El cronómetro local de la versión previa sigue en Mi agenda.</p></div>';
      return;
    }
    if (currentRoom) {
      renderRoomStage();
      return;
    }
    tools.innerHTML = [
      '<form id="community-room-create-form" class="community-room-form"><p class="community-eyebrow">CREAR UNA SALA</p><label class="field">Nombre corto<input id="community-room-title" maxlength="48" value="Sala tranquila" required placeholder="Ej. Un bloque de estudio"></label><label class="field">Duración del primer bloque<select id="community-room-duration"><option value="5">5 minutos · prueba</option><option value="15">15 minutos</option><option value="25" selected>25 minutos · Pomodoro</option><option value="45">45 minutos</option></select></label><button class="btn btn-dark btn-full" type="submit">Crear sala ↗</button></form>',
      '<div class="community-room-separator"><span>O SI YA TENÉS UN CÓDIGO</span></div>',
      '<form id="community-room-join-form" class="community-room-form community-room-join-form"><label class="field">Código de sala<input id="community-room-code" maxlength="6" minlength="6" pattern="[A-Za-z0-9]{6}" autocomplete="off" autocapitalize="characters" required placeholder="ABC123"></label><button class="btn btn-outline btn-full" type="submit">Unirme a la sala</button></form>',
      '<p class="community-microcopy">Hasta 12 participantes. El código se comparte sólo con las personas que quieras invitar.</p>'
    ].join('');
  }

  function renderRoomStage() {
    const stage = document.querySelector('#community-room-stage');
    const tools = document.querySelector('#community-room-tools');
    if (!stage || !currentRoom) return;
    if (tools) tools.innerHTML = '';
    const room = currentRoom;
    const hostTools = room.is_host ? [
      '<label class="community-duration-select" for="community-room-live-duration">Bloque<select id="community-room-live-duration"><option value="5" '+(room.duration_minutes===5?'selected':'')+'>5 min</option><option value="15" '+(room.duration_minutes===15?'selected':'')+'>15 min</option><option value="25" '+(room.duration_minutes===25?'selected':'')+'>25 min</option><option value="45" '+(room.duration_minutes===45?'selected':'')+'>45 min</option></select></label>',
      '<button type="button" class="btn btn-dark" data-community-action="room-start">'+(room.session_status==='running'?'Reiniciar bloque':'Empezar bloque')+'</button>',
      (room.session_status==='running'?'<button type="button" class="btn btn-quiet" data-community-action="room-pause">Pausar</button>':''),
      (room.session_status==='paused'?'<button type="button" class="btn btn-quiet" data-community-action="room-resume">Continuar</button>':''),
      (room.session_status==='running'||room.session_status==='paused'?'<button type="button" class="btn btn-outline" data-community-action="room-finish">Terminar bloque</button>':'')
    ].join('') : '<p class="community-microcopy">El anfitrión controla el temporizador compartido; vos podés enfocarte o salir cuando quieras.</p>';
    stage.innerHTML = [
      '<article class="community-live-room"><div class="community-live-room-top"><div><p class="community-eyebrow">SALA EN VIVO</p><h4>'+escapeHTML(room.title)+'</h4></div><span class="community-room-code"><small>CÓDIGO PARA INVITAR</small><strong>'+escapeHTML(room.join_code)+'</strong><button type="button" class="community-copy-code" data-community-action="copy-room-code">Copiar</button></span></div>',
      '<div class="community-live-clock-wrap"><span class="community-room-live-orbit" aria-hidden="true">✧</span><strong id="community-live-clock">25:00</strong><span id="community-live-session-label">'+escapeHTML(sessionLabel(room.session_status))+'</span></div>',
      '<div class="community-participants-wrap"><div class="community-participants-heading"><strong>Personas en la sala</strong><span id="community-participant-count">1</span></div><div class="community-participants" id="community-participants"><span class="community-person"><i>'+escapeHTML(localAvatar)+'</i>'+escapeHTML(localAlias)+'</span></div></div>',
      '<div class="community-room-actions">'+hostTools+'<button type="button" class="btn btn-quiet" data-community-action="room-leave">Salir de la sala</button></div>',
      '<p class="community-microcopy" id="community-room-message">El cronómetro se sincroniza; no hay chat, cámara ni micrófono.</p></article>'
    ].join('');
    renderRoomPresence();
    updateLiveClock();
  }

  function sessionLabel(status) {
    return ({idle:'Listos cuando quieran',running:'Bloque en curso · cada quien a su ritmo',paused:'En pausa',finished:'Bloque finalizado'})[status] || 'Sala tranquila';
  }

  function renderRoomPresence() {
    const root = document.querySelector('#community-participants');
    const count = document.querySelector('#community-participant-count');
    const countLabel = document.querySelector('#community-participant-count');
    if (!root || !currentRoom) return;
    let participants = [];
    try {
      const raw = roomChannel && roomChannel.presenceState ? roomChannel.presenceState() : {};
      Object.keys(raw || {}).forEach(function (key) {
        (raw[key] || []).forEach(function (entry) {
          const meta = entry && entry.meta ? entry.meta : entry;
          if (meta && typeof meta.alias === 'string') participants.push({alias:meta.alias,avatar:String(meta.avatar||'✳').slice(0,4)});
        });
      });
    } catch (error) {}
    if (!participants.some(function (p) { return p.alias === localAlias; })) participants.unshift({alias:localAlias,avatar:localAvatar});
    const seen = new Set();
    participants = participants.filter(function (p) { if (seen.has(p.alias)) return false; seen.add(p.alias); return true; }).slice(0,12);
    root.innerHTML = participants.map(function (person) {
      return '<span class="community-person"><i>'+escapeHTML(person.avatar)+'</i>'+escapeHTML(person.alias)+'</span>';
    }).join('');
    if (count) count.textContent = String(participants.length) + '/12';
    if (countLabel) countLabel.title = 'Presencia activa en la sala';
  }

  function updateDemoClock() {
    const clock = document.querySelector('#community-demo-clock');
    const status = document.querySelector('#community-demo-status');
    if (!clock) return;
    if (localRunning && localEndsAt) localRemaining = Math.max(0, Math.ceil((localEndsAt - Date.now()) / 1000));
    clock.textContent = formatTime(localRemaining);
    if (status) status.textContent = localRunning ? 'Un momento a la vez. El reloj sigue mientras esta pestaña está abierta.' : localRemaining === 0 ? 'Bloque terminado. Podés descansar o reiniciar.' : 'Listo cuando vos estés.';
    if (localRunning && localRemaining <= 0) {
      localRunning = false;
      localEndsAt = null;
      if (localDemoTimer) clearInterval(localDemoTimer);
      localDemoTimer = null;
    }
  }

  function updateLiveClock() {
    const clock = document.querySelector('#community-live-clock');
    const label = document.querySelector('#community-live-session-label');
    if (!clock || !currentRoom) return;
    let remaining = Math.max(0, Number(currentRoom.remaining_seconds) || 0);
    if (currentRoom.session_status === 'running' && currentRoom.session_ends_at) {
      const end = Date.parse(currentRoom.session_ends_at);
      if (Number.isFinite(end)) remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    }
    clock.textContent = formatTime(remaining);
    if (label) label.textContent = sessionLabel(currentRoom.session_status);
    if (currentRoom.session_status === 'running' && remaining === 0 && currentRoom.is_host && !roomFinishingAtZero) {
      roomFinishingAtZero = true;
      roomAction('finish_focus_session').finally(function () { roomFinishingAtZero = false; });
    }
  }

  function formatTime(seconds) {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    return String(Math.floor(n / 60)).padStart(2,'0') + ':' + String(n % 60).padStart(2,'0');
  }

  function normalizeRoom(data) {
    if (!data || typeof data !== 'object') return null;
    return {
      id: data.id,
      title: String(data.title || 'Sala tranquila'),
      join_code: String(data.join_code || ''),
      session_status: String(data.session_status || 'idle'),
      duration_minutes: Number(data.duration_minutes) || 25,
      session_ends_at: data.session_ends_at || null,
      remaining_seconds: Math.max(0, Number(data.remaining_seconds) || 0),
      is_host: data.is_host === true,
      participant_count: Math.max(1, Number(data.participant_count) || 1),
      max_participants: Math.max(2, Math.min(12, Number(data.max_participants) || 12))
    };
  }

  function updateCurrentRoom(room) {
    const normalized = normalizeRoom(room);
    if (!normalized) return;
    currentRoom = normalized;
    renderRoomStage();
    broadcastRoomState();
  }

  async function broadcastRoomState() {
    if (!roomChannel || !currentRoom || !currentRoom.is_host) return;
    try {
      await roomChannel.send({type:'broadcast', event:'focus-state', payload:{
        id:currentRoom.id,
        title:currentRoom.title,
        join_code:currentRoom.join_code,
        session_status:currentRoom.session_status,
        duration_minutes:currentRoom.duration_minutes,
        session_ends_at:currentRoom.session_ends_at,
        remaining_seconds:currentRoom.remaining_seconds,
        participant_count:currentRoom.participant_count,
        max_participants:currentRoom.max_participants
      }});
    } catch (error) {}
  }

  function clearRoomSubscriptions() {
    if (roomHeartbeat) clearInterval(roomHeartbeat);
    if (roomClock) clearInterval(roomClock);
    roomHeartbeat = null;
    roomClock = null;
    if (roomChannel && client) {
      try { client.removeChannel(roomChannel); } catch (error) {}
    }
    roomChannel = null;
  }

  async function connectRoomChannel(roomId) {
    if (!client || !currentRoom || currentRoom.id !== roomId) return;
    if (roomChannel && roomChannel.topic === 'realtime:nexo-focus:' + roomId) return;
    clearRoomSubscriptions();
    let presenceKey;
    try { presenceKey = global.crypto.randomUUID(); } catch (error) { presenceKey = String(Date.now()) + '-' + randomNumber(1000000); }
    ensureLocalPersona();
    roomChannel = client.channel('nexo-focus:' + roomId, {
      config: { private:true, presence:{key:presenceKey}, broadcast:{ack:true,self:false} }
    });
    roomChannel
      .on('presence', {event:'sync'}, renderRoomPresence)
      .on('broadcast', {event:'focus-state'}, function (message) {
        const payload = message && message.payload;
        if (!payload || payload.id !== currentRoom?.id) return;
        if (payload.room_closed) {
          clearRoomSubscriptions();
          currentRoom = null;
          renderHub();
          setStatus('El anfitrión cerró la sala. Podés crear otra o entrar con un nuevo código.');
          return;
        }
        currentRoom = Object.assign({}, currentRoom, payload);
        renderRoomStage();
      })
      .subscribe(async function (status) {
        if (status === 'SUBSCRIBED') {
          try {
            await roomChannel.track({alias:localAlias,avatar:localAvatar});
            const refreshed = await client.rpc('heartbeat_focus_room', {p_room_id:roomId});
            if (!refreshed.error && refreshed.data) currentRoom = normalizeRoom(refreshed.data);
            setRoomMessage('Conectado. Tu alias es temporal y no muestra tu cuenta.');
            renderRoomStage();
          } catch (error) {
            setRoomMessage('Se conectó la sala, pero no pudimos actualizar la presencia. Probá volver a entrar.');
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRoomMessage('Se perdió la conexión en tiempo real. Revisá el proyecto Supabase y volvé a intentar.');
        }
      });
    roomHeartbeat = setInterval(async function () {
      if (!currentRoom || currentRoom.id !== roomId || document.visibilityState !== 'visible') return;
      try {
        const refreshed = await client.rpc('heartbeat_focus_room', {p_room_id:roomId});
        if (refreshed.error) {
          setRoomMessage('La membresía expiró. Salí y volvé a entrar con el código para reconectar.');
          return;
        }
        currentRoom = normalizeRoom(refreshed.data);
        renderRoomPresence();
      } catch (error) {}
    }, 30000);
    roomClock = setInterval(updateLiveClock, 1000);
  }

  function setRoomMessage(message) {
    const node = document.querySelector('#community-room-message');
    if (node) node.textContent = message;
  }

  async function enterRoom(roomId, roomData) {
    if (!client || !user || !isUuid(roomId)) {
      setStatus('Primero iniciá sesión y conectá Supabase.', true);
      return;
    }
    let data = roomData;
    if (!data) {
      const result = await client.rpc('get_focus_room', {p_room_id:roomId});
      if (result.error) {
        setStatus(errorMessage(result.error), true);
        return;
      }
      data = result.data;
    }
    currentRoom = normalizeRoom(data);
    if (!currentRoom) {
      setStatus('No pudimos abrir esa sala.', true);
      return;
    }
    renderRoomStage();
    await connectRoomChannel(currentRoom.id);
    setStatus('Sala abierta. Invitá sólo a personas con las que te sientas cómodo/a.');
  }

  async function createRoom(form) {
    if (!client || !user) return;
    const title = String(form.querySelector('#community-room-title')?.value || '').trim().slice(0,48);
    const duration = Number(form.querySelector('#community-room-duration')?.value || 25);
    if (!title) {
      setStatus('Poné un nombre corto para la sala.', true);
      return;
    }
    const result = await client.rpc('create_focus_room', {p_title:title,p_duration_minutes:duration});
    if (result.error) {
      setStatus(errorMessage(result.error), true);
      return;
    }
    const room = normalizeRoom(result.data);
    if (!room || !isUuid(room.id)) {
      setStatus('Supabase no devolvió una sala válida. Revisá la migración de Fase 2.', true);
      return;
    }
    await enterRoom(room.id, room);
  }

  async function joinRoom(form) {
    if (!client || !user) return;
    const code = String(form.querySelector('#community-room-code')?.value || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setStatus('El código tiene que tener seis letras o números.', true);
      return;
    }
    const result = await client.rpc('join_focus_room', {p_join_code:code});
    if (result.error) {
      setStatus(errorMessage(result.error), true);
      return;
    }
    const room = normalizeRoom(result.data);
    if (!room || !isUuid(room.id)) {
      setStatus('No encontramos una sala abierta con ese código.', true);
      return;
    }
    await enterRoom(room.id, room);
  }

  function roomAction(functionName) {
    return (async function () {
      if (!client || !user || !currentRoom) return;
      const id = currentRoom.id;
      let result;
      if (functionName === 'start_focus_session') {
        const duration = Number(document.querySelector('#community-room-live-duration')?.value || currentRoom.duration_minutes || 25);
        result = await client.rpc(functionName, {p_room_id:id,p_duration_minutes:duration});
      } else {
        result = await client.rpc(functionName, {p_room_id:id});
      }
      if (result.error) {
        setStatus(errorMessage(result.error), true);
        return;
      }
      if (result.data && typeof result.data === 'object' && result.data.id) {
        updateCurrentRoom(result.data);
      }
    })();
  }

  async function leaveRoom() {
    if (!client || !currentRoom) return;
    const id = currentRoom.id;
    if (currentRoom.is_host && roomChannel) {
      try { await roomChannel.send({type:'broadcast',event:'focus-state',payload:{id:id,session_status:'finished',remaining_seconds:0,session_ends_at:null,room_closed:true}}); } catch (error) {}
    }
    await client.rpc('leave_focus_room', {p_room_id:id});
    clearRoomSubscriptions();
    currentRoom = null;
    roomFinishingAtZero = false;
    renderHub();
  }

  function renderWallArea() {
    const tools = document.querySelector('#community-wall-tools');
    const list = document.querySelector('#community-wall-list');
    if (!tools || !list) return;
    if (!configured) {
      tools.innerHTML = '<div class="community-demo-banner"><span>SOLO EJEMPLOS</span><p>Estas tarjetas son de muestra, no publicaciones de otras personas.</p></div>';
      list.innerHTML = [
        demoPost('Algo que aprendí: hacer una pregunta mejor a veces ayuda más que buscar una respuesta rápida.','Anónimo · Muestra'),
        demoPost('Una idea que me quedó dando vueltas: hay varias maneras de resolver el mismo problema.','Anónimo · Muestra'),
        demoPost('Esta semana me gustó descubrir una cosa nueva aunque no la terminara de entender.','Anónimo · Muestra')
      ].join('');
      return;
    }
    if (!user) {
      tools.innerHTML = '<div class="community-login-required"><span aria-hidden="true">✧</span><p>Cuando inicies sesión vas a poder leer las publicaciones aprobadas, compartir una idea y reportar contenido.</p></div>';
      list.innerHTML = '<div class="community-empty">El muro está protegido hasta iniciar sesión.</div>';
      return;
    }
    tools.innerHTML = '<form id="community-post-form" class="community-post-form"><label class="field" for="community-post-body">Compartí una idea, aprendizaje o pregunta<textarea id="community-post-body" maxlength="400" minlength="12" rows="4" required placeholder="Una idea que me sorprendió fue…"></textarea></label><div class="community-post-form-footer"><span id="community-post-length">0/400</span><button class="btn btn-dark" type="submit">Enviar a revisión ↗</button></div><p class="community-microcopy">12–400 caracteres. Sin enlaces, nombres, correo, teléfono ni datos privados. Tu publicación no aparece hasta que la revise una persona moderadora.</p><p id="community-post-status" class="community-status" role="status" aria-live="polite"></p></form>';
    list.innerHTML = '<div class="community-empty">Cargando publicaciones aprobadas…</div>';
  }

  function demoPost(body, author) {
    return '<article class="community-post is-demo"><div class="community-post-label">MUESTRA · NO ES UNA PUBLICACIÓN REAL</div><p>'+escapeHTML(body)+'</p><footer><span>'+escapeHTML(author)+'</span></footer></article>';
  }

  async function loadWall() {
    if (!client || !user || !document.querySelector('#community-wall-list')) return;
    const list = document.querySelector('#community-wall-list');
    list.innerHTML = '<div class="community-empty">Cargando ideas…</div>';
    const result = await client.rpc('get_discovery_wall', {p_limit:20});
    if (result.error) {
      list.innerHTML = '<div class="community-empty">No pudimos cargar el muro. Revisá que hayas ejecutado supabase/phase2-community.sql.</div>';
      return;
    }
    const posts = Array.isArray(result.data) ? result.data : [];
    list.innerHTML = posts.length ? posts.map(function (post) {
      const date = new Date(post.created_at);
      const label = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-AR',{day:'numeric',month:'short'});
      return '<article class="community-post"><div class="community-post-label">IDEA COMPARTIDA</div><p>'+escapeHTML(post.body)+'</p><footer><span>'+escapeHTML(post.author_label || 'Anónimo')+' · '+escapeHTML(label)+'</span><div class="community-post-tools"><button type="button" data-community-action="report-post" data-post-id="'+escapeHTML(post.post_id)+'">Reportar</button><button type="button" data-community-action="block-alias" data-alias-id="'+escapeHTML(post.author_alias_id)+'">Ocultar alias</button></div></footer></article>';
    }).join('') : '<div class="community-empty">Todavía no hay ideas aprobadas. Podés enviar la primera; aparecerá cuando la revise el equipo.</div>';
  }

  async function submitPost(form) {
    if (!client || !user) return;
    const input = form.querySelector('#community-post-body');
    const button = form.querySelector('button[type="submit"]');
    const body = String(input?.value || '').trim();
    if (body.length < 12 || body.length > 400) {
      setPostStatus('Escribí entre 12 y 400 caracteres.', true);
      return;
    }
    if (button) button.disabled = true;
    setPostStatus('Enviando a revisión…');
    const result = await client.rpc('create_discovery_post', {p_body:body});
    if (button) button.disabled = false;
    if (result.error) {
      setPostStatus(errorMessage(result.error), true);
      return;
    }
    form.reset();
    updatePostLength();
    setPostStatus('Tu aporte quedó pendiente de revisión. No se publicó todavía.');
    setStatus('Gracias por compartir una idea. Primero la revisa una persona moderadora.');
    await loadWall();
  }

  function setPostStatus(message, bad) {
    const node = document.querySelector('#community-post-status');
    if (node) {
      node.textContent = String(message || '');
      node.classList.toggle('is-error', Boolean(bad));
    }
  }

  function updatePostLength() {
    const input = document.querySelector('#community-post-body');
    const label = document.querySelector('#community-post-length');
    if (input && label) label.textContent = input.value.length + '/400';
  }

  async function openReport(postId) {
    if (!isUuid(postId)) return;
    activeReportId = postId;
    const dialog = document.querySelector('#community-report-dialog');
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  }

  async function confirmReport() {
    if (!client || !user || !isUuid(activeReportId)) return;
    const reason = String(document.querySelector('#community-report-reason')?.value || 'other');
    const result = await client.rpc('report_discovery_post',{p_post_id:activeReportId,p_reason:reason});
    const dialog = document.querySelector('#community-report-dialog');
    if (dialog && dialog.open) dialog.close();
    if (result.error) setStatus(errorMessage(result.error),true);
    else setStatus('Gracias. El reporte quedó registrado para revisión.');
    activeReportId = '';
  }

  async function blockAlias(aliasId) {
    if (!client || !user || !isUuid(aliasId)) return;
    if (!global.confirm('¿Ocultar las publicaciones de este alias en tu muro? Podés seguir usando NEXO sin interactuar con esta persona.')) return;
    const result = await client.rpc('block_community_alias',{p_alias_id:aliasId});
    if (result.error) {
      setStatus(errorMessage(result.error),true);
      return;
    }
    setStatus('Listo. Las publicaciones de ese alias dejarán de aparecer en tu muro.');
    await loadWall();
  }

  async function loadModerationQueue() {
    const root = document.querySelector('#community-moderation-queue');
    if (!root || !client || !user || !user.app_metadata || user.app_metadata.nexo_role !== 'moderator') return;
    root.innerHTML = '<div class="community-moderation"><p class="section-label">HERRAMIENTAS DE MODERACIÓN</p><h3>Revisión de publicaciones</h3><p class="muted">Pendientes o publicaciones aprobadas con reportes.</p><div class="community-empty">Cargando cola…</div></div>';
    const result = await client.rpc('get_discovery_moderation_queue',{p_limit:30});
    if (result.error) {
      root.innerHTML = '<div class="community-moderation"><h3>No pudimos cargar la cola.</h3><p class="muted">La cuenta necesita el permiso de moderación asignado desde el panel de administración de Supabase.</p></div>';
      return;
    }
    const posts = Array.isArray(result.data) ? result.data : [];
    root.innerHTML = '<div class="community-moderation"><p class="section-label">HERRAMIENTAS DE MODERACIÓN</p><h3>Revisión de publicaciones</h3><p class="muted">Aprobar sólo contenido apropiado. Retirar lo que incluya acoso, datos personales o riesgos.</p>' +
      (posts.length ? posts.map(function (post) {
        const reasons = Array.isArray(post.report_reasons) ? post.report_reasons.join(', ') : '';
        return '<article class="community-moderation-item"><div class="community-post-label">'+escapeHTML(post.status)+' · '+Number(post.report_count||0)+' reportes</div><p>'+escapeHTML(post.body)+'</p><small>'+escapeHTML(post.author_label||'Anónimo')+(reasons?' · Motivos: '+escapeHTML(reasons):'')+'</small><div class="community-room-actions">'+(post.status==='pending'?'<button type="button" class="btn btn-dark" data-community-action="moderate-post" data-post-id="'+escapeHTML(post.post_id)+'" data-status="approved">Aprobar</button>':'')+'<button type="button" class="btn btn-quiet" data-community-action="moderate-post" data-post-id="'+escapeHTML(post.post_id)+'" data-status="rejected">Rechazar</button><button type="button" class="btn btn-outline" data-community-action="moderate-post" data-post-id="'+escapeHTML(post.post_id)+'" data-status="removed">Retirar</button></div></article>';
      }).join('') : '<div class="community-empty">La cola está vacía.</div>') + '</div>';
  }

  async function moderatePost(postId, status) {
    if (!client || !user || !isUuid(postId) || !['approved','rejected','removed'].includes(status)) return;
    const result = await client.rpc('moderate_discovery_post',{p_post_id:postId,p_status:status});
    if (result.error) {
      setStatus(errorMessage(result.error),true);
      return;
    }
    setStatus(status==='approved'?'Publicación aprobada y visible en el muro.':status==='removed'?'Publicación retirada del muro.':'Publicación rechazada.');
    await loadModerationQueue();
    await loadWall();
  }

  function renderDiagnostics(items) {
    const host = document.querySelector('#community-diagnostics-results');
    if (!host) return;
    host.innerHTML = '<div class="community-diagnostic-list">' + items.map(function (item) {
      const kind = item.manual ? 'is-manual' : item.ok ? 'is-ok' : 'is-error';
      const label = item.manual ? 'PRUEBA MANUAL' : item.ok ? 'OK' : 'REVISAR';
      return '<div class="community-diagnostic-row ' + kind + '"><div><strong>' + escapeHTML(item.label) + '</strong><p>' + escapeHTML(item.details) + '</p></div><span>' + label + '</span></div>';
    }).join('') + '</div>';
  }

  async function runConnectionDiagnostics(button) {
    const trigger = button || document.querySelector('[data-community-action="diagnostics"]');
    const host = document.querySelector('#community-diagnostics-results');
    if (!host) return;
    if (!configured) {
      renderDiagnostics([{label:'Configuración de Supabase',ok:false,details:'Completá URL y publishable key en community-config.js.'}]);
      return;
    }
    if (!client) {
      renderDiagnostics([{label:'Cliente Supabase',ok:false,details:'No se inicializó el SDK. Revisá la carga de @supabase/supabase-js y la URL/configuración del proyecto.'}]);
      return;
    }
    if (trigger) {
      trigger.disabled = true;
      trigger.textContent = 'Comprobando…';
    }
    host.innerHTML = '<p>Comprobando sesión y permisos del muro…</p>';
    const items = [];
    try {
      const authResult = await client.auth.getUser();
      if (authResult.error || !authResult.data || !authResult.data.user) {
        items.push({
          label: 'Sesión del servidor',
          ok: false,
          details: 'Supabase no pudo validar la sesión actual. Cerrá sesión, volvé a ingresar y revisá Auth → URL Configuration si hay problemas de redirección.'
        });
        items.push({
          label: 'RPC del muro',
          ok: false,
          details: 'No se probó porque la sesión no quedó validada.'
        });
        items.push({
          label: 'Salas en tiempo real con dos cuentas',
          manual: true,
          details: 'Pendiente: requiere abrir una sala en una cuenta de prueba y entrar desde un segundo perfil de navegador.'
        });
        renderDiagnostics(items);
        setStatus('No se pudo validar la sesión con Supabase. Revisá la configuración de Auth y volvé a iniciar sesión.', true);
        return;
      }

      user = authResult.data.user;
      items.push({
        label: 'Sesión del servidor',
        ok: true,
        details: 'Supabase validó la sesión iniciada.'
      });

      const wallResult = await client.rpc('get_discovery_wall', {p_limit:1});
      if (wallResult.error) {
        items.push({
          label: 'RPC y permisos del muro',
          ok: false,
          details: 'No respondió get_discovery_wall. Confirmá que ejecutaste supabase/phase2-community.sql y revisá los permisos de authenticated.'
        });
      } else {
        items.push({
          label: 'RPC y permisos del muro',
          ok: true,
          details: 'get_discovery_wall respondió. Esto no valida por sí solo todas las políticas ni las funciones de las salas.'
        });
      }
      items.push({
        label: 'Salas en tiempo real con dos cuentas',
        manual: true,
        details: 'Pendiente: requiere abrir una sala en una cuenta de prueba y entrar desde un segundo perfil de navegador.'
      });
      renderDiagnostics(items);

      const checked = items.filter(function (item) { return !item.manual; });
      const passed = checked.filter(function (item) { return item.ok; }).length;
      if (passed === checked.length) {
        setStatus('Comprobación básica aprobada (' + passed + '/' + checked.length + '). La prueba multiusuario de Realtime sigue pendiente.', false);
      } else {
        setStatus('La comprobación básica quedó incompleta (' + passed + '/' + checked.length + '). Revisá los detalles antes de probar con otras cuentas.', true);
      }
    } catch (error) {
      items.push({
        label: 'Conexión / permisos',
        ok: false,
        details: 'Ocurrió un error de red o del SDK. Revisá el dominio del proyecto, la consola del navegador y el estado de Supabase.'
      });
      items.push({
        label: 'Salas en tiempo real con dos cuentas',
        manual: true,
        details: 'Pendiente: requiere una prueba manual una vez corregida la conexión.'
      });
      renderDiagnostics(items);
      setStatus('No se completó el diagnóstico. Revisá la configuración de Supabase e intentá nuevamente.', true);
    } finally {
      if (trigger && trigger.isConnected) {
        trigger.disabled = false;
        trigger.textContent = 'Volver a comprobar';
      }
    }
  }

  async function authAction(provider) {
    if (!client) {
      setStatus('Primero configurá la URL y la clave publishable de Supabase.',true);
      return;
    }
    if (provider === 'logout') {
      if (currentRoom) await leaveRoom();
      const result = await client.auth.signOut();
      if (result.error) setStatus(errorMessage(result.error),true);
      user = null;
      renderHub();
      return;
    }
    const result = await client.auth.signInWithOAuth({
      provider:provider,
      options:{redirectTo:global.location.origin + global.location.pathname}
    });
    if (result.error) setStatus(errorMessage(result.error),true);
  }

  function errorMessage(error) {
    const raw = String(error && (error.message || error.details || error.hint) || 'No se pudo completar la acción.');
    if (/rate|limit|54000/i.test(raw)) return 'Llegaste al límite temporal de esta acción. Volvé a intentarlo más tarde.';
    if (/not found|closed|P0002/i.test(raw)) return 'No encontramos una sala activa con ese código.';
    if (/42501|permission|policy|moderator/i.test(raw)) return 'Tu cuenta no tiene permiso para esa acción. Revisá la sesión y la configuración de seguridad.';
    if (/personal|email|phone-like|22023|character|between/i.test(raw)) return 'El texto no cumple las reglas de privacidad o la longitud permitida. Quitá enlaces y datos personales.';
    return raw.slice(0,220);
  }

  function startDemo() {
    if (localRunning) return;
    if (localRemaining <= 0) localRemaining = localDuration * 60;
    localRunning = true;
    localEndsAt = Date.now() + localRemaining * 1000;
    if (localDemoTimer) clearInterval(localDemoTimer);
    localDemoTimer = setInterval(updateDemoClock, 500);
    updateDemoClock();
  }

  function pauseDemo() {
    if (localRunning && localEndsAt) localRemaining = Math.max(0,Math.ceil((localEndsAt-Date.now())/1000));
    localRunning = false;
    localEndsAt = null;
    if (localDemoTimer) clearInterval(localDemoTimer);
    localDemoTimer = null;
    updateDemoClock();
  }

  function resetDemo() {
    pauseDemo();
    localDuration = Number(document.querySelector('#community-demo-duration')?.value || 25);
    localRemaining = localDuration * 60;
    updateDemoClock();
  }

  async function handleAction(action, button) {
    try {
      if (action === 'diagnostics') return await runConnectionDiagnostics(button);
      if (action === 'login-google') return await authAction('google');
      if (action === 'login-discord') return await authAction('discord');
      if (action === 'logout') return await authAction('logout');
      if (action === 'demo-start') return startDemo();
      if (action === 'demo-pause') return pauseDemo();
      if (action === 'demo-reset') return resetDemo();
      if (action === 'room-leave') return leaveRoom();
      if (action === 'room-start') return roomAction('start_focus_session');
      if (action === 'room-pause') return roomAction('pause_focus_session');
      if (action === 'room-resume') return roomAction('resume_focus_session');
      if (action === 'room-finish') return roomAction('finish_focus_session');
      if (action === 'copy-room-code') {
        if (!currentRoom) return;
        try {
          await global.navigator.clipboard.writeText(currentRoom.join_code);
          setRoomMessage('Código copiado. Compartilo sólo con quienes quieras invitar.');
        } catch (error) {
          setRoomMessage('Código de la sala: ' + currentRoom.join_code);
        }
        return;
      }
      if (action === 'report-post') return await openReport(button?.dataset.postId);
      if (action === 'confirm-report') return await confirmReport();
      if (action === 'close-report') {
        const dialog = document.querySelector('#community-report-dialog');
        if (dialog && dialog.open) dialog.close();
        activeReportId = '';
        return;
      }
      if (action === 'block-alias') return await blockAlias(button?.dataset.aliasId);
      if (action === 'moderate-post') return await moderatePost(button?.dataset.postId,button?.dataset.status);
    } catch (error) {
      setStatus(errorMessage(error),true);
    }
  }

  function wireForms() {
    document.addEventListener('submit',function (event) {
      const form = event.target;
      if (form.id === 'community-room-create-form') {
        event.preventDefault();
        createRoom(form);
      } else if (form.id === 'community-room-join-form') {
        event.preventDefault();
        joinRoom(form);
      } else if (form.id === 'community-post-form') {
        event.preventDefault();
        submitPost(form);
      }
    });
    document.addEventListener('click',function (event) {
      const button = event.target.closest('[data-community-action]');
      if (!button) return;
      const action = button.dataset.communityAction;
      handleAction(action,button);
    });
    document.addEventListener('input',function (event) {
      if (event.target && event.target.id === 'community-post-body') updatePostLength();
    });
    document.addEventListener('change',function (event) {
      if (event.target && event.target.id === 'community-demo-duration') {
        if (localRunning) pauseDemo();
        localDuration = Number(event.target.value) || 25;
        localRemaining = localDuration * 60;
        updateDemoClock();
      }
    });
    document.addEventListener('visibilitychange',function () {
      if (document.visibilityState === 'visible' && currentRoom && client) {
        client.rpc('join_focus_room',{p_join_code:currentRoom.join_code}).then(function (result) {
          if (!result.error && result.data) {
            currentRoom = normalizeRoom(result.data);
            renderRoomStage();
          }
        }).catch(function () {});
      }
    });
  }

    async function refresh() {
    if (!client) return;
    const wasOnCommunity = Boolean(document.querySelector('.community-page'));
    const response = await client.auth.getSession();
    user = response.data && response.data.session ? response.data.session.user : null;
    if (wasOnCommunity) renderHub();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    client = getClient();
    wireForms();
    if (!client) return;
    client.auth.onAuthStateChange(function (_event, session) {
      user = session ? session.user : null;
      global.setTimeout(function () {
        if (document.querySelector('.community-page')) renderHub();
      },0);
    });
    refresh().catch(function () {
      user = null;
      renderHub();
    });
  }

  global.NexoCommunity = {
    renderHub: renderHub,
    handleAction: handleAction,
    refresh: refresh,
    isConnected: function () { return Boolean(client && user); }
  };
  init();
})(window);

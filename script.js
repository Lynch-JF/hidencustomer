// ============================================================
//  CONFIGURACIÓN
// ============================================================
const API_HOJA_PROCESO   = "https://api.sheetbest.com/sheets/7793c015-368c-456b-a175-0fc6cc94821f";
const API_HOJA_HISTORIAL = "https://api.sheetbest.com/sheets/cce35084-ee62-4934-b2ed-eb5fcd2d414b";

// ── Umbral de referencias para sugerir equipo ──────────────
const UMBRAL_EQUIPO = 100; // Cambia este valor según tu criterio

let taskList     = document.getElementById("task-list");
let timers       = {};
let pausedTimers = {};

// ============================================================
//  HORARIOS
// ============================================================
const dayPausas = {
  1: "18:00:00", 2: "18:00:00", 3: "18:00:00",
  4: "18:00:00", 5: "17:00:00", 6: "12:00:00"
};

const INDIVIDUAL_PAUSES = {
  "Omar Marmolejos Fajardo":          { pausa: "13:00:00", reanuda: "14:00:00" },
  "Jairo Fernandez Salcedo":          { pausa: "13:00:00", reanuda: "14:00:00" },
  "Ismael Augusto Veras Lasuse":      { pausa: "13:00:00", reanuda: "14:00:00" },
  "Fernando Antonio Burgos Cabrera":  { pausa: "13:00:00", reanuda: "14:00:00" },
  "Juan De Jesús Peña Pérez":         { pausa: "13:00:00", reanuda: "14:00:00" },
  "Luis David Nuñez Santos":          { pausa: "13:00:00", reanuda: "14:00:00" },
  "Yustin Alexander Mendez":          { pausa: "13:00:00", reanuda: "14:00:00" },
  "Luis Eduardo Reyes":               { pausa: "13:00:00", reanuda: "14:00:00" },
  "Omelbe Gomez Valdez":              { pausa: "13:00:00", reanuda: "14:00:00" },
  "Bryhan Santo Cordero":             { pausa: "13:00:00", reanuda: "14:00:00" },
  "Enrique Nuñez Brito":              { pausa: "13:00:00", reanuda: "14:00:00" },
  "Cirilo Reynoso Acevedo":           { pausa: "13:00:00", reanuda: "14:00:00" },
  "Yan Carlos Cruz Paulino":          { pausa: "13:00:00", reanuda: "14:00:00" },
  "Wilkin Ortega Diaz":               { pausa: "13:00:00", reanuda: "14:00:00" }
};

const HORAS_SALIDA = {
  "Omar Marmolejos Fajardo":         "18:00:00",
  "Jairo Fernandez Salcedo":         "18:00:00",
  "Ismael Augusto Veras Lasuse":     "18:00:00",
  "Juan De Jesús Peña Pérez":        "18:00:00",
  "Fernando Antonio Burgos Cabrera": "18:00:00"
};

const TODOS_LOS_SACADORES = [
  "Omar Marmolejos Fajardo",
  "Jairo Fernandez Salcedo",
  "Ismael Augusto Veras Lasuse",
  "Fernando Antonio Burgos Cabrera",
  "Juan De Jesús Peña Pérez",
  "Luis David Nuñez Santos",
  "Yustin Alexander Mendez",
  "Luis Eduardo Reyes",
  "Omelbe Gomez Valdez",
  "Bryhan Santo Cordero",
  "Enrique Nuñez Brito",
  "Cirilo Reynoso Acevedo",
  "Yan Carlos Cruz Paulino",
  "Wilkin Ortega Diaz"
];

// ============================================================
//  UTILIDADES DE FORMATO
// ============================================================
function pad(n) { return String(n).padStart(2, "0"); }

function formatDateTime(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ` +
         `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatTime(totalSeconds) {
  totalSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatearFecha(timestamp) {
  const d = new Date(timestamp);
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

window.formatDateTime = formatDateTime;
window.formatTime     = formatTime;

// ============================================================
//  CÁLCULO DE ELAPSED
// ============================================================
function calcularElapsedMs(data, nowMs) {
  if (data.finalizado) return data.elapsedMsFinal || 0;
  let base = data.paused
    ? (data.pausedAt || nowMs) - data.startTimestamp
    : nowMs - data.startTimestamp;
  return Math.max(0, base - (data.pausedDuration || 0));
}

// ============================================================
//  TIMER
// ============================================================
function iniciarTimer(index) {
  if (timers[index]) clearInterval(timers[index]);
  timers[index] = setInterval(() => {
    const data = pausedTimers[index];
    if (!data || data.finalizado) { clearInterval(timers[index]); return; }
    const elapsedMs = calcularElapsedMs(data, Date.now());
    const timerEl   = document.getElementById(`timer-${index}`);
    if (timerEl) timerEl.textContent = formatTime(Math.floor(elapsedMs / 1000));
  }, 500);
}

// ============================================================
//  STATS BAR
// ============================================================
function actualizarStats() {
  let activos = 0, pausados = 0, finalizados = 0;
  for (let i in pausedTimers) {
    const d = pausedTimers[i];
    if (d.finalizado)   finalizados++;
    else if (d.paused)  pausados++;
    else                activos++;
  }
  const el = id => document.getElementById(id);
  if (el("stat-activos"))     el("stat-activos").textContent     = activos;
  if (el("stat-pausados"))    el("stat-pausados").textContent    = pausados;
  if (el("stat-finalizados")) el("stat-finalizados").textContent = finalizados;
}

// ============================================================
//  BADGE DE PRÓXIMA PAUSA
// ============================================================
function calcularProximaPausa(sacador, now) {
  const eventos = [];
  if (INDIVIDUAL_PAUSES[sacador]) {
    const p = getFutureTime(now, INDIVIDUAL_PAUSES[sacador].pausa);
    if (p > now) eventos.push({ label: "🍽 Almuerzo", time: p, tipo: "almuerzo" });
  }
  const dia = now.getDay();
  if (dayPausas[dia]) {
    const p = getFutureTime(now, dayPausas[dia]);
    if (p > now) eventos.push({ label: "🚪 Salida", time: p, tipo: "salida" });
  }
  if (HORAS_SALIDA[sacador]) {
    const p = getFutureTime(now, HORAS_SALIDA[sacador]);
    if (p > now) eventos.push({ label: "🚪 Salida", time: p, tipo: "salida" });
  }
  if (!eventos.length) return null;
  eventos.sort((a, b) => a.time - b.time);
  return eventos[0];
}

function renderBadgePausa(index) {
  const data    = pausedTimers[index];
  const badgeEl = document.getElementById(`badge-pausa-${index}`);
  if (!badgeEl || !data || data.finalizado || data.paused) {
    if (badgeEl) badgeEl.style.display = "none";
    return;
  }
  const prox = calcularProximaPausa(data.sacador, new Date());
  if (!prox) { badgeEl.style.display = "none"; return; }
  const diffMs  = prox.time - Date.now();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMin / 60);
  const remMin  = diffMin % 60;
  let textoTiempo = diffH > 0 ? `en ${diffH}h ${pad(remMin)}m` : `en ${diffMin}m`;
  const esPronto  = diffMin <= 15;
  badgeEl.textContent = `${prox.label} ${textoTiempo}`;
  badgeEl.className   = `badge-pausa tipo-${prox.tipo}${esPronto ? " tipo-pronto" : ""}`;
  badgeEl.style.display = "inline-flex";
}

function iniciarBadgeTimer(index) {
  setInterval(() => renderBadgePausa(index), 60000);
  renderBadgePausa(index);
}

// ============================================================
//  PAUSA / REANUDACIÓN
// ============================================================
function autoPause(index, tipo = "manual") {
  const data = pausedTimers[index];
  if (!data || data.paused || data.finalizado) return;
  data.paused    = true;
  data.pausedAt  = Date.now();
  data.tipoPausa = tipo;
  const btn = document.querySelector(`#card-${index} .btn-pause`);
  if (btn) { btn.textContent = "⏸ Pausado"; btn.classList.add("paused"); }
  renderBadgePausa(index);
  guardarPedidos();
  actualizarStats();
}

function autoReanudar(index) {
  const data = pausedTimers[index];
  if (!data || !data.paused || data.finalizado) return;
  const ahora = Date.now();
  data.pausedDuration = (data.pausedDuration || 0) + (ahora - (data.pausedAt || ahora));
  data.paused    = false;
  data.pausedAt  = null;
  data.reanudado = true;
  iniciarTimer(index);
  const btn = document.querySelector(`#card-${index} .btn-pause`);
  if (btn) { btn.textContent = "⏸ Pausar"; btn.classList.remove("paused"); }
  renderBadgePausa(index);
  guardarPedidos();
  actualizarStats();
}

function pausar(index)   { autoPause(index, "manual"); }
function reanudar(index) { autoReanudar(index); }
function pausarTodos()   { for (let i in pausedTimers) autoPause(i, "manual"); }
function reanudarTodos() { for (let i in pausedTimers) autoReanudar(i); }

// ============================================================
//  PROGRAMAR PAUSAS AUTOMÁTICAS
// ============================================================
function getFutureTime(date, timeStr) {
  const [h, m, s] = timeStr.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, s);
}

function addDays(date, d) {
  const nd = new Date(date);
  nd.setDate(date.getDate() + d);
  return nd;
}

function programarPausas(index, sacador, now) {
  const dia = now.getDay();
  if (INDIVIDUAL_PAUSES[sacador]) {
    const p1 = getFutureTime(now, INDIVIDUAL_PAUSES[sacador].pausa);
    const r1 = getFutureTime(now, INDIVIDUAL_PAUSES[sacador].reanuda);
    if (p1 > now) setTimeout(() => autoPause(index, "almuerzo"), p1 - now);
    if (r1 > now) setTimeout(() => autoReanudar(index),          r1 - now);
  }
  if (dayPausas[dia]) {
    const pausaGeneral = getFutureTime(now, dayPausas[dia]);
    const reanuda = dia === 6
      ? getFutureTime(addDays(now, 2), "08:00:00")
      : getFutureTime(addDays(now, 1), "08:00:00");
    if (pausaGeneral > now) setTimeout(() => autoPause(index, "salida"),  pausaGeneral - now);
    if (reanuda      > now) setTimeout(() => autoReanudar(index),         reanuda - now);
  }
  if (HORAS_SALIDA[sacador]) {
    const salida = getFutureTime(now, HORAS_SALIDA[sacador]);
    if (salida > now) setTimeout(() => autoPause(index, "salida anticipada"), salida - now);
  }
}

// ============================================================
//  AGREGAR PEDIDO
// ============================================================
function agregarPedido() {
  const codigo   = document.getElementById("codigo").value.trim();
  const sacador  = document.getElementById("sacador").value;
  const cantidad = parseInt(document.getElementById("cantidad").value.trim(), 10);
  const now      = new Date();

  if (!codigo || !sacador || isNaN(cantidad) || cantidad <= 0) {
    mostrarToast("⚠️ Completa todos los campos correctamente.", "warn"); return;
  }
  if (now.getDay() === 0) {
    mostrarToast("🚫 Los domingos no se pueden iniciar pedidos.", "error"); return;
  }

  const index = Date.now();
  const pedidoData = {
    index, codigo, sacador, cantidad,
    startTimestamp:  now.getTime(),
    pausedDuration:  0,
    pausedAt:        null,
    paused:          false,
    tipoPausa:       null,
    reanudado:       false,
    finalizado:      false,
    tiempoPorProducto: null,
    elapsedMsFinal:  0,
    // ── campos de equipo ──
    tieneEquipo:     false,
    liderId:         sacador,
    auxiliares:      []
  };

  // Si la cantidad supera el umbral, abrir modal de equipo antes de crear
  if (cantidad >= UMBRAL_EQUIPO) {
    _pedidoPendiente = pedidoData;
    _abrirModalEquipo(pedidoData);
    return;
  }

  _crearPedidoFinal(pedidoData);
}

// Pedido en espera mientras el modal de equipo está abierto
let _pedidoPendiente = null;

function _crearPedidoFinal(pedidoData) {
  const index = pedidoData.index;
  pausedTimers[index] = pedidoData;
  crearTarjeta(pedidoData);
  iniciarTimer(index);
  iniciarBadgeTimer(index);
  programarPausas(index, pedidoData.sacador, new Date());
  guardarPedidos();
  actualizarStats();
  aplicarFiltro();

  fetch(API_HOJA_PROCESO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      NumeroPedido:        pedidoData.codigo,
      Sacador:             pedidoData.sacador,
      CantidadReferencias: pedidoData.cantidad,
      HoraInicio:          formatDateTime(new Date(pedidoData.startTimestamp)),
      Estatus:             pedidoData.tieneEquipo ? "En Proceso - Equipo 👥" : "En Proceso... 📃",
      Equipo:              pedidoData.tieneEquipo
        ? [pedidoData.liderId, ...pedidoData.auxiliares].join(", ")
        : pedidoData.sacador
    })
  }).catch(err => console.error("❌ Error al enviar en proceso:", err));

  document.getElementById("codigo").value   = "";
  document.getElementById("sacador").value  = "";
  document.getElementById("cantidad").value = "";
  document.getElementById("codigo").focus();
}

// ============================================================
//  MODAL EQUIPO — al superar el umbral
// ============================================================
let _equipoAuxContador = 0;

function _abrirModalEquipo(pedidoData) {
  _equipoAuxContador = 0;
  const overlay = document.getElementById("modal-equipo-overlay");

  document.getElementById("equipo-subtitle").textContent =
    `Este pedido tiene ${pedidoData.cantidad} referencias (límite sugerido: ${UMBRAL_EQUIPO}). ` +
    `¿Deseas asignar un equipo? El líder será el sacador seleccionado.`;

  // Lider preview
  const iniciales = pedidoData.sacador.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase();
  document.getElementById("equipo-body").innerHTML = `
    <div class="equipo-lider-preview">
      <div class="equipo-lider-avatar">${iniciales}</div>
      <div class="equipo-lider-info">
        <div class="equipo-lider-name">${pedidoData.sacador}</div>
        <div class="equipo-lider-badge">👑 Líder del equipo</div>
      </div>
    </div>
    <div class="equipo-aux-list" id="equipo-aux-list"></div>
    <button class="equipo-btn-add-more" onclick="_agregarFilaAux('${pedidoData.sacador}')">
      + Agregar auxiliar
    </button>
  `;

  document.getElementById("equipo-footer").innerHTML = `
    <div class="equipo-footer-btns">
      <button class="modal-btn secondary" onclick="_rechazarEquipo()">
        Continuar sin equipo
      </button>
      <button class="modal-btn team" onclick="_confirmarEquipo()">
        👥 Confirmar equipo
      </button>
    </div>
  `;

  overlay.classList.add("open");
}

function _agregarFilaAux(lider) {
  _equipoAuxContador++;
  const id = `aux-row-${_equipoAuxContador}`;
  const fila = document.createElement("div");
  fila.className = "equipo-aux-item";
  fila.id = id;

  const opciones = TODOS_LOS_SACADORES
    .filter(s => s !== lider)
    .map(s => `<option value="${s}">${s}</option>`)
    .join("");

  fila.innerHTML = `
    <select class="equipo-aux-select">
      <option value="">-- Selecciona auxiliar --</option>
      ${opciones}
    </select>
    <button class="equipo-btn-remove-aux" onclick="document.getElementById('${id}').remove()" title="Quitar">✕</button>
  `;

  document.getElementById("equipo-aux-list").appendChild(fila);
}

function _rechazarEquipo() {
  cerrarModalEquipo();
  if (_pedidoPendiente) {
    _pedidoPendiente.tieneEquipo = false;
    _crearPedidoFinal(_pedidoPendiente);
    _pedidoPendiente = null;
  }
}

function _confirmarEquipo() {
  if (!_pedidoPendiente) { cerrarModalEquipo(); return; }

  const selects = document.querySelectorAll("#equipo-aux-list .equipo-aux-select");
  const auxiliares = [];
  let hayError = false;

  selects.forEach(sel => {
    if (!sel.value) {
      sel.style.borderColor = "var(--danger)";
      hayError = true;
    } else {
      sel.style.borderColor = "";
      if (!auxiliares.includes(sel.value)) auxiliares.push(sel.value);
    }
  });

  if (hayError) {
    mostrarToast("⚠️ Selecciona un colaborador en cada fila o elimina la fila vacía.", "warn");
    return;
  }

  const startTs = _pedidoPendiente.startTimestamp;
  _pedidoPendiente.tieneEquipo = true;
  // Auxiliares asignados al inicio comparten el mismo timestamp de inicio del pedido
  _pedidoPendiente.auxiliares  = auxiliares.map(nombre => ({ nombre, joinedAt: startTs }));

  cerrarModalEquipo();
  _crearPedidoFinal(_pedidoPendiente);

  const total = auxiliares.length + 1;
  mostrarToast(`👥 Equipo de ${total} personas asignado a #${_pedidoPendiente.codigo}`, "team");
  _pedidoPendiente = null;
}

function cerrarModalEquipo() {
  document.getElementById("modal-equipo-overlay").classList.remove("open");
}

// ============================================================
//  MODAL AUXILIAR — agregar a pedido existente
// ============================================================
let _auxTargetIndex = null;

function abrirModalAux(index) {
  _auxTargetIndex = index;
  const data = pausedTimers[index];
  if (!data) return;

  document.getElementById("aux-subtitle").textContent =
    `Pedido #${data.codigo} — ${data.sacador}`;

  // Filtrar sacadores ya en el equipo
  const yaAsignados = [
    data.liderId || data.sacador,
    ...(data.auxiliares || []).map(a => typeof a === "string" ? a : a.nombre)
  ];
  const auxSelect   = document.getElementById("aux-select");
  auxSelect.innerHTML = '<option value="">-- Selecciona un colaborador --</option>';

  TODOS_LOS_SACADORES
    .filter(s => !yaAsignados.includes(s))
    .forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      auxSelect.appendChild(opt);
    });

  const errorEl = document.getElementById("aux-error");
  if (errorEl) errorEl.classList.remove("visible");

  document.getElementById("modal-aux-overlay").classList.add("open");
  setTimeout(() => auxSelect.focus(), 100);
}

function cerrarModalAux() {
  document.getElementById("modal-aux-overlay").classList.remove("open");
  _auxTargetIndex = null;
}

function confirmarAgregarAux() {
  const select   = document.getElementById("aux-select");
  const errorEl  = document.getElementById("aux-error");
  const nuevoAux = select.value;

  if (!nuevoAux) {
    errorEl.classList.add("visible");
    select.focus();
    return;
  }

  const data = pausedTimers[_auxTargetIndex];
  if (!data) { cerrarModalAux(); return; }

  if (!data.auxiliares) data.auxiliares = [];
  if (!data.tieneEquipo) data.tieneEquipo = true;
  if (!data.liderId) data.liderId = data.sacador;

  // ── NUEVO: guardar timestamp exacto de cuando se unió ──
  const joinedAt = Date.now();
  data.auxiliares.push({ nombre: nuevoAux, joinedAt });

  cerrarModalAux();
  _actualizarSeccionEquipo(_auxTargetIndex);
  guardarPedidos();

  mostrarToast(`👥 ${nuevoAux.split(" ")[0]} se unió al equipo de #${data.codigo} — ${formatearFecha(joinedAt)}`, "team");
}

// ============================================================
//  RENDERIZAR SECCIÓN DE EQUIPO EN LA TARJETA
// ============================================================
function _actualizarSeccionEquipo(index) {
  const data = pausedTimers[index];
  if (!data) return;

  const card = document.getElementById(`card-${index}`);
  if (!card) return;

  // Actualizar clase visual de la tarjeta
  if (data.tieneEquipo && (data.auxiliares || []).length > 0) {
    card.classList.add("en-equipo");
  }

  let teamSection = document.getElementById(`team-section-${index}`);
  const lider = data.liderId || data.sacador;
  const auxiliares = data.auxiliares || [];

  // ── ACTUALIZADO: mostrar fecha/hora de unión de cada auxiliar ──
  const miembrosHTML = auxiliares.map(a => {
    const nombre   = typeof a === "string" ? a : a.nombre;
    const joined   = (typeof a === "object" && a.joinedAt)
      ? `<span class="member-joined">Se unió: ${formatearFecha(a.joinedAt)}</span>`
      : "";
    return `
      <div class="task-team-member">
        <span class="member-role auxiliar">Aux</span>
        <div class="member-info">
          <span>${nombre}</span>
          ${joined}
        </div>
      </div>`;
  }).join("");

  const btnAuxLabel = auxiliares.length === 0 ? "+ Agregar auxiliar" : "+ Añadir otro auxiliar";

  const innerHTML = `
    <div class="task-team-title">👥 Equipo</div>
    <div class="task-team-member">
      <span class="member-role lider">👑 Líder</span>
      <div class="member-info">
        <span>${lider}</span>
        <span class="member-joined">Inicio: ${formatearFecha(data.startTimestamp)}</span>
      </div>
    </div>
    ${miembrosHTML}
    ${!data.finalizado ? `<button class="btn-add-aux" onclick="abrirModalAux(${index})">${btnAuxLabel}</button>` : ""}
  `;

  if (teamSection) {
    teamSection.innerHTML = innerHTML;
  } else {
    teamSection = document.createElement("div");
    teamSection.className = "task-team";
    teamSection.id = `team-section-${index}`;
    teamSection.innerHTML = innerHTML;

    // Insertar antes de task-times
    const timesEl = document.getElementById(`times-wrap-${index}`);
    if (timesEl) {
      card.insertBefore(teamSection, timesEl);
    } else {
      const metaEl = card.querySelector(".task-meta");
      if (metaEl && metaEl.nextSibling) {
        card.insertBefore(teamSection, metaEl.nextSibling);
      } else {
        card.appendChild(teamSection);
      }
    }
  }
}

// ============================================================
//  CREAR TARJETA
// ============================================================
function crearTarjeta(pedido) {
  const { index, codigo, sacador, cantidad, startTimestamp, tieneEquipo } = pedido;

  const task = document.createElement("div");
  task.className = "task";
  task.id = `card-${index}`;
  task.dataset.codigo  = codigo.toLowerCase();
  task.dataset.sacador = sacador.toLowerCase();

  if (tieneEquipo && (pedido.auxiliares || []).length > 0) {
    task.classList.add("en-equipo");
  }

  task.innerHTML = `
    <div class="task-header">
      <div class="task-code">#${codigo}</div>
      <button class="btn-delete" onclick="eliminar(${index})" title="Eliminar">✕</button>
    </div>
    <div class="task-sacador">${sacador}</div>
    <div class="task-meta">
      <span class="meta-item">📦 <strong>${cantidad}</strong> productos</span>
      <span class="badge-pausa" id="badge-pausa-${index}" style="display:none;"></span>
    </div>
    <div id="times-wrap-${index}" class="task-times">
      <div class="time-row">
        <span class="time-label">Inicio</span>
        <span class="time-value" id="start-${index}">${formatearFecha(startTimestamp)}</span>
      </div>
      <div class="time-row">
        <span class="time-label">Fin</span>
        <span class="time-value" id="end-${index}">—</span>
      </div>
    </div>
    <div class="task-timer" id="timer-${index}">00:00:00</div>
    <div class="task-tpp" id="tpp-wrap-${index}" style="display:none;">
      ⏱ <span id="tpp-${index}">--</span> por producto
    </div>
    <div class="task-actions">
      <button class="btn-action btn-pause"  onclick="pausar(${index})">⏸ Pausar</button>
      <button class="btn-action btn-resume" onclick="reanudar(${index})">▶ Reanudar</button>
      <button class="btn-action btn-finish" onclick="abrirModalFinalizar(${index})">✔ Finalizar</button>
    </div>
  `;

  taskList.appendChild(task);

  // Si el pedido ya tiene equipo (p.ej. al reconstruir desde localStorage), renderizar sección
  if (tieneEquipo || (pedido.auxiliares && pedido.auxiliares.length > 0)) {
    _actualizarSeccionEquipo(index);
  } else if (!pedido.finalizado) {
    // Mostrar botón de "agregar auxiliar" en todos los pedidos activos
    _agregarBtnAuxSuelto(index);
  }
}

// Botón auxiliar suelto para pedidos sin equipo aún
function _agregarBtnAuxSuelto(index) {
  const data = pausedTimers[index];
  if (!data || data.finalizado) return;
  const card = document.getElementById(`card-${index}`);
  if (!card || card.querySelector(".btn-add-aux")) return;

  const btn = document.createElement("button");
  btn.className = "btn-add-aux";
  btn.textContent = "+ Agregar auxiliar";
  btn.onclick = () => abrirModalAux(index);

  // Insertarlo antes de task-actions
  const actionsEl = card.querySelector(".task-actions");
  if (actionsEl) card.insertBefore(btn, actionsEl);
}

// ============================================================
//  MODAL DE FINALIZAR — 4 pasos
// ============================================================
let modalIndex      = null;
let modalStep       = 1;
let modalRespuestas = {};

function abrirModalFinalizar(index) {
  modalIndex      = index;
  modalStep       = 1;
  modalRespuestas = {};
  const overlay   = document.getElementById("modal-overlay");
  overlay.classList.add("open");
  renderModalStep(1);
  setTimeout(() => {
    const input = document.getElementById("modal-input");
    if (input) input.focus();
  }, 100);
}

function cerrarModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  modalIndex = null;
}

function renderModalStep(step) {
  const data = pausedTimers[modalIndex];
  const titles = [
    "",
    "¿Cuántos productos se sacaron?",
    "¿Cuántos bultos se realizaron?",
    "¿Cuál es el monto total del pedido?",
    "Resumen del pedido"
  ];
  const subtitles = [
    "",
    `Esperado: ${data.cantidad} producto${data.cantidad > 1 ? "s" : ""}`,
    "Cantidad de bultos completados",
    "Monto en RD$",
    "Confirma los datos antes de guardar"
  ];

  document.getElementById("modal-title").textContent    = titles[step];
  document.getElementById("modal-subtitle").textContent = subtitles[step];

  const dots = document.querySelectorAll("#modal .modal-step-dot");
  dots.forEach((dot, i) => {
    dot.classList.remove("active", "done");
    if (i + 1 < step)        dot.classList.add("done");
    else if (i + 1 === step) dot.classList.add("active");
  });

  const body   = document.getElementById("modal-body");
  const footer = document.getElementById("modal-footer");
  body.innerHTML = "";

  if (step < 4) {
    const isLast = step === 3;
    const tipos  = ["", "number", "number", "number"];
    const hints  = [
      "",
      `Máximo: ${data.cantidad}`,
      "Solo números enteros positivos",
      "Ejemplo: 1500.00"
    ];

    body.innerHTML = `
      <div class="modal-field">
        <label>${titles[step]}</label>
        <input type="${tipos[step]}" id="modal-input" placeholder="0"
               min="0" step="${step === 3 ? "0.01" : "1"}" />
      </div>
      <p class="modal-hint" id="modal-hint">${hints[step]}</p>
      <p class="modal-hint error-msg" id="modal-error">Valor inválido, intenta de nuevo.</p>
    `;

    footer.innerHTML = `
      <button class="modal-btn secondary" onclick="cerrarModal()">Cancelar</button>
      <button class="modal-btn primary" onclick="modalSiguiente()">
        ${isLast ? "Ver resumen →" : "Siguiente →"}
      </button>
    `;

    const input = document.getElementById("modal-input");
    if (input) {
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); modalSiguiente(); }
      });
    }

  } else {
    const now        = new Date();
    const elapsedMs  = calcularElapsedMs(data, now.getTime());
    const elapsedSeg = Math.floor(elapsedMs / 1000);
    const cantidadSacada = modalRespuestas.cantidad;
    const porcentaje     = Math.round((cantidadSacada / data.cantidad) * 100);
    let tpp = "—";
    if (cantidadSacada > 0) tpp = formatTime(Math.floor(elapsedSeg / cantidadSacada));

    const equipoRow = data.tieneEquipo && data.auxiliares && data.auxiliares.length > 0
      ? `<div class="summary-row">
           <span class="summary-key">Equipo</span>
           <span class="summary-val" style="color:var(--team);font-size:12px;">
             ${[data.liderId || data.sacador, ...data.auxiliares.map(a => typeof a === "string" ? a : a.nombre)].join(", ")}
           </span>
         </div>`
      : "";

    body.innerHTML = `
      <div class="modal-summary">
        <div class="summary-row">
          <span class="summary-key">Pedido</span>
          <span class="summary-val highlight">#${data.codigo}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Sacador</span>
          <span class="summary-val">${data.sacador.split(" ").slice(0,2).join(" ")}</span>
        </div>
        ${equipoRow}
        <div class="summary-row">
          <span class="summary-key">Productos sacados</span>
          <span class="summary-val">${cantidadSacada} / ${data.cantidad} (${porcentaje}%)</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Tiempo total</span>
          <span class="summary-val success">${formatTime(elapsedSeg)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Tiempo/producto</span>
          <span class="summary-val success">${tpp}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Bultos</span>
          <span class="summary-val">${modalRespuestas.bultos}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Monto total</span>
          <span class="summary-val">RD$ ${parseFloat(modalRespuestas.monto).toFixed(2)}</span>
        </div>
      </div>
    `;

    footer.innerHTML = `
      <button class="modal-btn secondary" onclick="modalAnterior()">← Atrás</button>
      <button class="modal-btn success" onclick="confirmarFinalizar()">✔ Confirmar</button>
    `;
  }
}

function modalSiguiente() {
  const input    = document.getElementById("modal-input");
  const errorEl  = document.getElementById("modal-error");
  const data     = pausedTimers[modalIndex];
  const val      = parseFloat(input.value);
  let valido     = true;
  let mensajeError = "Valor inválido, intenta de nuevo.";

  if (modalStep === 1) {
    if (isNaN(val) || val < 0 || val > data.cantidad || !Number.isInteger(val)) {
      valido = false;
      mensajeError = `Ingresa un número entre 0 y ${data.cantidad}.`;
    } else { modalRespuestas.cantidad = val; }
  } else if (modalStep === 2) {
    if (isNaN(val) || val < 0 || !Number.isInteger(val)) {
      valido = false;
      mensajeError = "Ingresa un número entero positivo.";
    } else { modalRespuestas.bultos = val; }
  } else if (modalStep === 3) {
    if (isNaN(val) || val < 0) {
      valido = false;
      mensajeError = "Ingresa un monto válido mayor o igual a 0.";
    } else { modalRespuestas.monto = val; }
  }

  if (!valido) {
    input.classList.add("error");
    errorEl.textContent = mensajeError;
    errorEl.classList.add("visible");
    input.focus();
    return;
  }

  modalStep++;
  renderModalStep(modalStep);
  setTimeout(() => {
    const ni = document.getElementById("modal-input");
    if (ni) ni.focus();
  }, 80);
}

function modalAnterior() {
  if (modalStep > 1) {
    modalStep--;
    renderModalStep(modalStep);
    setTimeout(() => {
      const ni = document.getElementById("modal-input");
      if (ni) ni.focus();
    }, 80);
  }
}

function confirmarFinalizar() {
  const now  = new Date();
  const data = pausedTimers[modalIndex];
  if (!data) return;

  cerrarModal();

  if (data.paused) {
    data.pausedDuration = (data.pausedDuration || 0) + (now.getTime() - (data.pausedAt || now.getTime()));
    data.paused   = false;
    data.pausedAt = null;
  }

  const elapsedMs      = calcularElapsedMs(data, now.getTime());
  const elapsedSeg     = Math.floor(elapsedMs / 1000);
  const cantidadSacada = modalRespuestas.cantidad;
  const bultos         = modalRespuestas.bultos;
  const montoTotal     = parseFloat(modalRespuestas.monto);
  const porcentaje     = Math.round((cantidadSacada / data.cantidad) * 100);

  let tiempoPorProductoSeg = 0;
  let tiempoFormateado = "00:00:00";
  if (cantidadSacada > 0) {
    tiempoPorProductoSeg = elapsedSeg / cantidadSacada;
    tiempoFormateado = formatTime(Math.floor(tiempoPorProductoSeg));
  }

  data.finalizado        = true;
  data.endTimestamp      = now.getTime();
  data.tiempoPorProducto = tiempoFormateado;
  data.elapsedMsFinal    = elapsedMs;

  clearInterval(timers[modalIndex]);
  delete timers[modalIndex];

  const index = modalIndex;
  const card  = document.getElementById(`card-${index}`);
  if (card) card.classList.add("finalizado");

  const endEl   = document.getElementById(`end-${index}`);
  if (endEl)    endEl.textContent = formatearFecha(now.getTime());

  const timerEl = document.getElementById(`timer-${index}`);
  if (timerEl)  timerEl.textContent = formatTime(elapsedSeg);

  const tppWrap = document.getElementById(`tpp-wrap-${index}`);
  const tppEl   = document.getElementById(`tpp-${index}`);
  const badgeEl = document.getElementById(`badge-pausa-${index}`);
  if (tppWrap) tppWrap.style.display = "block";
  if (tppEl)   tppEl.textContent = tiempoFormateado;
  if (badgeEl) badgeEl.style.display = "none";

  // Actualizar sección equipo (quitar btn de agregar)
  const teamSection = document.getElementById(`team-section-${index}`);
  if (teamSection) {
    const btnAux = teamSection.querySelector(".btn-add-aux");
    if (btnAux) btnAux.remove();
  }

  // Quitar también el botón suelto si existe fuera de la sección equipo
  const btnAuxSuelto = card ? card.querySelector(".btn-add-aux") : null;
  if (btnAuxSuelto) btnAuxSuelto.remove();

  guardarPedidos();
  actualizarStats();

  const equipoStr = data.tieneEquipo && data.auxiliares && data.auxiliares.length > 0
    ? ` | Equipo: ${data.auxiliares.length + 1} personas`
    : "";

  mostrarToast(
    `✅ ${data.sacador.split(" ")[0]} — ${porcentaje}% | ${tiempoFormateado}/prod | ${bultos} bultos | RD$ ${montoTotal.toFixed(2)}${equipoStr}`,
    "success"
  );

  const auxList = (data.auxiliares || []);
  const endTs   = data.endTimestamp;

  // Construir string de equipo completo
  const equipoCompleto = data.tieneEquipo && auxList.length > 0
    ? [data.liderId || data.sacador, ...auxList.map(a => typeof a === "string" ? a : a.nombre)].join(", ")
    : data.sacador;

  // ── ACTUALIZADO: calcular tiempo trabajado individual por cada auxiliar ──
  const auxDetalles = auxList.map(a => {
    const nombre   = typeof a === "string" ? a : a.nombre;
    // joinedAt: cuando se incorporó. Si era del equipo inicial, es igual al startTimestamp del pedido.
    const joinedAt = (typeof a === "object" && a.joinedAt) ? a.joinedAt : data.startTimestamp;
    const tiempoAuxMs  = endTs - joinedAt;
    const tiempoAuxSeg = Math.max(0, Math.floor(tiempoAuxMs / 1000));
    let   tppAux       = "00:00:00";
    if (cantidadSacada > 0) tppAux = formatTime(Math.floor(tiempoAuxSeg / cantidadSacada));
    return { nombre, joinedAt, tiempoAuxSeg, tppAux };
  });

  // ── Registro principal: el LÍDER ──
  fetch(API_HOJA_HISTORIAL, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "Codigo P":                  data.codigo,
      "Sacador":                   data.sacador,
      "Rol":                       "Lider",
      "Equipo":                    equipoCompleto,
      "CantidadProductos ":        data.cantidad,
      "HoraInicio ":               formatDateTime(new Date(data.startTimestamp)),
      "HoraFin ":                  formatDateTime(new Date(endTs)),
      "TiempoTotal ":              formatTime(elapsedSeg),
      "TiempoPorProductoSegundos": tiempoPorProductoSeg.toFixed(2),
      "TiempoPorProducto":         tiempoFormateado,
      "Bultos":                    bultos,
      "MontoFinal":                montoTotal.toFixed(2)
    })
  }).catch(err => console.error("❌ Error al enviar historial (líder):", err));

  // ── Un registro por cada AUXILIAR con su tiempo real trabajado ──
  auxDetalles.forEach(aux => {
    fetch(API_HOJA_HISTORIAL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "Codigo P":                  data.codigo,
        "Sacador":                   aux.nombre,
        "Rol":                       "Auxiliar",
        "Equipo":                    equipoCompleto,
        "CantidadProductos ":        data.cantidad,
        "HoraInicio ":               formatDateTime(new Date(aux.joinedAt)),
        "HoraFin ":                  formatDateTime(new Date(endTs)),
        "TiempoTotal ":              formatTime(aux.tiempoAuxSeg),
        "TiempoPorProductoSegundos": cantidadSacada > 0
                                       ? (aux.tiempoAuxSeg / cantidadSacada).toFixed(2)
                                       : "0.00",
        "TiempoPorProducto":         aux.tppAux,
        "Bultos":                    bultos,
        "MontoFinal":                montoTotal.toFixed(2)
      })
    }).catch(err => console.error(`❌ Error al enviar historial (aux ${aux.nombre}):`, err));
  });

  // ── Actualizar estatus en la hoja de proceso ──
  fetch(`${API_HOJA_PROCESO}/search?NumeroPedido=${encodeURIComponent(data.codigo)}`, {
    method: "PATCH",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CantidadProductos: data.cantidad,
      Equipo:            equipoCompleto,
      HoraFin:           formatDateTime(new Date(endTs)),
      Estatus:           "Finalizado"
    })
  }).catch(err => console.error("❌ Error al actualizar Sheet externo:", err));
}

// ============================================================
//  FILTRO
// ============================================================
function aplicarFiltro() {
  const textoBusqueda = (document.getElementById("filtro-texto")?.value || "").toLowerCase().trim();
  const sacadorFiltro = (document.getElementById("filtro-sacador")?.value || "").toLowerCase();

  let visibles = 0;
  const total  = Object.keys(pausedTimers).length;

  document.querySelectorAll(".task").forEach(card => {
    const matchCodigo  = card.dataset.codigo?.includes(textoBusqueda) ?? true;
    const matchSacador = sacadorFiltro ? card.dataset.sacador?.includes(sacadorFiltro) : true;
    const visible = matchCodigo && matchSacador;
    card.style.display = visible ? "" : "none";
    if (visible) visibles++;
  });

  const countEl = document.getElementById("filter-count");
  if (countEl) {
    countEl.textContent = textoBusqueda || sacadorFiltro
      ? `${visibles} de ${total}`
      : `${total} pedidos`;
  }

  const emptyEl = document.getElementById("empty-state");
  if (emptyEl) emptyEl.classList.toggle("visible", visibles === 0 && total > 0);
}

function limpiarFiltro() {
  const tf = document.getElementById("filtro-texto");
  const sf = document.getElementById("filtro-sacador");
  if (tf) tf.value = "";
  if (sf) sf.value = "";
  aplicarFiltro();
}

// ============================================================
//  ELIMINAR
// ============================================================
function eliminar(index) {
  clearInterval(timers[index]);
  delete timers[index];
  delete pausedTimers[index];
  const card = document.getElementById(`card-${index}`);
  if (card) {
    card.style.animation = "fadeOut 0.3s ease forwards";
    setTimeout(() => { card.remove(); aplicarFiltro(); }, 300);
  }
  guardarPedidos();
  actualizarStats();
}

function eliminarTodos() {
  if (!confirm("¿Eliminar todos los pedidos? Esta acción no se puede deshacer.")) return;
  for (let index in pausedTimers) {
    clearInterval(timers[index]);
    const card = document.getElementById(`card-${index}`);
    if (card) card.remove();
  }
  pausedTimers = {};
  timers       = {};
  guardarPedidos();
  actualizarStats();
  aplicarFiltro();
}

// ============================================================
//  PERSISTENCIA
// ============================================================
function guardarPedidos() {
  const ahora = Date.now();
  for (let i in pausedTimers) {
    const d = pausedTimers[i];
    if (!d.finalizado) {
      d.elapsedSnapshot = calcularElapsedMs(d, ahora);
      d.savedAt = ahora;
    }
  }
  localStorage.setItem("pedidos", JSON.stringify(pausedTimers));
}

function reconstruirPedido(pedido) {
  const index = pedido.index;

  if (!pedido.finalizado) {
    const ahora      = Date.now();
    const snapshotMs = pedido.elapsedSnapshot || 0;

    if (!pedido.paused) {
      const tiempoCerradoMs = pedido.savedAt ? (ahora - pedido.savedAt) : 0;
      pedido.startTimestamp = ahora - snapshotMs - tiempoCerradoMs;
      pedido.pausedDuration = 0;
    } else {
      pedido.startTimestamp = ahora - snapshotMs - (pedido.pausedDuration || 0);
      pedido.pausedAt       = ahora;
    }
  }

  // Compatibilidad con pedidos guardados antes de la actualización
  if (!pedido.auxiliares)  pedido.auxiliares  = [];
  if (!pedido.liderId)     pedido.liderId     = pedido.sacador;
  if (pedido.tieneEquipo === undefined) pedido.tieneEquipo = false;

  // Compatibilidad: convertir auxiliares en formato string (antiguo) a objeto {nombre, joinedAt}
  pedido.auxiliares = pedido.auxiliares.map(a => {
    if (typeof a === "string") return { nombre: a, joinedAt: pedido.startTimestamp };
    return a;
  });

  pausedTimers[index] = pedido;
  crearTarjeta(pedido);

  if (pedido.finalizado) {
    const card    = document.getElementById(`card-${index}`);
    const tppWrap = document.getElementById(`tpp-wrap-${index}`);
    const tppEl   = document.getElementById(`tpp-${index}`);
    const timerEl = document.getElementById(`timer-${index}`);
    const endEl   = document.getElementById(`end-${index}`);
    if (card)    card.classList.add("finalizado");
    if (tppWrap) tppWrap.style.display = "block";
    if (tppEl && pedido.tiempoPorProducto) tppEl.textContent = pedido.tiempoPorProducto;
    if (timerEl) timerEl.textContent = formatTime(Math.floor((pedido.elapsedMsFinal || 0) / 1000));
    if (endEl && pedido.endTimestamp)  endEl.textContent = formatearFecha(pedido.endTimestamp);
  } else {
    iniciarTimer(index);
    iniciarBadgeTimer(index);
    programarPausas(index, pedido.sacador, new Date());
    if (pedido.paused) {
      const btn = document.querySelector(`#card-${index} .btn-pause`);
      if (btn) { btn.textContent = "⏸ Pausado"; btn.classList.add("paused"); }
    }
  }
}

// ============================================================
//  TOAST
// ============================================================
function mostrarToast(msg, tipo = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ============================================================
//  VERIFICAR MES
// ============================================================
function verificarMesActual() {
  const now       = new Date();
  const mesActual = now.getMonth();
  const saved     = parseInt(localStorage.getItem("mes_actual_guardado"), 10);
  if (isNaN(saved) || saved !== mesActual) {
    localStorage.setItem(`sacadores_${now.getFullYear()}_${mesActual}`, "{}");
    localStorage.setItem("mes_actual_guardado", mesActual);
  }
}

// ============================================================
//  INICIALIZACIÓN
// ============================================================
window.onload = () => {
  verificarMesActual();
  const saved = JSON.parse(localStorage.getItem("pedidos")) || {};
  Object.values(saved).forEach(pedido => reconstruirPedido(pedido));
  actualizarStats();
  aplicarFiltro();
};

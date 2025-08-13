let taskList = document.getElementById("task-list");
let timers = {}, pausedTimers = {};

const dayPausas = {
  1: "18:00:00", 2: "18:00:00", 3: "18:00:00", 4: "18:00:00",
  5: "17:00:00", 6: "12:00:00"
};

const INDIVIDUAL_PAUSES = {
  "Omar": { pausa: "13:00:00", reanuda: "14:00:00"},
  "Angelo": { pausa: "13:00:00", reanuda: "14:00:00"},
  "Jairo": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Nea": { pausa: "13:00:00", reanuda: "14:00:00"},
  "Brandy": { pausa: "13:00:00", reanuda: "14:00:00"},
  "Mello": { pausa: "13:00:00", reanuda: "14:00:00"},
  "Luis David": { pausa: "12:00:00", reanuda: "14:00:00" },
  "Rolfi": { pausa: "12:00:00", reanuda: "14:00:00" },
  "Luis Eduardo": { pausa: "12:00:00", reanuda: "14:00:00" },
  "Luis Morel": { pausa: "12:00:00", reanuda: "14:00:00" },
  "Brayan": { pausa: "12:00:00", reanuda: "14:00:00" },
  "Enrigue": { pausa: "12:00:00", reanuda: "14:00:00" },
  "Cirilo": { pausa: "12:00:00", reanuda: "14:00:00" }
};

const HORAS_SALIDA = {
  "Omar": "17:00:00",
  "Angelo": "17:00:00",
  "Jairo": "17:00:00",
  "Nea": "17:00:00",
  "Brandy": "17:00:00",
  "Mello": "17:00:00"
};

window.onload = () => {
    verificarMesActual(); 
  const saved = JSON.parse(localStorage.getItem("pedidos")) || {};
  Object.values(saved).forEach(pedido => reconstruirPedido(pedido));
};

function pad(n) {
  return n.toString().padStart(2, '0');
}

function formatDateTime(date) {
  if (!(date instanceof Date)) date = new Date(date);
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
}

function formatTime(totalSeconds) {
  totalSeconds = Number(totalSeconds) || 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Garantizar que esté disponible globalmente
window.formatDateTime = formatDateTime;
window.formatTime = formatTime;


function agregarPedido() {
  if (!confirm("¿Seguro que deseas agregar otro pedido?")) {
    return;
  }

  const codigo = document.getElementById("codigo").value.trim();
  const sacador = document.getElementById("sacador").value;
  const cantidad = parseInt(document.getElementById("cantidad").value.trim(), 10);

  if (!codigo || !sacador || isNaN(cantidad) || cantidad <= 0) {
    alert("Completa todos los campos correctamente.");
    return;
  }


  const index = Date.now();
  const now = new Date();
  const dia = now.getDay();

  if (dia === 0) {
    alert("Los domingos no se pueden iniciar pedidos.");
    return;
  }

  const task = document.createElement("div");
  task.className = "task";
task.innerHTML = `
  <div style="display:flex; justify-content:space-between; align-items:center;">
    <h3 id="codigo-${index}">${codigo}</h3>
    <button onclick="eliminar(${index})" style="background:red;color:white;border:none;border-radius:50%;width:24px;height:24px;font-weight:bold;">X</button>
  </div>
  <p id="sacador-${index}">${sacador}</p>
  <p>Cantidad de productos: <span>${cantidad}</span></p>
  <p>Inicio: <span id="start-${index}">${formatDateTime(now)}</span></p>
  <p>Final: <span id="end-${index}">--/--/---- --:--:--</span></p>
  <p>Tiempo: <span id="timer-${index}">00:00:00</span></p>
  <p>Tiempo por producto: <span id="tpp-${index}">--</span></p>
  <button onclick="pausar(${index})">Pausar</button>
  <button onclick="reanudar(${index})">Reanudar</button>
  <button onclick="finalizar(${index})">Finalizar</button>
`;

  taskList.appendChild(task);

  pausedTimers[index] = {
    index,
    codigo,
    sacador,
    cantidad,
    startTimestamp: now.getTime(),
    pausedDuration: 0,
    pausedAt: null,
    paused: false,
    tipoPausa: null,
    reanudado: false,
    finalizado: false,
    tiempoPorProducto: null
  };

  iniciarTimer(index);
  programarPausas(index, sacador, now);
  guardarPedidos();

  document.getElementById("codigo").value = "";
  document.getElementById("sacador").value = "";
  document.getElementById("cantidad").value = "";

  // ✅ Enfocar el primer campo
  document.getElementById("codigo").focus();
}

function iniciarTimer(index) {
  timers[index] = setInterval(() => {
    const data = pausedTimers[index];
    if (!data) return;
    let elapsed = 0;
    if (!data.paused) {
      elapsed = Date.now() - data.startTimestamp - data.pausedDuration;
    } else if (data.pausedAt) {
      elapsed = data.pausedAt - data.startTimestamp - data.pausedDuration;
    }
    const timerEl = document.getElementById(`timer-${index}`);
    if (timerEl) {
      timerEl.textContent = formatTime(Math.floor(elapsed / 1000));
    }
  }, 1000);
}

function programarPausas(index, sacador, now) {
  const dia = now.getDay();

  if (INDIVIDUAL_PAUSES[sacador]) {
    const p1 = getFutureTime(now, INDIVIDUAL_PAUSES[sacador].pausa);
    const r1 = getFutureTime(now, INDIVIDUAL_PAUSES[sacador].reanuda);
    setTimeout(() => autoPause(index, "individual"), p1 - now);
    setTimeout(() => autoReanudar(index), r1 - now);
  }

  if (dayPausas[dia]) {
    const pausaGeneral = getFutureTime(now, dayPausas[dia]);
    setTimeout(() => autoPause(index, "general"), pausaGeneral - now);

    let reanuda;
    if (dia === 6) {
      // Sábado: reanudar el lunes a las 08:00 AM
      reanuda = getFutureTime(addDays(now, 2), "08:00:00");
    } else { 
      // Otros días: reanudar al día siguiente
      reanuda = getFutureTime(addDays(now, 1), "08:00:00");
    }
    setTimeout(() => autoReanudar(index), reanuda - now);
  }

  if (HORAS_SALIDA[sacador]) {
    const salida = getFutureTime(now, HORAS_SALIDA[sacador]);
    setTimeout(() => autoPause(index, "salida anticipada"), salida - now);
  }
}

function autoPause(index, tipo) {
  if (!timers[index]) return;
  const now = new Date();
  pausedTimers[index].pausedAt = now.getTime();
  pausedTimers[index].paused = true;
  pausedTimers[index].tipoPausa = tipo;
  guardarPedidos();
}

function autoReanudar(index) {
  const data = pausedTimers[index];
  if (data.paused) {
    const now = Date.now();
    data.pausedDuration += now - data.pausedAt;
    data.paused = false;
    data.pausedAt = null;
    data.reanudado = true;
    guardarPedidos();
  }
}

// Formatea fecha para enviar a Sheets (YYYY-MM-DD HH:MM:SS)
function formatDateTime(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
         `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Formatea duración en segundos a HH:MM:SS
function formatTime(totalSeconds) {
  totalSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function finalizar(index) {
  const now = new Date();

  // Formato de fecha para mostrar
  const fechaCorta = formatDateTime(now);
  document.getElementById(`end-${index}`).textContent = fechaCorta;

  clearInterval(timers[index]);

  const data = pausedTimers[index];
  const total = data.cantidad;

  const cantidadSacada = parseInt(prompt(`¿Cuántos productos se sacaron del pedido? (Esperado: ${total})`), 10);
  if (isNaN(cantidadSacada) || cantidadSacada < 0 || cantidadSacada > total) {
    alert("Cantidad inválida.");
    return;
  }

  const porcentaje = Math.round((cantidadSacada / total) * 100);

  // Calcular duración real SIN tiempo en pausa
  const duracionMs = now.getTime() - data.startTimestamp - data.pausedDuration;
  const minutosTotales = duracionMs / 60000;

  let tiempoFormateado = "00:00:00";
  let tiempoPorProductoSegundos = 0;

  if (cantidadSacada > 0) {
    tiempoPorProductoSegundos = duracionMs / 1000 / cantidadSacada; // en segundos
    tiempoFormateado = formatTime(Math.floor(tiempoPorProductoSegundos)); // HH:MM:SS
  }

  // Mostrar en pantalla
  document.getElementById(`tpp-${index}`).textContent = tiempoFormateado;

  alert(`${data.sacador} sacó un ${porcentaje}% del pedido.\nTiempo por producto: ${tiempoFormateado}`);

  const task = document.getElementById(`codigo-${index}`).closest(".task");
  task.style.backgroundColor = "#d4edda";
  task.style.borderColor = "#28a745";

  if (!document.getElementById(`eliminar-${index}`)) {
    const eliminarBtn = document.createElement("button");
    eliminarBtn.id = `eliminar-${index}`;
    eliminarBtn.textContent = "Eliminar";
    eliminarBtn.style.backgroundColor = "#dc3545";
    eliminarBtn.style.marginLeft = "10px";
    eliminarBtn.onclick = () => eliminar(index);
    task.appendChild(eliminarBtn);
  }

  // Guardar datos en memoria
  data.finalizado = true;
  data.endTimestamp = now.getTime();
  data.tiempoPorProducto = tiempoFormateado;
  guardarPedidos();

  // Enviar a Google Sheets
  fetch("https://api.sheetbest.com/sheets/aa884681-ee43-48d7-8411-710416c171e5", {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json"
    },
  body: JSON.stringify({
  "Codigo P": data.codigo,
  "Sacador ": data.sacador,
  "CantidadProductos ": data.cantidad,
  "HoraInicio ": formatDateTime(new Date(data.startTimestamp)), // texto
  "HoraFin ": formatDateTime(new Date(data.endTimestamp)), // texto
  "TiempoTotal ": formatTime(Math.floor(duracionMs / 1000)), // HH:MM:SS
  "TiempoPorProductoSegundos": tiempoPorProductoSegundos.toFixed(2), // número en segundos
  "TiempoPorProducto": tiempoFormateado // HH:MM:SS
})

  })
    .then(res => res.text())
    .then(text => console.log("✅ Datos enviados a Sheets vía Sheet.best:", text))
    .catch(err => console.error("❌ Error al enviar a Sheet.best:", err));

  delete timers[index];
}



function eliminar(index) {
  delete pausedTimers[index];
  delete timers[index];
  const task = document.getElementById(`codigo-${index}`).closest(".task");
  if (task) task.remove();
  guardarPedidos();
}

function formatTime(totalSeconds) {
  totalSeconds = Math.floor(totalSeconds); // asegúrate de entero
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}



function getFutureTime(date, timeStr) {
  const [h, m, s] = timeStr.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, s);
}

function addDays(date, d) {
  const newDate = new Date(date);
  newDate.setDate(date.getDate() + d);
  return newDate;
}

function guardarPedidos() {
  localStorage.setItem("pedidos", JSON.stringify(pausedTimers));
}

function pausar(index) { autoPause(index, "manual"); }
function reanudar(index) { autoReanudar(index); }
function pausarTodos() { for (let i in pausedTimers) autoPause(i, "manual"); }
function reanudarTodos() { for (let i in pausedTimers) autoReanudar(i); }

function formatearFecha(timestamp) {
  const fecha = new Date(timestamp);
  const opcionesFecha = { day: '2-digit', month: '2-digit' };
  const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true };

  const fechaStr = fecha.toLocaleDateString('es-ES', opcionesFecha); // ej: "19/07"
  const horaStr = fecha.toLocaleTimeString('es-ES', opcionesHora).toLowerCase(); // ej: "04:40 p. m."

  return `${fechaStr}; ${horaStr.replace('.', '').replace(/\s/g, '')}`; // quita espacios y puntos extra
}


function reconstruirPedido(pedido) {
  const index = pedido.index;
  const task = document.createElement("div");
  task.className = "task";
  task.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3 id="codigo-${index}">${pedido.codigo}</h3>
      <button onclick="eliminar(${index})" style="background:red;color:white;border:none;border-radius:50%;width:24px;height:24px;font-weight:bold;">X</button>
    </div>
    <p id="sacador-${index}">${pedido.sacador}</p>
    <p>Cantidad de productos: <span>${pedido.cantidad}</span></p>
   <p>Inicio: <span id="start-${index}">${pedido.startTimeStr || formatearFecha(pedido.startTimestamp)}</span></p>
   <p>Final: <span id="end-${index}">${pedido.endTimestamp ? formatearFecha(pedido.endTimestamp) : '--/-- --:--'}</span></p>
    <p>Tiempo: <span id="timer-${index}">00:00:00</span></p>
    <p>Tiempo por producto: <span id="tpp-${index}">${pedido.tiempoPorProducto ? pedido.tiempoPorProducto + ' min' : '--'}</span></p>
    <button onclick="pausar(${index})">Pausar</button>
    <button onclick="reanudar(${index})">Reanudar</button>
    <button onclick="finalizar(${index})">Finalizar</button>
  `;
  if (pedido.finalizado) {
    task.style.backgroundColor = "#d4edda";
    task.style.borderColor = "#28a745";
  }
  taskList.appendChild(task);
  pausedTimers[index] = pedido;

  if (!pedido.finalizado) {
    iniciarTimer(index);
    programarPausas(index, pedido.sacador, new Date());
  }
}

function eliminarTodos() {
  if (confirm("¿Estás seguro de que deseas eliminar todos los pedidos? Esta acción no se puede deshacer.")) {
    for (let index in pausedTimers) {
      const task = document.getElementById(`codigo-${index}`)?.closest(".task");
      if (task) task.remove();
      clearInterval(timers[index]);
    }
    pausedTimers = {};
    timers = {};
    guardarPedidos();
  }
}

function verificarMesActual() {
  const now = new Date();
  const mesActual = now.getMonth();
  const añoActual = now.getFullYear();
  const claveMes = "mes_actual_guardado";
  const claveSacadores = `sacadores_${añoActual}_${mesActual}`;

  const mesGuardado = parseInt(localStorage.getItem(claveMes), 10);

  if (isNaN(mesGuardado) || mesGuardado !== mesActual) {
    // Cambió el mes, limpiar ranking
    localStorage.setItem(claveSacadores, "{}");
    localStorage.setItem(claveMes, mesActual);
  }
}
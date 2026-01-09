let taskList = document.getElementById("task-list");
let timers = {}, pausedTimers = {};
// URL del Google Sheet externo para seguimiento de pedidos

const dayPausas = {
  1: "18:00:00", 2: "18:00:00", 3: "18:00:00", 4: "18:00:00",
  5: "17:00:00", 6: "12:00:00"
};

const INDIVIDUAL_PAUSES = {
  "Omar": { pausa: "13:00:00", reanuda: "14:00:00"},
  "José": { pausa: "13:00:00", reanuda: "14:00:00"},
  "Jairo": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Ismael": { pausa: "13:00:00", reanuda: "14:00:00"},
  "Fernando": { pausa: "13:00:00", reanuda: "14:00:00"},
  "Mello": { pausa: "13:00:00", reanuda: "14:00:00"},
  "Luis David": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Yustin": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Luis Eduardo": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Luis Morel": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Brayan": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Enrigue": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Cirilo": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Luis Duran": { pausa: "13:00:00", reanuda: "14:00:00" },
  "Luis Ruiz": { pausa:"13:00:00", reanuda: "14:00:00" },
  "Wilkin Ortega": { pausa:"13:00:00", reanuda: "14:00:00" }
};

const HORAS_SALIDA = {
  "Omar": "18:00:00",
  "José": "18:00:00",
  "Jairo": "18:00:00",
  "Ismael": "18:00:00",
  "Mello": "18:00:00",
  "Fernando": "18:00:00"
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

  // Primero obtenemos los valores del formulario
  const codigo = document.getElementById("codigo").value.trim();
  const sacador = document.getElementById("sacador").value;
  const cantidad = parseInt(document.getElementById("cantidad").value.trim(), 10);
  const now = new Date();

  if (!codigo || !sacador || isNaN(cantidad) || cantidad <= 0) {
    alert("Completa todos los campos correctamente.");
    return;
  }

  const dia = now.getDay();
  if (dia === 0) {
    alert("Los domingos no se pueden iniciar pedidos.");
    return;
  }

// 🔹 Enviar a Google Sheet externo como EN PROCESO
fetch("https://api.sheetbest.com/sheets/08e16efc-8d19-4acf-9c45-c8ff9a2efdb5", {
  method: "POST",
  headers: { 
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "NumeroPedido": codigo,
    "Sacador": sacador,
    "CantidadReferencias": cantidad,
    "HoraInicio": formatDateTime(now),
    "Estatus": "En Proceso... 📃"
  })
})
.then(res => res.json())
.then(data => console.log("✅ Pedido enviado a Sheet externo en proceso:", data))
.catch(err => console.error("❌ Error al enviar en proceso:", err));

  const index = Date.now();

  // Crear la tarjeta del pedido en pantalla
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

  // Guardar datos para timers y pausas
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

  // Limpiar formulario y enfocar
  document.getElementById("codigo").value = "";
  document.getElementById("sacador").value = "";
  document.getElementById("cantidad").value = "";
  document.getElementById("codigo").focus();
}


function iniciarTimer(index) {
  timers[index] = setInterval(() => {
    const data = pausedTimers[index];
    if (!data) return;

    let elapsed = 0;
    if (data.paused) {
      // Si está pausado, mostrar el tiempo hasta que se pausó
      elapsed = data.pausedAt - data.startTimestamp - data.pausedDuration;
    } else {
      // Si no está pausado, sumar tiempo desde inicio menos pausas
      elapsed = Date.now() - data.startTimestamp - data.pausedDuration;
    }

    const timerEl = document.getElementById(`timer-${index}`);
    if (timerEl) timerEl.textContent = formatTime(Math.floor(elapsed / 1000));
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

function autoPause(index, tipo = "manual") {
  const data = pausedTimers[index];
  if (data && !data.paused) {
    data.paused = true;
    data.pausedAt = Date.now();
    data.tipoPausa = tipo; // opcional: "manual" o "automática"
    console.log(`⏸ Pedido ${data.codigo} pausado (${tipo})`);
    guardarPedidos();
  }
}

function autoReanudar(index) {
  const data = pausedTimers[index];
  if (data && data.paused) {
    const ahora = Date.now();
    data.pausedDuration += ahora - data.pausedAt; // sumar tiempo en pausa
    data.paused = false;
    data.pausedAt = null;
    data.reanudado = true;
    console.log(`▶ Pedido ${data.codigo} reanudado`);
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
  const duracionMs = now.getTime() - data.startTimestamp - (data.pausedDuration || 0);

  let tiempoFormateado = "00:00:00";
  let tiempoPorProductoSegundos = 0;

  if (cantidadSacada > 0) {
    tiempoPorProductoSegundos = duracionMs / 1000 / cantidadSacada; // en segundos
    tiempoFormateado = formatTime(Math.floor(tiempoPorProductoSegundos));
  }

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

  console.log("DEBUG ENVIO SHEET:", {
  codigo: data.codigo,
  sacador: data.sacador,
  cantidad: data.cantidad
});

  // Enviar a Google Sheets principal (historial detallado)
// ✅ Enviar a Google Sheets de pedidos (historial)
fetch("https://api.sheetbest.com/sheets/b728e7de-89eb-4872-9169-f1bdbd4a54dd", {
  method: "POST",
  mode: "cors",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    "Codigo P": data.codigo,
    "Sacador": data.sacador,
    "CantidadProductos": data.cantidad,
    "HoraInicio": formatDateTime(new Date(data.startTimestamp)),
    "HoraFin": formatDateTime(new Date(data.endTimestamp)),
    "TiempoTotal": formatTime(Math.floor(duracionMs / 1000)),
    "TiempoPorProductoSegundos": tiempoPorProductoSegundos.toFixed(2),
    "TiempoPorProducto": tiempoFormateado
  })
})
  .then(res => res.text())
  .then(text => console.log("✅ Datos enviados a Sheets historial:", text))
  .catch(err => console.error("❌ Error al enviar historial:", err));

  // Actualizar estatus en Google Sheet externo (proceso -> finalizado)
  fetch(`https://api.sheetbest.com/sheets/30e3fbb6-d751-4bc7-bf1c-4012867c53c3/search?NumeroPedido=${encodeURIComponent(data.codigo)}`, {
    method: "PATCH",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "CantidadProductos": data.cantidad,
      "HoraFin": formatDateTime(new Date(data.endTimestamp)),
      "Estatus": "Finalizado"
    })
  })
  .then(res => res.json())
  .then(resp => console.log("✅ Pedido actualizado a FINALIZADO en Sheet externo:", resp))
  .catch(err => console.error("❌ Error al actualizar Sheet externo:", err));

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
  for (let i in pausedTimers) {
    const data = pausedTimers[i];
    if (!data.finalizado) {
      if (data.paused) {
        data.elapsed = data.pausedAt - data.startTimestamp - data.pausedDuration;
      } else {
        data.elapsed = Date.now() - data.startTimestamp - data.pausedDuration;
      }
    }
  }
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
    if (pedido.paused) {
      const elapsed = (pedido.elapsed || 0) / 1000;
      document.getElementById(`timer-${index}`).textContent = formatTime(Math.floor(elapsed));
    } else {
      iniciarTimer(index);
    }
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

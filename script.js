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
  const saved = JSON.parse(localStorage.getItem("pedidos")) || {};
  Object.values(saved).forEach(pedido => reconstruirPedido(pedido));
};

function agregarPedido() {
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
    <p>Inicio: <span id="start-${index}">${now.toLocaleString()}</span></p>
    <p>Final: <span id="end-${index}">--/-- --:--:--</span></p>
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

function finalizar(index) {
  const now = new Date();
  document.getElementById(`end-${index}`).textContent = now.toLocaleString();
  clearInterval(timers[index]);

  const data = pausedTimers[index];
  const total = data.cantidad;
  const cantidadSacada = parseInt(prompt(`¿Cuántos productos se sacaron del pedido? (Esperado: ${total})`), 10);
  if (isNaN(cantidadSacada) || cantidadSacada < 0 || cantidadSacada > total) {
    alert("Cantidad inválida.");
    return;
  }

const porcentaje = Math.round((cantidadSacada / total) * 100);
const duracionMs = now.getTime() - data.startTimestamp - data.pausedDuration;
const minutosTotales = duracionMs / 60000; // ✅ Precisión decimal sin redondear hacia abajo
const promedioMinPorProducto = (cantidadSacada > 0)
  ? (minutosTotales / cantidadSacada).toFixed(2)
  : "0.00";


  document.getElementById(`tpp-${index}`).textContent = `${promedioMinPorProducto} min`;

  alert(`${data.sacador} sacó un ${porcentaje}% del pedido.\nTiempo por producto: ${promedioMinPorProducto} min`);

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

  data.finalizado = true;
  data.endTimestamp = now.getTime();
  data.tiempoPorProducto = promedioMinPorProducto;
  guardarPedidos();

  fetch("https://api.sheetbest.com/sheets/e5698a50-c77c-47ee-895a-eeb9c29c7a17", {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "Codigo P": data.codigo,
      "Sacador ": data.sacador,
      "CantidadProductos ": data.cantidad,
      "HoraInicio ": new Date(data.startTimestamp).toISOString(),
      "HoraFin ": new Date(data.endTimestamp).toISOString(),
      "TiempoTotal ": formatTime(Math.floor(duracionMs / 1000)),
      "Tiempoitms": promedioMinPorProducto
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

function formatTime(s) {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
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
    <p>Inicio: <span id="start-${index}">${pedido.startTimeStr || new Date(pedido.startTimestamp).toLocaleString()}</span></p>
    <p>Final: <span id="end-${index}">${pedido.endTimestamp ? new Date(pedido.endTimestamp).toLocaleString() : '--/-- --:--:--'}</span></p>
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

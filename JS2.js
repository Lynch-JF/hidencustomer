const API_SHEET = "https://api.sheetbest.com/sheets/3e63ab90-8471-42e0-8f80-b4c67b419fcd";

let resumenSacadores = []; // Datos globales para resumen
let pedidosFiltrados = []; // Datos globales para pedidos filtrados
let graficaTiempo = null;

// Función para convertir tiempo "HH:MM:SS" a minutos con decimales
function tiempoAminutos(str) {
  if (!str) return NaN;
  const partes = str.split(":");
  if (partes.length !== 3) return NaN;
  const [h, m, s] = partes.map(Number);
  return h * 60 + m + s / 60;
}

// Funciones para fechas (mismo que antes)
function esMismaFecha(f1, f2) {
  return f1.getFullYear() === f2.getFullYear() &&
         f1.getMonth() === f2.getMonth() &&
         f1.getDate() === f2.getDate();
}

function estaMismaSemana(fecha, referencia) {
  const diaSemana = referencia.getDay();
  const inicio = new Date(referencia);
  inicio.setDate(referencia.getDate() - diaSemana);
  inicio.setHours(0,0,0,0);

  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  fin.setHours(23,59,59,999);

  return fecha >= inicio && fecha <= fin;
}

function obtenerNombreMes(mes) {
  const nombres = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return nombres[mes] || "Mes desconocido";
}

// Función para filtrar pedidos según rango y actualizar globales
function obtenerPedidosFiltrados(rango) {
  return fetch(API_SHEET)
    .then(res => res.json())
    .then(data => {
      const ahora = new Date();

      const pedidosFiltradosLocal = data.filter(pedido => {
        const fechaStr = (pedido["HoraFin "] || pedido["HoraFin"] || "").trim();
        const fecha = new Date(fechaStr);
        if (isNaN(fecha)) return false;

        switch (rango) {
          case "hoy": return esMismaFecha(fecha, ahora);
          case "ayer": {
            const ayer = new Date(ahora);
            ayer.setDate(ahora.getDate() - 1);
            return esMismaFecha(fecha, ayer);
          }
          case "semana": return estaMismaSemana(fecha, ahora);
          case "mes": return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
          case "todos": return true;
          default: return false;
        }
      });

      pedidosFiltrados = pedidosFiltradosLocal;
      return pedidosFiltradosLocal;
    });
}

// Renderizar tabla resumen sacadores
function renderizarTablaResumenSacadores(resumen) {
  const tbody = document.querySelector("#tabla-pedidos-filtrados tbody");
  if (!tbody) return;

  if (resumen.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No se encontraron datos.</td></tr>`;
    return;
  }

  tbody.innerHTML = resumen.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.sacador}</td>
      <td>${item.totalProductos}</td>
      <td>${item.totalPedidos}</td>
      <td>${item.promedioTiempo.toFixed(2)} min/producto</td>
    </tr>
  `).join("");
}

// Actualizar conteo en pantalla
function actualizarConteoPedidos(totalPedidos) {
  const conteoDiv = document.getElementById("conteo-pedidos");
  if (conteoDiv) {
    conteoDiv.textContent = `📦 Total de pedidos en este periodo: ${totalPedidos}`;
  }
}

// Función para filtrar y renderizar resumen sacadores según rango
function filtrarPedidos(rango) {
  if (rango === "ningun") {
    renderizarTablaResumenSacadores([]);
    actualizarConteoPedidos(0);
    document.getElementById("mensaje").textContent = "Seleccione una opción para ver los datos.";
    return;
  } else {
    document.getElementById("mensaje").textContent = "";
  }

  obtenerPedidosFiltrados(rango)
    .then(pedidos => {
      const sacadoresMap = {};

      pedidos.forEach(pedido => {
        const sacador = (pedido["Sacador "] || pedido["Sacador"] || "").trim() || "Sin nombre";
        const cantidad = parseInt(pedido["CantidadProductos "] || pedido["CantidadProductos"] || "0", 10);
        const tiempoStr = (pedido["Tiempoitms "] || pedido["Tiempoitms"] || "").trim();
        const tiempoPorProducto = tiempoAminutos(tiempoStr);

        if (!sacadoresMap[sacador]) {
          sacadoresMap[sacador] = {
            totalProductos: 0,
            totalPedidos: 0,
            sumaTiempos: 0,
            cantidadTiempos: 0
          };
        }

        sacadoresMap[sacador].totalProductos += cantidad;
        sacadoresMap[sacador].totalPedidos++;
        if (!isNaN(tiempoPorProducto)) {
          sacadoresMap[sacador].sumaTiempos += tiempoPorProducto;
          sacadoresMap[sacador].cantidadTiempos++;
        }
      });

      resumenSacadores = Object.entries(sacadoresMap).map(([sacador, datos]) => ({
        sacador,
        totalProductos: datos.totalProductos,
        totalPedidos: datos.totalPedidos,
        promedioTiempo: datos.cantidadTiempos > 0 ? (datos.sumaTiempos / datos.cantidadTiempos) : 0
      }));

      resumenSacadores.sort((a, b) => a.promedioTiempo - b.promedioTiempo);

      renderizarTablaResumenSacadores(resumenSacadores);
      actualizarConteoPedidos(pedidos.length);
      actualizarGraficaTiempos(resumenSacadores);
    })
    .catch(err => {
      console.error("❌ Error al filtrar pedidos:", err);
      renderizarTablaResumenSacadores([]);
      actualizarConteoPedidos(0);
    });
}

// Función para actualizar gráfico
function actualizarGraficaTiempos(resumen) {
  const ctx = document.getElementById("grafica-tiempo").getContext("2d");
  const labels = resumen.map(item => item.sacador);
  const data = resumen.map(item => item.promedioTiempo);

  if (graficaTiempo) {
    graficaTiempo.data.labels = labels;
    graficaTiempo.data.datasets[0].data = data;
    graficaTiempo.update();
  } else {
    graficaTiempo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '⏱️ Tiempo promedio (min/producto)',
          data,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          tooltip: { enabled: true }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Minutos' }
          },
          x: {
            title: { display: true, text: 'Sacadores' }
          }
        }
      }
    });
  }
}

// Mostrar top 3 sacadores más rápidos
function obtenerTop3SacadoresRapidos() {
  fetch(API_SHEET)
    .then(res => res.json())
    .then(data => {
      const ahora = new Date();
      const mesActual = ahora.getMonth();
      const añoActual = ahora.getFullYear();

      const tiempos = {};

      function tiempoAminutosString(tiempoStr) {
        if (!tiempoStr) return NaN;
        const match = tiempoStr.match(/(\d+(?:\.\d+)?)\s*min/i);
        if (!match) return NaN;
        return parseFloat(match[1]);
      }

      data.forEach(pedido => {
        const horaFin = (pedido["HoraFin"] || pedido["HoraFin "] || "").trim();
        const sacador = (pedido["Sacador"] || pedido["Sacador "] || "").trim();
        const tiempoStr = (pedido["Tiempoitms"] || pedido["Tiempoitms "] || "").trim();

        const fechaFin = new Date(horaFin);
        const tiempoPorProducto = tiempoAminutosString(tiempoStr);

        if (
          sacador &&
          !sacador.includes("/") &&
          !isNaN(fechaFin) &&
          fechaFin.getMonth() === mesActual &&
          fechaFin.getFullYear() === añoActual &&
          !isNaN(tiempoPorProducto)
        ) {
          if (!tiempos[sacador]) tiempos[sacador] = { total: 0, count: 0 };
          tiempos[sacador].total += tiempoPorProducto;
          tiempos[sacador].count += 1;
        }
      });

      const promedios = Object.entries(tiempos).map(([sacador, datos]) => ({
        sacador,
        promedio: datos.total / datos.count
      }));

      const top3 = promedios.sort((a, b) => a.promedio - b.promedio).slice(0, 3);

      mostrarRankingRapidos(top3);
    })
    .catch(err => console.error("❌ Error al obtener ranking:", err));
}

function mostrarRankingRapidos(top3) {
  const lista = document.getElementById("lista-top-sacadores");
  lista.innerHTML = top3.map((item, i) => `
    <li><span>${["🥇", "🥈", "🥉"][i] || ""}</span> <strong>${item.sacador}</strong>: ${item.promedio.toFixed(2)} min/prod</li>
  `).join("");
}

// Mostrar historial ganadores
function mostrarHistorialGanadores() {
  fetch(API_SHEET)
    .then(res => res.json())
    .then(data => {
      const historial = {};

      data.forEach(pedido => {
        const fecha = new Date(pedido["HoraFin "] || pedido["HoraFin"] || "");
        if (isNaN(fecha)) return;

        const mes = fecha.getMonth();
        const año = fecha.getFullYear();
        const claveMes = `${año}-${mes}`;
        const sacador = (pedido["Sacador "] || pedido["Sacador"] || "Desconocido").trim();

        if (!historial[claveMes]) historial[claveMes] = {};
        historial[claveMes][sacador] = (historial[claveMes][sacador] || 0) + 1;
      });

      const ganadores = Object.entries(historial).map(([mesClave, sacadores]) => {
        const [año, mes] = mesClave.split("-");
        const mesNombre = obtenerNombreMes(parseInt(mes));
        const [nombreGanador, cantidad] = Object.entries(sacadores)
          .sort((a, b) => b[1] - a[1])[0];

        return {
          mes: `${mesNombre} ${año}`,
          ganador: nombreGanador,
          cantidad
        };
      });

      renderizarHistorial(ganadores);
    })
    .catch(err => console.error("❌ Error al obtener historial:", err));
}

function renderizarHistorial(ganadores) {
  const container = document.getElementById("historial-ganadores");
  if (!container) {
    console.warn("⚠️ Falta el contenedor #historial-ganadores");
    return;
  }

  container.innerHTML = `
    <ul class="historial-lista">
      ${ganadores
        .sort((a, b) => new Date(b.mes) - new Date(a.mes))
        .map(g => `<li><strong>${g.mes}</strong>: ${g.ganador} (${g.cantidad} pedidos)</li>`)
        .join("")}
    </ul>
  `;
}

// Al cargar la página, mostrar datos por defecto
window.onload = () => {
  filtrarPedidos("mes");        // Muestra resumen del mes actual
  mostrarHistorialGanadores();
  obtenerTop3SacadoresRapidos();
};

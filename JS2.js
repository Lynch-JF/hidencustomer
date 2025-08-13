const API_SHEET = "https://api.sheetbest.com/sheets/3e63ab90-8471-42e0-8f80-b4c67b419fcd";

let resumenSacadores = []; 
let pedidosFiltrados = []; 
let graficaTiempo = null;

// Funciones de fecha
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
  const nombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return nombres[mes] || "Mes desconocido";
}

// Filtrar pedidos según rango
function obtenerPedidosFiltrados(rango) {
  return fetch(API_SHEET)
    .then(res => res.json())
    .then(data => {
      const ahora = new Date();
      return data.filter(pedido => {
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
          case "mesPasado": {
            const mesPasado = new Date(ahora);
            mesPasado.setMonth(ahora.getMonth() - 1);
            return fecha.getMonth() === mesPasado.getMonth() && fecha.getFullYear() === mesPasado.getFullYear();
          }
          case "todos": return true;
          default: return false;
        }
      });
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

  tbody.innerHTML = resumen.map((item,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${item.sacador}</td>
      <td>${item.totalProductos}</td>
      <td>${item.totalPedidos}</td>
      <td>${item.promedioTiempo.toFixed(2)} min/producto</td>
    </tr>
  `).join("");
}

// Actualizar conteo
function actualizarConteoPedidos(totalPedidos) {
  const conteoDiv = document.getElementById("conteo-pedidos");
  if (conteoDiv) {
    conteoDiv.textContent = `📦 Total de pedidos en este periodo: ${totalPedidos}`;
  }
}

// Filtrar y renderizar resumen sacadores usando columna "Grafica"
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
        const sacador = (pedido["Sacador "] || pedido["Sacador"] || "").trim();
        if (!sacador || sacador.includes("/")) return; // ❌ Excluir equipos

        const cantidad = parseInt(pedido["CantidadProductos "] || pedido["CantidadProductos"] || "0",10);
        const tiempoPorProducto = parseFloat(pedido["Grafica"]);

        if (!sacadoresMap[sacador]) {
          sacadoresMap[sacador] = { totalProductos:0, totalPedidos:0, sumaTiempos:0, cantidadTiempos:0 };
        }

        sacadoresMap[sacador].totalProductos += cantidad;
        sacadoresMap[sacador].totalPedidos++;
        if (!isNaN(tiempoPorProducto)) {
          sacadoresMap[sacador].sumaTiempos += tiempoPorProducto;
          sacadoresMap[sacador].cantidadTiempos++;
        }
      });

      resumenSacadores = Object.entries(sacadoresMap).map(([sacador,datos]) => ({
        sacador,
        totalProductos: datos.totalProductos,
        totalPedidos: datos.totalPedidos,
        promedioTiempo: datos.cantidadTiempos > 0 ? (datos.sumaTiempos / datos.cantidadTiempos) : 0
      }));

      // 🔽 Ordenar de mayor a menor tiempo promedio
      resumenSacadores.sort((a,b) => b.promedioTiempo - a.promedioTiempo);

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

// Actualizar gráfico
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
          legend: { display:true },
          tooltip: { enabled:true }
        },
        scales: {
          y: { beginAtZero:true, title:{display:true,text:'Minutos'} },
          x: { title:{display:true,text:'Sacadores'} }
        }
      }
    });
  }
}

// Top 3 sacadores más rápidos
function obtenerTop3SacadoresRapidos() {
  fetch(API_SHEET)
    .then(res => res.json())
    .then(data => {
      const ahora = new Date();
      const mesActual = ahora.getMonth();
      const añoActual = ahora.getFullYear();
      const tiempos = {};

      data.forEach(pedido => {
        const sacador = (pedido["Sacador "] || pedido["Sacador"] || "").trim();
        if (!sacador || sacador.includes("/")) return; // ❌ Excluir equipos

        const fechaFin = new Date(pedido["HoraFin "] || pedido["HoraFin"] || "");
        const tiempoPorProducto = parseFloat(pedido["Grafica"]);

        if (!isNaN(fechaFin) && fechaFin.getMonth() === mesActual && fechaFin.getFullYear() === añoActual && !isNaN(tiempoPorProducto)) {
          if (!tiempos[sacador]) tiempos[sacador] = { total:0, count:0 };
          tiempos[sacador].total += tiempoPorProducto;
          tiempos[sacador].count += 1;
        }
      });

      const promedios = Object.entries(tiempos).map(([sacador,datos]) => ({
        sacador,
        promedio: datos.total/datos.count
      }));

      const top3 = promedios.sort((a,b)=>a.promedio-b.promedio).slice(0,3);
      mostrarRankingRapidos(top3);
    })
    .catch(err=>console.error("❌ Error al obtener ranking:", err));
}

function mostrarRankingRapidos(top3) {
  const lista = document.getElementById("lista-top-sacadores");
  lista.innerHTML = top3.map((item,i)=>`
    <li><span>${["🥇","🥈","🥉"][i]||""}</span> <strong>${item.sacador}</strong>: ${item.promedio.toFixed(2)} min/prod</li>
  `).join("");
}

// Historial ganadores
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
        historial[claveMes][sacador] = (historial[claveMes][sacador]||0)+1;
      });

      const ganadores = Object.entries(historial).map(([mesClave,sacadores])=>{
        const [año,mes] = mesClave.split("-");
        const mesNombre = obtenerNombreMes(parseInt(mes));
        const [nombreGanador,cantidad] = Object.entries(sacadores)
          .sort((a,b)=>b[1]-a[1])[0];
        return { mes:`${mesNombre} ${año}`, ganador:nombreGanador, cantidad };
      });

      renderizarHistorial(ganadores);
    })
    .catch(err=>console.error("❌ Error al obtener historial:",err));
}

function renderizarHistorial(ganadores) {
  const container = document.getElementById("historial-ganadores");
  if (!container) return;

  container.innerHTML = `
    <ul class="historial-lista">
      ${ganadores.sort((a,b)=>new Date(b.mes)-new Date(a.mes))
        .map(g=>`<li><strong>${g.mes}</strong>: ${g.ganador} (${g.cantidad} pedidos)</li>`).join("")}
    </ul>
  `;
}

// Al cargar la página
window.onload = () => {
  filtrarPedidos("mes"); 
  mostrarHistorialGanadores();
  obtenerTop3SacadoresRapidos();
};

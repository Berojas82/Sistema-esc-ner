/**
 * SISTEMA DE CONTROL DE ACCESO - JAVASCRIPT DEL CLIENTE
 * Soporte para Lector USB NewPrint X1 (Barcode Scanner X1)
 * Decodificación y captura de código 2D PDF417 de Cédula Colombiana
 */

// ─── Estado Global ─────────────────────────────────────────────────────────────
const state = {
  paginaActual: 'page-escaner',
  audioHabilitado: true,
  busquedaDebounce: null,
  paginaAsistentes: 1,
  totalPaginas: 1,
  limitePorPagina: 20,
  ultimoEscaneo: null,
  escaneoEnProgreso: false
};

// ─── Sintetizador de Sonidos (Web Audio API) ───────────────────────────────────
// Genera sonidos instantáneos sin requerir archivos mp3 externos
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Sonido de éxito: campanada doble en tono mayor agradable
  playSuccess() {
    if (!state.audioHabilitado) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    // Tono 1 (Do alto)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, t); // C5
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.35);

    // Tono 2 (Mi alto)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, t + 0.12); // E5
    gain2.gain.setValueAtTime(0.35, t + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t + 0.12);
    osc2.stop(t + 0.55);
  }

  // Sonido de advertencia: tono doble de alerta (ya registrado)
  playWarning() {
    if (!state.audioHabilitado) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(370, t + 0.15);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // Sonido de error: tono grave corto (no encontrado / lectura fallida)
  playError() {
    if (!state.audioHabilitado) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.3);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }
}

const sfx = new SoundEffects();

// ─── Inicialización al Cargar la Página ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupLiveClock();
  setupAudioToggle();
  setupScanner();
  setupManualSearch();
  setupAsistentes();
  setupConfiguracion();
  setupModals();
  setupResponsiveSidebar();

  cargarConfiguracion();
  cargarDashboard();
  cargarAsistentes();

  // Actualizar dashboard periódicamente cada 6 segundos
  setInterval(() => {
    if (state.paginaActual === 'page-dashboard') {
      cargarDashboard();
    }
  }, 6000);
});

// ─── Navegación entre Pestañas ─────────────────────────────────────────────────
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const pageTitle = document.getElementById('pageTitle');

  const titulos = {
    'page-escaner': 'Control de Ingreso - Escáner NewPrint X1',
    'page-dashboard': 'Dashboard de Asistencia en Tiempo Real',
    'page-asistentes': 'Base de Datos de Asistentes',
    'page-reportes': 'Generación y Descarga de Reportes',
    'page-configuracion': 'Configuración del Evento y Red'
  };

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPageId = link.getAttribute('data-page');

      // Actualizar links activos
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Cambiar de página
      pages.forEach(p => p.classList.remove('active'));
      const targetPage = document.getElementById(targetPageId);
      if (targetPage) targetPage.classList.add('active');

      state.paginaActual = targetPageId;
      if (pageTitle) pageTitle.textContent = titulos[targetPageId] || 'Control de Acceso';

      // Cerrar sidebar en móviles
      closeMobileSidebar();

      // Si vuelve al escáner, auto-enfocar input
      if (targetPageId === 'page-escaner') {
        const input = document.getElementById('scannerInput');
        if (input) {
          input.focus();
          input.select();
        }
      }

      // Si va al dashboard, refrescar datos
      if (targetPageId === 'page-dashboard') {
        cargarDashboard();
      }

      // Si va a asistentes, recargar
      if (targetPageId === 'page-asistentes') {
        cargarAsistentes();
      }
    });
  });
}

// ─── Reloj en Vivo ─────────────────────────────────────────────────────────────
function setupLiveClock() {
  const clockEl = document.getElementById('liveClock');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
  update();
  setInterval(update, 1000);
}

// ─── Control de Sonido ─────────────────────────────────────────────────────────
function setupAudioToggle() {
  const btn = document.getElementById('btnAudioToggle');
  const icon = document.getElementById('audioIcon');
  const text = document.getElementById('audioText');

  btn.addEventListener('click', () => {
    sfx.init(); // Inicializar contexto de audio en primer clic
    state.audioHabilitado = !state.audioHabilitado;
    if (state.audioHabilitado) {
      icon.textContent = '🔊';
      text.textContent = 'Sonido';
      sfx.playSuccess();
      mostrarToast('Sonido activado', 'success');
    } else {
      icon.textContent = '🔇';
      text.textContent = 'Silenciado';
      mostrarToast('Sonido silenciado', 'info');
    }
  });
}

// ─── Captura del Escáner NewPrint X1 ───────────────────────────────────────────
function setupScanner() {
  const scannerInput = document.getElementById('scannerInput');
  if (!scannerInput) return;

  // Garantizar enfoque inicial
  scannerInput.focus();

  // Si el usuario hace clic en cualquier parte de la pantalla de escaneo,
  // re-enfocar automáticamente el input para que el lector no pierda teclas
  document.addEventListener('click', (e) => {
    if (state.paginaActual === 'page-escaner') {
      const isInteractive = e.target.closest('button, input, select, a, textarea');
      if (!isInteractive && scannerInput) {
        scannerInput.focus();
      }
    }
  });

  // El lector USB NewPrint X1 emula un teclado y envía un 'Enter' al final
  scannerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const codigo = scannerInput.value.trim();
      if (codigo.length > 0) {
        procesarEscaneo(codigo);
      }
      scannerInput.value = '';
    }
  });
}

// Enviar código escaneado al backend
async function procesarEscaneo(codigo) {
  if (state.escaneoEnProgreso) return;
  state.escaneoEnProgreso = true;

  const scannerInput = document.getElementById('scannerInput');
  const resultCard = document.getElementById('scanResult');
  const statusText = document.getElementById('scannerStatusText');
  if (statusText) statusText.textContent = 'Procesando...';

  try {
    const res = await fetch('/api/escanear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo })
    });

    const data = await res.json();

    if (data.ok && data.tipo === 'ACCESO_CONCEDIDO') {
      // ✅ ACCESO PERMITIDO
      sfx.playSuccess();
      mostrarResultadoEscaneo('success', '✓ ACCESO PERMITIDO', data.mensaje, data.asistente);
      mostrarToast(`Ingreso: ${data.asistente.nombres} ${data.asistente.apellidos}`, 'success');
      actualizarMiniStats();
    } else if (data.tipo === 'YA_REGISTRADO') {
      // ⚠️ YA FUE REGISTRADO PREVIAMENTE
      sfx.playWarning();
      mostrarResultadoEscaneo('warning', '⚠️ YA REGISTRADO', data.mensaje, data.asistente);
      mostrarToast('Esta persona ya fue registrada anteriormente', 'warning');
    } else {
      // ❌ NO ENCONTRADO O ERROR
      sfx.playError();
      const asistenteFallback = {
        documento: data.documento || codigo,
        nombres: data.nombres || 'NO ENCONTRADO EN LISTA',
        apellidos: data.apellidos || '',
        tipo_documento: 'CC',
        hora_registro: '--:--:--'
      };
      mostrarResultadoEscaneo('error', '⛔ ACCESO DENEGADO', data.mensaje || 'Documento no registrado', asistenteFallback);
      mostrarToast(data.mensaje || 'Documento no encontrado', 'error');
    }

  } catch (err) {
    console.error('Error al procesar escaneo:', err);
    sfx.playError();
    mostrarToast('Error de conexión con el servidor', 'error');
  } finally {
    state.escaneoEnProgreso = false;
    if (statusText) statusText.textContent = 'Lector listo';
    if (scannerInput) {
      scannerInput.value = '';
      scannerInput.focus();
    }
  }
}

// Mostrar tarjeta visual de resultado
function mostrarResultadoEscaneo(tipo, titulo, subtitulo, asistente) {
  const resultCard = document.getElementById('scanResult');
  const resultIcon = document.getElementById('resultIcon');
  const resultStatus = document.getElementById('resultStatus');
  const resultSubtitle = document.getElementById('resultSubtitle');

  const resDoc = document.getElementById('resDocumento');
  const resNombres = document.getElementById('resNombres');
  const resApellidos = document.getElementById('resApellidos');
  const resTipoDoc = document.getElementById('resTipoDoc');
  const resHora = document.getElementById('resHora');

  // Clases de estilo
  resultCard.className = `scan-result visible ${tipo}`;

  if (tipo === 'success') resultIcon.textContent = '✓';
  else if (tipo === 'warning') resultIcon.textContent = '⚠️';
  else resultIcon.textContent = '✕';

  resultStatus.textContent = titulo;
  resultSubtitle.textContent = subtitulo;

  if (asistente) {
    resDoc.textContent = asistente.documento || '--';
    resNombres.textContent = asistente.nombres || '--';
    resApellidos.textContent = asistente.apellidos || '--';
    resHora.textContent = asistente.hora_registro || new Date().toLocaleTimeString('es-CO');

    if (resTipoDoc) {
      resTipoDoc.textContent = asistente.tipo_documento || 'CC';
    }
  }
}

// ─── Búsqueda Manual ───────────────────────────────────────────────────────────
function setupManualSearch() {
  const form = document.getElementById('formManualSearch');
  const input = document.getElementById('manualDocInput');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const doc = input.value.trim();
    if (doc) {
      procesarEscaneo(doc);
      input.value = '';
    }
  });
}

// ─── Mini Estadísticas de Turno ────────────────────────────────────────────────
async function actualizarMiniStats() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    if (data.ok && data.stats) {
      const { ingresados, pendientes, porcentaje } = data.stats;
      const elIngresados = document.getElementById('miniIngresados');
      const elPendientes = document.getElementById('miniPendientes');
      const elPct = document.getElementById('miniPorcentaje');

      if (elIngresados) elIngresados.textContent = ingresados;
      if (elPendientes) elPendientes.textContent = pendientes;
      if (elPct) elPct.textContent = `${porcentaje}%`;

      const badge = document.getElementById('badgeTotalAsistentes');
      if (badge) badge.textContent = data.stats.total;
    }
  } catch (err) {
    console.error('Error actualizando mini stats:', err);
  }
}

// ─── Dashboard Completo ────────────────────────────────────────────────────────
async function cargarDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    if (!data.ok) return;

    const { total, ingresados, pendientes, porcentaje } = data.stats;

    // Tarjetas principales
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statIngresados').textContent = ingresados;
    document.getElementById('statPendientes').textContent = pendientes;
    document.getElementById('statPorcentaje').textContent = `${porcentaje}%`;

    // Mini stats
    const elIng = document.getElementById('miniIngresados');
    const elPen = document.getElementById('miniPendientes');
    const elPct = document.getElementById('miniPorcentaje');
    if (elIng) elIng.textContent = ingresados;
    if (elPen) elPen.textContent = pendientes;
    if (elPct) elPct.textContent = `${porcentaje}%`;

    // Barra de progreso global
    document.getElementById('dashProgresoPct').textContent = `${porcentaje}%`;
    document.getElementById('dashProgresoFill').style.width = `${porcentaje}%`;

    // Badge sidebar
    const badge = document.getElementById('badgeTotalAsistentes');
    if (badge) badge.textContent = total;

    // Desglose por tipo de documento
    renderTiposDocumento(data.porTipoDocumento || []);

    // Últimos ingresos registrados
    renderUltimosIngresos(data.ultimosIngresos || []);

  } catch (err) {
    console.error('Error cargando dashboard:', err);
  }
}

function renderTiposDocumento(tipos) {
  const container = document.getElementById('tipoDocBars');
  if (!container) return;

  if (tipos.length === 0) {
    container.innerHTML = '<div class="text-muted" style="text-align: center; padding: 20px;">No hay datos de tipos de documento.</div>';
    return;
  }

  let html = '';
  tipos.forEach(item => {
    const total = item.total || 0;
    const ing = item.ingresados || 0;
    const pct = total > 0 ? Math.round((ing / total) * 100) : 0;

    html += `
      <div class="chart-bar-item">
        <div class="chart-bar-label">${item.tipo_documento || 'CC'}</div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width: ${pct}%;">
            ${pct > 15 ? pct + '%' : ''}
          </div>
        </div>
        <div class="chart-bar-count">${ing}/${total}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderUltimosIngresos(registros) {
  const container = document.getElementById('recentEntriesList');
  if (!container) return;

  if (registros.length === 0) {
    container.innerHTML = '<div class="text-muted" style="text-align: center; padding: 20px;">No hay ingresos recientes.</div>';
    return;
  }

  let html = '';
  registros.forEach(r => {
    const iniciales = ((r.nombres?.[0] || '') + (r.apellidos?.[0] || '')).toUpperCase() || 'ID';
    const fecha = new Date(r.fecha_hora);
    const hora = fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    html += `
      <div class="recent-item">
        <div class="recent-avatar">${iniciales}</div>
        <div class="recent-info">
          <div class="recent-name">${r.nombres} ${r.apellidos}</div>
          <div class="recent-doc">${r.tipo_documento || 'CC'}: ${r.documento}</div>
        </div>
        <div class="recent-time">🕒 ${hora}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ─── Gestión de Asistentes ─────────────────────────────────────────────────────
function setupAsistentes() {
  const filtroBuscar = document.getElementById('filtroBuscar');
  const filtroEstado = document.getElementById('filtroEstado');
  const btnRefrescarDash = document.getElementById('btnRefrescarDash');

  if (btnRefrescarDash) {
    btnRefrescarDash.addEventListener('click', () => {
      cargarDashboard();
      mostrarToast('Dashboard actualizado', 'info');
    });
  }

  if (filtroBuscar) {
    filtroBuscar.addEventListener('input', () => {
      clearTimeout(state.busquedaDebounce);
      state.busquedaDebounce = setTimeout(() => {
        state.paginaAsistentes = 1;
        cargarAsistentes();
      }, 300);
    });
  }

  if (filtroEstado) {
    filtroEstado.addEventListener('change', () => {
      state.paginaAsistentes = 1;
      cargarAsistentes();
    });
  }
}

async function cargarAsistentes() {
  const tbody = document.getElementById('tablaAsistentesBody');
  if (!tbody) return;

  const buscar = document.getElementById('filtroBuscar')?.value.trim() || '';
  const estado = document.getElementById('filtroEstado')?.value || '';

  const params = new URLSearchParams({
    pagina: state.paginaAsistentes,
    limite: state.limitePorPagina,
    buscar,
    estado
  });

  try {
    const res = await fetch(`/api/asistentes?${params}`);
    const data = await res.json();

    if (!data.ok) return;

    state.totalPaginas = Math.ceil(data.total / state.limitePorPagina) || 1;

    renderTablaAsistentes(data.asistentes);
    renderPaginacion(data.total);

  } catch (err) {
    console.error('Error cargando asistentes:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #e74c3c;">Error al cargar asistentes</td></tr>';
  }
}

function renderTablaAsistentes(asistentes) {
  const tbody = document.getElementById('tablaAsistentesBody');
  if (!tbody) return;

  if (asistentes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
          No se encontraron asistentes con los filtros aplicados.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  asistentes.forEach(a => {
    const ingresado = a.registrado === 1;
    const statusPill = ingresado 
      ? `<span class="status-pill ingresado">✓ Ingresó</span>`
      : `<span class="status-pill pendiente">⏳ Pendiente</span>`;

    html += `
      <tr>
        <td>${statusPill}</td>
        <td><span class="badge-tipo">${a.tipo_documento || 'CC'}</span></td>
        <td class="td-doc">${a.documento}</td>
        <td class="td-name">${a.nombres}</td>
        <td class="td-name">${a.apellidos}</td>
        <td class="text-mono">${a.hora_registro || '—'}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button 
            class="btn ${ingresado ? 'btn-secondary' : 'btn-success'} btn-sm" 
            onclick="toggleIngresoManual(${a.id})"
            title="${ingresado ? 'Marcar como pendiente' : 'Registrar ingreso manual'}"
          >
            ${ingresado ? '↩ Desmarcar' : '⚡ Ingresar'}
          </button>
          <button 
            class="btn btn-danger btn-sm" 
            onclick="eliminarAsistente(${a.id}, '${a.nombres} ${a.apellidos}')"
            title="Eliminar asistente"
          >
            🗑️
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderPaginacion(total) {
  const container = document.getElementById('paginacionContainer');
  if (!container) return;

  if (state.totalPaginas <= 1) {
    container.innerHTML = `<span class="text-muted text-small">${total} asistente(s) registrado(s)</span>`;
    return;
  }

  let html = `
    <button class="page-btn" ${state.paginaAsistentes === 1 ? 'disabled' : ''} onclick="cambiarPagina(${state.paginaAsistentes - 1})">«</button>
  `;

  for (let i = 1; i <= state.totalPaginas; i++) {
    if (i === 1 || i === state.totalPaginas || (i >= state.paginaAsistentes - 1 && i <= state.paginaAsistentes + 1)) {
      html += `
        <button class="page-btn ${i === state.paginaAsistentes ? 'active' : ''}" onclick="cambiarPagina(${i})">${i}</button>
      `;
    } else if (i === state.paginaAsistentes - 2 || i === state.paginaAsistentes + 2) {
      html += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
    }
  }

  html += `
    <button class="page-btn" ${state.paginaAsistentes === state.totalPaginas ? 'disabled' : ''} onclick="cambiarPagina(${state.paginaAsistentes + 1})">»</button>
    <span class="text-muted text-small" style="margin-left: 10px;">Total: ${total}</span>
  `;

  container.innerHTML = html;
}

window.cambiarPagina = function(p) {
  if (p < 1 || p > state.totalPaginas) return;
  state.paginaAsistentes = p;
  cargarAsistentes();
};

window.toggleIngresoManual = async function(id) {
  try {
    const res = await fetch(`/api/asistentes/${id}/marcar-ingreso`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      if (data.accion === 'INGRESADO') sfx.playSuccess();
      mostrarToast(data.mensaje, 'success');
      cargarAsistentes();
      cargarDashboard();
    }
  } catch (err) {
    mostrarToast('Error al modificar estado', 'error');
  }
};

window.eliminarAsistente = async function(id, nombre) {
  if (!confirm(`¿Estás seguro de eliminar a ${nombre} de la lista?`)) return;

  try {
    const res = await fetch(`/api/asistentes/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      mostrarToast('Asistente eliminado', 'info');
      cargarAsistentes();
      cargarDashboard();
    }
  } catch (err) {
    mostrarToast('Error al eliminar', 'error');
  }
};

// ─── Modales ───────────────────────────────────────────────────────────────────
function setupModals() {
  // Botones para abrir modales
  document.getElementById('btnModalNuevoAsistente')?.addEventListener('click', () => {
    abrirModal('modalNuevoAsistente');
  });

  document.getElementById('btnModalImportar')?.addEventListener('click', () => {
    abrirModal('modalImportar');
  });

  // Botones para cerrar modales
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      cerrarModal(modalId);
    });
  });

  // Cerrar al hacer clic en fondo oscuro
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
      }
    });
  });

  // Formulario nuevo asistente
  const formNuevo = document.getElementById('formNuevoAsistente');
  if (formNuevo) {
    formNuevo.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        documento: document.getElementById('newDocumento').value.trim(),
        nombres: document.getElementById('newNombres').value.trim(),
        apellidos: document.getElementById('newApellidos').value.trim(),
        tipo_documento: document.getElementById('newTipoDoc').value
      };

      try {
        const res = await fetch('/api/asistentes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();

        if (data.ok) {
          mostrarToast('Asistente creado exitosamente', 'success');
          formNuevo.reset();
          cerrarModal('modalNuevoAsistente');
          cargarAsistentes();
          cargarDashboard();
        } else {
          mostrarToast(data.mensaje || 'Error al guardar', 'error');
        }
      } catch (err) {
        mostrarToast('Error de conexión', 'error');
      }
    });
  }

  // Formulario de importación de archivo
  const formImportar = document.getElementById('formImportar');
  const archivoInput = document.getElementById('archivoImportar');
  const archivoLabel = document.getElementById('archivoLabel');
  const btnSubir = document.getElementById('btnSubirArchivo');

  if (archivoInput && archivoLabel) {
    archivoInput.addEventListener('change', () => {
      if (archivoInput.files.length > 0) {
        archivoLabel.textContent = `Archivo seleccionado: ${archivoInput.files[0].name}`;
      } else {
        archivoLabel.textContent = 'Haz clic para seleccionar el archivo';
      }
    });
  }

  if (formImportar) {
    formImportar.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!archivoInput.files.length) {
        mostrarToast('Selecciona un archivo', 'warning');
        return;
      }

      btnSubir.disabled = true;
      btnSubir.innerHTML = '<span class="spinner"></span> Importando...';

      const formData = new FormData();
      formData.append('archivo', archivoInput.files[0]);

      try {
        const res = await fetch('/api/importar', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.ok) {
          mostrarToast(data.mensaje, 'success');
          cerrarModal('modalImportar');
          formImportar.reset();
          archivoLabel.textContent = 'Haz clic para seleccionar el archivo';
          cargarAsistentes();
          cargarDashboard();
        } else {
          mostrarToast(data.mensaje || 'Error al importar', 'error');
        }
      } catch (err) {
        mostrarToast('Error procesando el archivo', 'error');
      } finally {
        btnSubir.disabled = false;
        btnSubir.textContent = 'Comenzar Importación';
      }
    });
  }
}

function abrirModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function cerrarModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// ─── Configuración del Evento ──────────────────────────────────────────────────
function setupConfiguracion() {
  const form = document.getElementById('formConfigEvento');
  const btnReiniciar = document.getElementById('btnReiniciarTodo');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        nombre_evento: document.getElementById('cfgNombreEvento').value.trim(),
        fecha_evento: document.getElementById('cfgFechaEvento').value,
        lugar_evento: document.getElementById('cfgLugarEvento').value.trim()
      };

      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.ok) {
          mostrarToast('Configuración guardada', 'success');
          cargarConfiguracion();
        }
      } catch (err) {
        mostrarToast('Error al guardar configuración', 'error');
      }
    });
  }

  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', async () => {
      const confirmar = confirm(
        '⚠️ ATENCIÓN: Esta acción revertirá el estado de TODOS los asistentes a PENDIENTE y borrará el historial de ingresos.\n\n¿Deseas continuar?'
      );
      if (!confirmar) return;

      try {
        const res = await fetch('/api/reiniciar-todo', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          mostrarToast(data.mensaje, 'warning');
          cargarDashboard();
          cargarAsistentes();
          const resultCard = document.getElementById('scanResult');
          if (resultCard) resultCard.className = 'scan-result';
        }
      } catch (err) {
        mostrarToast('Error al reiniciar', 'error');
      }
    });
  }
}

async function cargarConfiguracion() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.ok && data.config) {
      const cfg = data.config;
      const elNombre = document.getElementById('sidebarEventName');
      const elFecha = document.getElementById('sidebarEventDate');
      const cfgNombre = document.getElementById('cfgNombreEvento');
      const cfgFecha = document.getElementById('cfgFechaEvento');
      const cfgLugar = document.getElementById('cfgLugarEvento');

      if (elNombre) elNombre.textContent = cfg.nombre_evento || 'Evento';
      if (elFecha) elFecha.textContent = cfg.fecha_evento || '--/--/----';
      if (cfgNombre) cfgNombre.value = cfg.nombre_evento || '';
      if (cfgFecha) cfgFecha.value = cfg.fecha_evento || '';
      if (cfgLugar) cfgLugar.value = cfg.lugar_evento || '';

      // Actualizar pista de IP local
      const host = window.location.host;
      const elIp = document.getElementById('localIpHint');
      if (elIp) elIp.textContent = `http://${host}`;
    }
  } catch (err) {
    console.error('Error cargando configuración:', err);
  }
}

// ─── Sidebar Móvil ─────────────────────────────────────────────────────────────
function setupResponsiveSidebar() {
  const btnToggle = document.getElementById('btnToggleSidebar');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (btnToggle && sidebar && overlay) {
    btnToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });

    overlay.addEventListener('click', closeMobileSidebar);
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// ─── Sistema de Notificaciones Toast ───────────────────────────────────────────
function mostrarToast(mensaje, tipo = 'info', titulo = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconos = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `
    <span class="toast-icon">${iconos[tipo] || 'ℹ️'}</span>
    <div class="toast-content">
      ${titulo ? `<div class="toast-title">${titulo}</div>` : ''}
      <div class="toast-message">${mensaje}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

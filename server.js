/**
 * Sistema de Control de Acceso a Eventos
 * Servidor principal - Express + SQLite
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Base de Datos ─────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'data', 'eventos.db');
const db = new Database(DB_PATH);

// Habilitar WAL para mejor rendimiento
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Inicialización de Tablas ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS asistentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documento TEXT NOT NULL UNIQUE,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    tipo_documento TEXT DEFAULT 'CC',
    registrado INTEGER DEFAULT 0,
    fecha_registro DATETIME,
    hora_registro TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documento TEXT NOT NULL,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    tipo_documento TEXT DEFAULT 'CC',
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    metodo TEXT DEFAULT 'ESCANER',
    operador TEXT DEFAULT 'Sistema'
  );

  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );
`);

// Insertar configuración por defecto si no existe
const insertConfig = db.prepare(`
  INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)
`);
insertConfig.run('nombre_evento', 'Evento de Control de Acceso');
insertConfig.run('fecha_evento', new Date().toISOString().split('T')[0]);
insertConfig.run('lugar_evento', 'Por definir');

// ─── Seed de Datos de Prueba ───────────────────────────────────────────────────
function seedDatosPrueba() {
  const count = db.prepare('SELECT COUNT(*) as c FROM asistentes').get();
  if (count.c > 0) return;

  const asistentes = [
    { documento: '1234567890', nombres: 'CARLOS ANDRÉS', apellidos: 'GÓMEZ RODRÍGUEZ', tipo: 'CC' },
    { documento: '9876543210', nombres: 'MARÍA FERNANDA', apellidos: 'LÓPEZ MARTÍNEZ', tipo: 'CC' },
    { documento: '1122334455', nombres: 'JUAN PABLO', apellidos: 'HERNÁNDEZ TORRES', tipo: 'CC' },
    { documento: '5544332211', nombres: 'ANA LUCÍA', apellidos: 'RAMÍREZ VILLA', tipo: 'CC' },
    { documento: '9988776655', nombres: 'PEDRO JOSÉ', apellidos: 'CASTILLO MORALES', tipo: 'CC' },
    { documento: '1029384756', nombres: 'VALENTINA', apellidos: 'VARGAS QUINTERO', tipo: 'CC' },
    { documento: '6574839201', nombres: 'ANDRÉS FELIPE', apellidos: 'SUÁREZ PATIÑO', tipo: 'CC' },
    { documento: '1928374650', nombres: 'LAURA CRISTINA', apellidos: 'JIMÉNEZ ARANGO', tipo: 'CC' },
    { documento: '1123456789', nombres: 'SANTIAGO', apellidos: 'RESTREPO CARDONA', tipo: 'CC' },
    { documento: '9087654321', nombres: 'DANIELA PAOLA', apellidos: 'MEJÍA FRANCO', tipo: 'CC' },
    { documento: '1357924680', nombres: 'MIGUEL ÁNGEL', apellidos: 'SÁNCHEZ RÍOS', tipo: 'CC' },
    { documento: '2468013579', nombres: 'ISABELA', apellidos: 'RUEDA MONTOYA', tipo: 'CC' },
    { documento: '1470258369', nombres: 'CAMILO ERNESTO', apellidos: 'AGUILAR OSPINA', tipo: 'CC' },
    { documento: '3692581470', nombres: 'SOFÍA ALEJANDRA', apellidos: 'PEDRAZA NIÑO', tipo: 'CC' },
    { documento: '8520741963', nombres: 'JUAN SEBASTIÁN', apellidos: 'BERMÚDEZ OCHOA', tipo: 'CC' },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO asistentes (documento, nombres, apellidos, tipo_documento)
    VALUES (@documento, @nombres, @apellidos, @tipo)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) insert.run(item);
  });

  insertMany(asistentes);
  console.log(`✅ ${asistentes.length} asistentes de prueba creados.`);
}

seedDatosPrueba();

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// ─── Parser de Código de Barras PDF417 Colombiano ─────────────────────────────
/**
 * La cédula de ciudadanía colombiana (formato PDF417) almacena los datos codificados.
 * Dependiendo de la configuración del lector NewPrint X1 (USB HID teclado), puede enviar:
 * 1. Formato estándar Registraduría (crudo con posiciones fijas o separadores de control):
 *    - Caracteres de control iniciales / cabecera
 *    - Documento de 10 dígitos (con ceros a la izquierda)
 *    - Primer apellido (hasta 20 chars), Segundo apellido (hasta 20 chars)
 *    - Primer nombre (hasta 20 chars), Segundo nombre (hasta 20 chars)
 * 2. Formato delimitado por '=', ';', '|' o comas según perfiles de escáner.
 * 3. Número de cédula directo (ingreso rápido o lectores con filtro de prefijo).
 */
function parsearCodigoBarras(rawData) {
  if (!rawData || typeof rawData !== 'string') return null;

  let data = rawData.trim();
  if (!data) return null;

  // Limpiar caracteres de control no imprimibles (ASCII < 32 excepto tabs/enters)
  const cleaned = data.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').trim();

  // Caso 1: Separado por '=' (Ej: GOMEZ RODRIGUEZ=CARLOS ANDRES=1234567890=...)
  if (data.includes('=')) {
    const parts = data.split('=').map(p => p.trim());
    if (parts.length >= 3) {
      return {
        apellidos: limpiarTexto(parts[0]),
        nombres: limpiarTexto(parts[1]),
        documento: extraerNumero(parts[2]),
        raw: data
      };
    }
  }

  // Caso 2: Separado por ';' (Ej: GOMEZ;CARLOS;1234567890)
  if (data.includes(';')) {
    const parts = data.split(';').map(p => p.trim());
    if (parts.length >= 3) {
      // Determinar cuál posición tiene el documento numérico
      let doc = null, nom = '', ape = '';
      for (let i = 0; i < parts.length; i++) {
        const num = extraerNumero(parts[i]);
        if (num && num.length >= 6 && num.length <= 11) {
          doc = num;
          if (i === 0) {
            ape = parts[1] || '';
            nom = parts[2] || '';
          } else if (i === 2) {
            ape = parts[0] || '';
            nom = parts[1] || '';
          } else {
            ape = parts[0] || '';
            nom = parts[2] || '';
          }
          break;
        }
      }
      if (doc) {
        return { apellidos: limpiarTexto(ape), nombres: limpiarTexto(nom), documento: doc, raw: data };
      }
    }
  }

  // Caso 3: Separado por '|'
  if (data.includes('|')) {
    const parts = data.split('|').map(p => p.trim());
    if (parts.length >= 3) {
      return {
        apellidos: limpiarTexto(parts[0]),
        nombres: limpiarTexto(parts[1]),
        documento: extraerNumero(parts[2]),
        raw: data
      };
    }
  }

  // Caso 4: Formato estándar Registraduría Nacional de Colombia (PDF417 crudo)
  // Generalmente contiene 10 dígitos numéricos seguidos de texto en mayúsculas
  // Ejemplo: ...0001020304050GOMEZ<RODRIGUEZ<CARLOS<ANDRES... o cadenas similares
  const regexCedula = /(\d{8,11})([A-ZÁÉÍÓÚÜÑ\s<]{4,})/i;
  const matchReg = cleaned.match(regexCedula);
  if (matchReg) {
    const doc = matchReg[1].replace(/^0+/, ''); // Quitar ceros a la izquierda
    const textPart = matchReg[2].replace(/</g, ' ').trim();
    const words = textPart.split(/\s+/).filter(w => w.length > 1);
    let apellidos = '';
    let nombres = '';
    if (words.length >= 4) {
      apellidos = `${words[0]} ${words[1]}`;
      nombres = words.slice(2).join(' ');
    } else if (words.length >= 2) {
      apellidos = words[0];
      nombres = words.slice(1).join(' ');
    }
    return {
      documento: doc,
      apellidos: limpiarTexto(apellidos) || null,
      nombres: limpiarTexto(nombres) || null,
      raw: data
    };
  }

  // Caso 5: Secuencia que contiene un número de documento de 6 a 11 dígitos
  // Si tiene ceros a la izquierda e.g. 000123456789
  const numMatches = cleaned.match(/\b0*(\d{6,11})\b/);
  if (numMatches) {
    return {
      documento: numMatches[1],
      nombres: null,
      apellidos: null,
      raw: data
    };
  }

  // Caso 6: Solo número
  const soloNum = extraerNumero(data);
  if (soloNum && soloNum.length >= 5) {
    return {
      documento: soloNum,
      nombres: null,
      apellidos: null,
      raw: data
    };
  }

  return { raw: data, documento: null, nombres: null, apellidos: null };
}

function limpiarTexto(texto) {
  if (!texto) return '';
  return texto.trim().toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function extraerNumero(texto) {
  if (!texto) return null;
  const num = texto.replace(/\D/g, '').trim();
  // Quitar ceros excedentes al inicio si es un documento de 10 caracteres como 00012345678
  if (num.length > 10 && num.startsWith('00')) {
    return num.replace(/^0+/, '');
  }
  return num || null;
}

// ─── API Routes ────────────────────────────────────────────────────────────────

// GET /api/config - Obtener configuración del evento
app.get('/api/config', (req, res) => {
  const rows = db.prepare('SELECT clave, valor FROM configuracion').all();
  const config = {};
  rows.forEach(r => { config[r.clave] = r.valor; });
  res.json({ ok: true, config });
});

// POST /api/config - Actualizar configuración
app.post('/api/config', (req, res) => {
  const { nombre_evento, fecha_evento, lugar_evento } = req.body;
  const update = db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)');
  const tx = db.transaction(() => {
    if (nombre_evento) update.run('nombre_evento', nombre_evento);
    if (fecha_evento) update.run('fecha_evento', fecha_evento);
    if (lugar_evento) update.run('lugar_evento', lugar_evento);
  });
  tx();
  res.json({ ok: true, mensaje: 'Configuración actualizada' });
});

// POST /api/escanear - Procesar código escaneado
app.post('/api/escanear', (req, res) => {
  const { codigo } = req.body;

  if (!codigo || codigo.trim() === '') {
    return res.status(400).json({ ok: false, mensaje: 'Código vacío' });
  }

  const parsed = parsearCodigoBarras(codigo);

  if (!parsed || !parsed.documento) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer el código de barras. Intente de nuevo.',
      raw: codigo
    });
  }

  // Buscar en la base de datos
  const asistente = db.prepare(
    'SELECT * FROM asistentes WHERE documento = ?'
  ).get(parsed.documento);

  if (!asistente) {
    return res.json({
      ok: false,
      tipo: 'NO_ENCONTRADO',
      mensaje: 'Documento no encontrado en la lista de asistentes.',
      documento: parsed.documento,
      nombres: parsed.nombres || '—',
      apellidos: parsed.apellidos || '—'
    });
  }

  if (asistente.registrado === 1) {
    return res.json({
      ok: false,
      tipo: 'YA_REGISTRADO',
      mensaje: `${asistente.nombres} ${asistente.apellidos} ya fue registrado/a a las ${asistente.hora_registro}.`,
      asistente: {
        documento: asistente.documento,
        nombres: asistente.nombres,
        apellidos: asistente.apellidos,
        tipo_documento: asistente.tipo_documento,
        fecha_registro: asistente.fecha_registro,
        hora_registro: asistente.hora_registro
      }
    });
  }

  // Registrar ingreso
  const ahora = new Date();
  const fechaISO = ahora.toISOString();
  const hora = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  db.prepare(`
    UPDATE asistentes
    SET registrado = 1, fecha_registro = ?, hora_registro = ?
    WHERE documento = ?
  `).run(fechaISO, hora, asistente.documento);

  db.prepare(`
    INSERT INTO registros (documento, nombres, apellidos, tipo_documento, fecha_hora, metodo)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(asistente.documento, asistente.nombres, asistente.apellidos, asistente.tipo_documento, fechaISO, 'ESCANER');

  res.json({
    ok: true,
    tipo: 'ACCESO_CONCEDIDO',
    mensaje: `¡Bienvenido/a, ${asistente.nombres}!`,
    asistente: {
      documento: asistente.documento,
      nombres: asistente.nombres,
      apellidos: asistente.apellidos,
      tipo_documento: asistente.tipo_documento,
      hora_registro: hora
    }
  });
});

// POST /api/buscar - Buscar asistente por documento (manual)
app.post('/api/buscar', (req, res) => {
  const { documento } = req.body;
  if (!documento) return res.status(400).json({ ok: false, mensaje: 'Documento requerido' });

  const asistente = db.prepare('SELECT * FROM asistentes WHERE documento = ?').get(documento.trim());
  if (!asistente) return res.json({ ok: false, mensaje: 'No encontrado' });

  res.json({ ok: true, asistente });
});

// GET /api/dashboard - Estadísticas en tiempo real
app.get('/api/dashboard', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM asistentes').get().c;
  const ingresados = db.prepare('SELECT COUNT(*) as c FROM asistentes WHERE registrado = 1').get().c;
  const pendientes = total - ingresados;
  const porcentaje = total > 0 ? Math.round((ingresados / total) * 100) : 0;

  const porTipoDocumento = db.prepare(`
    SELECT tipo_documento, 
           COUNT(*) as total, 
           SUM(registrado) as ingresados
    FROM asistentes 
    GROUP BY tipo_documento
  `).all();

  const ultimosIngresos = db.prepare(`
    SELECT r.nombres, r.apellidos, r.documento, r.tipo_documento, r.fecha_hora, r.metodo
    FROM registros r
    ORDER BY r.fecha_hora DESC
    LIMIT 10
  `).all();

  const ingresosPorHora = db.prepare(`
    SELECT strftime('%H:00', fecha_hora) as hora, COUNT(*) as cantidad
    FROM registros
    WHERE date(fecha_hora) = date('now')
    GROUP BY hora
    ORDER BY hora
  `).all();

  res.json({
    ok: true,
    stats: { total, ingresados, pendientes, porcentaje },
    porTipoDocumento,
    ultimosIngresos,
    ingresosPorHora
  });
});

// GET /api/asistentes - Lista completa de asistentes
app.get('/api/asistentes', (req, res) => {
  const { buscar, estado, pagina = 1, limite = 50 } = req.query;
  const offset = (parseInt(pagina) - 1) * parseInt(limite);

  let where = [];
  let params = [];

  if (buscar) {
    where.push('(nombres LIKE ? OR apellidos LIKE ? OR documento LIKE ?)');
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  if (estado === 'registrado') { where.push('registrado = 1'); }
  if (estado === 'pendiente') { where.push('registrado = 0'); }

  const whereStr = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) as c FROM asistentes ${whereStr}`).get(...params).c;
  const filas = db.prepare(`
    SELECT * FROM asistentes ${whereStr}
    ORDER BY apellidos, nombres
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limite), offset);

  res.json({ ok: true, total, pagina: parseInt(pagina), limite: parseInt(limite), asistentes: filas });
});

// POST /api/asistentes - Agregar asistente
app.post('/api/asistentes', (req, res) => {
  const { documento, nombres, apellidos, tipo_documento = 'CC' } = req.body;

  if (!documento || !nombres || !apellidos) {
    return res.status(400).json({ ok: false, mensaje: 'Documento, nombres y apellidos son requeridos' });
  }

  try {
    db.prepare(`
      INSERT INTO asistentes (documento, nombres, apellidos, tipo_documento)
      VALUES (?, ?, ?, ?)
    `).run(documento.trim(), nombres.toUpperCase().trim(), apellidos.toUpperCase().trim(), tipo_documento);

    res.json({ ok: true, mensaje: 'Asistente agregado correctamente' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe un asistente con ese documento' });
    }
    res.status(500).json({ ok: false, mensaje: err.message });
  }
});

// PUT /api/asistentes/:id - Actualizar asistente
app.put('/api/asistentes/:id', (req, res) => {
  const { nombres, apellidos, tipo_documento } = req.body;
  const { id } = req.params;

  db.prepare(`
    UPDATE asistentes
    SET nombres = ?, apellidos = ?, tipo_documento = ?
    WHERE id = ?
  `).run(nombres?.toUpperCase(), apellidos?.toUpperCase(), tipo_documento, id);

  res.json({ ok: true, mensaje: 'Actualizado' });
});

// DELETE /api/asistentes/:id - Eliminar asistente
app.delete('/api/asistentes/:id', (req, res) => {
  db.prepare('DELETE FROM asistentes WHERE id = ?').run(req.params.id);
  res.json({ ok: true, mensaje: 'Eliminado' });
});

// POST /api/asistentes/:id/reiniciar - Reiniciar registro de asistente
app.post('/api/asistentes/:id/reiniciar', (req, res) => {
  db.prepare(`
    UPDATE asistentes SET registrado = 0, fecha_registro = NULL, hora_registro = NULL WHERE id = ?
  `).run(req.params.id);
  res.json({ ok: true, mensaje: 'Registro reiniciado' });
});

// POST /api/asistentes/:id/marcar-ingreso - Marcar o desmarcar ingreso manual
app.post('/api/asistentes/:id/marcar-ingreso', (req, res) => {
  const { id } = req.params;
  const asistente = db.prepare('SELECT * FROM asistentes WHERE id = ?').get(id);

  if (!asistente) {
    return res.status(404).json({ ok: false, mensaje: 'Asistente no encontrado' });
  }

  if (asistente.registrado === 1) {
    // Si ya está registrado, lo desmarcamos
    db.prepare('UPDATE asistentes SET registrado = 0, fecha_registro = NULL, hora_registro = NULL WHERE id = ?').run(id);
    return res.json({ ok: true, accion: 'DESMARCADO', mensaje: `Ingreso revertido para ${asistente.nombres} ${asistente.apellidos}` });
  } else {
    // Si está pendiente, registramos ingreso
    const ahora = new Date();
    const fechaISO = ahora.toISOString();
    const hora = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    db.prepare(`
      UPDATE asistentes
      SET registrado = 1, fecha_registro = ?, hora_registro = ?
      WHERE id = ?
    `).run(fechaISO, hora, id);

    db.prepare(`
      INSERT INTO registros (documento, nombres, apellidos, tipo_documento, fecha_hora, metodo)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(asistente.documento, asistente.nombres, asistente.apellidos, asistente.tipo_documento, fechaISO, 'MANUAL');

    return res.json({
      ok: true,
      accion: 'INGRESADO',
      mensaje: `Ingreso registrado para ${asistente.nombres} ${asistente.apellidos}`,
      hora
    });
  }
});

// GET /api/plantilla - Descargar plantilla Excel para importar
app.get('/api/plantilla', (req, res) => {
  const wb = xlsx.utils.book_new();
  const wsData = [
    ['Documento', 'Nombres', 'Apellidos', 'Tipo_Documento'],
    ['1020304050', 'JUAN CARLOS', 'PEREZ GOMEZ', 'CC'],
    ['987654321', 'MARIA CAMILA', 'RODRIGUEZ SILVA', 'CC'],
    ['1122334455', 'ANDRES FELIPE', 'LOPEZ CASTRO', 'CC']
  ];
  const ws = xlsx.utils.aoa_to_sheet(wsData);
  xlsx.utils.book_append_sheet(wb, ws, 'Plantilla Asistentes');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_asistentes.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// POST /api/importar - Importar asistentes desde archivo Excel o CSV
app.post('/api/importar', upload.single('archivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, mensaje: 'No se subió ningún archivo' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!data || data.length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'El archivo está vacío' });
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO asistentes (documento, nombres, apellidos, tipo_documento)
      VALUES (?, ?, ?, ?)
    `);

    let insertados = 0;
    let omitidos = 0;

    const insertTx = db.transaction((rows) => {
      for (const row of rows) {
        // Normalizar nombres de columnas (insensible a mayúsculas/minúsculas)
        const keys = Object.keys(row);
        const findKey = (candidates) => {
          const k = keys.find(key => candidates.includes(key.trim().toLowerCase()));
          return k ? String(row[k]).trim() : '';
        };

        const documento = extraerNumero(findKey(['documento', 'cedula', 'identificacion', 'doc', 'id', 'numero']));
        const nombres = findKey(['nombres', 'nombre', 'first_name']).toUpperCase();
        const apellidos = findKey(['apellidos', 'apellido', 'last_name']).toUpperCase();
        const tipoDoc = findKey(['tipo_documento', 'tipo_doc', 'tipo documento', 'tipo', 'tipodoc']) || 'CC';

        if (documento && (nombres || apellidos)) {
          const result = insert.run(
            documento,
            nombres || 'SIN NOMBRE',
            apellidos || 'SIN APELLIDO',
            tipoDoc
          );
          if (result.changes > 0) insertados++;
          else omitidos++;
        } else {
          omitidos++;
        }
      }
    });

    insertTx(data);

    res.json({
      ok: true,
      mensaje: `Importación completada: ${insertados} agregados, ${omitidos} omitidos o ya existentes.`,
      insertados,
      omitidos,
      totalProcesados: data.length
    });
  } catch (err) {
    console.error('Error importando archivo:', err);
    res.status(500).json({ ok: false, mensaje: 'Error al procesar el archivo: ' + err.message });
  }
});

// POST /api/reiniciar-todo - Reiniciar todos los registros
app.post('/api/reiniciar-todo', (req, res) => {
  db.prepare('UPDATE asistentes SET registrado = 0, fecha_registro = NULL, hora_registro = NULL').run();
  db.prepare('DELETE FROM registros').run();
  res.json({ ok: true, mensaje: 'Todos los registros han sido reiniciados' });
});

// GET /api/reporte - Descargar reporte Excel
app.get('/api/reporte', (req, res) => {
  const config = {};
  db.prepare('SELECT clave, valor FROM configuracion').all().forEach(r => { config[r.clave] = r.valor; });

  const asistentes = db.prepare('SELECT * FROM asistentes ORDER BY apellidos, nombres').all();
  const registros = db.prepare('SELECT * FROM registros ORDER BY fecha_hora').all();

  const wb = xlsx.utils.book_new();

  // Hoja 1: Todos los asistentes
  const wsData1 = [
    ['SISTEMA DE CONTROL DE ACCESO - ' + config.nombre_evento],
    ['Fecha:', config.fecha_evento, 'Lugar:', config.lugar_evento],
    [],
    ['#', 'Documento', 'Tipo Documento', 'Apellidos', 'Nombres', 'Estado', 'Hora de Ingreso']
  ];
  asistentes.forEach((a, i) => {
    wsData1.push([
      i + 1, a.documento, a.tipo_documento, a.apellidos, a.nombres,
      a.registrado ? 'INGRESÓ' : 'PENDIENTE', a.hora_registro || ''
    ]);
  });

  const ws1 = xlsx.utils.aoa_to_sheet(wsData1);
  xlsx.utils.book_append_sheet(wb, ws1, 'Lista Completa');

  // Hoja 2: Solo los que ingresaron
  const wsData2 = [
    ['REGISTRO DE INGRESOS'],
    [],
    ['#', 'Documento', 'Tipo Documento', 'Apellidos', 'Nombres', 'Fecha y Hora', 'Método']
  ];
  registros.forEach((r, i) => {
    wsData2.push([
      i + 1, r.documento, r.tipo_documento, r.apellidos, r.nombres,
      r.fecha_hora, r.metodo
    ]);
  });

  const ws2 = xlsx.utils.aoa_to_sheet(wsData2);
  xlsx.utils.book_append_sheet(wb, ws2, 'Ingresos');

  // Hoja 3: Resumen
  const stats = {
    total: asistentes.length,
    ingresados: asistentes.filter(a => a.registrado).length,
    pendientes: asistentes.filter(a => !a.registrado).length
  };

  const wsData3 = [
    ['RESUMEN ESTADÍSTICO'],
    [],
    ['Total registrados en lista:', stats.total],
    ['Total ingresados:', stats.ingresados],
    ['Total pendientes:', stats.pendientes],
    ['Porcentaje de asistencia:', `${Math.round((stats.ingresados / stats.total) * 100)}%`]
  ];

  const ws3 = xlsx.utils.aoa_to_sheet(wsData3);
  xlsx.utils.book_append_sheet(wb, ws3, 'Resumen');

  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename="reporte_evento_${Date.now()}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// GET /api/reporte/csv - Descargar reporte CSV
app.get('/api/reporte/csv', (req, res) => {
  const asistentes = db.prepare('SELECT * FROM asistentes ORDER BY apellidos, nombres').all();

  let csv = 'Documento,Tipo,Apellidos,Nombres,Estado,Hora Ingreso\n';
  asistentes.forEach(a => {
    csv += `"${a.documento}","${a.tipo_documento}","${a.apellidos}","${a.nombres}","${a.registrado ? 'INGRESÓ' : 'PENDIENTE'}","${a.hora_registro || ''}"\n`;
  });

  res.setHeader('Content-Disposition', `attachment; filename="reporte_${Date.now()}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('\ufeff' + csv); // BOM para UTF-8 en Excel
});

// Catch-all: devolver index.html para rutas SPA (Compatible con Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Arrancar Servidor ─────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const ips = [];

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address);
        }
      }
    }

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║   SISTEMA DE CONTROL DE ACCESO - EVENTO            ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║   Local:  http://localhost:${PORT}                    ║`);
    ips.forEach(ip => {
      console.log(`║   Red:    http://${ip}:${PORT}                  ║`);
    });
    console.log('╚════════════════════════════════════════════════════╝\n');
  });
}

app.parsearCodigoBarras = parsearCodigoBarras;
app.limpiarTexto = limpiarTexto;
app.extraerNumero = extraerNumero;
app.db = db;

module.exports = app;

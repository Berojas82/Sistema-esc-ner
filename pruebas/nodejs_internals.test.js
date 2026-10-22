/**
 * Pruebas Unitarias del Entorno e Internals de Node.js
 * Evalúa runtime, módulos nativos (fs, path, os), base de datos SQLite WAL,
 * transacciones atómicas, middlewares de Express y control de errores.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../server');

describe('Pruebas Unitarias de Node.js (Runtime, Módulos Nativos, SQLite y Middlewares)', () => {

  // ─── 1. RUNTIME Y MÓDULOS NATIVOS DE NODE.JS ────────────────────────────────
  describe('1. Runtime y Módulos Nativos de Node.js', () => {

    test('debe ejecutarse en una versión compatible de Node.js (>= v18)', () => {
      const version = process.version;
      const majorVersion = parseInt(version.replace('v', '').split('.')[0], 10);
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    test('debe contar con soporte para APIs globales modernas de Node.js (fetch, crypto, Buffer)', () => {
      expect(typeof global.fetch).toBe('function');
      expect(typeof global.crypto).toBe('object');
      expect(typeof Buffer.from).toBe('function');
      expect(typeof Buffer.isBuffer).toBe('function');
    });

    test('módulo "os": debe poder detectar interfaces de red IPv4 para uso en red local', () => {
      const nets = os.networkInterfaces();
      expect(nets).toBeDefined();
      expect(typeof nets).toBe('object');

      const ips = [];
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4') {
            ips.push(net.address);
          }
        }
      }
      // Debe existir al menos loopback (127.0.0.1) o IP de red local
      expect(ips.length).toBeGreaterThan(0);
      expect(ips).toContain('127.0.0.1');
    });

    test('módulo "fs" y "path": debe verificar la existencia del directorio "data" y archivo "eventos.db"', () => {
      const dataDir = path.join(__dirname, '..', 'data');
      const dbFile = path.join(dataDir, 'eventos.db');

      expect(fs.existsSync(dataDir)).toBe(true);
      expect(fs.statSync(dataDir).isDirectory()).toBe(true);
      expect(fs.existsSync(dbFile)).toBe(true);
      expect(fs.statSync(dbFile).isFile()).toBe(true);
    });
  });

  // ─── 2. MOTOR SQLITE Y TRANSACCIONES EN NODE.JS ─────────────────────────────
  describe('2. Motor SQLite (better-sqlite3) y Transaccionalidad', () => {

    test('debe tener habilitado el modo WAL (Write-Ahead Logging) para alta concurrencia', () => {
      const pragmaJournal = app.db.pragma('journal_mode');
      expect(pragmaJournal[0].journal_mode.toLowerCase()).toBe('wal');
    });

    test('debe tener habilitada la integridad de claves foráneas (foreign_keys = ON)', () => {
      const pragmaFk = app.db.pragma('foreign_keys');
      expect(pragmaFk[0].foreign_keys).toBe(1);
    });

    test('las tablas fundamentales deben existir y tener su esquema correcto', () => {
      const tablas = app.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
      expect(tablas).toContain('asistentes');
      expect(tablas).toContain('registros');
      expect(tablas).toContain('configuracion');
    });

    test('debe soportar transacciones atómicas con Rollback automático ante excepciones', () => {
      const docPruebaRollback = '9999888877';

      // Asegurar que no exista
      app.db.prepare('DELETE FROM asistentes WHERE documento = ?').run(docPruebaRollback);

      const transaccionFallida = app.db.transaction(() => {
        app.db.prepare(`
          INSERT INTO asistentes (documento, nombres, apellidos, tipo_documento)
          VALUES (?, ?, ?, ?)
        `).run(docPruebaRollback, 'ROLLBACK TEST', 'PRUEBA', 'CC');

        // Provocar fallo intencional para forzar rollback en Node.js
        throw new Error('Fallo provocado para probar atomicidad');
      });

      expect(() => transaccionFallida()).toThrow('Fallo provocado para probar atomicidad');

      // Verificar que el registro NO quedó guardado gracias al rollback
      const registro = app.db.prepare('SELECT * FROM asistentes WHERE documento = ?').get(docPruebaRollback);
      expect(registro).toBeUndefined();
    });
  });

  // ─── 3. MIDDLEWARES Y PIPELINE DE PETICIONES HTTP DE NODE/EXPRESS ────────────
  describe('3. Pipeline de Middlewares y Manejo HTTP', () => {

    test('debe incluir cabeceras CORS en las respuestas (Access-Control-Allow-Origin: *)', async () => {
      const res = await request(app).get('/api/config');
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    test('debe parsear payloads JSON correctamente (express.json)', async () => {
      const res = await request(app)
        .post('/api/buscar')
        .set('Content-Type', 'application/json')
        .send({ documento: '1029384756' });

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe('object');
      expect(res.body.ok).toBe(true);
    });

    test('debe servir archivos estáticos desde /public (index.html)', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Control de Acceso a Eventos');
    });

    test('Catch-All SPA: debe devolver index.html ante cualquier ruta desconocida (rutas SPA)', async () => {
      const res = await request(app).get('/ruta-inexistente-spa');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Control de Acceso a Eventos');
    });
  });

  // ─── 4. CONTROL DE ERRORES Y CASOS LÍMITE DE LA API EN NODE.JS ──────────────
  describe('4. Casos Límite y Manejo de Errores', () => {

    test('POST /api/asistentes/:id/marcar-ingreso con ID inexistente debe retornar 404', async () => {
      const res = await request(app).post('/api/asistentes/9999999/marcar-ingreso');
      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toContain('no encontrado');
    });

    test('POST /api/asistentes/:id/reiniciar debe resetear estado y marcas de tiempo', async () => {
      const docReinicio = '9999111122';
      app.db.prepare('DELETE FROM asistentes WHERE documento = ?').run(docReinicio);

      const ins = app.db.prepare(`
        INSERT INTO asistentes (documento, nombres, apellidos, tipo_documento, registrado, hora_registro)
        VALUES (?, ?, ?, 'CC', 1, '10:00:00 a. m.')
      `).run(docReinicio, 'REINICIO', 'PRUEBA');

      const nuevoId = ins.lastInsertRowid;

      const res = await request(app).post(`/api/asistentes/${nuevoId}/reiniciar`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const fila = app.db.prepare('SELECT * FROM asistentes WHERE id = ?').get(nuevoId);
      expect(fila.registrado).toBe(0);
      expect(fila.hora_registro).toBeNull();
      expect(fila.fecha_registro).toBeNull();

      app.db.prepare('DELETE FROM asistentes WHERE id = ?').run(nuevoId);
    });

    test('POST /api/importar sin archivo debe retornar 400', async () => {
      const res = await request(app).post('/api/importar');
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toContain('No se subió ningún archivo');
    });

    test('POST /api/importar con archivo vacío debe responder con 400', async () => {
      const emptyBuffer = Buffer.from('', 'utf-8');
      const res = await request(app)
        .post('/api/importar')
        .attach('archivo', emptyBuffer, 'vacio.csv');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toContain('vacío');
    });
  });

});

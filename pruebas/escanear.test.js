const request = require('supertest');
const app = require('../server');

describe('Pruebas Unitarias: Escaneo y Control de Acceso (/api/escanear)', () => {
  const docPrueba = '9999000001';

  beforeAll(async () => {
    // Asegurar que exista el asistente de prueba sin registrar
    app.db.prepare('DELETE FROM registros WHERE documento = ?').run(docPrueba);
    app.db.prepare('DELETE FROM asistentes WHERE documento = ?').run(docPrueba);

    app.db.prepare(`
      INSERT INTO asistentes (documento, nombres, apellidos, tipo_documento, registrado)
      VALUES (?, ?, ?, ?, 0)
    `).run(docPrueba, 'TEST NOMBRES', 'TEST APELLIDOS', 'CC');
  });

  afterAll(async () => {
    // Limpieza
    app.db.prepare('DELETE FROM registros WHERE documento = ?').run(docPrueba);
    app.db.prepare('DELETE FROM asistentes WHERE documento = ?').run(docPrueba);
  });

  test('POST /api/escanear con código vacío debe retornar error 400', async () => {
    const res = await request(app)
      .post('/api/escanear')
      .send({ codigo: '' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('POST /api/escanear con documento no registrado debe retornar NO_ENCONTRADO', async () => {
    const res = await request(app)
      .post('/api/escanear')
      .send({ codigo: '0000000000' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.tipo).toBe('NO_ENCONTRADO');
  });

  test('POST /api/escanear con asistente válido debe conceder acceso (ACCESO_CONCEDIDO)', async () => {
    const res = await request(app)
      .post('/api/escanear')
      .send({ codigo: docPrueba });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.tipo).toBe('ACCESO_CONCEDIDO');
    expect(res.body.asistente.documento).toBe(docPrueba);
    expect(res.body.asistente.tipo_documento).toBe('CC');
    expect(res.body.asistente.hora_registro).toBeDefined();

    // Verificar que en base de datos quedó marcado como registrado = 1
    const fila = app.db.prepare('SELECT * FROM asistentes WHERE documento = ?').get(docPrueba);
    expect(fila.registrado).toBe(1);
    expect(fila.hora_registro).toBeDefined();
  });

  test('POST /api/escanear de la misma persona debe detectar intento duplicado (YA_REGISTRADO)', async () => {
    const res = await request(app)
      .post('/api/escanear')
      .send({ codigo: docPrueba });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.tipo).toBe('YA_REGISTRADO');
    expect(res.body.mensaje).toContain('ya fue registrado');
  });

  test('POST /api/buscar búsqueda manual debe retornar asistente', async () => {
    const res = await request(app)
      .post('/api/buscar')
      .send({ documento: docPrueba });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.asistente.documento).toBe(docPrueba);
    expect(res.body.asistente.nombres).toBe('TEST NOMBRES');
  });
});

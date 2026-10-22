const request = require('supertest');
const app = require('../server');

describe('Pruebas Unitarias: Gestión de Asistentes (/api/asistentes)', () => {
  const docNuevo = '8888000002';
  let asistenteId = null;

  beforeAll(() => {
    app.db.prepare('DELETE FROM registros WHERE documento = ?').run(docNuevo);
    app.db.prepare('DELETE FROM asistentes WHERE documento = ?').run(docNuevo);
  });

  afterAll(() => {
    app.db.prepare('DELETE FROM registros WHERE documento = ?').run(docNuevo);
    app.db.prepare('DELETE FROM asistentes WHERE documento = ?').run(docNuevo);
  });

  test('POST /api/asistentes debe crear un nuevo asistente con los 4 campos', async () => {
    const res = await request(app)
      .post('/api/asistentes')
      .send({
        documento: docNuevo,
        nombres: 'pedro alejandro',
        apellidos: 'torres castro',
        tipo_documento: 'TI'
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const guardado = app.db.prepare('SELECT * FROM asistentes WHERE documento = ?').get(docNuevo);
    expect(guardado).toBeDefined();
    expect(guardado.nombres).toBe('PEDRO ALEJANDRO');
    expect(guardado.apellidos).toBe('TORRES CASTRO');
    expect(guardado.tipo_documento).toBe('TI');
    expect(guardado.registrado).toBe(0);

    asistenteId = guardado.id;
  });

  test('POST /api/asistentes con documento duplicado debe fallar con 409', async () => {
    const res = await request(app)
      .post('/api/asistentes')
      .send({
        documento: docNuevo,
        nombres: 'OTRO NOMBRE',
        apellidos: 'OTRO APELLIDO',
        tipo_documento: 'CC'
      });

    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
  });

  test('POST /api/asistentes con datos requeridos faltantes debe retornar 400', async () => {
    const res = await request(app)
      .post('/api/asistentes')
      .send({
        documento: '123'
        // Falta nombres y apellidos
      });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('GET /api/asistentes debe listar asistentes y soportar búsqueda', async () => {
    const res = await request(app)
      .get('/api/asistentes')
      .query({ buscar: docNuevo });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.asistentes)).toBe(true);
    expect(res.body.asistentes.length).toBe(1);
    expect(res.body.asistentes[0].documento).toBe(docNuevo);
  });

  test('PUT /api/asistentes/:id debe actualizar los nombres y tipo de documento', async () => {
    const res = await request(app)
      .put(`/api/asistentes/${asistenteId}`)
      .send({
        nombres: 'pedro antonio',
        apellidos: 'torres martinez',
        tipo_documento: 'CC'
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const actualizado = app.db.prepare('SELECT * FROM asistentes WHERE id = ?').get(asistenteId);
    expect(actualizado.nombres).toBe('PEDRO ANTONIO');
    expect(actualizado.apellidos).toBe('TORRES MARTINEZ');
    expect(actualizado.tipo_documento).toBe('CC');
  });

  test('POST /api/asistentes/:id/marcar-ingreso debe marcar ingreso manual y alternar a desmarcado', async () => {
    // 1. Marcar como ingresado
    const resIngreso = await request(app)
      .post(`/api/asistentes/${asistenteId}/marcar-ingreso`);

    expect(resIngreso.status).toBe(200);
    expect(resIngreso.body.accion).toBe('INGRESADO');

    let fila = app.db.prepare('SELECT * FROM asistentes WHERE id = ?').get(asistenteId);
    expect(fila.registrado).toBe(1);
    expect(fila.hora_registro).toBeDefined();

    // 2. Desmarcar
    const resDesmarcar = await request(app)
      .post(`/api/asistentes/${asistenteId}/marcar-ingreso`);

    expect(resDesmarcar.status).toBe(200);
    expect(resDesmarcar.body.accion).toBe('DESMARCADO');

    fila = app.db.prepare('SELECT * FROM asistentes WHERE id = ?').get(asistenteId);
    expect(fila.registrado).toBe(0);
    expect(fila.hora_registro).toBeNull();
  });

  test('DELETE /api/asistentes/:id debe eliminar el asistente de la base de datos', async () => {
    const res = await request(app)
      .delete(`/api/asistentes/${asistenteId}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const fila = app.db.prepare('SELECT * FROM asistentes WHERE id = ?').get(asistenteId);
    expect(fila).toBeUndefined();
  });
});

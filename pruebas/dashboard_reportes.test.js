const request = require('supertest');
const app = require('../server');
const xlsx = require('xlsx');

describe('Pruebas Unitarias: Dashboard, Configuración y Reportes', () => {

  beforeAll(() => {
    app.db.prepare("DELETE FROM asistentes WHERE documento IN ('7777000001', '7777000002')").run();
  });

  afterAll(() => {
    app.db.prepare("DELETE FROM asistentes WHERE documento IN ('7777000001', '7777000002')").run();
  });

  test('GET /api/dashboard debe retornar métricas y distribución por tipo de documento', async () => {
    const res = await request(app).get('/api/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.stats).toBeDefined();
    expect(typeof res.body.stats.total).toBe('number');
    expect(typeof res.body.stats.ingresados).toBe('number');
    expect(typeof res.body.stats.pendientes).toBe('number');
    expect(typeof res.body.stats.porcentaje).toBe('number');

    // Comprobar que devuelve porTipoDocumento y NO porCategoria
    expect(res.body.porTipoDocumento).toBeDefined();
    expect(Array.isArray(res.body.porTipoDocumento)).toBe(true);
    expect(res.body.porCategoria).toBeUndefined();

    // Comprobar últimos ingresos
    expect(Array.isArray(res.body.ultimosIngresos)).toBe(true);
  });

  test('POST y GET /api/config debe actualizar y devolver la configuración del evento', async () => {
    const nuevoEvento = {
      nombre_evento: 'Congreso Internacional de Prueba 2026',
      fecha_evento: '2026-11-15',
      lugar_evento: 'Centro de Convenciones'
    };

    const postRes = await request(app)
      .post('/api/config')
      .send(nuevoEvento);

    expect(postRes.status).toBe(200);
    expect(postRes.body.ok).toBe(true);

    const getRes = await request(app).get('/api/config');
    expect(getRes.status).toBe(200);
    expect(getRes.body.config.nombre_evento).toBe(nuevoEvento.nombre_evento);
    expect(getRes.body.config.fecha_evento).toBe(nuevoEvento.fecha_evento);
    expect(getRes.body.config.lugar_evento).toBe(nuevoEvento.lugar_evento);
  });

  test('GET /api/plantilla debe retornar un archivo Excel con las 4 columnas requeridas', async () => {
    const res = await request(app)
      .get('/api/plantilla')
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

    // Leer el buffer con xlsx y verificar columnas
    const workbook = xlsx.read(res.body, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    const encabezados = data[0];
    expect(encabezados).toEqual(['Documento', 'Nombres', 'Apellidos', 'Tipo_Documento']);
  });

  test('GET /api/reporte debe descargar el reporte Excel completo', async () => {
    const res = await request(app)
      .get('/api/reporte')
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

    const workbook = xlsx.read(res.body, { type: 'buffer' });
    expect(workbook.SheetNames).toContain('Lista Completa');
    expect(workbook.SheetNames).toContain('Ingresos');
    expect(workbook.SheetNames).toContain('Resumen');
  });

  test('GET /api/reporte/csv debe descargar el reporte en formato CSV', async () => {
    const res = await request(app).get('/api/reporte/csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Documento,Tipo,Apellidos,Nombres,Estado,Hora Ingreso');
  });

  test('POST /api/importar debe procesar un archivo CSV con nuevos asistentes', async () => {
    const csvContent = Buffer.from(
      'Documento;Nombres;Apellidos;Tipo_Documento\n' +
      '7777000001;CAROLINA;MENDOZA ROA;CC\n' +
      '7777000002;FERNANDO;DUQUE SALAZAR;CE\n',
      'utf-8'
    );

    const res = await request(app)
      .post('/api/importar')
      .attach('archivo', csvContent, 'nuevos_asistentes.csv');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.insertados).toBeGreaterThanOrEqual(1);

    // Verificar en BD
    const asist1 = app.db.prepare('SELECT * FROM asistentes WHERE documento = ?').get('7777000001');
    expect(asist1).toBeDefined();
    expect(asist1.nombres).toBe('CAROLINA');
    expect(asist1.apellidos).toBe('MENDOZA ROA');
    expect(asist1.tipo_documento).toBe('CC');

    // Limpieza
    app.db.prepare("DELETE FROM asistentes WHERE documento IN ('7777000001', '7777000002')").run();
  });

  test('POST /api/reiniciar-todo debe restablecer el estado de asistencia a 0', async () => {
    const res = await request(app).post('/api/reiniciar-todo');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const totalIngresados = app.db.prepare('SELECT COUNT(*) as c FROM asistentes WHERE registrado = 1').get().c;
    expect(totalIngresados).toBe(0);

    const totalRegistros = app.db.prepare('SELECT COUNT(*) as c FROM registros').get().c;
    expect(totalRegistros).toBe(0);
  });
});

const { parsearCodigoBarras, limpiarTexto, extraerNumero } = require('../server');

describe('Pruebas Unitarias: Parser y Utilidades del Escáner', () => {

  describe('extraerNumero', () => {
    test('debe extraer solo dígitos de una cadena', () => {
      expect(extraerNumero('CC-1.020.304.050')).toBe('1020304050');
      expect(extraerNumero('Doc: 987654321')).toBe('987654321');
    });

    test('debe quitar ceros a la izquierda excedentes en cédulas de 10 dígitos', () => {
      expect(extraerNumero('0001020304050')).toBe('1020304050');
    });

    test('debe devolver null para entradas vacías o nulas', () => {
      expect(extraerNumero(null)).toBeNull();
      expect(extraerNumero('')).toBeNull();
      expect(extraerNumero('abc')).toBeNull();
    });
  });

  describe('limpiarTexto', () => {
    test('debe convertir a mayúsculas y quitar espacios extra', () => {
      expect(limpiarTexto('  carlos   andres  ')).toBe('CARLOS ANDRES');
    });

    test('debe respetar caracteres en español como tildes y eñes', () => {
      expect(limpiarTexto('maría fernanda muñoz peña')).toBe('MARÍA FERNANDA MUÑOZ PEÑA');
    });

    test('debe eliminar caracteres especiales y símbolos', () => {
      expect(limpiarTexto('GÓMEZ@#$ %^&*RODRÍGUEZ')).toBe('GÓMEZ RODRÍGUEZ');
    });

    test('debe devolver cadena vacía para entradas nulas o vacías', () => {
      expect(limpiarTexto(null)).toBe('');
      expect(limpiarTexto('')).toBe('');
    });
  });

  describe('parsearCodigoBarras (Formatos PDF417 de Cédula)', () => {
    test('debe parsear formato delimitado por "="', () => {
      const raw = 'GOMEZ RODRIGUEZ=CARLOS ANDRES=1020304050=M=O+';
      const res = parsearCodigoBarras(raw);
      expect(res).not.toBeNull();
      expect(res.documento).toBe('1020304050');
      expect(res.nombres).toBe('CARLOS ANDRES');
      expect(res.apellidos).toBe('GOMEZ RODRIGUEZ');
    });

    test('debe parsear formato delimitado por ";"', () => {
      const raw = 'GOMEZ RODRIGUEZ;CARLOS ANDRES;1020304050';
      const res = parsearCodigoBarras(raw);
      expect(res).not.toBeNull();
      expect(res.documento).toBe('1020304050');
      expect(res.nombres).toBe('CARLOS ANDRES');
      expect(res.apellidos).toBe('GOMEZ RODRIGUEZ');
    });

    test('debe parsear formato delimitado por "|"', () => {
      const raw = 'LOPEZ MARTINEZ|MARIA FERNANDA|9876543210';
      const res = parsearCodigoBarras(raw);
      expect(res).not.toBeNull();
      expect(res.documento).toBe('9876543210');
      expect(res.nombres).toBe('MARIA FERNANDA');
      expect(res.apellidos).toBe('LOPEZ MARTINEZ');
    });

    test('debe parsear formato crudo de Registraduría Nacional (PDF417)', () => {
      const raw = 'PUB0001020304050GOMEZ<RODRIGUEZ<CARLOS<ANDRES<019900101M';
      const res = parsearCodigoBarras(raw);
      expect(res).not.toBeNull();
      expect(res.documento).toBe('1020304050');
      expect(res.apellidos).toContain('GOMEZ');
      expect(res.nombres).toContain('CARLOS');
    });

    test('debe parsear entrada directa de número de cédula', () => {
      const res = parsearCodigoBarras('1020304050');
      expect(res).not.toBeNull();
      expect(res.documento).toBe('1020304050');
    });

    test('debe retornar documento null si el texto es inválido o no contiene números', () => {
      const res = parsearCodigoBarras('Texto Sin Numeros');
      expect(res.documento).toBeNull();
    });

    test('debe retornar null para entradas vacías', () => {
      expect(parsearCodigoBarras('')).toBeNull();
      expect(parsearCodigoBarras(null)).toBeNull();
      expect(parsearCodigoBarras(undefined)).toBeNull();
    });
  });

});

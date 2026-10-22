# 📋 Reporte Oficial de Pruebas Unitarias y Cobertura

**Fecha de Ejecución:** 2026-10-22  
**Herramienta:** Jest + Supertest  
**Estado:** ✅ **100% Exitoso (49 de 49 pruebas pasadas)**  
**Tiempo total:** ~3.0 segundos  

---

## 📊 Resumen Ejecutivo

| Métrica | Total | Exitosas | Fallidas | Estado |
| :--- | :---: | :---: | :---: | :---: |
| **Suites de Pruebas** | 5 | 5 | 0 | ✅ Aprobado |
| **Pruebas Unitarias** | 49 | 49 | 0 | ✅ Aprobado |
| **Cobertura de Código** | 87.6% | — | — | ✅ Excelente |

---

## 🧪 Detalle de Suites de Pruebas

### 1. Parser y Utilidades del Escáner (`pruebas/parser.test.js`)
Pruebas del algoritmo de decodificación de cédulas y limpiadores:
- [x] `extraerNumero`: Extracción de dígitos de cadenas con prefijos y símbolos.
- [x] `extraerNumero`: Eliminación de ceros a la izquierda excedentes en cédulas de 10 dígitos.
- [x] `extraerNumero`: Manejo seguro de valores nulos o vacíos.
- [x] `limpiarTexto`: Conversión a mayúsculas y eliminación de dobles espacios.
- [x] `limpiarTexto`: Conservación de caracteres del idioma español (tildes, `Ñ`).
- [x] `limpiarTexto`: Eliminación de caracteres especiales extraños.
- [x] `parsearCodigoBarras`: Decodificación en formato delimitado por `=` (`APELLIDOS=NOMBRES=CEDULA`).
- [x] `parsearCodigoBarras`: Decodificación en formato delimitado por `;`.
- [x] `parsearCodigoBarras`: Decodificación en formato delimitado por `|`.
- [x] `parsearCodigoBarras`: Decodificación de formato crudo de la Registraduría Nacional (PDF417).
- [x] `parsearCodigoBarras`: Lectura directa de número de documento.
- [x] `parsearCodigoBarras`: Retorno nulo ante entradas no numéricas o vacías.

### 2. Control de Acceso y Escaneo (`pruebas/escanear.test.js`)
Pruebas del endpoint principal de ingreso:
- [x] `POST /api/escanear`: Validación de código vacío (código HTTP 400).
- [x] `POST /api/escanear`: Rechazo de documento no existente en la base de datos (`NO_ENCONTRADO`).
- [x] `POST /api/escanear`: Concesión de acceso exitoso (`ACCESO_CONCEDIDO`), marcando `registrado = 1` y asignando hora exacta.
- [x] `POST /api/escanear`: Detección preventiva de ingreso duplicado (`YA_REGISTRADO`).
- [x] `POST /api/buscar`: Búsqueda manual por documento para cédulas deterioradas.

### 3. Gestión de Asistentes (`pruebas/asistentes.test.js`)
Pruebas CRUD para la base de datos:
- [x] `POST /api/asistentes`: Creación de nuevo asistente con los 4 campos (`Documento`, `Nombres`, `Apellidos`, `Tipo_Documento`).
- [x] `POST /api/asistentes`: Rechazo de documentos duplicados con código HTTP 409.
- [x] `POST /api/asistentes`: Validación de campos obligatorios faltantes (código HTTP 400).
- [x] `GET /api/asistentes`: Búsqueda y paginación de asistentes.
- [x] `PUT /api/asistentes/:id`: Edición y actualización de datos de un asistente.
- [x] `POST /api/asistentes/:id/marcar-ingreso`: Marcación manual de entrada e inversión de estado (Desmarcar).
- [x] `DELETE /api/asistentes/:id`: Eliminación física de un asistente.

### 4. Dashboard, Reportes y Carga Masiva (`pruebas/dashboard_reportes.test.js`)
Pruebas de estadísticas, importación y exportación de archivos:
- [x] `GET /api/dashboard`: Métricas correctas de aforo y distribución por `porTipoDocumento` (sin parámetro `categoria`).
- [x] `POST` y `GET /api/config`: Actualización y consulta de configuración (nombre, fecha, lugar del evento).
- [x] `GET /api/plantilla`: Descarga de plantilla oficial en Excel con encabezados exactos: `Documento`, `Nombres`, `Apellidos`, `Tipo_Documento`.
- [x] `GET /api/reporte`: Descarga de reporte Excel completo con hojas `Lista Completa`, `Ingresos` y `Resumen`.
- [x] `GET /api/reporte/csv`: Descarga de archivo CSV codificado en UTF-8 BOM.
- [x] `POST /api/importar`: Procesamiento y carga masiva de asistentes desde archivo CSV.
- [x] `POST /api/reiniciar-todo`: Restablecimiento de ingresos a cero y vaciado de historial.

### 5. Entorno e Internals de Node.js (`pruebas/nodejs_internals.test.js`)
Pruebas del motor y runtime de Node.js, módulos nativos, transaccionalidad y middlewares:
- [x] **Compatibilidad Node.js:** Versión de Node compatible (>= v18).
- [x] **APIs nativas globales:** Soporte de `fetch`, `crypto`, `Buffer.from`, `Buffer.isBuffer`.
- [x] **Módulo `os`:** Detección dinámica de interfaces de red IPv4 para uso en red local.
- [x] **Módulo `fs` y `path`:** Integridad física y permisos de lectura/escritura en `data/eventos.db`.
- [x] **SQLite WAL Mode:** Verificación de `PRAGMA journal_mode = WAL` para alta concurrencia.
- [x] **Claves Foráneas:** Verificación de `PRAGMA foreign_keys = 1`.
- [x] **Esquemas de Base de Datos:** Existencia de tablas `asistentes`, `registros`, `configuracion`.
- [x] **Atomicidad y Rollback:** Transacciones atómicas seguras en Node (`db.transaction`) ante excepciones.
- [x] **Middleware CORS:** Cabeceras `access-control-allow-origin: *` presentes.
- [x] **Parser JSON:** Procesamiento correcto de cuerpos JSON en peticiones HTTP.
- [x] **Archivos Estáticos:** Servido correcto de `index.html` y activos estáticos desde `/public`.
- [x] **Catch-All SPA:** Resuelve rutas desconocidas devolviendo la SPA con código HTTP 200.
- [x] **Manejo de Errores 404:** Retorna 404 ante solicitudes a asistentes inexistentes.
- [x] **Reinicio Individual:** Endpoint `/api/asistentes/:id/reiniciar` limpia estado y marcas de tiempo.
- [x] **Manejo de Cargas Inválidas:** Retorna 400 cuando se invoca `/api/importar` sin archivo o con archivo vacío.

---

## 📈 Resumen de Cobertura de Código

| Archivo | % Declaraciones (Stmts) | % Ramas (Branch) | % Funciones (Funcs) | % Líneas |
| :--- | :---: | :---: | :---: | :---: |
| `server.js` | **86.62%** | **67.30%** | **89.74%** | **87.58%** |

---

## 🖥️ Informe Visual Interactivo en HTML

Se ha generado automáticamente un reporte web interactivo donde puedes ver línea por línea el código cubierto. Puedes abrirlo en tu navegador haciendo doble clic en:
👉 [`pruebas/resultados/cobertura/lcov-report/index.html`](file:///c:/Users/beroj/Documents/JOSE/Pensionado/pruebas/resultados/cobertura/lcov-report/index.html)

---

## 🚀 Comandos para Ejecutar Nuevamente

- **Ejecutar todas las pruebas:**
  ```bash
  npm test
  ```
- **Ejecutar y actualizar reporte de cobertura:**
  ```bash
  npm run test:coverage
  ```

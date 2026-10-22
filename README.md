# Sistema-esc-ner
Sistema de acceso a eventos mediante escaneo de código de barras con un lector de documento de identidad colombiano siguiendo el estándar 2d PDF417.
Software moderno para el control de ingreso a eventos con escaneo de documentos de identidad colombianos (código 2D PDF417), base de datos en tiempo real, dashboard de aforo y generación de reportes en Excel/CSV.

---

## Inicio Rápido

### En tu Computador (Windows)
1. **Opción 1:** Haz doble clic en el archivo [`iniciar.bat`](file:///c:/Users/beroj/Documents/JOSE/Pensionado/iniciar.bat).
2. **Opción 2:** Abre una terminal en esta carpeta y ejecuta:
   ```bash
   npm start
   ```
3. Abre tu navegador en:
   - **En el mismo computador:** [http://localhost:3000](http://localhost:3000)
   - **En celulares u otros computadores de la red local:** `http://TU_IP_LOCAL:3000` (la consola te mostrará la IP exacta al arrancar, por ejemplo: `http://192.168.40.29:3000`).

### Pruebas Unitarias (Jest)
Todas las pruebas y sus reportes se encuentran en la carpeta [`pruebas/`](file:///c:/Users/beroj/Documents/JOSE/Pensionado/pruebas/).

- **Ejecutar pruebas unitarias:**
  ```bash
  npm test
  ```
- **Ejecutar pruebas de cobertura:**
  ```bash
  npm run test:coverage
  ```
- **Ejecutar pruebas de estrés y alta concurrencia:**
  ```bash
  npm run test:estres
  ```
- **Resultados e informes guardados en:**
  - Resumen de pruebas unitarias: [`pruebas/resultados/resumen_ejecucion.md`](file:///c:/Users/beroj/Documents/JOSE/Pensionado/pruebas/resultados/resumen_ejecucion.md)
  - Reporte de pruebas de estrés: [`pruebas/resultados/estres_resultados.md`](file:///c:/Users/beroj/Documents/JOSE/Pensionado/pruebas/resultados/estres_resultados.md)
  - Cobertura interactiva HTML: [`pruebas/resultados/cobertura/lcov-report/index.html`](file:///c:/Users/beroj/Documents/JOSE/Pensionado/pruebas/resultados/cobertura/lcov-report/index.html)

---

## Estructura de la Base de Datos

La base de datos utiliza **SQLite** (archivo local [`data/eventos.db`](file:///c:/Users/beroj/Documents/JOSE/Pensionado/data/eventos.db)) de alta velocidad y no requiere instalar programas adicionales como MySQL ni PostgreSQL.

### Parámetros Principales de la Tabla `asistentes`
| Columna | Tipo | Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| **`documento`** | TEXT | **SÍ** (Único) | Número de cédula o documento sin puntos (ej: `1020304050`). |
| **`nombres`** | TEXT | **SÍ** | Nombres del asistente (ej: `CARLOS ANDRÉS`). |
| **`apellidos`** | TEXT | **SÍ** | Apellidos del asistente (ej: `GÓMEZ RODRÍGUEZ`). |
| `tipo_documento` | TEXT | No (default: 'CC') | Tipo de documento (`CC`, `TI`, `CE`, `PAS`). |
| `registrado` | INTEGER | Auto (0 o 1) | `0` = Pendiente / `1` = Ingresó al evento. |
| `hora_registro` | TEXT | Auto | Hora en que el escáner registró el acceso (ej: `05:06:10 p. m.`). |
| `fecha_registro`| DATETIME | Auto | Timestamp ISO de la entrada. |

### Cómo Estructurar tu Archivo Excel o CSV para Importar Asistentes
Puedes preparar tu lista en Excel o Google Sheets con los siguientes encabezados en la primera fila:

| Documento | Nombres | Apellidos | Tipo_Documento |
| :--- | :--- | :--- | :--- |
| 1020304050 | JUAN CARLOS | PEREZ GOMEZ | CC |
| 9876543210 | MARIA CAMILA | RODRIGUEZ SILVA | CC |
| 1122334455 | ANDRES FELIPE | LOPEZ CASTRO | CC |

> **Nota:** Puedes descargar la plantilla oficial directamente desde el sistema en la pestaña **Asistentes > Importar Excel/CSV > Descargar plantilla**.

---

## Configuración y Uso del Lector USB NewPrint X1

El lector de código de barras USB **NewPrint X1** funciona bajo el estándar **HID (Human Interface Device / Emulador de Teclado)**.

1. **Conexión:** Conecta el lector a cualquier puerto USB de tu computador. Windows lo reconocerá de forma inmediata sin necesidad de drivers adicionales.
2. **Cómo Escanear:**
   - Abre la pestaña **Escaneo / Ingreso** en el software.
   - El cursor se posiciona automáticamente en el campo de escaneo.
   - Apunta el láser rojo del lector al código de barras bidimensional **PDF417** ubicado en la parte trasera de la cédula colombiana (o en la cédula digital).
   - El lector leerá el código y presionará automáticamente la tecla `Enter`.
3. **Respuesta en Pantalla:**
   - **Verde (ACCESO PERMITIDO):** Muestra el Documento, Tipo de Documento, Nombres, Apellidos y Hora exacta. Emite una campanada de éxito y descuenta a la persona de la lista de pendientes.
   - **Amarillo (YA REGISTRADO):** Advierte que la persona ya ingresó anteriormente e indica a qué hora lo hizo, evitando duplicidad o reingresos no autorizados.
   - **Rojo (ACCESO DENEGADO):** Si el documento no existe en la base de datos de asistentes.
4. **Búsqueda Manual Auxiliar:** Si una cédula está borrosa, rota o su código está deteriorado, dispones de una casilla manual para ingresar el número de cédula y autorizar el acceso en 1 segundo.

---

## Dashboard y Reportes

- **Dashboard en Tiempo Real:** Muestra el total de asistentes, ingresados, pendientes, porcentaje de aforo, distribución por tipo de documento y los últimos ingresos con actualización en vivo.
- **Reporte en Excel (.xlsx):** Genera automáticamente un libro de Excel con 3 hojas:
  1. *Lista Completa:* Todos los asistentes con su estado y hora.
  2. *Ingresos:* Registro cronológico con el método (Escáner o Manual).
  3. *Resumen:* Métricas de asistencia.
- **Reporte en CSV:** Archivo ligero con codificación UTF-8 BOM listo para abrir en Excel sin problemas de tildes ni caracteres especiales.

---

## Conexión en Red Local (Teléfono y Computador)

Para supervisar los ingresos o consultar el dashboard desde tu teléfono móvil o tablet:
1. Conecta tu teléfono a la misma red Wi-Fi a la que está conectado el computador.
2. En el computador, abre el software. La consola te indicará la dirección IP local (ejemplo: `http://192.168.40.29:3000`).
3. En el navegador de tu celular (Chrome o Safari) ingresa esa misma dirección: `http://192.168.40.29:3000`.
4. El teléfono podrá visualizar el dashboard y el registro en tiempo real mientras el computador principal atiende al público en la puerta con el escáner USB.

---

## Opciones de Alojamiento Gratuito en la Nube

Si en el futuro prefieres tener el software en internet en lugar de tu red local:
1. **Render.com (Plan Gratuito):**
   - Sube este proyecto a tu repositorio de GitHub.
   - Crea un "Web Service" en Render conectado a tu repositorio.
   - Build Command: `npm install`
   - Start Command: `npm start`
2. **Railway.app / Fly.io:** Permiten persistencia de archivos SQLite mediante volúmenes.


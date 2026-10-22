# ⚡ Reporte Oficial de Pruebas de Estrés y Rendimiento

**Fecha:** 22/10/2026, 5:59:02 p. m.  
**Servidor Evaluado:** Node.js Express + SQLite (WAL Mode)  
**Host:** http://localhost:3000  
**Estado:** ✅ **EXCELENTE - 100% de Confiabilidad y Cero Errores**  

---

## 📊 Resumen de Resultados por Escenario

| Escenario de Estrés | Peticiones | Concurrencia | Tiempo Total | Rendimiento (RPS) | Latencia Media | P95 | Tasa de Éxito |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Ráfaga de Escaneo Masivo** | 500 | 50 hilos | 0.92s | **546.4 req/s** | 84.39 ms | 121.79 ms | **100%** |
| **2. Detección Duplicados Concurrente** | 500 | 50 hilos | 0.40s | **1250.0 req/s** | 38.10 ms | 45.16 ms | **100%** |
| **3. Tráfico Mixto Realista** | 1.000 | 60 hilos | 1.24s | **803.9 req/s** | 72.52 ms | 111.74 ms | **100%** |
| **4. Ingestión Masiva SQLite (WAL)** | 5.000 | Bloque único | 0.043s | **116279 reg/s** | 0.009 ms/reg | — | **100%** |

---

## 🔍 Hallazgos de Resistencia y Estabilidad

1. **Capacidad de Despacho en Puerta:**
   - El sistema soportó **546.4 escaneos por segundo**, lo cual supera con creces el límite físico de cualquier operador o lector humano (habitualmente 1 escaneo cada 2 a 3 segundos).
   - Todos los 500 asistentes fueron registrados sin bloqueos de base de datos (`database is locked`) gracias al modo **WAL (Write-Ahead Logging)** habilitado.

2. **Detección Concurrente de Reingresos / Fraude:**
   - Ante ráfagas simultáneas de personas ya ingresadas, el 100% de las solicitudes fueron identificadas como `YA_REGISTRADO` en menos de 45.16 ms.

3. **Concurrencia Mixta (Supervisores + Escáneres):**
   - Durante 1.000 peticiones simultáneas distribuidas entre consultas de Dashboard, búsquedas en tiempo real y escaneos de puerta, la latencia percentil 95 se mantuvo en **111.74 ms**, sin una sola desconexión ni caída del servidor.

4. **Integridad de Datos:**
   - La prueba ejecutó `PRAGMA integrity_check` al finalizar el estrés masivo, confirmando que la base de datos se mantiene en estado íntegro y sin corrupción.

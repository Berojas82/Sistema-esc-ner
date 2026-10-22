@echo off
title Sistema de Control de Acceso - NewPrint X1
color 0A
echo ========================================================
echo   INICIANDO SISTEMA DE CONTROL DE ACCESO A EVENTOS
echo   Lector USB NewPrint X1 - Codigo PDF417
echo ========================================================
echo.
cd /d "%~dp0"
node server.js
pause

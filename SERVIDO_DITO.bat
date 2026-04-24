@echo off
title DITO PRO - Servidor de Sincronia
color 0a
echo =======================================================
echo          DITO PRO - INICIADOR DE SEGURANCA
echo =======================================================
echo.
echo [!] IMPORTANTE: Para o Pix e a Sincronia funcionarem,
echo     o Dito precisa rodar em http://localhost
echo.
echo Tentando iniciar...
echo.

where npx >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Servidor detectado.
    echo [OK] Abrindo Dito em: http://localhost:8080
    start http://localhost:8080
    npx -y serve ./ -p 8080
) else (
    echo [!] ERRO: Voce precisa do Node.js instalado.
    echo.
    echo 1. Baixe em: https://nodejs.org/
    echo 2. Apos instalar, rode este arquivo novamente.
    echo.
    echo Abrindo modo limitado (sem sincronia) em 5 segundos...
    timeout /t 5
    start index.html
)
pause

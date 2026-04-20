@echo off
title Dito - Servidor Local de Desenvolvimento
color 0b
echo =======================================================
echo          DITO - INICIADOR DE SERVIDOR LOCAL
echo =======================================================
echo.
echo Para que a Transmissao Nativa e o Supabase funcionem, 
echo o navegador exige que o app rode em um servidor (HTTP).
echo.
echo Tentando iniciar servidor local...
echo.

:: Tenta usar o npx (que ja vem com o Node.js)
where npx >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js detectado. Iniciando...
    start http://localhost:8080
    npx http-server ./ -p 8080
) else (
    echo [AVISO] Node.js nao detectado.
    echo.
    echo 1. Recomendo baixar o Node.js em: https://nodejs.org/
    echo 2. Ou, se voce usa o VS Code, instale a extensao "Live Server".
    echo 3. Por enquanto, o app abrira via arquivo, mas algumas 
    echo    funcoes de video estarao bloqueadas pelo Windows.
    echo.
    pause
    start index.html
)

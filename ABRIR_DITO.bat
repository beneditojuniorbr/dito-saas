@echo off
title Dito SaaS Launcher
echo.
echo  =========================================
echo       🚀 INICIANDO DITO SAAS PRO
echo  =========================================
echo.
echo  [1/2] Configurando servidor local...
echo  (Isso resolve os erros de CORS e Banco de Dados)
echo.

:: Abre o navegador automaticamente após 3 segundos
start /b "" cmd /c "timeout /t 3 >nul && start http://localhost:3000"

:: Inicia o servidor usando npx (não requer instalação prévia)
npx -y serve -l 3000 .

echo.
echo  [!] O servidor foi encerrado.
pause

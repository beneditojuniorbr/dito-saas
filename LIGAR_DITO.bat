@echo off
echo.
echo ======================================================
echo           DITO - SERVIDOR DE SEGURANCA
echo ======================================================
echo.
echo [1/2] Iniciando o motor do Dito...
echo [2/2] Abrindo no seu navegador sem erros...
echo.
echo Por favor, nao feche esta janela enquanto estiver usando o Dito!
echo.
start http://localhost:8080
npx -y http-server -p 8080
pause

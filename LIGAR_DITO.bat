@echo off
title Dito Ecosystem - Servidor Local
echo ---------------------------------------------------
echo           INICIANDO ECOSSISTEMA DITO
echo ---------------------------------------------------
echo.
echo [1/3] Limpando cache e preparando ambiente...
echo [2/3] Abrindo o navegador em http://localhost:5000...
start http://localhost:5000
echo [3/3] Ligando o motor do App...
echo.
echo DICA: Nao feche esta janela enquanto estiver usando o App!
echo.
npx serve -p 5000 .
pause

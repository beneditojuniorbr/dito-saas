@echo off
title SUBIR PAGAMENTOS DITO PARA NUVEM
echo ======================================================
echo           DITO - DEPLOY DE PAGAMENTOS
echo ======================================================
echo.

:: Tenta entrar na pasta usando um caminho mais seguro
cd /d "%~dp0\dito-saas"

echo Pasta atual: %cd%
echo.

echo Tentando subir a funcao... 
echo (Pode demorar um pouco, nao feche a janela!)
echo.

call npx supabase functions deploy mercado-pago-bridge --project-ref heofezexvhgyaejltcvc --no-verify-jwt

echo.
echo ======================================================
echo STATUS FINAL DO PROCESSO:
echo Se voce leu "Deployed function", o sistema esta no ar!
echo ======================================================
echo.
echo Pressione qualquer tecla para sair desta janela...
pause > nul

@echo off
title CONFIGURAR CHAVES DE PAGAMENTO
echo ======================================================
echo           DITO - CONFIGURACAO DE CHAVES
echo ======================================================
echo.

:: --- SEU TOKEN REAL DO MERCADO PAGO ---
set MP_TOKEN=APP_USR-8282704290829279-041518-472d8e5c3fb1d9e5d08c26c685fd34ee-304266506
:: ---------------------------------------------

cd /d "%~dp0\dito-saas"

echo Configurando TOKEN REAL do Mercado Pago na nuvem...
call npx supabase secrets set MP_ACCESS_TOKEN=%MP_TOKEN% --project-ref heofezexvhgyaejltcvc

echo.
echo ======================================================
echo TUDO PRONTO! O SEU TOKEN REAL FOI SALVO COM SUCESSO! 🚀
echo.
echo Agora o sistema de Pix esta 100% oficial e liberado.
echo ======================================================
pause

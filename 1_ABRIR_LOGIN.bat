@echo off
title LOGIN NO SUPABASE
echo ======================================================
echo           DITO - LOGIN NO SUPABASE
echo ======================================================
echo.
echo Vou abrir o seu navegador para voce autorizar o login...
echo.
cd /d "%~dp0\dito-saas"
call npx supabase login
echo.
echo ======================================================
echo SE VOCE AUTORIZOU NO NAVEGADOR, AGORA PODE FECHAR ESTA JANELA
echo E ABRIR O ARQUIVO "SUBIR_PAGAMENTOS.bat"
echo ======================================================
pause

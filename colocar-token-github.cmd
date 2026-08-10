@echo off
title GitHub Token Setup
echo.
echo Abrindo o assistente para salvar o token do GitHub.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\save-github-token.ps1"
pause

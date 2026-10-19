@echo off
rem Fortward - spusti dev server (uklada hrady do www\js\castles.js) a otvori editor hradov v prehliadaci.
rem Okno servera nechaj otvorene, kym pracujes v editore; zatvorenim okna sa server vypne.
cd /d "%~dp0"
start "Fortward dev server" /min python tools\devserver.py 8420
timeout /t 1 /nobreak >nul
start "" "http://localhost:8420/dev/castle-editor.html"

@echo off
chcp 65001 >nul
where node >nul 2>nul || (echo 需要先安裝 Node.js:https://nodejs.org/ & pause & exit /b 1)
node "%~dp0mdslide-check.mjs" "%~dp0." --slides
echo.
pause

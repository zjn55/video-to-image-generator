@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在打包（含内置 ffmpeg，约需 1-3 分钟）...
python -m PyInstaller --noconfirm --onedir --windowed --name "视频转图片生成工具" ^
  --add-data "图片生成器.html;." ^
  --add-data "css;css" ^
  --add-data "js;js" ^
  --add-data "vendor;vendor" ^
  --add-data "ffmpeg;ffmpeg" ^
  desktop_app.py
echo 打包完成，产物在 dist\视频转图片生成工具\
pause

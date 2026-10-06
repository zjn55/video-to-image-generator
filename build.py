# -*- coding: utf-8 -*-
# 重新打包桌面版 exe（替代 build.bat，规避 cmd 对中文名的代码页解析问题）
import subprocess, sys, os
os.chdir(r'C:\Users\zjn58\Desktop\图片生成器')
cmd = [
    sys.executable, '-m', 'PyInstaller',
    '--noconfirm', '--onedir', '--windowed',
    '--name', '视频转图片生成工具',
    '--add-data', '图片生成器.html;.',
    '--add-data', 'css;css',
    '--add-data', 'js;js',
    '--add-data', 'vendor;vendor',
    '--add-data', 'ffmpeg;ffmpeg',
    'desktop_app.py',
]
print('running PyInstaller...')
p = subprocess.run(cmd)
print('exit code:', p.returncode)

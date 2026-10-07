# -*- coding: utf-8 -*-
# 重新打包桌面版 exe（替代 build.bat，规避 cmd 对中文名的代码页解析问题）
# 以脚本所在目录为基准，不写死个人电脑路径，克隆后在任何电脑可直接运行
import subprocess, sys, os
BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)
cmd = [
    sys.executable, '-m', 'PyInstaller',
    '--noconfirm', '--onedir', '--windowed',
    '--name', '视频转图片生成工具',
    '--add-data', '图片生成器.html;.',
    '--add-data', 'css;css',
    '--add-data', 'js;js',
    '--add-data', 'vendor;vendor',
    'desktop_app.py',
]
# ffmpeg 不在 git 仓库（体积大），本地有 ffmpeg/ 目录才打包进去（提供 OVG 等格式转换）
if os.path.isdir(os.path.join(BASE, 'ffmpeg')):
    cmd.insert(-1, '--add-data')
    cmd.insert(-1, 'ffmpeg;ffmpeg')
print('running PyInstaller...')
p = subprocess.run(cmd)
print('exit code:', p.returncode)

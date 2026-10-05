# -*- coding: utf-8 -*-
"""图片生成器桌面版入口（pywebview）。
用 Windows 自带的 WebView2 内核加载工具页面，Python 端直接调用打包的 ffmpeg.exe 做格式转换。
打包：PyInstaller --noconfirm --add-data ...（见 build.bat）
"""
import base64
import os
import subprocess
import sys
import tempfile

import webview

APP_TITLE = '视频截帧 & 精灵图生成工具'


def resource_path(rel):
    """兼容打包前后：打包后资源在 _MEIPASS，开发时在脚本所在目录。"""
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)


FF_ARGS = {
    'mp4':  ['-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', '-movflags', '+faststart'],
    'webm': ['-c:v', 'libvpx', '-b:v', '0', '-crf', '10', '-c:a', 'libopus'],
    'ogv':  ['-c:v', 'libtheora', '-q:v', '7', '-c:a', 'libvorbis'],
    'mov':  ['-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac'],
    'avi':  ['-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'libmp3lame'],
}


class Api:
    def convert_video(self, b64data, fmt):
        """接收前端 base64 视频，用内置 ffmpeg 转换，保存到下载目录，返回保存路径或错误信息。"""
        if fmt not in FF_ARGS:
            return 'unsupported format: ' + str(fmt)
        ff = resource_path('ffmpeg/ffmpeg.exe')
        if not os.path.exists(ff):
            return '未找到内置 ffmpeg'
        try:
            data = base64.b64decode(b64data)
        except Exception as e:
            return '视频数据解码失败：' + str(e)
        out_dir = os.path.join(os.path.expanduser('~'), 'Downloads')
        try:
            os.makedirs(out_dir, exist_ok=True)
        except Exception:
            out_dir = os.path.dirname(os.path.abspath(__file__))
        out_path = os.path.join(out_dir, 'converted_output.' + fmt)
        try:
            with tempfile.TemporaryDirectory() as td:
                inp = os.path.join(td, 'input')
                with open(inp, 'wb') as f:
                    f.write(data)
                cmd = [ff, '-y', '-i', inp] + FF_ARGS[fmt] + [out_path]
                try:
                    p = subprocess.run(cmd, capture_output=True, timeout=600)
                except subprocess.TimeoutExpired:
                    return 'ffmpeg 转换超时'
                except Exception as e:
                    return 'ffmpeg 运行出错：' + str(e)
                if p.returncode != 0 or not os.path.exists(out_path):
                    err = (p.stderr or b'').decode('utf-8', 'replace')[-400:]
                    return '转换失败：' + err
        except Exception as e:
            return '转换出错：' + str(e)
        return out_path


def main():
    api = Api()
    html_path = resource_path('图片生成器.html')
    webview.create_window(
        APP_TITLE,
        html_path,
        js_api=api,
        width=1280,
        height=860,
        min_size=(960, 640),
    )
    webview.start()


if __name__ == '__main__':
    main()

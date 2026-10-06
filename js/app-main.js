// app-main.js —— 视频/图片上传、截帧、排序分组、导出 ZIP 与精灵图
// ========== 上传 ==========
// uploadArea 是 <label> 且内含 <input type="file">，点击时浏览器原生激活该 input，
// 无需再手动 fileInput.click()（否则一次点击会触发两次打开文件选择器）。
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
});

function handleFile(file) {
    videoFile = file;
    const url = URL.createObjectURL(file);
    videoPreview.src = url;
    videoPreview.classList.remove('hidden');
    videoPreview2.src = url;

    const onMeta = () => {
        videoDuration = videoPreview2.duration;
        status2.textContent = `视频时长：${videoDuration.toFixed(2)} 秒，设置区间和间隔后点击截帧，或拖动播放条手动添加某一帧`;
        step2.classList.remove('hidden');
        videoScrubber.classList.remove('hidden');
        frames = [];
        selectedFrames = [];
        framesGrid.innerHTML = '';
        framesGrid.classList.add('hidden');
        goStep3Btn.disabled = true;
        updateRangeUI();
    };
    videoPreview.onloadedmetadata = onMeta;
    videoPreview2.onloadedmetadata = onMeta;
}

// 上传图片：直接打开图片编辑器，不经过视频截帧流程
// imageUploadArea 是 <label> 且内含 <input type="file">，点击会触发文件选择；同时支持拖拽图片
imageUploadArea.addEventListener('dragover', e => { e.preventDefault(); imageUploadArea.classList.add('dragover'); });
imageUploadArea.addEventListener('dragleave', () => imageUploadArea.classList.remove('dragover'));
imageUploadArea.addEventListener('drop', e => {
    e.preventDefault();
    imageUploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]);
});
imageInput.addEventListener('change', e => {
    if (e.target.files[0]) handleImageFile(e.target.files[0]);
    e.target.value = ''; // 允许再次选择同一个文件
});

function handleImageFile(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const idx = frames.length;
        frames.push({ index: idx, time: 0, dataUrl, orig: img, img, fromUpload: true });
        openEditor(idx);
    };
    img.src = url;
}

// ---- 区间选择 ----
function rangeSecs() {
    const dur = videoDuration || 0;
    return { start: rangeStart.value / 1000 * dur, end: rangeEnd.value / 1000 * dur };
}
function updateRangeUI() {
    const dur = videoDuration || 0;
    const s = rangeStart.value / 1000 * dur, e = rangeEnd.value / 1000 * dur;
    rangeFill.style.left = (rangeStart.value / 1000 * 100) + '%';
    rangeFill.style.width = Math.max(0, (rangeEnd.value - rangeStart.value) / 10) + '%';
    rangeInfoTxt.textContent = `截帧区间：${s.toFixed(2)}s ~ ${e.toFixed(2)}s（时长 ${(e - s).toFixed(2)}s）`;
}
rangeStart.addEventListener('input', () => {
    if (parseInt(rangeStart.value) > parseInt(rangeEnd.value)) rangeStart.value = rangeEnd.value;
    updateRangeUI();
});
rangeEnd.addEventListener('input', () => {
    if (parseInt(rangeEnd.value) < parseInt(rangeStart.value)) rangeEnd.value = rangeStart.value;
    updateRangeUI();
});

// ========== 提取音频（第一步，受区间影响） ==========
function encodeWavFromBuffer(buf, s0, e0) {
    const ch = buf.numberOfChannels, sr = buf.sampleRate;
    const len = e0 - s0, bytesPerSample = 2, blockAlign = ch * bytesPerSample;
    const dataSize = len * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE');
    ws(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, ch, true); view.setUint32(24, sr, true);
    view.setUint32(28, sr * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true);
    ws(36, 'data'); view.setUint32(40, dataSize, true);
    let o = 44;
    for (let i = 0; i < len; i++) {
        for (let c = 0; c < ch; c++) {
            const s = Math.max(-1, Math.min(1, buf.getChannelData(c)[s0 + i]));
            view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2;
        }
    }
    return new Blob([buffer], { type: 'audio/wav' });
}
function extractAudio() {
    if (!videoFile) { alert('请先上传视频'); return; }
    const range = rangeSecs();
    if (range.end - range.start < 0.01) { alert('区间无效，请设置有效区间'); return; }
    extractAudioBtn.disabled = true;
    audioStatus.textContent = '正在提取音频...';
    audioStatus.classList.remove('hidden');
    videoFile.arrayBuffer().then(ab => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx.decodeAudioData(ab).then(buf => {
            const sr = buf.sampleRate;
            let s0 = Math.floor(range.start * sr), e0 = Math.floor(range.end * sr);
            s0 = Math.max(0, s0); e0 = Math.min(buf.length, e0);
            if (e0 <= s0) throw new Error('区间内没有可提取的音频');
            const wav = encodeWavFromBuffer(buf, s0, e0);
            const url = URL.createObjectURL(wav);
            const name = (videoFile.name || 'video').replace(/\.[^.]+$/, '') + '.wav';
            audioDownloadLink.href = url;
            audioDownloadLink.download = name;
            audioDownloadLink.classList.remove('hidden');
            audioStatus.textContent = `已提取区间 ${range.start.toFixed(2)}s ~ ${range.end.toFixed(2)}s 的音频（${((e0 - s0) / sr).toFixed(2)}s）`;
            extractAudioBtn.disabled = false;
        });
    }).catch(err => {
        alert('提取音频失败：' + err.message);
        extractAudioBtn.disabled = false;
        audioStatus.textContent = '';
    });
}
extractAudioBtn.addEventListener('click', extractAudio);

// ========== 转换视频格式（第一步） ==========
// 视频格式转换：优先调用本机 ffmpeg（经本地服务，支持 MP4/WebM/OGV/MOV/AVI，保真）；
// 未检测到 ffmpeg 时回退到浏览器原生 MediaRecorder（仅 MP4/WebM）。
let convVideo = null;
let hasServerFfmpeg = false;
let IS_DESKTOP = false;
// 桌面应用（pywebview）接口注入完成后，才开启桌面模式并重新填充格式选项
window.addEventListener('pywebviewready', function () {
    IS_DESKTOP = !!(window.pywebview && window.pywebview.api && window.pywebview.api.convert_video);
    fillConvertFormats();
    // 初始化全局导出路径：优先读本地保存，否则用系统下载文件夹
    loadExportDir();
    if (!getExportDir() && window.pywebview && window.pywebview.api && window.pywebview.api.get_download_dir) {
        window.pywebview.api.get_download_dir().then((d) => { if (d && !getExportDir()) setExportDir(d); });
    }
});
const REC_MIME = {
    mp4: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    webm: 'video/webm;codecs=vp9,opus'
};
const SERVER_FMTS = [
    ['mp4', 'MP4 (H.264)'],
    ['webm', 'WebM (VP8)'],
    ['ogv', 'OGV (Theora)'],
    ['mov', 'MOV (H.264)'],
    ['avi', 'AVI (MPEG4)']
];
function fillConvertFormats() {
    const sel = document.getElementById('convertFmt');
    if (!sel) return;
    sel.innerHTML = '';
    function addOpt(v, l) {
        const o = document.createElement('option');
        o.value = v; o.textContent = l;
        sel.appendChild(o);
    }
    function mp4WebmRec() {
        [['mp4', 'MP4 (H.264)'], ['webm', 'WebM (VP8)']].forEach(([v, l]) => {
            if (window.MediaRecorder && REC_MIME[v] && MediaRecorder.isTypeSupported(REC_MIME[v])) addOpt(v, l);
        });
    }
    if (IS_DESKTOP) {
        hasServerFfmpeg = true;
        SERVER_FMTS.forEach(([v, l]) => addOpt(v, l));
        const st = document.getElementById('convertStatus');
        if (st) { st.classList.add('hidden'); st.textContent = ''; }
        return;
    }
    fetch('/api/formats', { cache: 'no-store' }).then(r => r.json()).then(j => {
        hasServerFfmpeg = !!j.ffmpeg;
        if (hasServerFfmpeg) SERVER_FMTS.forEach(([v, l]) => addOpt(v, l));
        else mp4WebmRec();
    }).catch(() => {
        hasServerFfmpeg = false;
        mp4WebmRec();
        const st = document.getElementById('convertStatus');
        if (st) {
            st.classList.remove('hidden');
            st.textContent = '完整格式转换（OGV / MOV / AVI）需双击「启动工具.bat」启动本地服务后使用';
        }
    });
}
function convertVideo() {
    if (!videoFile) { alert('请先上传视频'); return; }
    if (IS_DESKTOP) convertDesktop();
    else if (hasServerFfmpeg) convertServer();
    else convertMediaRecorder();
}
async function convertServer() {
    const fmt = convertFmt.value;
    convertBtn.disabled = true;
    convertStatus.classList.remove('hidden');
    convertStatus.textContent = '正在转换（格式：' + fmt + '）...';
    convertDlLink.classList.add('hidden');
    try {
        const resp = await fetch('/api/convert?format=' + fmt, { method: 'POST', body: videoFile });
        if (!resp.ok) {
            const t = await resp.text();
            throw new Error(t || ('HTTP ' + resp.status));
        }
        const blob = await resp.blob();
        const name = (videoFile.name || 'video').replace(/\.[^.]+$/, '') + '.' + fmt;
        const url = URL.createObjectURL(blob);
        convertDlLink.href = url; convertDlLink.download = name; convertDlLink.classList.remove('hidden');
        convertStatus.textContent = '转换完成（' + (blob.size / 1024 / 1024).toFixed(2) + ' MB）';
    } catch (e) {
        convertStatus.textContent = '转换失败：' + (e.message || e);
    }
    convertBtn.disabled = false;
}
async function convertDesktop() {
    const fmt = convertFmt.value;
    convertBtn.disabled = true;
    convertStatus.classList.remove('hidden');
    convertStatus.textContent = '正在转换（格式：' + fmt + '）...';
    convertDlLink.classList.add('hidden');
    try {
        const buf = await videoFile.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        const b64 = btoa(bin);
        const result = await window.pywebview.api.convert_video(b64, fmt);
        if (result && /^[a-zA-Z]:[\\/]/.test(result)) {
            convertStatus.textContent = '转换完成，已保存到：' + result;
        } else {
            throw new Error(result || '转换失败');
        }
    } catch (e) {
        convertStatus.textContent = '转换失败：' + (e.message || e);
    }
    convertBtn.disabled = false;
}
function convertMediaRecorder() {
    if (!window.MediaRecorder) { alert('当前浏览器不支持视频录制转码'); return; }
    const mt = REC_MIME[convertFmt.value];
    if (!mt) { alert('当前浏览器不支持所选格式的录制'); return; }
    if (convVideo) { convVideo.rec.stop(); convVideo.src.pause(); }
    const cap = videoPreview.captureStream ? videoPreview.captureStream() : (videoPreview.mozCaptureStream ? videoPreview.mozCaptureStream() : null);
    if (!cap) { alert('当前浏览器不支持画面捕获，无法转换'); return; }
    const rec = new MediaRecorder(cap, { mimeType: mt });
    const chunks = [];
    convertBtn.disabled = true;
    convertStatus.classList.remove('hidden');
    convertStatus.textContent = '正在转换（需完整播放一遍视频；为保留音轨，播放时会出声）...';
    convertDlLink.classList.add('hidden');
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
        const blob = new Blob(chunks, { type: mt });
        const url = URL.createObjectURL(blob);
        const name = (videoFile.name || 'video').replace(/\.[^.]+$/, '') + '_converted.' + convertFmt.value;
        convertDlLink.href = url;
        convertDlLink.download = name;
        convertDlLink.classList.remove('hidden');
        convertStatus.textContent = `转换完成（${(blob.size / 1024 / 1024).toFixed(2)} MB）`;
        convertBtn.disabled = false;
        convVideo = null;
    };
    const vid = videoPreview;
    vid.muted = false; // 保留音轨需出声播放
    vid.onended = () => { if (convVideo) convVideo.rec.stop(); };
    convVideo = { rec, src: vid };
    rec.start();
    vid.currentTime = 0;
    vid.play().catch(() => { });
}
convertBtn.addEventListener('click', convertVideo);
fillConvertFormats();

// ========== 截帧 ==========
// 截取视频在 time 秒处的一帧并加入 frames（按时间排序、自动去重、重新编号）
async function captureFrameAt(time) {
    if (videoFile === null || time < 0 || time > videoDuration) return -1;
    const exist = frames.find(f => Math.abs(f.time - time) < 0.001);
    if (exist) return exist.index;
    if (Math.abs(videoPreview2.currentTime - time) > 0.01) {
        videoPreview2.currentTime = time;
        await new Promise(r => videoPreview2.onseeked = r);
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = videoPreview2.videoWidth;
    canvas.height = videoPreview2.videoHeight;
    ctx.drawImage(videoPreview2, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => img.onload = r);
    frames.push({ index: -1, time, dataUrl, orig: img, img });
    frames.sort((a, b) => a.time - b.time);
    frames.forEach((f, i) => f.index = i);
    return frames.findIndex(f => Math.abs(f.time - time) < 0.001);
}
function markAllSelected() {
    selectedFrames = frames.map(f => f.index);
    goStep3Btn.disabled = selectedFrames.length === 0;
}
extractBtn.addEventListener('click', async () => {
    if (!videoFile) return;
    const interval = parseFloat(intervalInput.value);
    if (isNaN(interval) || interval <= 0) { alert('请输入有效的间隔'); return; }
    const { start, end } = rangeSecs();
    if (end - start < 0.01) { alert('请先设置有效的截帧区间'); return; }
    const totalFrames = Math.floor((end - start) / interval) + 1;
    progress1.classList.remove('hidden');
    extractBtn.disabled = true;
    status2.textContent = `正在截取区间 ${start.toFixed(2)}s ~ ${end.toFixed(2)}s，共 ${totalFrames} 帧...`;
    for (let i = 0; i < totalFrames; i++) {
        const time = start + i * interval;
        if (time > end + 0.001) break;
        await captureFrameAt(Math.min(time, videoDuration));
        progressBar1.style.width = ((i + 1) / totalFrames * 100) + '%';
    }
    extractBtn.disabled = false;
    progress1.classList.add('hidden');
    renderFrames();
    markAllSelected();
    status2.textContent = `截取完成，共 ${frames.length} 帧，已全部选中`;
});

// 手动选取当前播放位置的一帧
addFrameBtn.addEventListener('click', async () => {
    if (!videoFile) return;
    const t = videoPreview2.currentTime;
    const idx = await captureFrameAt(t);
    renderFrames();
    markAllSelected();
    status2.textContent = `已添加 ${t.toFixed(2)}s 的帧${idx >= 0 ? '（第 ' + idx + ' 帧）' : ''}，当前共 ${frames.length} 帧`;
});

function renderFrames() {
    framesGrid.innerHTML = '';
    framesGrid.classList.remove('hidden');
    
    frames.forEach(f => {
        const item = document.createElement('div');
        item.className = 'frame-item selected';
        item.dataset.index = f.index;
        item.innerHTML = `
            <input type="checkbox" class="checkbox" checked>
            <img src="${f.dataUrl}">
            <div class="frame-index">#${f.index} (${f.time.toFixed(2)}s)</div>
        `;
        item.addEventListener('click', e => {
            if (e.target.tagName === 'INPUT') return;
            // 点击缩略图：选中该帧并进入编辑模式
            const cb = item.querySelector('.checkbox');
            if (!cb.checked) {
                cb.checked = true;
                toggleFrame(f.index, true);
            }
            openEditor(f.index);
        });
        item.querySelector('.checkbox').addEventListener('change', e => {
            toggleFrame(f.index, e.target.checked);
        });
        framesGrid.appendChild(item);
    });
}

function syncStatus3() {
    if (step3.classList.contains('hidden')) return;
    status3.textContent = `已选择 ${selectedFrames.length} 帧，请选择导出方式`;
}

function toggleFrame(index, checked) {
    const item = framesGrid.querySelector(`[data-index="${index}"]`);
    if (checked) {
        item.classList.add('selected');
        if (!selectedFrames.includes(index)) selectedFrames.push(index);
    } else {
        item.classList.remove('selected');
        selectedFrames = selectedFrames.filter(i => i !== index);
    }
    status2.textContent = `已选择 ${selectedFrames.length} / ${frames.length} 帧`;
    goStep3Btn.disabled = selectedFrames.length === 0;
    syncStatus3();
}

selectAllBtn.addEventListener('click', () => {
    selectedFrames = frames.map(f => f.index);
    document.querySelectorAll('.frame-item').forEach(el => {
        el.classList.add('selected');
        el.querySelector('.checkbox').checked = true;
    });
    status2.textContent = `已选择 ${selectedFrames.length} / ${frames.length} 帧`;
    goStep3Btn.disabled = false;
    syncStatus3();
});

invertBtn.addEventListener('click', () => {
    selectedFrames = [];
    document.querySelectorAll('.frame-item').forEach(el => {
        const cb = el.querySelector('.checkbox');
        cb.checked = !cb.checked;
        if (cb.checked) {
            el.classList.add('selected');
            selectedFrames.push(parseInt(el.dataset.index));
        } else {
            el.classList.remove('selected');
        }
    });
    status2.textContent = `已选择 ${selectedFrames.length} / ${frames.length} 帧`;
    goStep3Btn.disabled = selectedFrames.length === 0;
    syncStatus3();
});

// ========== 进入第三步 ==========
goStep3Btn.addEventListener('click', () => {
    // 先进入“调整帧顺序”步骤
    enterOrderStep();
    stepOrder.classList.remove('hidden');
    stepOrder.scrollIntoView({ behavior: 'smooth' });
});
backToStep2Btn.addEventListener('click', () => {
    stepOrder.classList.add('hidden');
    step2.scrollIntoView({ behavior: 'smooth' });
});
goStep3Btn2.addEventListener('click', () => {
    // 进入导出设置时不隐藏排序步骤，保持可见以便对照调整
    syncFrameOrder();
    renderZipGroupList();
    renderSpriteDropdown();
    step3.classList.remove('hidden');
    status3.textContent = `已选择 ${selectedFrames.length} 帧，请选择导出方式`;
    spritePreview.classList.add('hidden');
    step3.scrollIntoView({ behavior: 'smooth' });
});

// ---- 导出视图选项卡 ----
tabZip.addEventListener('click', () => { switchExportView('viewZip'); });
tabSprite.addEventListener('click', () => { switchExportView('viewSprite'); });
function switchExportView(name) {
    const map = { viewZip: tabZip, viewSprite: tabSprite };
    [tabZip, tabSprite].forEach(t => t.classList.toggle('active', t === map[name]));
    [viewZip, viewSprite].forEach(v => v.classList.toggle('active', v.id === name));
}

// ---- 调整帧顺序与分组 ----
function enterOrderStep() {
    rebuildFrameGroups();
    renderGroupsArea();
    statusOrder.textContent = `已选取 ${selectedFrames.length} 帧，拖拽排序，或拖到分组下方新建分组`;
}
function rebuildFrameGroups() {
    const sel = new Set(selectedFrames);
    frameGroups.forEach(g => { g.frames = g.frames.filter(i => sel.has(i)); });
    frameGroups = frameGroups.filter(g => g.frames.length > 0 || g.name === '未分组');
    if (frameGroups.length === 0 || !frameGroups.some(g => g.name === '未分组')) {
        const byTime = selectedFrames.slice().sort((a, b) => (frames[a].time || 0) - (frames[b].time || 0));
        frameGroups.unshift({ name: '未分组', frames: byTime });
    } else {
        const seen = new Set();
        frameGroups.forEach(g => g.frames.forEach(i => seen.add(i)));
        const missing = selectedFrames.filter(i => !seen.has(i)).sort((a, b) => (frames[a].time || 0) - (frames[b].time || 0));
        if (missing.length) frameGroups[0].frames = frameGroups[0].frames.concat(missing);
    }
}
function syncFrameOrder() {
    frameOrder = frameGroups.flatMap(g => g.frames);
}
// ---- 分组帧动画预览播放 ----
const groupPlayers = {};
function stopPlay(gi) { const p = groupPlayers[gi]; if (p && p.timer) clearInterval(p.timer); groupPlayers[gi] = null; }
function stopAllPlay() { for (const k in groupPlayers) { const p = groupPlayers[k]; if (p && p.timer) clearInterval(p.timer); } for (const k in groupPlayers) delete groupPlayers[k]; }
function clearPlayHighlight(gi) {
    const block = document.querySelector('.group-block[data-gi="' + gi + '"]');
    if (block) block.querySelectorAll('.order-item').forEach(it => it.classList.remove('playing'));
}
function showFrame(gi, idx, preview) {
    const g = frameGroups[gi]; if (!g) return;
    preview.src = frames[g.frames[idx]].dataUrl;
    const block = document.querySelector('.group-block[data-gi="' + gi + '"]');
    if (block) { const items = block.querySelectorAll('.order-item'); items.forEach((it, i) => it.classList.toggle('playing', i === idx)); }
}
function startPlay(gi, fpsIn, loopChk, preview, btn) {
    const g = frameGroups[gi]; if (!g || g.frames.length < 2) { alert('该分组帧数不足，无法播放'); return; }
    stopPlay(gi);
    const fps = Math.max(1, Math.min(60, parseInt(fpsIn.value) || 10));
    const p = { idx: 0, fps, loop: loopChk.checked, timer: null, preview, btn };
    groupPlayers[gi] = p;
    if (btn) btn.textContent = '⏸';
    const step = () => {
        p.idx++;
        if (p.idx >= g.frames.length) { if (p.loop) { p.idx = 0; } else { stopPlay(gi); if (btn) btn.textContent = '▶'; clearPlayHighlight(gi); return; } }
        showFrame(gi, p.idx, preview);
    };
    showFrame(gi, p.idx, preview);
    p.timer = setInterval(step, 1000 / fps);
}
function togglePlay(gi, fpsIn, loopChk, preview, btn) {
    if (groupPlayers[gi]) { stopPlay(gi); btn.textContent = '▶'; clearPlayHighlight(gi); }
    else startPlay(gi, fpsIn, loopChk, preview, btn);
}

function renderGroupsArea() {
    groupsArea.innerHTML = '';
    stopAllPlay();
    frameGroups.forEach((g, gi) => {
        const block = document.createElement('div');
        block.className = 'group-block';
        block.dataset.gi = gi;
        // 头部：名称 + 数量 + 删除
        const head = document.createElement('div');
        head.className = 'group-head';
        const name = document.createElement('span');
        name.className = 'group-name';
        name.textContent = g.name;
        name.title = '双击重命名';
        name.addEventListener('dblclick', () => renameGroupInline(name, gi));
        const count = document.createElement('span');
        count.className = 'group-count';
        count.textContent = `(${g.frames.length})`;
        head.appendChild(name); head.appendChild(count);
        if (g.name !== '未分组') {
            const del = document.createElement('button');
            del.className = 'group-del';
            del.textContent = '×';
            del.title = '删除分组（帧移回未分组）';
            del.addEventListener('click', () => deleteGroup(gi));
            head.appendChild(del);
        }
        block.appendChild(head);
        // 播放预览条
        const play = document.createElement('div');
        play.className = 'group-play';
        const playBtn = document.createElement('button');
        playBtn.className = 'play-btn';
        playBtn.textContent = '▶';
        playBtn.title = '播放 / 停止';
        const fpsLab = document.createElement('span');
        fpsLab.textContent = '频率';
        const fpsIn = document.createElement('input');
        fpsIn.type = 'number'; fpsIn.className = 'play-fps'; fpsIn.value = '10'; fpsIn.min = 1; fpsIn.max = 60;
        const fpsU = document.createElement('span');
        fpsU.textContent = 'fps';
        const loopLab = document.createElement('label');
        loopLab.className = 'play-loop-lab';
        const loopChk = document.createElement('input');
        loopChk.type = 'checkbox'; loopChk.className = 'play-loop'; loopChk.checked = true;
        loopLab.appendChild(loopChk); loopLab.appendChild(document.createTextNode('循环'));
        const preview = document.createElement('img');
        preview.className = 'play-preview'; preview.alt = '';
        if (g.frames.length) preview.src = frames[g.frames[0]].dataUrl;
        playBtn.addEventListener('click', () => togglePlay(gi, fpsIn, loopChk, preview, playBtn));
        fpsIn.addEventListener('change', () => { if (groupPlayers[gi]) startPlay(gi, fpsIn, loopChk, preview, groupPlayers[gi].btn); });
        loopChk.addEventListener('change', () => { if (groupPlayers[gi]) groupPlayers[gi].loop = loopChk.checked; });
        play.appendChild(playBtn); play.appendChild(fpsLab); play.appendChild(fpsIn); play.appendChild(fpsU); play.appendChild(loopLab); play.appendChild(preview);
        block.appendChild(play);
        // 帧列表
        const framesBox = document.createElement('div');
        framesBox.className = 'group-frames';
        g.frames.forEach((frameIdx, pos) => {
            const f = frames[frameIdx];
            const item = document.createElement('div');
            item.className = 'order-item';
            item.dataset.gi = gi;
            item.dataset.pos = pos;
            item.innerHTML = `<span class="order-idx">${pos + 1}</span><img src="${f.dataUrl}" alt="帧" draggable="false"><div class="order-time">${f.time.toFixed(2)}s</div>`;
            item.addEventListener('pointerdown', e => { e.preventDefault(); startDrag(gi, pos, item, e); });
            framesBox.appendChild(item);
        });
        block.appendChild(framesBox);
        groupsArea.appendChild(block);
    });
    // 整块区域统一的“新建分组”放置区
    const globalDrop = document.createElement('div');
    globalDrop.className = 'group-drop-new';
    globalDrop.textContent = '＋ 拖图片到此处新建分组';
    groupsArea.appendChild(globalDrop);
}
function renameGroupInline(el, gi) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'group-name-input';
    input.value = frameGroups[gi].name;
    el.replaceWith(input);
    input.focus(); input.select();
    let done = false;
    const commit = () => {
        if (done) return; done = true;
        const v = input.value.trim();
        if (v) frameGroups[gi].name = v;
        renderGroupsArea();
    };
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        else if (e.key === 'Escape') { done = true; renderGroupsArea(); }
    });
    input.addEventListener('blur', commit);
}
function deleteGroup(gi) {
    const g = frameGroups[gi];
    if (g.name === '未分组') return;
    const def = frameGroups[0];
    g.frames.forEach(i => def.frames.push(i));
    frameGroups.splice(gi, 1);
    renderGroupsArea();
}

// ---- 拖拽排序 / 跨组 / 新建分组 ----
let dragState = null;
function startDrag(gi, pos, item, e) {
    dragState = { gi, pos, frameIdx: frameGroups[gi].frames[pos], ghost: null, line: null, target: null, dropEl: null };
    const ghost = item.cloneNode(true);
    ghost.classList.add('order-ghost');
    ghost.style.position = 'fixed';
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = 99999;
    document.body.appendChild(ghost);
    dragState.ghost = ghost;
    const line = document.createElement('div');
    line.className = 'order-insert-line';
    groupsArea.appendChild(line);
    dragState.line = line;
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    updateDragTarget(e);
}
function onDragMove(e) {
    if (!dragState) return;
    dragState.ghost.style.left = (e.clientX + 14) + 'px';
    dragState.ghost.style.top = (e.clientY + 14) + 'px';
    updateDragTarget(e);
}
function updateDragTarget(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const framesEl = el ? el.closest('.group-frames') : null;
    const dropEl = el ? el.closest('.group-drop-new') : null;
    const itemEl = el ? el.closest('.order-item') : null;
    // 清除旧高亮
    groupsArea.querySelectorAll('.group-drop-new.hover').forEach(x => x.classList.remove('hover'));
    // 1) 新建分组放置区（整块区域唯一）
    if (dropEl) {
        dragState.target = { type: 'new' };
        dragState.dropEl = dropEl;
        dropEl.classList.add('hover');
        hideLine();
        return;
    }
    // 2) 帧列表内（可能是本组或他组）
    if (framesEl || itemEl) {
        const gi = itemEl ? parseInt(itemEl.dataset.gi) : parseInt(framesEl.closest('.group-block').dataset.gi);
        const targetBlock = groupsArea.querySelector('.group-block[data-gi="' + gi + '"]');
        const list = targetBlock.querySelector('.group-frames');
        const items = [...list.querySelectorAll('.order-item')];
        dragState.target = { type: 'group', gi };
        dragState.dropEl = null;
        if (!items.length) { hideLine(); return; }
        let insertPos;
        // 3) 拖到某张图片上方：以该图左右侧为插入点
        if (itemEl && items.indexOf(itemEl) !== -1) {
            const r = itemEl.getBoundingClientRect();
            insertPos = (e.clientX < r.left + r.width / 2) ? items.indexOf(itemEl) : items.indexOf(itemEl) + 1;
        } else {
            // 拖到组内空白：找最近缝隙
            let best = { pos: 0, dist: Infinity };
            for (let i = 0; i <= items.length; i++) {
                const right = i < items.length ? items[i] : null;
                const left = i > 0 ? items[i - 1] : null;
                let x, y;
                if (right) { const r = right.getBoundingClientRect(); x = r.left; y = r.top + r.height / 2; }
                else { const r = left.getBoundingClientRect(); x = r.right; y = r.top + r.height / 2; }
                const d = Math.hypot(e.clientX - x, e.clientY - y);
                if (d < best.dist) best = { pos: i, dist: d };
            }
            insertPos = best.pos;
        }
        dragState.insertPos = insertPos;
        // 插入虚线：仅在两个相邻帧之间，长度=该行帧高度
        const anchor = insertPos < items.length ? items[insertPos] : items[items.length - 1];
        const r = anchor.getBoundingClientRect();
        const g = groupsArea.getBoundingClientRect();
        const x = insertPos < items.length ? r.left : r.right;
        dragState.line.style.display = 'block';
        dragState.line.style.top = (r.top - g.top) + 'px';
        dragState.line.style.height = r.height + 'px';
        dragState.line.style.left = (x - g.left) + 'px';
        return;
    }
    // 3) 其他区域
    dragState.target = null; dragState.dropEl = null; dragState.insertPos = undefined;
    hideLine();
}
function hideLine() { if (dragState && dragState.line) dragState.line.style.display = 'none'; }
function onDragEnd() {
    if (!dragState) return;
    const t = dragState.target;
    if (t) {
        if (t.type === 'new') {
            // 新建分组放入（自动命名，之后可双击重命名）
            const g = frameGroups[dragState.gi];
            const idxIn = g.frames.indexOf(dragState.frameIdx);
            if (idxIn >= 0) g.frames.splice(idxIn, 1);
            groupSeq++;
            frameGroups.push({ name: '分组 ' + groupSeq, frames: [dragState.frameIdx], settings: defaultSpriteSettings() });
            statusOrder.textContent = `已放入新分组「${frameGroups[frameGroups.length - 1].name}」（双击标题可重命名）`;
        } else if (t.type === 'group') {
            const from = dragState.gi, to = t.gi, pos = dragState.insertPos;
            if (from !== to) {
                const src = frameGroups[from];
                const idxIn = src.frames.indexOf(dragState.frameIdx);
                if (idxIn >= 0) src.frames.splice(idxIn, 1);
                frameGroups[to].frames.splice(pos, 0, dragState.frameIdx);
                statusOrder.textContent = `已移到「${frameGroups[to].name}」`;
            } else {
                // 组内排序
                const src = frameGroups[from];
                const old = src.frames.indexOf(dragState.frameIdx);
                if (pos !== old && pos !== old + 1) {
                    src.frames.splice(old, 1);
                    src.frames.splice(pos > old ? pos - 1 : pos, 0, dragState.frameIdx);
                }
            }
        }
    }
    if (dragState.ghost) dragState.ghost.remove();
    if (dragState.line) dragState.line.remove();
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    dragState = null;
    renderGroupsArea();
}

// ========== 导出 ZIP ==========
function renderZipGroupList() {
    zipGroupList.innerHTML = '';
    if (!frameGroups.length) { zipGroupList.innerHTML = '<div class="zip-group-none">暂无分组，请先在第三步整理帧</div>'; return; }
    frameGroups.forEach((g, gi) => {
        // 每个分组一个可展开下拉框：头部勾选 + 名称 + 帧数，点击展开该分组帧缩略图预览
        const dd = document.createElement('div');
        dd.className = 'sprite-dropdown';
        const head = document.createElement('div');
        head.className = 'sprite-dropdown-head';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'sprite-dd-check';
        cb.checked = zipChecked[gi] !== false;
        cb.addEventListener('change', () => { zipChecked[gi] = cb.checked; });
        cb.addEventListener('click', e => { e.stopPropagation(); });
        const title = document.createElement('span');
        title.textContent = g.name + (g.frames.length ? `（${g.frames.length} 帧）` : '（0 帧）');
        const arrow = document.createElement('span');
        arrow.className = 'sprite-dd-arrow'; arrow.textContent = '▾';
        head.appendChild(cb); head.appendChild(title); head.appendChild(arrow);
        const body = document.createElement('div');
        body.className = 'sprite-dropdown-body hidden';
        const framesRow = document.createElement('div');
        framesRow.className = 'sprite-dd-frames';
        if (!g.frames.length) {
            framesRow.innerHTML = '<div class="zip-group-none">该分组暂无帧</div>';
        } else {
            g.frames.forEach(idx => {
                const f = frames[idx];
                if (!f) return;
                const t = document.createElement('div');
                t.className = 'sprite-dd-frame';
                const img = document.createElement('img');
                img.src = f.dataUrl || f.img.toDataURL();
                img.alt = '帧' + idx;
                t.appendChild(img);
                const cap = document.createElement('span');
                cap.textContent = '#' + idx;
                t.appendChild(cap);
                framesRow.appendChild(t);
            });
        }
        body.appendChild(framesRow);
        dd.appendChild(head); dd.appendChild(body);
        head.addEventListener('click', () => {
            body.classList.toggle('hidden');
            dd.classList.toggle('open', !body.classList.contains('hidden'));
        });
        zipGroupList.appendChild(dd);
    });
}
function defaultSpriteSettings() {
    return { cols: 8, rows: 0, frameW: 0, frameH: 0, gap: 0, bgMode: 'transparent', bgColor: '#000000' };
}
function ensureSpriteSettings() {
    frameGroups.forEach(g => { if (!g.settings) g.settings = defaultSpriteSettings(); });
}
function sanitizeFolderName(name) {
    return String(name).replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名分组';
}
// 文件夹命名方式：默认(分组名) / 自定义前缀
document.querySelectorAll('input[name="zipNameMode"]').forEach(r => {
    r.addEventListener('change', () => {
        zipNamePrefix.classList.toggle('hidden', r.value !== 'custom');
    });
});
function zipFolderName(g, gi) {
    const custom = document.querySelector('input[name="zipNameMode"]:checked');
    if (custom && custom.value === 'custom') {
        const p = sanitizeFolderName(zipNamePrefix.value);
        return p ? `${p}_${gi + 1}` : sanitizeFolderName(g.name);
    }
    return sanitizeFolderName(g.name);
}
exportZipBtn.addEventListener('click', async () => {
    if (selectedFrames.length === 0) return;
    
    exportZipBtn.disabled = true;
    exportZipBtn.textContent = '正在打包...';
    
    const zip = new JSZip();
    const anyChecked = frameGroups.some((g, gi) => zipChecked[gi] !== false && g.frames.length > 0);
    if (!anyChecked) { alert('请至少勾选一个分组'); exportZipBtn.disabled = false; exportZipBtn.textContent = '导出 ZIP 压缩包'; return; }
    
    frameGroups.forEach((g, gi) => {
        if (zipChecked[gi] === false || g.frames.length === 0) return;
        const folder = zip.folder(zipFolderName(g, gi));
        g.frames.forEach((frameIdx, i) => {
            const f = frames[frameIdx];
            const base64 = f.dataUrl.split(',')[1];
            folder.file(`frame_${String(i).padStart(4, '0')}.png`, base64, { base64: true });
        });
    });
    
    const blob = await zip.generateAsync({ type: 'blob' });
    if (IS_DESKTOP && window.pywebview && window.pywebview.api && window.pywebview.api.save_zip) {
        const b64 = await blobToBase64(blob);
        const res = await window.pywebview.api.save_zip(b64, getExportDir(), 'frames_export.zip');
        status3.textContent = (res && res.indexOf('：') !== -1) ? res : ('已导出到：' + (res || ''));
    } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'frames_export.zip';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    exportZipBtn.disabled = false;
    exportZipBtn.textContent = '导出 ZIP 压缩包';
});

// 渲染单个分组的精灵图约束设置（返回 DOM 元素）
function buildGroupSettings(gi) {
    const g = frameGroups[gi];
    const s = g.settings;
    const box = document.createElement('div');
    box.className = 'sprite-group-editor';
    const head = document.createElement('div');
    head.className = 'sge-head';
    head.textContent = g.name + (g.frames.length ? `（${g.frames.length} 帧）` : '（0 帧）');
    box.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'sprite-settings';
    grid.appendChild(numItem('列数', s.cols, 1, 10000, v => s.cols = Math.max(1, v || 1)));
    grid.appendChild(numItem('行数', s.rows, 0, 10000, v => s.rows = Math.max(0, v || 0), '0=自动'));
    grid.appendChild(numItem('帧宽(px)', s.frameW, 0, 10000, v => s.frameW = Math.max(0, v || 0), '0=原宽'));
    grid.appendChild(numItem('帧高(px)', s.frameH, 0, 10000, v => s.frameH = Math.max(0, v || 0), '0=原高'));
    grid.appendChild(numItem('间距(px)', s.gap, 0, 10000, v => s.gap = Math.max(0, v || 0)));
    const bgItem = document.createElement('div');
    bgItem.className = 'ss-item';
    const bgL = document.createElement('label'); bgL.textContent = '背景';
    const bgSel = document.createElement('select');
    ['transparent', 'color'].forEach(m => {
        const op = document.createElement('option');
        op.value = m; op.textContent = (m === 'transparent' ? '透明' : '纯色');
        if (m === s.bgMode) op.selected = true;
        bgSel.appendChild(op);
    });
    const bgColor = document.createElement('input');
    bgColor.type = 'color'; bgColor.value = s.bgColor; bgColor.title = '背景色';
    if (s.bgMode !== 'color') bgColor.classList.add('hidden');
    bgSel.addEventListener('change', () => {
        s.bgMode = bgSel.value;
        bgColor.classList.toggle('hidden', bgSel.value !== 'color');
    });
    bgColor.addEventListener('input', () => { s.bgColor = bgColor.value; });
    bgItem.appendChild(bgL); bgItem.appendChild(bgSel); bgItem.appendChild(bgColor);
    grid.appendChild(bgItem);
    box.appendChild(grid);
    return box;
}

// 渲染精灵图下拉框：每个分组一个可展开的下拉框（帧图 + 约束设置）
function renderSpriteDropdown() {
    ensureSpriteSettings();
    spriteDropdowns.innerHTML = '';
    if (!frameGroups.length) {
        spriteDropdowns.innerHTML = '<div class="zip-group-none">暂无分组，请先在第三步整理帧</div>';
        return;
    }
    frameGroups.forEach((g, gi) => {
        const dd = document.createElement('div');
        dd.className = 'sprite-dropdown';
        const head = document.createElement('div');
        head.className = 'sprite-dropdown-head';
        // 头部勾选是否生成该分组精灵图
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'sprite-dd-check';
        cb.checked = spriteChecked[gi] !== false;
        cb.addEventListener('change', () => { spriteChecked[gi] = cb.checked; });
        cb.addEventListener('click', e => { e.stopPropagation(); });
        const title = document.createElement('span');
        title.textContent = g.name + (g.frames.length ? `（${g.frames.length} 帧）` : '（0 帧）');
        const arrow = document.createElement('span');
        arrow.className = 'sprite-dd-arrow'; arrow.textContent = '▾';
        head.appendChild(cb); head.appendChild(title); head.appendChild(arrow);
        const body = document.createElement('div');
        body.className = 'sprite-dropdown-body hidden';
        // 该分组的所有帧图片
        const framesRow = document.createElement('div');
        framesRow.className = 'sprite-dd-frames';
        if (!g.frames.length) {
            framesRow.innerHTML = '<div class="zip-group-none">该分组暂无帧</div>';
        } else {
            g.frames.forEach(idx => {
                const f = frames[idx];
                if (!f) return;
                const t = document.createElement('div');
                t.className = 'sprite-dd-frame';
                const img = document.createElement('img');
                img.src = f.dataUrl || f.img.toDataURL();
                img.alt = '帧' + idx;
                t.appendChild(img);
                const cap = document.createElement('span');
                cap.textContent = '#' + idx;
                t.appendChild(cap);
                framesRow.appendChild(t);
            });
        }
        body.appendChild(framesRow);
        // 该分组的约束设置
        const settingsBox = document.createElement('div');
        settingsBox.className = 'sprite-dd-settings';
        settingsBox.appendChild(buildGroupSettings(gi));
        body.appendChild(settingsBox);
        dd.appendChild(head); dd.appendChild(body);
        head.addEventListener('click', () => {
            body.classList.toggle('hidden');
            dd.classList.toggle('open', !body.classList.contains('hidden'));
        });
        spriteDropdowns.appendChild(dd);
    });
}
function numItem(labelText, val, min, max, onInput, unit) {
    const item = document.createElement('div');
    item.className = 'ss-item';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = min; input.max = max;
    input.value = val;
    input.addEventListener('input', () => onInput(parseInt(input.value)));
    item.appendChild(label); item.appendChild(input);
    if (unit) {
        const u = document.createElement('span');
        u.className = 'ss-unit'; u.textContent = unit;
        item.appendChild(u);
    }
    return item;
}

// ========== 生成精灵图（按分组逐个生成，使用各自设置） ==========
genSpriteBtn.addEventListener('click', () => {
    if (selectedFrames.length === 0) return;

    spriteSheets = [];
    spriteList.innerHTML = '';
    const groups = frameGroups.filter((g, gi) => g.frames.length && spriteChecked[gi] !== false);
    if (!groups.length) { alert('请至少勾选一个分组'); return; }
    groups.forEach(g => {
        if (!g.frames.length) return;
        ensureSpriteSettings();
        const s = g.settings;
        const cols = Math.max(1, s.cols || 8);
        const rows = s.rows || 0;
        const fwIn = s.frameW || 0, fhIn = s.frameH || 0;
        const gap = s.gap || 0;
        const bg = s.bgMode === 'color' ? s.bgColor : null;
        const sorted = g.frames;
        const origW = frames[sorted[0]].img.width, origH = frames[sorted[0]].img.height;
        const frameW = (fwIn > 0) ? fwIn : origW;
        const frameH = (fhIn > 0) ? fhIn : origH;
        const perSheet = rows > 0 ? cols * rows : cols * Math.ceil(sorted.length / cols);
        let groupSheetCount = 0;
        for (let sIdx = 0; sIdx * perSheet < sorted.length; sIdx++) {
            const chunk = sorted.slice(sIdx * perSheet, (sIdx + 1) * perSheet);
            const sheetRows = rows > 0 ? rows : Math.ceil(chunk.length / cols);
            const canvas = document.createElement('canvas');
            canvas.width = frameW * cols + (cols - 1) * gap;
            canvas.height = frameH * sheetRows + (sheetRows - 1) * gap;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
            chunk.forEach((frameIdx, i) => {
                const col = i % cols, row = Math.floor(i / cols);
                ctx.drawImage(frames[frameIdx].img, col * (frameW + gap), row * (frameH + gap), frameW, frameH);
            });
            groupSheetCount++;
            const name = (groupSheetCount === 1 ? 'sprite_sheet' : 'sprite_sheet_' + groupSheetCount) + '.png';
            spriteSheets.push({ groupName: g.name, name, url: canvas.toDataURL('image/png') });
        }
    });
    // 预览：按分组分组显示
    const byGroup = {};
    spriteSheets.forEach(s => { (byGroup[s.groupName] = byGroup[s.groupName] || []).push(s); });
    Object.keys(byGroup).forEach(gn => {
        const gHead = document.createElement('div');
        gHead.className = 'sheet-group-name';
        gHead.textContent = gn;
        spriteList.appendChild(gHead);
        byGroup[gn].forEach(s => {
            const wrap = document.createElement('div');
            wrap.className = 'sheet-name';
            wrap.textContent = s.name;
            const img = document.createElement('img');
            img.src = s.url; img.alt = s.name;
            const box = document.createElement('div');
            box.appendChild(wrap); box.appendChild(img);
            spriteList.appendChild(box);
        });
    });
    sheetCount.textContent = spriteSheets.length;
    spritePreview.classList.remove('hidden');
});

downloadSpriteBtn.addEventListener('click', async () => {
    if (!spriteSheets.length) return;
    const zip = new JSZip();
    const byGroup = {};
    spriteSheets.forEach(s => { (byGroup[s.groupName] = byGroup[s.groupName] || []).push(s); });
    Object.keys(byGroup).forEach(gn => {
        const folder = zip.folder(sanitizeFolderName(gn));
        byGroup[gn].forEach(s => folder.file(s.name, s.url.split(',')[1], { base64: true }));
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    if (IS_DESKTOP && window.pywebview && window.pywebview.api && window.pywebview.api.save_zip) {
        const b64 = await blobToBase64(blob);
        const res = await window.pywebview.api.save_zip(b64, getExportDir(), 'sprite_sheets.zip');
        const st = document.getElementById('status3');
        if (st) st.textContent = (res && res.indexOf('：') !== -1) ? res : ('已导出到：' + (res || ''));
    } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'sprite_sheets.zip';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }
});

// ========== 设置弹窗：导出保存路径 ==========
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const settingsExportPath = document.getElementById('settingsExportPath');
const settingsPathBtn = document.getElementById('settingsPathBtn');
const settingsPathReset = document.getElementById('settingsPathReset');
function refreshSettingsPath() {
    if (settingsExportPath) settingsExportPath.value = getExportDir() || '（默认：系统下载文件夹）';
}
function openSettings() {
    // 尚无导出路径且桌面版可用时，取系统下载目录作默认
    if (!getExportDir() && IS_DESKTOP && window.pywebview && window.pywebview.api && window.pywebview.api.get_download_dir) {
        window.pywebview.api.get_download_dir().then((d) => { if (d && !getExportDir()) { setExportDir(d); refreshSettingsPath(); } });
    }
    refreshSettingsPath();
    if (settingsModal) settingsModal.classList.remove('hidden');
}
function closeSettings() { if (settingsModal) settingsModal.classList.add('hidden'); }
settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', closeSettings);
settingsPathBtn.addEventListener('click', () => {
    if (!(window.create_file_dialog)) return;
    window.create_file_dialog(1 /* FOLDER_DIALOG */, getExportDir() || '', '', []).then((res) => {
        if (res && res.length && res[0]) {
            setExportDir(res[0].replace(/[\\/]+$/, ''));
            refreshSettingsPath();
        }
    });
});
settingsPathReset.addEventListener('click', () => {
    if (IS_DESKTOP && window.pywebview && window.pywebview.api && window.pywebview.api.get_download_dir) {
        window.pywebview.api.get_download_dir().then((d) => { setExportDir(d || ''); refreshSettingsPath(); });
    } else {
        setExportDir('');
        refreshSettingsPath();
    }
});


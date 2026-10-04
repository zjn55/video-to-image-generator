
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const videoPreview = document.getElementById('videoPreview');
const videoPreview2 = document.getElementById('videoPreview2');
const videoScrubber = document.getElementById('videoScrubber');
const rangeStart = document.getElementById('rangeStart');
const rangeEnd = document.getElementById('rangeEnd');
const rangeFill = document.getElementById('rangeFill');
const rangeInfoTxt = document.getElementById('rangeInfoTxt');
const addFrameBtn = document.getElementById('addFrameBtn');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const intervalInput = document.getElementById('interval');
const extractBtn = document.getElementById('extractBtn');
const framesGrid = document.getElementById('framesGrid');
const status2 = document.getElementById('status2');
const progress1 = document.getElementById('progress1');
const progressBar1 = document.getElementById('progressBar1');
const goStep3Btn = document.getElementById('goStep3Btn');
const stepOrder = document.getElementById('stepOrder');
const orderGrid = document.getElementById('orderGrid');
const statusOrder = document.getElementById('statusOrder');
const backToStep2Btn = document.getElementById('backToStep2Btn');
const goStep3Btn2 = document.getElementById('goStep3Btn2');
const groupsArea = document.getElementById('groupsArea');
const tabZip = document.getElementById('tabZip');
const tabSprite = document.getElementById('tabSprite');
const viewZip = document.getElementById('viewZip');
const viewSprite = document.getElementById('viewSprite');
const zipGroupList = document.getElementById('zipGroupList');
const zipNamePrefix = document.getElementById('zipNamePrefix');
const spriteDropdowns = document.getElementById('spriteDropdowns');
let zipChecked = {};
let spriteChecked = {};
const selectAllBtn = document.getElementById('selectAllBtn');
const invertBtn = document.getElementById('invertBtn');
const status3 = document.getElementById('status3');
const exportZipBtn = document.getElementById('exportZipBtn');
const sheetCount = document.getElementById('sheetCount');
const spriteList = document.getElementById('spriteList');
const genSpriteBtn = document.getElementById('genSpriteBtn');
const spritePreview = document.getElementById('spritePreview');
const downloadSpriteBtn = document.getElementById('downloadSpriteBtn');
let spriteSheets = [];

let videoFile = null;
let videoDuration = 0;
let frames = [];
let selectedFrames = [];
let frameOrder = [];
let frameGroups = [];
let groupSeq = 0;

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
function renderGroupsArea() {
    groupsArea.innerHTML = '';
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
        const row = document.createElement('label');
        row.className = 'zip-group';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = zipChecked[gi] !== false;
        cb.addEventListener('change', () => { zipChecked[gi] = cb.checked; });
        const nm = document.createElement('span');
        nm.className = 'zip-group-name';
        nm.textContent = g.name;
        const cnt = document.createElement('span');
        cnt.className = 'zip-group-count';
        cnt.textContent = `${g.frames.length} 帧`;
        row.appendChild(cb); row.appendChild(nm); row.appendChild(cnt);
        zipGroupList.appendChild(row);
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'frames_export.zip';
    a.click();
    URL.revokeObjectURL(url);
    
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

downloadSpriteBtn.addEventListener('click', () => {
    if (!spriteSheets.length) return;
    const zip = new JSZip();
    const byGroup = {};
    spriteSheets.forEach(s => { (byGroup[s.groupName] = byGroup[s.groupName] || []).push(s); });
    Object.keys(byGroup).forEach(gn => {
        const folder = zip.folder(sanitizeFolderName(gn));
        byGroup[gn].forEach(s => folder.file(s.name, s.url.split(',')[1], { base64: true }));
    });
    zip.generateAsync({ type: 'blob' }).then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'sprite_sheets.zip';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    });
});

// ================= 图片编辑模式 =================
const editorModal = document.getElementById('editorModal');
const editorTitle = document.getElementById('editorTitle');
const editorDisplay = document.getElementById('editorDisplay');
const curSize = document.getElementById('curSize');
const rotLeftBtn = document.getElementById('rotLeftBtn');
const rotRightBtn = document.getElementById('rotRightBtn');
const flipHBtn = document.getElementById('flipHBtn');
const flipVBtn = document.getElementById('flipVBtn');
const cropModeBtn = document.getElementById('cropModeBtn');
const resetCropBtn = document.getElementById('resetCropBtn');
const scaleW = document.getElementById('scaleW');
const scaleH = document.getElementById('scaleH');
const lockAspect = document.getElementById('lockAspect');
const applyScaleBtn = document.getElementById('applyScaleBtn');
const brightnessIn = document.getElementById('brightness');
const contrastIn = document.getElementById('contrast');
const saturationIn = document.getElementById('saturation');
const brightnessNum = document.getElementById('brightnessNum');
const contrastNum = document.getElementById('contrastNum');
const saturationNum = document.getElementById('saturationNum');
const resetBrightnessBtn = document.getElementById('resetBrightnessBtn');
const resetContrastBtn = document.getElementById('resetContrastBtn');
const resetSaturationBtn = document.getElementById('resetSaturationBtn');
const pixelateIn = document.getElementById('pixelate');
const pixelVal = document.getElementById('pixelVal');
const adjustScope = document.getElementById('adjustScope');
const regionModeBtn = document.getElementById('regionModeBtn');
const ellipseModeBtn = document.getElementById('ellipseModeBtn');
const lassoModeBtn = document.getElementById('lassoModeBtn');
const bgselModeBtn = document.getElementById('bgselModeBtn');
const regionList = document.getElementById('regionList');
const regionHint = document.getElementById('regionHint');
const eraseBtn = document.getElementById('eraseBtn');
const keepBtn = document.getElementById('keepBtn');
const clearEraseBtn = document.getElementById('clearEraseBtn');
const selectHint = document.getElementById('selectHint');
const clearRegionBtn = document.getElementById('clearRegionBtn');
const bgselControls = document.getElementById('bgselControls');
const pickBgBtn = document.getElementById('pickBgBtn');
const chromaSwatch = document.getElementById('chromaSwatch');
const clearChromaBtn = document.getElementById('clearChromaBtn');
const chromaTol = document.getElementById('chromaTol');
const chromaFeather = document.getElementById('chromaFeather');
const chromaTolVal = document.getElementById('chromaTolVal');
const chromaFeatherVal = document.getElementById('chromaFeatherVal');
const chromaHint = document.getElementById('chromaHint');
const brushToolBtn = document.getElementById('brushToolBtn');
const arrowToolBtn = document.getElementById('arrowToolBtn');
const textToolBtn = document.getElementById('textToolBtn');
const selectToolBtn = document.getElementById('selectToolBtn');
const textSizeIn = document.getElementById('textSizeIn');
const drawColor = document.getElementById('drawColor');
const drawSize = document.getElementById('drawSize');
const drawSizeInput = document.getElementById('drawSizeInput');
const clearAnnoBtn = document.getElementById('clearAnnoBtn');
const delSelectedBtn = document.getElementById('delSelectedBtn');
const undoStrokeBtn = document.getElementById('undoStrokeBtn');
const redoStrokeBtn = document.getElementById('redoStrokeBtn');
const resetEditBtn = document.getElementById('resetEditBtn');
const applyOneBtn = document.getElementById('applyOneBtn');
const applyAllBtn = document.getElementById('applyAllBtn');
const closeEditorBtn = document.getElementById('closeEditorBtn');

const editorState = {
    frameIndex: null,
    canvas: document.createElement('canvas'),
    rotation: 0,
    flipH: false, flipV: false,
    crop: null,
    cropping: false,
    targetW: null, targetH: null,
    brightness: 100, contrast: 100, saturation: 100,
    pixelate: 1,
    strokes: [],
    mode: 'none',
    brushColor: '#ff0000',
    brushSize: 3,
    selectedObj: null,
    undoStack: [],
    redoStack: [],
    view: { scale: 1, ox: 0, oy: 0 },
    regions: [],
    activeRegion: null,
    draftRegion: null,
    draftLasso: [],
    eraseOps: [],
};
let editorDrag = null;
let panDrag = null;

// ---- Canvas 工具函数 ----
function makeCanvasFromImage(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
}
function rotateCanvas(src, deg) {
    const w = src.width, h = src.height;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (deg % 180 === 0) {
        c.width = w; c.height = h;
        ctx.translate(w, h); ctx.rotate(Math.PI);
    } else {
        c.width = h; c.height = w;
        if (deg === 90) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
        else { ctx.translate(0, w); ctx.rotate(-Math.PI / 2); }
    }
    ctx.drawImage(src, 0, 0);
    return c;
}
function flipCanvas(src, flipH, flipV) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    if (flipH && flipV) { ctx.translate(src.width, src.height); ctx.scale(-1, -1); }
    else if (flipH) { ctx.translate(src.width, 0); ctx.scale(-1, 1); }
    else if (flipV) { ctx.translate(0, src.height); ctx.scale(1, -1); }
    ctx.drawImage(src, 0, 0);
    return c;
}
function pixelateCanvas(canvas, block) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const tw = Math.max(1, Math.round(w / block));
    const th = Math.max(1, Math.round(h / block));
    const tmp = document.createElement('canvas');
    tmp.width = tw; tmp.height = th;
    const tctx = tmp.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(canvas, 0, 0, tw, th);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(tmp, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
}
function buildPipelineCanvas(src, s) {
    let c = (s.rotation % 360) ? rotateCanvas(src, s.rotation) : makeCanvasFromImage(src);
    if (s.flipH || s.flipV) c = flipCanvas(c, s.flipH, s.flipV);
    let w = c.width, h = c.height;
    if (s.targetW) { w = s.targetW; h = s.targetH; }
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.filter = `brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturation}%)`;
    ctx.drawImage(c, 0, 0, w, h);
    ctx.filter = 'none';
    if (s.pixelate > 1) pixelateCanvas(out, s.pixelate);
    return out;
}
function buildCrop(c, s) {
    if (!s.crop) return c;
    const cw = c.width, ch = c.height;
    const x = Math.round(s.crop.x * cw), y = Math.round(s.crop.y * ch);
    const w = Math.max(1, Math.round(s.crop.w * cw)), h = Math.max(1, Math.round(s.crop.h * ch));
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d').drawImage(c, x, y, w, h, 0, 0, w, h);
    return out;
}
// 对画布上每个局部区域应用各自独立的亮度/对比度/饱和度/像素化/抠图
// 区域支持像素级掩码（矩形 / 椭圆 / 套索 / 背景色选区）
function applyRegions(canvas, s) {
    if (!s.regions.length) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width, ch = canvas.height;
    s.regions.forEach(r => {
        const x = Math.max(0, Math.round(r.x * cw)), y = Math.max(0, Math.round(r.y * ch));
        const w = Math.max(1, Math.min(cw - x, Math.round(r.w * cw)));
        const h = Math.max(1, Math.min(ch - y, Math.round(r.h * ch)));
        if (w < 1 || h < 1) return;
        const needAdjust = !(r.brightness === 100 && r.contrast === 100 && r.saturation === 100);
        const needPixelate = r.pixelate > 1;
        const needTransparent = !!r.transparent;
        const needFill = !!r.fillColor;
        if (!needAdjust && !needPixelate && !needTransparent && !needFill) return;
        const img = ctx.getImageData(x, y, w, h);
        const d = img.data;
        const mask = r.mask || null;
        // 调色
        if (needAdjust) {
            const b = r.brightness / 100, c = r.contrast / 100, sat = r.saturation / 100;
            for (let i = 0; i < w * h; i++) {
                if (mask && mask[i] === 0) continue;
                const o = i * 4;
                let R = d[o], G = d[o + 1], B = d[o + 2];
                if (b !== 1) { R *= b; G *= b; B *= b; }
                if (c !== 1) { R = (R - 128) * c + 128; G = (G - 128) * c + 128; B = (B - 128) * c + 128; }
                if (sat !== 1) { const L = 0.213 * R + 0.715 * G + 0.072 * B; R = L + (R - L) * sat; G = L + (G - L) * sat; B = L + (B - L) * sat; }
                d[o] = R; d[o + 1] = G; d[o + 2] = B;
            }
        }
        // 像素化
        if (needPixelate) {
            const p = r.pixelate;
            for (let by = 0; by < h; by += p) {
                for (let bx = 0; bx < w; bx += p) {
                    let sr = 0, sg = 0, sb = 0, cnt = 0;
                    const x1b = Math.min(bx + p, w), y1b = Math.min(by + p, h);
                    for (let py = by; py < y1b; py++) {
                        for (let px = bx; px < x1b; px++) {
                            const ii = py * w + px;
                            if (mask && mask[ii] === 0) continue;
                            const o = ii * 4;
                            sr += d[o]; sg += d[o + 1]; sb += d[o + 2]; cnt++;
                        }
                    }
                    if (!cnt) continue;
                    sr /= cnt; sg /= cnt; sb /= cnt;
                    for (let py = by; py < y1b; py++) {
                        for (let px = bx; px < x1b; px++) {
                            const ii = py * w + px;
                            if (mask && mask[ii] === 0) continue;
                            const o = ii * 4;
                            d[o] = sr; d[o + 1] = sg; d[o + 2] = sb;
                        }
                    }
                }
            }
        }
        // 填充颜色：选中像素改为填充色（羽化边按掩码强度混合）
        if (needFill) {
            const fr = r.fillColor[0], fg = r.fillColor[1], fb = r.fillColor[2];
            for (let i = 0; i < w * h; i++) {
                const sel = mask ? mask[i] : 255;
                if (!sel) continue;
                const o = i * 4;
                const k = sel / 255;
                d[o] = d[o] * (1 - k) + fr * k;
                d[o + 1] = d[o + 1] * (1 - k) + fg * k;
                d[o + 2] = d[o + 2] * (1 - k) + fb * k;
            }
        }
        // 删除选中像素（变透明）：按掩码强度渐变（选中 255→全透明，羽化边→半透明）
        if (needTransparent) {
            for (let i = 0; i < w * h; i++) {
                const sel = mask ? mask[i] : 255;
                if (!sel) continue;
                d[i * 4 + 3] = 255 - sel;
            }
        }
        ctx.putImageData(img, x, y);
    });
}
// 椭圆掩码
function ellipseMask(w, h) {
    const m = new Uint8Array(w * h);
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const rx = Math.max(1, w / 2), ry = Math.max(1, h / 2);
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            const dx = (px - cx) / rx, dy = (py - cy) / ry;
            m[py * w + px] = (dx * dx + dy * dy <= 1) ? 255 : 0;
        }
    }
    return m;
}
// 套索多边形掩码（even-odd 填充），pts 为相对该区域 bbox 的归一化点
function lassoMask(w, h, pts) {
    const m = new Uint8Array(w * h);
    if (!pts || pts.length < 3) return m;
    const poly = pts.map(p => [Math.max(0, Math.min(w - 1, Math.round(p[0] * (w - 1)))), Math.max(0, Math.min(h - 1, Math.round(p[1] * (h - 1))))]);
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            let inside = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
                if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
            }
            m[py * w + px] = inside ? 255 : 0;
        }
    }
    return m;
}
// 背景色掩码（选中强度 0-255）：容差内=255，羽化边缘=渐变，其余=0
function bgMask(w, h, imgData, bgColor, tol, feather) {
    const m = new Uint8Array(w * h);
    const d = imgData.data;
    const f = feather || 0;
    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        const dr = d[o] - bgColor[0], dg = d[o + 1] - bgColor[1], db = d[o + 2] - bgColor[2];
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist <= tol) m[i] = 255;
        else if (dist < tol + f) m[i] = Math.round((1 - (dist - tol) / f) * 255);
        else m[i] = 0;
    }
    return m;
}
// 用选区四周的平均颜色填充选区（去水印 / 移除对象）
function eraseRegion(canvas, x, y, w, h) {
    const cw = canvas.width, ch = canvas.height;
    if (w < 1 || h < 1 || x >= cw || y >= ch) return;
    const ctx = canvas.getContext('2d');
    const band = 2;
    const avg = (px, py, pw, ph) => {
        px = Math.max(0, Math.min(cw - 1, px)); py = Math.max(0, Math.min(ch - 1, py));
        pw = Math.max(1, Math.min(cw - px, pw)); ph = Math.max(1, Math.min(ch - py, ph));
        if (pw < 1 || ph < 1) return [0, 0, 0];
        const d = ctx.getImageData(px, py, pw, ph).data;
        let r = 0, g = 0, b = 0, n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        return [r / n, g / n, b / n];
    };
    const top = avg(x, y - band, w, band);
    const bottom = avg(x, y + h, w, band);
    const left = avg(x - band, y, band, h);
    const right = avg(x + w, y, band, h);
    const img = ctx.getImageData(x, y, w, h);
    const d = img.data;
    for (let py = 0; py < h; py++) {
        const ty = h > 1 ? py / (h - 1) : 0;
        for (let px = 0; px < w; px++) {
            const tx = w > 1 ? px / (w - 1) : 0;
            const i = (py * w + px) * 4;
            d[i] = (top[0] * (1 - ty) + bottom[0] * ty + left[0] * (1 - tx) + right[0] * tx) / 2;
            d[i + 1] = (top[1] * (1 - ty) + bottom[1] * ty + left[1] * (1 - tx) + right[1] * tx) / 2;
            d[i + 2] = (top[2] * (1 - ty) + bottom[2] * ty + left[2] * (1 - tx) + right[2] * tx) / 2;
        }
    }
    ctx.putImageData(img, x, y);
}
function applyEraseOps(canvas, s) {
    if (!s.eraseOps.length) return;
    const cw = canvas.width, ch = canvas.height;
    s.eraseOps.forEach(op => {
        const x = Math.max(0, Math.round(op.x * cw)), y = Math.max(0, Math.round(op.y * ch));
        const w = Math.max(1, Math.min(cw - x, Math.round(op.w * cw)));
        const h = Math.max(1, Math.min(ch - y, Math.round(op.h * ch)));
        eraseRegion(canvas, x, y, w, h);
    });
}
// 对单个画布按背景色抠图：接近背景色的像素变透明（用于局部区域抠图）
function syncChromaUI() {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    const isBg = !!(r && r.shape === 'bg');
    bgselControls.classList.toggle('hidden', !isBg);
    if (r && r.bgColor) {
        chromaSwatch.style.background = `rgb(${r.bgColor[0]},${r.bgColor[1]},${r.bgColor[2]})`;
    } else {
        chromaSwatch.style.background = '';
    }
    if (!isBg) {
        chromaHint.textContent = '';
        return;
    }
    chromaHint.textContent = (r.bgColor && r.mask && r.bgColor) ? `区域 #${s.activeRegion}（背景色）已生成同色选区。可调节容差 / 羽化后重新取色；“清除选区(透明)”可把它删成透明。` : `区域 #${s.activeRegion}（背景色）：点“点图取背景色”，在该范围内点击背景，把同色像素选为区域`;
}
// 滑块当前作用对象：有活动区域时作用于该区域，否则作用于整张图
function adjustTarget(s) {
    if (s.activeRegion !== null && s.regions[s.activeRegion]) return s.regions[s.activeRegion];
    return s;
}
function clearRegions() {
    editorState.regions = [];
    editorState.activeRegion = null;
    editorState.draftRegion = null;
    editorState.draftLasso = [];
    renderRegionList();
    syncAdjustUI();
}
// 归一化点绕中心旋转（角度弧度）
function rotP(cx, cy, ang, px, py) {
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const dx = px - cx, dy = py - cy;
    return { lx: cx + dx * cos - dy * sin, ly: cy + dx * sin + dy * cos };
}
// 画一个小方块手柄
function drawHandle(x, y) {
    const g = editorDisplay.getContext('2d');
    g.fillStyle = '#fff';
    g.strokeStyle = '#e91e63';
    g.lineWidth = 1.5;
    g.fillRect(x - 4, y - 4, 8, 8);
    g.strokeRect(x - 4, y - 4, 8, 8);
}
function wrapFillText(ctx, text, x, y, maxWidth) {
    const chars = String(text).split('');
    let line = '', yy = y;
    ctx.textAlign = 'left';
    for (let i = 0; i < chars.length; i++) {
        const test = line + chars[i];
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, yy);
            line = chars[i];
            yy += ctx.measureText('M').width * 1.2;
        } else {
            line = test;
        }
    }
    if (line) ctx.fillText(line, x, yy);
}
function drawStrokes(ctx, w, h, strokes) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    strokes.forEach(st => {
        if (st.type === 'brush') {
            if (st.points.length < 1) return;
            ctx.strokeStyle = st.color;
            ctx.lineWidth = st.size; // 真实像素粗细
            ctx.beginPath();
            ctx.moveTo(st.points[0][0] * w, st.points[0][1] * h);
            for (let i = 1; i < st.points.length; i++) ctx.lineTo(st.points[i][0] * w, st.points[i][1] * h);
            ctx.stroke();
        } else if (st.type === 'arrow') {
            const x1 = st.x1 * w, y1 = st.y1 * h, x2 = st.x2 * w, y2 = st.y2 * h;
            ctx.strokeStyle = st.color;
            const lw = st.size; // 真实像素粗细
            ctx.lineWidth = lw;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            const ang = Math.atan2(y2 - y1, x2 - x1);
            const al = Math.max(10, lw * 3);
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - al * Math.cos(ang - Math.PI / 6), y2 - al * Math.sin(ang - Math.PI / 6));
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - al * Math.cos(ang + Math.PI / 6), y2 - al * Math.sin(ang + Math.PI / 6));
            ctx.stroke();
        } else if (st.type === 'text') {
            const x = st.x * w, y = st.y * h, tw = st.w * w, th = st.h * h;
            const cx = x + tw / 2, cy = y + th / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((st.angle || 0) * Math.PI / 180);
            ctx.fillStyle = st.color;
            ctx.textBaseline = 'top';
            const fs = Math.max(6, th * 0.8);
            ctx.font = 'bold ' + fs + 'px sans-serif';
            wrapFillText(ctx, st.text, -tw / 2, -th * 0.1, tw);
            ctx.restore();
        }
    });
    ctx.restore();
}

// ---- 对象选择 / 变换（箭头端点、文字框移动/缩放/旋转） ----
function objImgRect() {
    const s = editorState;
    const r = editorDisplay.getBoundingClientRect();
    return { rect: r, cw: s.canvas.width, ch: s.canvas.height };
}
function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const L2 = dx * dx + dy * dy;
    if (!L2) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function rotVec(vx, vy, ang) {
    const cos = Math.cos(ang), sin = Math.sin(ang);
    return { x: vx * cos - vy * sin, y: vx * sin + vy * cos };
}
function textBoxPts(st, cw, ch) {
    const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
    const ang = (st.angle || 0) * Math.PI / 180;
    const pts = [{ lx: st.x, ly: st.y }, { lx: st.x + st.w, ly: st.y }, { lx: st.x + st.w, ly: st.y + st.h }, { lx: st.x, ly: st.y + st.h }]
        .map(p => rotP(cx, cy, ang, p.lx, p.ly));
    return { pts, cx, cy, ang };
}
function pointInText(mx, my, st, cw, ch) {
    const { pts, cx, cy, ang } = textBoxPts(st, cw, ch);
    const csx = editorState.view.ox + cx * cw * editorState.view.scale;
    const csy = editorState.view.oy + cy * ch * editorState.view.scale;
    const dx = mx - csx, dy = my - csy;
    const l = rotVec(dx, dy, -ang);
    const hw = st.w * cw * editorState.view.scale / 2, hh = st.h * ch * editorState.view.scale / 2;
    return Math.abs(l.x) <= hw && Math.abs(l.y) <= hh;
}
function hitTestObject(mx, my) {
    const s = editorState, { cw, ch } = objImgRect();
    for (let i = s.strokes.length - 1; i >= 0; i--) {
        const st = s.strokes[i];
        if (st.type === 'arrow') {
            const x1 = s.view.ox + st.x1 * cw * s.view.scale, y1 = s.view.oy + st.y1 * ch * s.view.scale;
            const x2 = s.view.ox + st.x2 * cw * s.view.scale, y2 = s.view.oy + st.y2 * ch * s.view.scale;
            if (distToSeg(mx, my, x1, y1, x2, y2) < 12) return i;
        } else if (st.type === 'text') {
            if (pointInText(mx, my, st, cw, ch)) return i;
        }
    }
    return null;
}
function startSelectDrag(e) {
    const s = editorState, { rect, cw, ch } = objImgRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const ix = (e.clientX - rect.left - s.view.ox) / s.view.scale, iy = (e.clientY - rect.top - s.view.oy) / s.view.scale;
    // 1) 已选中对象的手柄优先
    if (s.selectedObj !== null && s.strokes[s.selectedObj]) {
        const st = s.strokes[s.selectedObj];
        if (st.type === 'arrow') {
            const p1x = s.view.ox + st.x1 * cw * s.view.scale, p1y = s.view.oy + st.y1 * ch * s.view.scale;
            const p2x = s.view.ox + st.x2 * cw * s.view.scale, p2y = s.view.oy + st.y2 * ch * s.view.scale;
            if (Math.hypot(mx - p1x, my - p1y) < 12) { pushStrokeUndo(); editorDrag = { kind: 'obj', mode: 'endpoint', which: 1, six: ix, siy: iy }; editorDisplay.setPointerCapture(e.pointerId); return; }
            if (Math.hypot(mx - p2x, my - p2y) < 12) { pushStrokeUndo(); editorDrag = { kind: 'obj', mode: 'endpoint', which: 2, six: ix, siy: iy }; editorDisplay.setPointerCapture(e.pointerId); return; }
            if (distToSeg(mx, my, p1x, p1y, p2x, p2y) < 12) { pushStrokeUndo(); editorDrag = { kind: 'obj', mode: 'move', six: ix, siy: iy, oX1: st.x1, oY1: st.y1, oX2: st.x2, oY2: st.y2 }; editorDisplay.setPointerCapture(e.pointerId); return; }
        } else if (st.type === 'text') {
            const { pts, cx, cy, ang } = textBoxPts(st, cw, ch);
            const top = rotP(cx, cy, ang, cx, st.y);
            const rsx = s.view.ox + top.lx * cw * s.view.scale, rsy = s.view.oy + top.ly * ch * s.view.scale;
            if (Math.hypot(mx - rsx, my - (rsy - 28)) < 12) { pushStrokeUndo(); editorDrag = { kind: 'obj', mode: 'rotate', six: ix, siy: iy, cx, cy, oAng: st.angle || 0 }; editorDisplay.setPointerCapture(e.pointerId); return; }
            for (let ci = 0; ci < 4; ci++) {
                const p = pts[ci];
                const sx = s.view.ox + p.lx * cw * s.view.scale, sy = s.view.oy + p.ly * ch * s.view.scale;
                if (Math.hypot(mx - sx, my - sy) < 12) { pushStrokeUndo(); editorDrag = { kind: 'obj', mode: 'resize', corner: ci, cx, cy, ang }; editorDisplay.setPointerCapture(e.pointerId); return; }
            }
            if (pointInText(mx, my, st, cw, ch)) { pushStrokeUndo(); editorDrag = { kind: 'obj', mode: 'move', six: ix, siy: iy, oX: st.x, oY: st.y }; editorDisplay.setPointerCapture(e.pointerId); return; }
        }
    }
    // 2) 命中检测其它对象 → 选中并移动
    const hit = hitTestObject(mx, my);
    if (hit !== null) {
        s.selectedObj = hit;
        renderEditor();
        const st = s.strokes[hit];
        pushStrokeUndo();
        editorDrag = { kind: 'obj', mode: 'move', six: ix, siy: iy };
        if (st.type === 'arrow') { editorDrag.oX1 = st.x1; editorDrag.oY1 = st.y1; editorDrag.oX2 = st.x2; editorDrag.oY2 = st.y2; }
        else if (st.type === 'text') { editorDrag.oX = st.x; editorDrag.oY = st.y; }
        editorDisplay.setPointerCapture(e.pointerId);
        return;
    }
    // 3) 空白：取消选中并平移视图
    if (s.selectedObj !== null) { s.selectedObj = null; renderEditor(); }
    panDrag = { startX: e.clientX, startY: e.clientY, startOx: s.view.ox, startOy: s.view.oy };
    editorDisplay.style.cursor = 'grabbing';
    editorDisplay.setPointerCapture(e.pointerId);
}
// ---- 视图：镜头缩放 / 平移（不改变图片实际尺寸） ----
let lastCanvasW = 0, lastCanvasH = 0;
function clampPan() {
    const s = editorState;
    const canvas = s.canvas;
    const wrap = editorDisplay.parentElement;
    const dispW = wrap.clientWidth, dispH = wrap.clientHeight;
    const w = canvas.width * s.view.scale;
    const h = canvas.height * s.view.scale;
    if (w >= dispW) s.view.ox = Math.min(0, Math.max(dispW - w, s.view.ox));
    else s.view.ox = (dispW - w) / 2;
    if (h >= dispH) s.view.oy = Math.min(0, Math.max(dispH - h, s.view.oy));
    else s.view.oy = (dispH - h) / 2;
}
function resetView() {
    const s = editorState;
    const canvas = s.canvas;
    if (!canvas.width) return;
    const wrap = editorDisplay.parentElement;
    const dispW = Math.max(50, wrap.clientWidth);
    const dispH = Math.max(50, wrap.clientHeight);
    // cover 铺满：图片填满整个显示区域
    s.view.scale = Math.max(dispW / canvas.width, dispH / canvas.height);
    s.view.ox = (dispW - canvas.width * s.view.scale) / 2;
    s.view.oy = (dispH - canvas.height * s.view.scale) / 2;
    clampPan();
}
function dispToImg(e) {
    const s = editorState;
    const canvas = s.canvas;
    if (!canvas.width) return null;
    const rect = editorDisplay.getBoundingClientRect();
    const ix = (e.clientX - rect.left - s.view.ox) / s.view.scale;
    const iy = (e.clientY - rect.top - s.view.oy) / s.view.scale;
    if (ix < 0 || iy < 0 || ix > canvas.width || iy > canvas.height) return null;
    return { nx: ix / canvas.width, ny: iy / canvas.height };
}
function drawView() {
    const s = editorState;
    const canvas = s.canvas;
    if (!canvas.width) return;
    const wrap = editorDisplay.parentElement;
    const dispW = Math.max(50, wrap.clientWidth);
    const dispH = Math.max(50, wrap.clientHeight);
    // 画布尺寸变化时自动重新铺满
    if (canvas.width !== lastCanvasW || canvas.height !== lastCanvasH) {
        lastCanvasW = canvas.width; lastCanvasH = canvas.height;
        resetView();
    }
    editorDisplay.width = dispW;
    editorDisplay.height = dispH;
    const ctx = editorDisplay.getContext('2d');
    ctx.clearRect(0, 0, dispW, dispH);
    ctx.save();
    ctx.translate(s.view.ox, s.view.oy);
    ctx.scale(s.view.scale, s.view.scale);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
    // 背景色选区预览：半透明红色高亮显示当前会选中的像素（随容差 / 羽化实时变化；按住 Shift 临时隐藏查看原图）
    if (!maskPreviewHidden && s.activeRegion !== null) {
        const br = s.regions[s.activeRegion];
        if (br && br.shape === 'bg' && br.bgColor && br.mask) {
            const cw = canvas.width, ch = canvas.height;
            const px0 = Math.max(0, Math.round(br.x * cw)), py0 = Math.max(0, Math.round(br.y * ch));
            const pw = Math.max(1, Math.min(cw - px0, Math.round(br.w * cw)));
            const ph = Math.max(1, Math.min(ch - py0, Math.round(br.h * ch)));
            if (br.mask.length === pw * ph) {
                const ov = document.createElement('canvas');
                ov.width = pw; ov.height = ph;
                const oc = ov.getContext('2d');
                const id = oc.createImageData(pw, ph);
                const dd = id.data;
                for (let i = 0; i < pw * ph; i++) {
                    const sel = br.mask[i] || 0;
                    if (sel) {
                        dd[i * 4] = 255; dd[i * 4 + 1] = 60; dd[i * 4 + 2] = 60;
                        dd[i * 4 + 3] = 24 + Math.round(sel / 255 * 84);
                    }
                }
                oc.putImageData(id, 0, 0);
                ctx.drawImage(ov, s.view.ox + px0 * s.view.scale, s.view.oy + py0 * s.view.scale, pw * s.view.scale, ph * s.view.scale);
            }
        }
    }
    if (s.cropping && s.crop) {
        const cw = canvas.width, ch = canvas.height;
        const x1 = s.view.ox + s.crop.x * cw * s.view.scale;
        const y1 = s.view.oy + s.crop.y * ch * s.view.scale;
        const x2 = s.view.ox + (s.crop.x + s.crop.w) * cw * s.view.scale;
        const y2 = s.view.oy + (s.crop.y + s.crop.h) * ch * s.view.scale;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, dispW, y1);
        ctx.fillRect(0, y2, dispW, dispH - y2);
        ctx.fillRect(0, y1, x1, y2 - y1);
        ctx.fillRect(x2, y1, dispW - x2, y2 - y1);
        ctx.strokeStyle = '#1565c0';
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
    // 局部区域边框 + 框选预览
    if (s.regions.length || s.draftRegion || (s.draftLasso && s.draftLasso.length)) {
        const cw = canvas.width, ch = canvas.height;
        ctx.save();
        s.regions.forEach((r, i) => {
            const x1 = s.view.ox + r.x * cw * s.view.scale;
            const y1 = s.view.oy + r.y * ch * s.view.scale;
            const x2 = s.view.ox + (r.x + r.w) * cw * s.view.scale;
            const y2 = s.view.oy + (r.y + r.h) * ch * s.view.scale;
            ctx.strokeStyle = (s.activeRegion === i) ? '#1565c0' : '#8ab4f8';
            ctx.lineWidth = (s.activeRegion === i) ? 2 : 1;
            ctx.setLineDash([6, 4]);
            if (r.shape === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse(s.view.ox + (r.x + r.w / 2) * cw * s.view.scale, s.view.oy + (r.y + r.h / 2) * ch * s.view.scale, r.w * cw * s.view.scale / 2, r.h * ch * s.view.scale / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (r.shape === 'lasso' && r.poly && r.poly.length >= 2) {
                // 套索：画出用户实际圈出的不规则多边形轮廓
                ctx.beginPath();
                r.poly.forEach((pt, idx) => {
                    const sx = s.view.ox + pt[0] * cw * s.view.scale;
                    const sy = s.view.oy + pt[1] * ch * s.view.scale;
                    if (idx === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
                });
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            }
            ctx.setLineDash([]);
        });
        if (s.draftRegion) {
            const x1 = s.view.ox + s.draftRegion.x * cw * s.view.scale;
            const y1 = s.view.oy + s.draftRegion.y * ch * s.view.scale;
            const x2 = s.view.ox + (s.draftRegion.x + s.draftRegion.w) * cw * s.view.scale;
            const y2 = s.view.oy + (s.draftRegion.y + s.draftRegion.h) * ch * s.view.scale;
            ctx.strokeStyle = '#1565c0';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            ctx.setLineDash([]);
        }
        if (s.draftLasso && s.draftLasso.length > 1) {
            ctx.strokeStyle = '#e91e63';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            s.draftLasso.forEach((pt, idx) => {
                const sx = s.view.ox + pt[0] * cw * s.view.scale;
                const sy = s.view.oy + pt[1] * ch * s.view.scale;
                if (idx === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }
    // 选中对象（箭头 / 文字）的变换手柄
    if (s.selectedObj !== null && s.strokes[s.selectedObj]) {
        const st = s.strokes[s.selectedObj];
        const cw = canvas.width, ch = canvas.height;
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#e91e63';
        if (st.type === 'arrow') {
            const p1 = { sx: s.view.ox + st.x1 * cw * s.view.scale, sy: s.view.oy + st.y1 * ch * s.view.scale };
            const p2 = { sx: s.view.ox + st.x2 * cw * s.view.scale, sy: s.view.oy + st.y2 * ch * s.view.scale };
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke();
            ctx.setLineDash([]);
            drawHandle(p1.sx, p1.sy); drawHandle(p2.sx, p2.sy);
        } else if (st.type === 'text') {
            const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
            const ang = (st.angle || 0) * Math.PI / 180;
            const corners = [
                { lx: st.x, ly: st.y }, { lx: st.x + st.w, ly: st.y },
                { lx: st.x + st.w, ly: st.y + st.h }, { lx: st.x, ly: st.y + st.h }
            ].map(p => rotP(cx, cy, ang, p.lx, p.ly));
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            corners.forEach((c, i) => { const sx = s.view.ox + c.lx * cw * s.view.scale, sy = s.view.oy + c.ly * ch * s.view.scale; if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); });
            ctx.closePath(); ctx.stroke();
            ctx.setLineDash([]);
            corners.forEach(c => { const sx = s.view.ox + c.lx * cw * s.view.scale, sy = s.view.oy + c.ly * ch * s.view.scale; drawHandle(sx, sy); });
            // 旋转手柄：顶边中点上方
            const top = rotP(cx, cy, ang, cx, st.y);
            const rx = s.view.ox + top.lx * cw * s.view.scale, ry = s.view.oy + top.ly * ch * s.view.scale;
            ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry - 28); ctx.stroke();
            ctx.beginPath(); ctx.arc(rx, ry - 28, 6, 0, Math.PI * 2); ctx.fillStyle = '#e91e63'; ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }
    curSize.textContent = `(${canvas.width}×${canvas.height})`;
}

function renderEditor() {
    const s = editorState;
    if (s.frameIndex === null) return;
    const src = frames[s.frameIndex].orig;
    const pre = buildPipelineCanvas(src, s);
    const final = s.cropping ? pre : buildCrop(pre, s);
    const canvas = s.canvas;
    canvas.width = final.width;
    canvas.height = final.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, final.width, final.height);
    ctx.drawImage(final, 0, 0);
    applyRegions(canvas, s);
    applyEraseOps(canvas, s);
    drawStrokes(ctx, final.width, final.height, s.strokes);
    drawView();
}

function setEditorMode(mode) {
    editorState.mode = mode;
    editorDisplay.style.cursor = (mode === 'none') ? 'grab' : 'crosshair';
    cropModeBtn.classList.toggle('active', mode === 'crop');
    regionModeBtn.classList.toggle('active', mode === 'region');
    ellipseModeBtn.classList.toggle('active', mode === 'ellipse');
    lassoModeBtn.classList.toggle('active', mode === 'lasso');
    bgselModeBtn.classList.toggle('active', mode === 'bgsel');
    eraseBtn.classList.toggle('active', mode === 'erase');
    pickBgBtn.classList.toggle('active', mode === 'pick');
    brushToolBtn.classList.toggle('active', mode === 'brush');
    arrowToolBtn.classList.toggle('active', mode === 'arrow');
    textToolBtn.classList.toggle('active', mode === 'text');
    selectToolBtn.classList.toggle('active', mode === 'select');
}

function resetEditorState() {
    const s = editorState;
    s.rotation = 0; s.flipH = false; s.flipV = false;
    s.crop = null; s.cropping = false;
    s.targetW = null; s.targetH = null;
    s.brightness = 100; s.contrast = 100; s.saturation = 100;
    s.pixelate = 1;
    s.strokes = [];
    s.regions = [];
    s.activeRegion = null;
    s.selectedObj = null;
    s.draftRegion = null;
    s.draftLasso = [];
    s.eraseOps = [];
    s.mode = 'none';
    brightnessIn.value = 100; contrastIn.value = 100; saturationIn.value = 100;
    pixelateIn.value = 1; pixelVal.textContent = '关';
    renderRegionList();
    syncAdjustUI();
    scaleW.value = ''; scaleH.value = '';
    setEditorMode('none');
    renderEditor();
}

function openEditor(index) {
    editorState.frameIndex = index;
    editorState.canvas = document.createElement('canvas');
    editorState.canvas.willReadFrequently = true; // 去水印等需频繁读取像素，避免性能警告
    editorState.view = { scale: 1, ox: 0, oy: 0 };
    editorTitle.textContent = `编辑帧 #${index}（${frames[index].time.toFixed(2)}s）`;
    const f = frames[index];
    const srcW = f.orig.naturalWidth || f.orig.width;
    const srcH = f.orig.naturalHeight || f.orig.height;
    editorModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    resetEditorState();
    // 缩放/尺寸初始显示图片实际长宽
    scaleW.value = srcW;
    scaleH.value = srcH;
    requestAnimationFrame(() => { if (editorState.frameIndex !== null) drawView(); });
}

function closeEditor() {
    editorModal.classList.add('hidden');
    editorState.frameIndex = null;
    document.body.style.overflow = '';
}

function commitToFrame(index) {
    const s = editorState;
    const orig = frames[index].orig;
    let final = buildPipelineCanvas(orig, s);
    final = buildCrop(final, s);
    final.willReadFrequently = true;
    applyRegions(final, s);
    applyEraseOps(final, s);
    drawStrokes(final.getContext('2d'), final.width, final.height, s.strokes);
    const dataUrl = final.toDataURL('image/png');
    const img = new Image();
    // 编辑结果作为新的“原始图”保存，再次打开编辑器时基于编辑后的图继续（如透明背景不会回来）
    img.onload = () => { frames[index].orig = img; };
    img.src = dataUrl;
    frames[index].img = img;
    frames[index].dataUrl = dataUrl;
    const thumb = framesGrid.querySelector(`[data-index="${index}"] img`);
    if (thumb) thumb.src = dataUrl;
}
// 裁剪：以当前已编辑的图作为源，裁出所选区域作为新的原始图，然后重新开始编辑（清空全部操作记录）
function applyCropToFrame() {
    const s = editorState;
    const c = s.crop;
    if (!c || s.frameIndex === null) return;
    const src = s.canvas; // 当前画布已包含所有编辑（区域 / 画笔 / 擦除）
    const cw = src.width, ch = src.height;
    const x = Math.max(0, Math.round(c.x * cw)), y = Math.max(0, Math.round(c.y * ch));
    const w = Math.max(1, Math.min(cw - x, Math.round(c.w * cw)));
    const h = Math.max(1, Math.min(ch - y, Math.round(c.h * ch)));
    if (w < 1 || h < 1 || x >= cw || y >= ch) { s.crop = null; renderEditor(); return; }
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d').drawImage(src, x, y, w, h, 0, 0, w, h);
    const dataUrl = out.toDataURL('image/png');
    const img = new Image();
    const idx = s.frameIndex;
    img.onload = () => {
        frames[idx].orig = img;
        frames[idx].img = img;
        frames[idx].dataUrl = dataUrl;
        const thumb = framesGrid.querySelector(`[data-index="${idx}"] img`);
        if (thumb) thumb.src = dataUrl;
        openEditor(idx); // 基于裁剪后的新图重新开始编辑，之前的局部区域 / 画笔 / 擦除已烘焙进图并清空
        selectHint.textContent = '已裁剪：以裁剪后的图重新开始编辑（之前的局部区域 / 画笔等已并入图中并清空）';
    };
    img.src = dataUrl;
}

// ---- 弹窗开关 ----
closeEditorBtn.addEventListener('click', closeEditor);
editorModal.addEventListener('click', e => { if (e.target === editorModal) closeEditor(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !editorModal.classList.contains('hidden')) closeEditor(); });

// ---- 旋转 / 翻转 ----
rotLeftBtn.addEventListener('click', () => { editorState.rotation = (editorState.rotation + 270) % 360; editorState.crop = null; clearRegions(); renderEditor(); });
rotRightBtn.addEventListener('click', () => { editorState.rotation = (editorState.rotation + 90) % 360; editorState.crop = null; clearRegions(); renderEditor(); });
flipHBtn.addEventListener('click', () => { editorState.flipH = !editorState.flipH; clearRegions(); renderEditor(); });
flipVBtn.addEventListener('click', () => { editorState.flipV = !editorState.flipV; clearRegions(); renderEditor(); });

// ---- 裁剪 ----
cropModeBtn.addEventListener('click', () => {
    if (editorState.mode === 'crop') { editorState.cropping = false; setEditorMode('none'); }
    else { editorState.cropping = true; setEditorMode('crop'); renderEditor(); }
});
resetCropBtn.addEventListener('click', () => { editorState.crop = null; renderEditor(); });

// ---- 局部调整（区域：矩形 / 椭圆 / 套索 / 背景色） ----
regionModeBtn.addEventListener('click', () => {
    if (editorState.mode === 'region') { editorState.draftRegion = null; setEditorMode('none'); }
    else { editorState.cropping = false; setEditorMode('region'); regionHint.textContent = '在图片上拖动，框出要单独调整的矩形区域'; }
});
ellipseModeBtn.addEventListener('click', () => {
    if (editorState.mode === 'ellipse') { editorState.draftRegion = null; setEditorMode('none'); }
    else { editorState.cropping = false; setEditorMode('ellipse'); regionHint.textContent = '在图片上拖动，框出要单独调整的椭圆区域'; }
});
lassoModeBtn.addEventListener('click', () => {
    if (editorState.mode === 'lasso') { editorState.draftLasso = []; setEditorMode('none'); }
    else { editorState.cropping = false; setEditorMode('lasso'); regionHint.textContent = '按住鼠标左键，在图片上画线围出要调整的范围，松开自动闭合'; }
});
bgselModeBtn.addEventListener('click', () => {
    if (editorState.mode === 'bgsel') { editorState.draftRegion = null; setEditorMode('none'); }
    else { editorState.cropping = false; setEditorMode('bgsel'); regionHint.textContent = '在图片上拖动框出一个范围，然后点“点图取背景色”，把该范围内同色像素选为一块区域'; }
});
function buildRegionFromDraft(d, shape, canvas) {
    const cw = canvas.width, ch = canvas.height;
    const base = { x: d.x, y: d.y, w: d.w, h: d.h, brightness: 100, contrast: 100, saturation: 100, pixelate: 1, transparent: false, shape, mask: null, bgColor: null, fillColor: null };
    if (shape === 'ellipse') {
        const wp = Math.max(1, Math.round(d.w * cw)), hp = Math.max(1, Math.round(d.h * ch));
        base.mask = ellipseMask(wp, hp);
    } else if (shape === 'bg') {
        // 背景色区域：初始空掩码，等点取背景色后生成实际选区
        const wp = Math.max(1, Math.round(d.w * cw)), hp = Math.max(1, Math.round(d.h * ch));
        base.mask = new Uint8Array(wp * hp);
    }
    return base;
}
function buildRegionLasso(pts, canvas) {
    const cw = canvas.width, ch = canvas.height;
    let minx = 1, miny = 1, maxx = 0, maxy = 0;
    pts.forEach(p => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); });
    const w = maxx - minx, h = maxy - miny;
    if (w < 0.005 || h < 0.005) return null;
    const base = { x: minx, y: miny, w, h, brightness: 100, contrast: 100, saturation: 100, pixelate: 1, transparent: false, shape: 'lasso', mask: null, bgColor: null, fillColor: null, poly: pts };
    const wp = Math.max(1, Math.round(w * cw)), hp = Math.max(1, Math.round(h * ch));
    base.mask = lassoMask(wp, hp, pts.map(p => [(p[0] - minx) / w, (p[1] - miny) / h]));
    return base;
}
function renderRegionList() {
    const s = editorState;
    const shapeName = { rect: '矩形', ellipse: '椭圆', lasso: '套索', bg: '背景色' };
    regionList.innerHTML = '';
    if (!s.regions.length) {
        regionHint.textContent = '矩形 / 椭圆 / 套索：圈出一块区域单独编辑；背景色：把同色像素选为一块区域';
        return;
    }
    regionHint.textContent = `已框选 ${s.regions.length} 个区域；当前滑块${s.activeRegion !== null ? `作用于区域 #${s.activeRegion}` : '作用于整张图'}。选中区域后滑块只改该区域。`;
    s.regions.forEach((r, i) => {
        const div = document.createElement('div');
        div.className = 'region-item' + (s.activeRegion === i ? ' active' : '');
        const name = document.createElement('span');
        name.className = 'region-name';
        name.textContent = `区域 #${i}（${shapeName[r.shape] || '矩形'}${r.transparent ? '·透明' : ''}${r.fillColor ? '·填色' : ''}）`;
        const selBtn = document.createElement('button');
        selBtn.textContent = (s.activeRegion === i) ? '取消' : '编辑';
        selBtn.title = (s.activeRegion === i) ? '取消选中，滑块回到整张图' : '让右侧滑块编辑此区域';
        selBtn.addEventListener('click', e => { e.stopPropagation(); toggleActiveRegion(i); });
        const delBtn = document.createElement('button');
        delBtn.className = 'region-del';
        delBtn.textContent = '删除';
        delBtn.title = '删除该区域';
        delBtn.addEventListener('click', e => { e.stopPropagation(); deleteRegion(i); });
        div.appendChild(name);
        div.appendChild(selBtn);
        div.appendChild(delBtn);
        regionList.appendChild(div);
    });
}
function toggleActiveRegion(i) {
    const s = editorState;
    s.activeRegion = (s.activeRegion === i) ? null : i;
    syncFillUI();
    renderRegionList();
    syncAdjustUI();
    syncChromaUI();
    renderEditor();
}
function syncFillUI() {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    if (r && r.fillColor) {
        regionFillColor.value = '#' + r.fillColor.map(v => v.toString(16).padStart(2, '0')).join('');
    }
}
function deleteRegion(i) {
    const s = editorState;
    s.regions.splice(i, 1);
    if (s.activeRegion !== null) {
        if (s.activeRegion === i) s.activeRegion = null;
        else if (s.activeRegion > i) s.activeRegion--;
    }
    renderRegionList();
    syncAdjustUI();
    syncChromaUI();
    renderEditor();
}

// ---- 选区操作（去水印 / 只保留选区） ----
eraseBtn.addEventListener('click', () => {
    if (editorState.mode === 'erase') { editorState.draftRegion = null; setEditorMode('none'); }
    else { editorState.cropping = false; setEditorMode('erase'); selectHint.textContent = '在图片上拖动，框出要移除的水印或对象'; }
});
// 只保留选区 = 裁剪到选区（复用裁剪模式）
keepBtn.addEventListener('click', () => { cropModeBtn.click(); selectHint.textContent = '在图片上拖动，框出要保留的对象，其余部分将被删除'; });
clearEraseBtn.addEventListener('click', () => {
    editorState.eraseOps = [];
    renderEditor();
});

// ---- 背景色选区（作用于当前选中的“背景色”局部区域） ----
clearRegionBtn.addEventListener('click', () => {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    if (!r) { regionHint.textContent = '请先在“局部调整”里选中一个区域，再清除选区'; return; }
    r.transparent = !r.transparent;
    renderRegionList();
    renderEditor();
});
// ---- 填充颜色：给当前选区选中的像素填色 ----
applyFillBtn.addEventListener('click', () => {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    if (!r) { regionHint.textContent = '请先在“局部调整”里选中一个区域，再应用填充色'; return; }
    const hex = regionFillColor.value.replace('#', '');
    r.fillColor = [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
    renderRegionList();
    renderEditor();
    regionHint.textContent = `已将填充色应用到区域 #${s.activeRegion} 选中的像素；点“清除填充色”可恢复原色`;
});
clearFillBtn.addEventListener('click', () => {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    if (!r) { regionHint.textContent = '请先选中一个区域'; return; }
    if (!r.fillColor) { regionHint.textContent = '该区域还没有应用填充色'; return; }
    r.fillColor = null;
    renderRegionList();
    renderEditor();
    regionHint.textContent = '已清除填充色，选区恢复原色';
});
pickBgBtn.addEventListener('click', () => {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    if (!r || r.shape !== 'bg') {
        chromaHint.textContent = '请先用“背景色”按钮框选一个范围并选中，再点“点图取背景色”';
        return;
    }
    if (s.mode === 'pick') { setEditorMode('none'); return; }
    setEditorMode('pick');
    chromaHint.textContent = '在该范围内点击背景处以选取背景色，同色像素会成为选区';
});
clearChromaBtn.addEventListener('click', () => {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    if (r && r.shape === 'bg') {
        r.bgColor = null;
        if (r.mask) r.mask = new Uint8Array(r.mask.length);
        r.transparent = false;
    }
    syncChromaUI();
    renderRegionList();
    renderEditor();
});
// 基于已取的背景色，按当前容差 / 羽化实时重算选区（供预览与透明使用）
function updateBgMaskFromColor() {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    if (!r || r.shape !== 'bg' || !r.bgColor) return;
    const cw = s.canvas.width, ch = s.canvas.height;
    if (!cw || !ch) return;
    const x = Math.max(0, Math.round(r.x * cw)), y = Math.max(0, Math.round(r.y * ch));
    const w = Math.max(1, Math.min(cw - x, Math.round(r.w * cw))), h = Math.max(1, Math.min(ch - y, Math.round(r.h * ch)));
    const tol = (parseInt(chromaTol.value) || 0) / 100 * 160 + 5;
    const feather = (parseInt(chromaFeather.value) || 0) / 30 * 40 + 5;
    const sub = s.canvas.getContext('2d').getImageData(x, y, w, h);
    r.mask = bgMask(w, h, sub, r.bgColor, tol, feather);
}
// 背景色选区高亮临时隐藏（按住 Shift 查看原图）
let maskPreviewHidden = false;
document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift' && !maskPreviewHidden) { maskPreviewHidden = true; renderEditor(); }
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' && maskPreviewHidden) { maskPreviewHidden = false; renderEditor(); }
});
chromaTol.addEventListener('input', () => { chromaTolVal.textContent = chromaTol.value; updateBgMaskFromColor(); renderEditor(); });
chromaFeather.addEventListener('input', () => { chromaFeatherVal.textContent = chromaFeather.value; updateBgMaskFromColor(); renderEditor(); });

// ---- 缩放 / 尺寸 ----
scaleW.addEventListener('input', () => {
    if (lockAspect.checked) {
        const w = parseFloat(scaleW.value);
        if (w > 0 && editorState.frameIndex !== null) {
            const base = frames[editorState.frameIndex].orig;
            scaleH.value = Math.round(w * ((base.naturalHeight || base.height) / (base.naturalWidth || base.width)));
        }
    }
});
scaleH.addEventListener('input', () => {
    if (lockAspect.checked) {
        const h = parseFloat(scaleH.value);
        if (h > 0 && editorState.frameIndex !== null) {
            const base = frames[editorState.frameIndex].orig;
            scaleW.value = Math.round(h * ((base.naturalWidth || base.width) / (base.naturalHeight || base.height)));
        }
    }
});
applyScaleBtn.addEventListener('click', () => {
    const w = parseInt(scaleW.value), h = parseInt(scaleH.value);
    if (isNaN(w) || isNaN(h) || w < 1 || h < 1) { editorState.targetW = null; editorState.targetH = null; }
    else { editorState.targetW = w; editorState.targetH = h; }
    renderEditor();
});

// ---- 调色（滑块 + 数字输入联动） ----
function clampAdjust(v) { v = parseInt(v); if (isNaN(v)) return null; return Math.max(0, Math.min(200, v)); }
function syncAdjustUI() {
    const t = adjustTarget(editorState);
    brightnessIn.value = t.brightness;
    brightnessNum.value = t.brightness;
    contrastIn.value = t.contrast;
    contrastNum.value = t.contrast;
    saturationIn.value = t.saturation;
    saturationNum.value = t.saturation;
    pixelateIn.value = t.pixelate;
    pixelVal.textContent = t.pixelate > 1 ? t.pixelate + 'px' : '关';
    adjustScope.textContent = (editorState.activeRegion !== null) ? `（作用于区域 #${editorState.activeRegion}）` : '（作用于整张图）';
}
function bindAdjust(slider, num, key) {
    slider.addEventListener('input', () => {
        const t = adjustTarget(editorState);
        t[key] = parseInt(slider.value) || 0;
        num.value = t[key];
        renderEditor();
    });
    num.addEventListener('input', () => {
        const v = clampAdjust(num.value);
        if (v === null) return; // 输入中，暂不处理
        const t = adjustTarget(editorState);
        t[key] = v;
        slider.value = v;
        renderEditor();
    });
    num.addEventListener('change', () => {
        const v = clampAdjust(num.value);
        const t = adjustTarget(editorState);
        t[key] = (v === null) ? 100 : v;
        num.value = t[key];
        slider.value = t[key];
        renderEditor();
    });
}
bindAdjust(brightnessIn, brightnessNum, 'brightness');
bindAdjust(contrastIn, contrastNum, 'contrast');
bindAdjust(saturationIn, saturationNum, 'saturation');
resetBrightnessBtn.addEventListener('click', () => { adjustTarget(editorState).brightness = 100; syncAdjustUI(); renderEditor(); });
resetContrastBtn.addEventListener('click', () => { adjustTarget(editorState).contrast = 100; syncAdjustUI(); renderEditor(); });
resetSaturationBtn.addEventListener('click', () => { adjustTarget(editorState).saturation = 100; syncAdjustUI(); renderEditor(); });

// ---- 像素化 ----
pixelateIn.addEventListener('input', () => {
    const t = adjustTarget(editorState);
    t.pixelate = parseInt(pixelateIn.value);
    pixelVal.textContent = t.pixelate > 1 ? t.pixelate + 'px' : '关';
    renderEditor();
});

// ---- 绘制 / 标注 ----
brushToolBtn.addEventListener('click', () => { if (editorState.mode === 'brush') setEditorMode('none'); else { editorState.cropping = false; setEditorMode('brush'); } });
arrowToolBtn.addEventListener('click', () => { if (editorState.mode === 'arrow') setEditorMode('none'); else { editorState.cropping = false; setEditorMode('arrow'); } });
textToolBtn.addEventListener('click', () => { if (editorState.mode === 'text') setEditorMode('none'); else { editorState.cropping = false; setEditorMode('text'); } });
selectToolBtn.addEventListener('click', () => {
    if (editorState.mode === 'select') { editorState.selectedObj = null; setEditorMode('none'); renderEditor(); }
    else { editorState.cropping = false; setEditorMode('select'); renderEditor(); }
});
// 文字字号：新文字用此值；对选中的文字对象，实时改其字号（改框高）
textSizeIn.addEventListener('input', () => {
    const s = editorState;
    const fs = parseInt(textSizeIn.value) || 28;
    if (s.selectedObj !== null && s.strokes[s.selectedObj] && s.strokes[s.selectedObj].type === 'text') {
        const st = s.strokes[s.selectedObj];
        const ch = s.canvas.height;
        pushStrokeUndo();
        st.h = Math.max(0.02, fs / ch);
        renderEditor();
    }
});
clearAnnoBtn.addEventListener('click', () => { pushStrokeUndo(); editorState.strokes = []; editorState.selectedObj = null; renderEditor(); });
delSelectedBtn.addEventListener('click', () => {
    const s = editorState;
    if (s.selectedObj === null || !s.strokes[s.selectedObj]) { selectHint.textContent = '请先在“选择”工具里点选一个箭头或文字，再删除'; return; }
    pushStrokeUndo();
    s.strokes.splice(s.selectedObj, 1);
    s.selectedObj = null;
    renderEditor();
});
undoStrokeBtn.addEventListener('click', undoStroke);
redoStrokeBtn.addEventListener('click', redoStroke);
// ---- 标注（画笔 / 箭头 / 文字）撤销与重做 ----
function pushStrokeUndo() {
    const s = editorState;
    s.undoStack.push(JSON.parse(JSON.stringify(s.strokes)));
    if (s.undoStack.length > 100) s.undoStack.shift();
    s.redoStack = [];
}
function undoStroke() {
    const s = editorState;
    if (!s.undoStack.length) { selectHint.textContent = '没有可撤销的标注操作'; return; }
    s.redoStack.push(JSON.parse(JSON.stringify(s.strokes)));
    s.strokes = s.undoStack.pop();
    s.selectedObj = null;
    renderEditor();
}
function redoStroke() {
    const s = editorState;
    if (!s.redoStack.length) { selectHint.textContent = '没有可重做的操作'; return; }
    s.undoStack.push(JSON.parse(JSON.stringify(s.strokes)));
    s.strokes = s.redoStack.pop();
    s.selectedObj = null;
    renderEditor();
}
drawColor.addEventListener('input', () => { editorState.brushColor = drawColor.value; });
drawSize.addEventListener('input', () => {
    editorState.brushSize = parseInt(drawSize.value) || 1;
    drawSizeInput.value = editorState.brushSize;
});
drawSizeInput.addEventListener('input', () => {
    let v = parseInt(drawSizeInput.value);
    if (isNaN(v) || v < 1) v = 1;
    editorState.brushSize = v;
    drawSize.value = Math.min(v, parseInt(drawSize.max) || 40);
});
drawSizeInput.addEventListener('change', () => {
    let v = parseInt(drawSizeInput.value);
    if (isNaN(v) || v < 1) v = 1;
    const max = parseInt(drawSizeInput.max) || 200;
    if (v > max) v = max;
    drawSizeInput.value = v;
    editorState.brushSize = v;
    drawSize.value = Math.min(v, parseInt(drawSize.max) || 40);
});

// ---- 画布交互（平移 + 镜头缩放 + 裁剪/绘制） ----
editorDisplay.addEventListener('pointerdown', e => {
    const s = editorState;
    if (s.mode === 'select') { startSelectDrag(e); return; }
    if (s.mode === 'none') {
        // 无工具时：左键拖动平移视图
        panDrag = { startX: e.clientX, startY: e.clientY, startOx: s.view.ox, startOy: s.view.oy };
        editorDisplay.style.cursor = 'grabbing';
        editorDisplay.setPointerCapture(e.pointerId);
        return;
    }
    const p = dispToImg(e);
    if (!p) return;
    if (s.mode === 'crop') {
        editorDrag = { kind: 'crop', x: p.nx, y: p.ny };
    } else if (s.mode === 'brush') {
        pushStrokeUndo();
        editorDrag = { kind: 'brush', points: [[p.nx, p.ny]] };
        s.strokes.push({ type: 'brush', color: s.brushColor, size: s.brushSize, points: editorDrag.points });
        renderEditor();
    } else if (s.mode === 'arrow') {
        pushStrokeUndo();
        editorDrag = { kind: 'arrow' };
        s.strokes.push({ type: 'arrow', color: s.brushColor, size: s.brushSize, x1: p.nx, y1: p.ny, x2: p.nx, y2: p.ny });
        renderEditor();
    } else if (s.mode === 'text') {
        // 点击放置一个文字框，立即进入内联编辑
        const fs = parseInt(textSizeIn.value) || 28;
        const cw = s.canvas.width, ch = s.canvas.height;
        const h = Math.max(0.02, fs / ch);
        const w = Math.max(0.08, (fs * 6) / cw);
        const idx = s.strokes.length;
        pushStrokeUndo();
        s.strokes.push({ type: 'text', x: Math.max(0, Math.min(1 - w, p.nx)), y: Math.max(0, Math.min(1 - h, p.ny)), w, h, text: '', color: s.brushColor, angle: 0 });
        s.selectedObj = idx;
        setEditorMode('select');
        renderEditor();
        openTextEditor(idx);
    } else if (s.mode === 'region' || s.mode === 'ellipse' || s.mode === 'bgsel') {
        editorDrag = { kind: 'region', shape: s.mode, x: p.nx, y: p.ny };
        s.draftRegion = { x: p.nx, y: p.ny, w: 0, h: 0 };
        renderEditor();
    } else if (s.mode === 'lasso') {
        editorDrag = { kind: 'lasso', pts: [[p.nx, p.ny]] };
        s.draftLasso = editorDrag.pts;
        renderEditor();
    } else if (s.mode === 'erase') {
        editorDrag = { kind: 'erase', x: p.nx, y: p.ny };
        s.draftRegion = { x: p.nx, y: p.ny, w: 0, h: 0 };
        renderEditor();
    } else if (s.mode === 'pick') {
        // 取色：读取点击处像素颜色，把该范围内符合同色的像素选为背景色选区
        const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
        const cx = Math.round(p.nx * s.canvas.width);
        const cy = Math.round(p.ny * s.canvas.height);
        if (r && r.shape === 'bg' && s.canvas.width && cx >= 0 && cx < s.canvas.width && cy >= 0 && cy < s.canvas.height) {
            const cctx = s.canvas.getContext('2d');
            const px = cctx.getImageData(cx, cy, 1, 1).data;
            const bg = [px[0], px[1], px[2]];
            const tol = (parseInt(chromaTol.value) || 0) / 100 * 160 + 5;
            const feather = (parseInt(chromaFeather.value) || 0) / 30 * 40 + 5;
            const xr = Math.max(0, Math.round(r.x * s.canvas.width)), yr = Math.max(0, Math.round(r.y * s.canvas.height));
            const wr = Math.max(1, Math.min(s.canvas.width - xr, Math.round(r.w * s.canvas.width)));
            const hr = Math.max(1, Math.min(s.canvas.height - yr, Math.round(r.h * s.canvas.height)));
            const sub = cctx.getImageData(xr, yr, wr, hr);
            r.mask = bgMask(wr, hr, sub, bg, tol, feather);
            r.bgColor = bg;
            setEditorMode('none');
            syncChromaUI();
            renderEditor();
            regionHint.textContent = `已为区域 #${s.activeRegion}（背景色）选取背景色。红色高亮即会选中的像素，可拖动容差 / 羽化实时预览；按住 Shift 临时查看原图`;
        }
    }
    if (editorDrag) editorDisplay.setPointerCapture(e.pointerId);
});
editorDisplay.addEventListener('pointermove', e => {
    const s = editorState;
    if (panDrag) {
        s.view.ox = panDrag.startOx + (e.clientX - panDrag.startX);
        s.view.oy = panDrag.startOy + (e.clientY - panDrag.startY);
        clampPan();
        drawView();
        return;
    }
    if (!editorDrag) return;
    const p = dispToImg(e);
    if (!p) return;
    if (editorDrag.kind === 'crop') {
        const x0 = Math.min(editorDrag.x, p.nx), x1 = Math.max(editorDrag.x, p.nx);
        const y0 = Math.min(editorDrag.y, p.ny), y1 = Math.max(editorDrag.y, p.ny);
        s.crop = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        renderEditor();
    } else if (editorDrag.kind === 'brush') {
        editorDrag.points.push([p.nx, p.ny]);
        renderEditor();
    } else if (editorDrag.kind === 'arrow') {
        const st = s.strokes[s.strokes.length - 1];
        st.x2 = p.nx; st.y2 = p.ny;
        renderEditor();
    } else if (editorDrag.kind === 'region') {
        const x0 = Math.min(editorDrag.x, p.nx), x1 = Math.max(editorDrag.x, p.nx);
        const y0 = Math.min(editorDrag.y, p.ny), y1 = Math.max(editorDrag.y, p.ny);
        s.draftRegion = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        renderEditor();
    } else if (editorDrag.kind === 'lasso') {
        editorDrag.pts.push([p.nx, p.ny]);
        s.draftLasso = editorDrag.pts;
        renderEditor();
    } else if (editorDrag.kind === 'erase') {
        const x0 = Math.min(editorDrag.x, p.nx), x1 = Math.max(editorDrag.x, p.nx);
        const y0 = Math.min(editorDrag.y, p.ny), y1 = Math.max(editorDrag.y, p.ny);
        s.draftRegion = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        renderEditor();
    } else if (editorDrag.kind === 'obj') {
        const st = s.strokes[s.selectedObj];
        if (!st) return;
        const cw = s.canvas.width, ch = s.canvas.height;
        const ix = p.nx * cw, iy = p.ny * ch;
        const dnx = (ix - editorDrag.six) / cw, dny = (iy - editorDrag.siy) / ch;
        if (editorDrag.mode === 'move') {
            if (st.type === 'arrow') {
                st.x1 = Math.max(0, Math.min(1, editorDrag.oX1 + dnx)); st.y1 = Math.max(0, Math.min(1, editorDrag.oY1 + dny));
                st.x2 = Math.max(0, Math.min(1, editorDrag.oX2 + dnx)); st.y2 = Math.max(0, Math.min(1, editorDrag.oY2 + dny));
            } else if (st.type === 'text') {
                st.x = Math.max(0, Math.min(1, editorDrag.oX + dnx));
                st.y = Math.max(0, Math.min(1, editorDrag.oY + dny));
            }
            renderEditor();
        } else if (editorDrag.mode === 'endpoint') {
            const nx = Math.max(0, Math.min(1, p.nx)), ny = Math.max(0, Math.min(1, p.ny));
            if (editorDrag.which === 1) { st.x1 = nx; st.y1 = ny; } else { st.x2 = nx; st.y2 = ny; }
            renderEditor();
        } else if (editorDrag.mode === 'rotate') {
            const cpx = editorDrag.cx * cw, cpy = editorDrag.cy * ch;
            const ang = Math.atan2(iy - cpy, ix - cpx) * 180 / Math.PI + 90;
            st.angle = ((ang % 360) + 360) % 360;
            renderEditor();
        } else if (editorDrag.mode === 'resize') {
            // 以对角为固定点缩放，支持旋转
            const cx = editorDrag.cx, cy = editorDrag.cy, ang = editorDrag.ang;
            const cpx = cx * cw, cpy = cy * ch;
            const l = rotVec(ix - cpx, iy - cpy, -ang);
            const corner = editorDrag.corner;
            const fixedLocal = [[-1, -1], [1, -1], [1, 1], [-1, 1]][(corner + 2) % 4];
            const curLocal = [l.x, l.y];
            // 用拖动的角确定新半宽高（符号取反保持固定角不动）
            const newHw = Math.max(4, Math.abs(curLocal[0]));
            const newHh = Math.max(4, Math.abs(curLocal[1]));
            const rotFix = rotVec(fixedLocal[0] * newHw, fixedLocal[1] * newHh, ang);
            const newCx = cpx - rotFix.x, newCy = cpy - rotFix.y;
            st.x = (newCx - newHw) / cw; st.y = (newCy - newHh) / ch;
            st.w = newHw * 2 / cw; st.h = newHh * 2 / ch;
            renderEditor();
        }
    }
});
function endDisplayDrag() {
    if (panDrag) {
        panDrag = null;
        editorDisplay.style.cursor = (editorState.mode === 'none') ? 'grab' : 'crosshair';
        return;
    }
    if (editorDrag && editorDrag.kind === 'crop' && editorState.crop) {
        const c = editorState.crop;
        if (c.w < 0.02 || c.h < 0.02) { editorState.crop = null; }
        else { applyCropToFrame(); } // 以当前编辑后的图作为裁剪源，裁剪后重新开始编辑
        editorState.cropping = false;
    }
    if (editorDrag && editorDrag.kind === 'region' && editorState.draftRegion) {
        const d = editorState.draftRegion;
        const shape = (editorDrag.shape === 'ellipse') ? 'ellipse' : ((editorDrag.shape === 'bgsel') ? 'bg' : 'rect');
        if (d.w > 0.01 && d.h > 0.01) {
            const reg = buildRegionFromDraft(d, shape, editorState.canvas);
            editorState.regions.push(reg);
            editorState.activeRegion = editorState.regions.length - 1;
            renderRegionList();
            syncAdjustUI();
            syncChromaUI();
            if (shape === 'bg') chromaHint.textContent = '已框选背景色范围：点“点图取背景色”，在该范围内点击背景，把同色像素选为区域';
        }
        editorState.draftRegion = null;
        setEditorMode('none');
    }
    if (editorDrag && editorDrag.kind === 'lasso' && editorState.draftLasso && editorState.draftLasso.length >= 3) {
        const reg = buildRegionLasso(editorState.draftLasso, editorState.canvas);
        if (reg) {
            editorState.regions.push(reg);
            editorState.activeRegion = editorState.regions.length - 1;
            renderRegionList();
            syncAdjustUI();
            syncChromaUI();
        }
        editorState.draftLasso = [];
        setEditorMode('none');
    }
    if (editorDrag && editorDrag.kind === 'erase' && editorState.draftRegion) {
        const d = editorState.draftRegion;
        if (d.w > 0.01 && d.h > 0.01) {
            editorState.eraseOps.push({ x: d.x, y: d.y, w: d.w, h: d.h });
            selectHint.textContent = '已移除一块区域，可继续框选其他水印 / 对象，或用“撤销擦除”回退';
        }
        editorState.draftRegion = null;
        setEditorMode('none');
    }
    // 画完箭头后自动选中，便于立即拖动端点调整
    if (editorDrag && editorDrag.kind === 'arrow' && editorState.strokes.length) {
        editorState.selectedObj = editorState.strokes.length - 1;
        setEditorMode('select');
    }
    editorDrag = null;
    renderEditor();
}
editorDisplay.addEventListener('pointerup', endDisplayDrag);
editorDisplay.addEventListener('pointercancel', endDisplayDrag);

// ---- 文字内联编辑：把可编辑文本框覆盖在文字框位置上 ----
let textEditorEl = null;
function ensureTextEditor() {
    if (textEditorEl) return textEditorEl;
    textEditorEl = document.createElement('textarea');
    textEditorEl.style.cssText = 'position:absolute;display:none;resize:none;overflow:hidden;padding:0;margin:0;border:none;background:transparent;color:transparent;caret-color:#e91e63;font-family:sans-serif;font-weight:bold;line-height:1.2;z-index:5;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:break-word;';
    textEditorEl.addEventListener('input', () => {
        const s = editorState;
        if (s.selectedObj !== null && s.strokes[s.selectedObj] && s.strokes[s.selectedObj].type === 'text') {
            s.strokes[s.selectedObj].text = textEditorEl.value;
            renderEditor();
        }
    });
    textEditorEl.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextEditor(); }
        if (e.key === 'Escape') commitTextEditor();
    });
    textEditorEl.addEventListener('blur', commitTextEditor);
    editorDisplay.parentElement.style.position = 'relative';
    editorDisplay.parentElement.appendChild(textEditorEl);
    return textEditorEl;
}
function commitTextEditor() {
    if (!textEditorEl) return;
    textEditorEl.style.display = 'none';
    renderEditor();
}
function openTextEditor(idx) {
    const s = editorState;
    const st = s.strokes[idx];
    if (!st || st.type !== 'text') return;
    const ta = ensureTextEditor();
    const { rect, cw, ch } = objImgRect();
    const fs = st.h * ch * 0.8;
    ta.value = st.text;
    ta.style.fontSize = Math.max(8, fs) + 'px';
    const sc = s.view.scale;
    const x = s.view.ox + st.x * cw * sc, y = s.view.oy + st.y * ch * sc;
    ta.style.left = x + 'px';
    ta.style.top = y + 'px';
    ta.style.width = (st.w * cw * sc) + 'px';
    ta.style.height = (st.h * ch * sc) + 'px';
    const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
    ta.style.transformOrigin = 'center';
    ta.style.transform = `rotate(${st.angle || 0}deg)`;
    ta.style.display = 'block';
    ta.focus();
}
// 双击文字框进入编辑
editorDisplay.addEventListener('dblclick', e => {
    const s = editorState;
    if (s.mode !== 'select') return;
    const { rect, cw, ch } = objImgRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hit = hitTestObject(mx, my);
    if (hit !== null && s.strokes[hit].type === 'text') {
        s.selectedObj = hit;
        renderEditor();
        openTextEditor(hit);
    }
});
// 删除选中对象
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (textEditorEl && textEditorEl.style.display !== 'none' && document.activeElement === textEditorEl) return;
        const s = editorState;
        if (s.selectedObj !== null && s.strokes[s.selectedObj]) {
            e.preventDefault();
            pushStrokeUndo();
            s.strokes.splice(s.selectedObj, 1);
            s.selectedObj = null;
            renderEditor();
        }
    }
});

// 滚轮缩放（镜头缩放，不改图片实际尺寸）
editorDisplay.addEventListener('wheel', e => {
    e.preventDefault();
    const s = editorState;
    const canvas = s.canvas;
    if (!canvas.width) return;
    const rect = editorDisplay.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const wrap = editorDisplay.parentElement;
    const dispW = Math.max(50, wrap.clientWidth), dispH = Math.max(50, wrap.clientHeight);
    const fitScale = Math.min(dispW / canvas.width, dispH / canvas.height);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    let ns = s.view.scale * factor;
    ns = Math.max(fitScale, Math.min(ns, fitScale * 20));
    const imgX = (dx - s.view.ox) / s.view.scale;
    const imgY = (dy - s.view.oy) / s.view.scale;
    s.view.scale = ns;
    s.view.ox = dx - imgX * ns;
    s.view.oy = dy - imgY * ns;
    clampPan();
    drawView();
}, { passive: false });

// 窗口尺寸变化时重绘视图
window.addEventListener('resize', () => {
    if (!editorModal.classList.contains('hidden')) drawView();
});

// ---- 应用编辑 ----
resetEditBtn.addEventListener('click', resetEditorState);
applyOneBtn.addEventListener('click', () => {
    if (editorState.frameIndex === null) return;
    commitToFrame(editorState.frameIndex);
    status2.textContent = `已应用编辑到帧 #${editorState.frameIndex}`;
    closeEditor();
});
applyAllBtn.addEventListener('click', () => {
    if (selectedFrames.length === 0) return;
    selectedFrames.forEach(idx => commitToFrame(idx));
    status2.textContent = `已应用编辑到 ${selectedFrames.length} 帧`;
    closeEditor();
});


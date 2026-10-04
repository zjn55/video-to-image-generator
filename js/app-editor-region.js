// app-editor-region.js —— 局部调整（矩形/椭圆/套索/背景色）、编辑选区、选区操作、背景色选区、填充颜色
// 选区容器面板：可折叠、标题可点击重命名（所有用户创建的选区统一显示在此容器中）
const regionPanel = document.getElementById('regionPanel');
const regionPanelTitle = document.getElementById('regionPanelTitle');
const regionPanelToggle = document.getElementById('regionPanelToggle');
const mergeUnionBtn = document.getElementById('mergeUnionBtn');
const mergeIntersectBtn = document.getElementById('mergeIntersectBtn');
const mergeSubtractBtn = document.getElementById('mergeSubtractBtn');
regionPanelToggle.addEventListener('click', () => {
    const collapsed = regionPanel.classList.toggle('collapsed');
    regionPanelToggle.textContent = collapsed ? '▸' : '▾';
});
regionPanelTitle.addEventListener('click', () => {
    if (regionPanelTitle.querySelector('input')) return;
    const old = regionPanelTitle.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = old;
    regionPanelTitle.textContent = '';
    regionPanelTitle.appendChild(input);
    input.focus(); input.select();
    let done = false;
    const commit = () => {
        if (done) return; done = true;
        const v = input.value.trim();
        regionPanelTitle.textContent = v || '我的选区';
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        else if (e.key === 'Escape') { input.value = old; input.blur(); }
    });
});
// ---- 选区树：合并选区（并集 / 交集 / 差集）----
// 把任意选区转成整图掩码（0/255）。普通选区从自身区域掩码填充到整图；合并选区递归做布尔合并。
// 计算一组选区的并集包围盒（归一化）
function mergedBBox(children) {
    let minx = 1, miny = 1, maxx = 0, maxy = 0;
    children.forEach(c => { minx = Math.min(minx, c.x); maxx = Math.max(maxx, c.x + c.w); miny = Math.min(miny, c.y); maxy = Math.max(maxy, c.y + c.h); });
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
}
// 重算合并选区 r 的负责区域与包围盒（由 children 实时生成，差集=并集减交集）
function rebuildMerged(r, cw, ch) {
    if (!r || !r.children || !r.unionType) return;
    r.area = mergedArea(r, cw, ch);
    r.baseW = cw; r.baseH = ch; // 重算的逐像素坐标基于当前画布尺寸
    const bb = mergedBBox(r.children);
    r.x = bb.x; r.y = bb.y; r.w = Math.max(0.001, bb.w); r.h = Math.max(0.001, bb.h);
}
// 从某选区向上同步所有祖先合并选区（子选区被编辑 / 删除后调用），树状递归
function syncMergedAncestors(r, cw, ch) {
    if (!r || r.parent == null) return;
    const p = editorState.regions.find(x => x.id === r.parent);
    if (!p) return;
    rebuildMerged(p, cw, ch);
    syncMergedAncestors(p, cw, ch);
}
// 把选中的多个选区合并成新的合并选区（子选区仍保留、可单独编辑）
mergeUnionBtn.addEventListener('click', () => mergeSelectedRegions('union'));
mergeIntersectBtn.addEventListener('click', () => mergeSelectedRegions('intersect'));
mergeSubtractBtn.addEventListener('click', () => mergeSelectedRegions('subtract'));
function mergeSelectedRegions(unionType) {
    const s = editorState;
    const raw = selectedRegions(s);
    if (raw.length < 2) { regionHint.textContent = '请先选中至少 2 个区域，再点合并按钮'; return; }
    const cw = s.canvas.width, ch = s.canvas.height;
    // 单父模型：一个选区只属于一个父。若选中了非顶层子选区，自动提升为它的顶层祖先参与合并（子选区不可再直接合并）
    const seen = new Set(); const lifted = [];
    raw.forEach(r => {
        let t = r;
        while (t.parent != null) { const p = s.regions.find(x => x.id === t.parent); if (!p) break; t = p; }
        if (!seen.has(t.id)) { seen.add(t.id); lifted.push(t); }
    });
    if (lifted.length < 2) {
        regionHint.textContent = '选中区域提升为顶层祖先后不足 2 个（如同一个合并选区里的子选区会提升为同一个祖先），无法合并';
        return;
    }
    const bb = mergedBBox(lifted);
    const merged = { id: ++s.nextRegionId, x: bb.x, y: bb.y, w: Math.max(0.001, bb.w), h: Math.max(0.001, bb.h), brightness: 100, contrast: 100, saturation: 100, pixelate: 1, transparent: false, shape: 'merged', area: null, bgColor: null, fillColor: null, parent: null, children: lifted.slice(), unionType, poly: null };
    lifted.forEach(r => { r.parent = merged.id; });
    merged.area = mergedArea(merged, cw, ch);
    merged.baseW = cw; merged.baseH = ch; // 合并结果的逐像素坐标基于此画布尺寸
    s.regions.push(merged);
    const newIdx = s.regions.length - 1;
    s.activeRegions = [newIdx]; s.activeRegion = newIdx;
    renderRegionList(); syncAdjustUI(); syncChromaUI(); renderEditor();
    const liftCount = raw.length - lifted.length;
    regionHint.textContent = `已将 ${lifted.length} 个顶层区域合并为${unionType === 'union' ? '并集' : unionType === 'intersect' ? '交集' : '差集'}选区${liftCount ? `（自动把 ${liftCount} 个子选区提升为各自顶层祖先参与合并）` : ''}；点其旁的 ▾ 可查看 / 管理组成子选区`;
}
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
    const base = { id: ++editorState.nextRegionId, x: d.x, y: d.y, w: d.w, h: d.h, brightness: 100, contrast: 100, saturation: 100, pixelate: 1, transparent: false, shape, area: null, bgColor: null, fillColor: null, parent: null, children: null, unionType: null };
    if (shape === 'ellipse') {
        // 椭圆用节省型几何表达（w/h 为半轴基准，r 为半径），查询时由 getRegionArea 转标准型像素
        base.area = { kind: 'shape', shapeType: RegionShape.ELLIPSE, x: d.x, y: d.y, w: d.w, h: d.h, r: Math.min(d.w, d.h) / 2 };
    } else if (shape === 'rect') {
        base.area = { kind: 'shape', shapeType: RegionShape.RECT, x: d.x, y: d.y, w: d.w, h: d.h };
    } else if (shape === 'bg') {
        // 背景色区域：初始空负责区域，等点取背景色后生成实际选区
        base.area = mkEmptyArea();
    }
    return base;
}
function buildRegionLasso(pts, canvas) {
    const cw = canvas.width, ch = canvas.height;
    // 把套索顶点裁剪到图片内 [0,1]，防止超出图片的部分导致选区越界、清除选区时误清除图片区域
    const clipped = pts.map(p => [Math.max(0, Math.min(1, p[0])), Math.max(0, Math.min(1, p[1]))]);
    let minx = 1, miny = 1, maxx = 0, maxy = 0;
    clipped.forEach(p => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); });
    const w = maxx - minx, h = maxy - miny;
    if (w < 0.005 || h < 0.005) return null;
    const base = { id: ++editorState.nextRegionId, x: minx, y: miny, w, h, brightness: 100, contrast: 100, saturation: 100, pixelate: 1, transparent: false, shape: 'lasso', area: null, bgColor: null, fillColor: null, poly: clipped, parent: null, children: null, unionType: null };
    // 套索负责区域 = 多边形内像素（标准型，绝对坐标）
    const wp = Math.max(1, Math.round(w * cw)), hp = Math.max(1, Math.round(h * ch));
    const X = Math.round(minx * cw), Y = Math.round(miny * ch);
    const rel = lassoMask(wp, hp, clipped.map(p => [(p[0] - minx) / w, (p[1] - miny) / h]));
    const ptsAbs = new Set();
    for (const k of rel) { const px = k >> 16, py = k & 0xFFFF; ptsAbs.add(pointKey(X + px, Y + py)); }
    base.area = { kind: 'points', shapeType: RegionShape.LASSO, data: ptsAbs };
    base.baseW = cw; base.baseH = ch; // 记录生成时的画布尺寸，缩放尺寸时按比例映射
    return base;
}
function renderRegionList() {
    const s = editorState;
    const shapeName = { rect: '矩形', ellipse: '椭圆', lasso: '套索', bg: '背景色', merged: '合并选区' };
    const unionName = { union: '并集', intersect: '交集', subtract: '差集' };
    regionList.innerHTML = '';
    if (!s.regions.length) {
        regionHint.textContent = '矩形 / 椭圆 / 套索：圈出一块区域单独编辑；背景色：把同色像素选为一块区域';
        updateRegionBtnState();
        return;
    }
    const selCount = s.activeRegions.length;
    regionHint.textContent = `已创建 ${s.regions.length} 个区域；${selCount ? `当前滑块作用于选中区域（#${s.activeRegions.join(',')}）的并集` : '当前滑块作用于整张图'}。点击选中 / 再次点击取消；按住 Shift 多选；选中 ≥2 个可用顶部 ∪∩− 合并。`;
    const tops = s.regions.map((r, i) => ({ r, i })).filter(x => x.r.parent == null);
    function buildItem(r, i, depth, parentEl) {
        const div = document.createElement('div');
        div.className = 'region-item' + (s.activeRegions.includes(i) ? ' active' : '');
        div.title = '点击选中该区域，再次点击取消；按住 Shift 多选' + (depth === 0 ? '；可拖动调整覆盖顺序' : '；可在同一合并内拖动排序');
        // 所有选区都可拖动排序（子选区只能与同父的其他子选区交换，由拖拽合法性按 parent 校验）
        div.setAttribute('draggable', 'true');
        div.setAttribute('data-rindex', String(i));
        div.style.cursor = 'grab';
        // 扁平排列：所有选区从上到下平铺，子选区用字号前缩进表示层级
        div.style.paddingLeft = (8 + depth * 16) + 'px';
        const isMerged = !!(r.children && r.unionType);
        if (isMerged) {
            const caret = document.createElement('span');
            caret.className = 'region-caret';
            caret.textContent = r._expanded ? '▾' : '▸';
            caret.title = '展开 / 收起组成子选区';
            caret.addEventListener('click', e => { e.stopPropagation(); r._expanded = !r._expanded; renderRegionList(); });
            div.appendChild(caret);
        } else {
            const pad = document.createElement('span'); pad.className = 'region-caret'; pad.textContent = '·'; div.appendChild(pad);
        }
        const name = document.createElement('span');
        name.className = 'region-name';
        const baseName = isMerged ? `合并${unionName[r.unionType]}` : `区域 #${i}（${shapeName[r.shape] || '矩形'}${r.transparent ? '·透明' : ''}${r.fillColor ? '·填色' : ''}）`;
        name.textContent = baseName + (r.parent != null ? '（子）' : '');
        const delBtn = document.createElement('button');
        delBtn.className = 'region-del';
        delBtn.textContent = '删除';
        delBtn.title = r.parent != null ? '删除该子选区（父选区会自动重新合并）' : '删除该区域';
        delBtn.addEventListener('click', e => { e.stopPropagation(); deleteRegion(i); });
        div.appendChild(name);
        div.appendChild(delBtn);
        div.addEventListener('click', e => toggleActiveRegion(i, e.shiftKey));
        (parentEl || regionList).appendChild(div);
        // 合并选区展开时：子选区扁平平铺到同一列表（紧随合并项之后，用 padding 缩进表示层级）
        if (isMerged && r._expanded && r.children) {
            r.children.forEach(c => { const ci = s.regions.indexOf(c); if (ci >= 0) buildItem(c, ci, depth + 1, parentEl || regionList); });
        }
    }
    tops.forEach(t => buildItem(t.r, t.i, 0));
    updateRegionBtnState();
}
// 编辑选区 / 应用填充色：选中编辑区域后才可正常使用，否则灰显
function updateRegionBtnState() {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    maskEditBtn.disabled = !(r) || (r && r.shape === 'merged'); // 合并选区本体不可直接编辑选区（编辑其子选区即可）
    applyFillBtn.disabled = (s.activeRegion === null && !s.activeRegions.length);
    clearFillBtn.disabled = applyFillBtn.disabled;
    const multi = selectedRegions(s).length >= 2;
    mergeUnionBtn.disabled = !multi; mergeIntersectBtn.disabled = !multi; mergeSubtractBtn.disabled = !multi;
}
function toggleActiveRegion(i, multi) {
    const s = editorState;
    if (multi) {
        const pos = s.activeRegions.indexOf(i);
        if (pos >= 0) s.activeRegions.splice(pos, 1);
        else s.activeRegions.push(i);
    } else {
        if (s.activeRegions.length === 1 && s.activeRegions[0] === i) s.activeRegions = [];
        else s.activeRegions = [i];
    }
    s.activeRegion = s.activeRegions.length ? s.activeRegions[s.activeRegions.length - 1] : null;
    syncFillUI();
    renderRegionList();
    syncAdjustUI();
    syncChromaUI();
    // 编辑选区状态下切换选区：按新的多选集重建临时并集，单选则清空
    if (s.mode === 'maskedit') {
        if (s.activeRegions.length > 1) {
            const sel = s.activeRegions.map(i => s.regions[i]).filter(Boolean);
            s.maskEditUnion = sel.length > 1 ? unionRegions(sel, s.canvas.width, s.canvas.height) : null;
        } else {
            s.maskEditUnion = null;
        }
    }
    // 选中 / 取消选区只影响显示层（轮廓 / 高亮），画布内容不变，只重绘显示层即可，无需整幅重建
    if (s.mode === 'maskedit') renderEditor(); // 编辑选区需把新临时并集应用到画布，才重建
    else drawView();
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
    const r = s.regions[i];
    if (!r) return;
    const cw = s.canvas.width, ch = s.canvas.height;
    // 若 r 是合并选区：其子选区释放回顶层（parent 置空，仍可单独编辑）
    if (r.children && r.unionType) r.children.forEach(c => { c.parent = null; });
    // 单父模型：若 r 是某个合并选区的子选区，从该父的 children 中移除，父重新合并并向上同步整棵父链
    if (r.parent != null) {
        const p = s.regions.find(x => x.id === r.parent);
        if (p && p.children) {
            const pi = p.children.indexOf(r);
            if (pi >= 0) { p.children.splice(pi, 1); rebuildMerged(p, cw, ch); syncMergedAncestors(p, cw, ch); }
        }
    }
    s.regions.splice(i, 1);
    if (s.activeRegion !== null) {
        if (s.activeRegion === i) s.activeRegion = null;
        else if (s.activeRegion > i) s.activeRegion--;
    }
    if (s.activeRegions.length) {
        s.activeRegions = s.activeRegions.map(x => x === i ? -1 : (x > i ? x - 1 : x)).filter(x => x >= 0);
        s.activeRegion = s.activeRegions.length ? s.activeRegions[s.activeRegions.length - 1] : null;
    }
    renderRegionList();
    syncAdjustUI();
    syncChromaUI();
    renderEditor();
}

// ---- 编辑选区：手动修改当前选中区域（背景色）的选中像素 ----
maskEditBtn.addEventListener('click', () => {
    const s = editorState;
    if (s.mode === 'maskedit') { clearMaskEditUnion(); setEditorMode('none'); regionHint.textContent = '已退出编辑选区'; return; }
    const sel = selectedRegions(s);
    if (!sel.length) {
        regionHint.textContent = '请先选中一个区域，再进入编辑选区';
        return;
    }
    const cw = s.canvas.width, ch = s.canvas.height;
    if (sel.length > 1) {
        // 多选：创建临时并集区域，笔刷编辑并集掩码（负责区域 = 选中区域掩码的并集）
        s.maskEditUnion = unionRegions(sel, cw, ch);
    } else {
        const r = sel[0];
        // 单选：把负责区域转为标准型 points（若为节省型几何，先转换），便于笔刷增删像素
        if (!r.area || r.area.kind === 'shape') { r.area = getRegionArea(r, cw, ch); r.baseW = cw; r.baseH = ch; }
    }
    setEditorMode('maskedit');
    regionHint.textContent = sel.length > 1 ? `编辑选区中（作用于 ${sel.length} 个选中区域的并集）：在图片上拖动用笔刷${s.maskErase ? '橡皮擦清除选中' : '画笔增加选中'}` : `编辑选区中：在图片上拖动用笔刷${s.maskErase ? '橡皮擦清除选中' : '画笔增加选中'}`;
});
function clearMaskEditUnion() { editorState.maskEditUnion = null; }
maskPenBtn.addEventListener('click', () => {
    editorState.maskErase = false;
    updateMaskToolUI();
    if (editorState.mode === 'maskedit') updateMaskCursor();
});
maskEraseBtn.addEventListener('click', () => {
    editorState.maskErase = true;
    updateMaskToolUI();
    if (editorState.mode === 'maskedit') updateMaskCursor();
});
function updateMaskToolUI() {
    maskPenBtn.classList.toggle('active', !editorState.maskErase);
    maskEraseBtn.classList.toggle('active', editorState.maskErase);
}
maskPenSizeIn.addEventListener('input', () => { editorState.maskPenSize = Math.max(1, parseInt(maskPenSizeIn.value) || 20); if (editorState.mode === 'maskedit' && !editorState.maskErase) updateMaskCursor(); });
maskEraseSizeIn.addEventListener('input', () => { editorState.maskEraseSize = Math.max(1, parseInt(maskEraseSizeIn.value) || 40); if (editorState.mode === 'maskedit' && editorState.maskErase) updateMaskCursor(); });
function updateMaskCursor() {
    const s = editorState;
    if (s.mode !== 'maskedit') { editorDisplay.style.cursor = 'crosshair'; return; }
    const d = Math.max(8, (s.maskErase ? s.maskEraseSize : s.maskPenSize));
    const r = Math.round(d / 2);
    const color = s.maskErase ? '#e53935' : '#1e88e5';
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + d + "' height='" + d + "'><circle cx='" + r + "' cy='" + r + "' r='" + (d / 2 - 1) + "' fill='rgba(255,255,255,0.25)' stroke='" + color + "' stroke-width='1.5'/><circle cx='" + r + "' cy='" + r + "' r='1.6' fill='" + color + "'/></svg>";
    const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    editorDisplay.style.cursor = 'url("' + uri + '") ' + r + ' ' + r + ', crosshair';
}
function applyMaskBrush(p, isDown) {
    const s = editorState;
    // 多选编辑选区时作用在临时并集区域，单选时作用在当前选中区域
    const r = s.maskEditUnion || ((s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null);
    if (!r) return;
    const cw = s.canvas.width, ch = s.canvas.height;
    // 确保负责区域为标准型 points（若为节省型几何，先转换，便于笔刷增删像素）
    let area = r.area;
    if (!area || area.kind === 'shape') { r.area = getRegionArea(r, cw, ch); area = r.area; }
    if (!area || area.kind !== 'points') return;
    r.baseW = cw; r.baseH = ch; // 笔刷增删像素基于当前画布尺寸，据此记录基准
    const data = area.data;
    const mx = Math.round(p.nx * cw), my = Math.round(p.ny * ch);
    if (mx < 0 || my < 0 || mx >= cw || my >= ch) return;
    const bpx = Math.max(1, Math.round((s.maskErase ? s.maskEraseSize : s.maskPenSize) / 2));
    const erasing = s.maskErase;
    for (let j = Math.max(0, my - bpx); j <= Math.min(ch - 1, my + bpx); j++) {
        for (let i = Math.max(0, mx - bpx); i <= Math.min(cw - 1, mx + bpx); i++) {
            if (Math.hypot(i - mx, j - my) <= bpx) {
                const key = pointKey(i, j);
                if (erasing) data.delete(key); else data.add(key);
            }
        }
    }
    // 若编辑的是子选区，同步更新其父合并选区及祖先的负责区域
    if (!s.maskEditUnion && r.parent != null) syncMergedAncestors(r, cw, ch);
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
    const rs = selectedRegions(s);
    if (!rs.length) { regionHint.textContent = '请先在“局部调整”里选中一个区域，再清除选区'; return; }
    rs.forEach(r => r.transparent = !r.transparent);
    renderRegionList();
    renderEditor();
});
// ---- 填充颜色：给当前选区选中的像素填色 ----
applyFillBtn.addEventListener('click', () => {
    const s = editorState;
    const rs = selectedRegions(s);
    if (!rs.length) { regionHint.textContent = '请先在“局部调整”里选中一个区域，再应用填充色'; return; }
    const hex = regionFillColor.value.replace('#', '');
    const col = [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
    rs.forEach(r => r.fillColor = col);
    renderRegionList();
    renderEditor();
    regionHint.textContent = `已将填充色应用到 ${rs.length} 个选中区域选中的像素；点“清除填充色”可恢复原色`;
});
clearFillBtn.addEventListener('click', () => {
    const s = editorState;
    const rs = selectedRegions(s);
    if (!rs.length) { regionHint.textContent = '请先选中一个区域'; return; }
    if (!rs.some(r => r.fillColor)) { regionHint.textContent = '选中区域还没有应用填充色'; return; }
    rs.forEach(r => r.fillColor = null);
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
        r.area = mkEmptyArea();
        r.transparent = false;
    }
    syncChromaUI();
    renderRegionList();
    renderEditor();
});
// 基于已取的背景色，按当前容差实时重算选区（供预览与透明使用）
function updateBgMaskFromColor() {
    const s = editorState;
    const r = (s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null;
    if (!r || r.shape !== 'bg' || !r.bgColor) return;
    const cw = s.canvas.width, ch = s.canvas.height;
    if (!cw || !ch) return;
    const x = Math.max(0, Math.round(r.x * cw)), y = Math.max(0, Math.round(r.y * ch));
    const w = Math.max(1, Math.min(cw - x, Math.round(r.w * cw))), h = Math.max(1, Math.min(ch - y, Math.round(r.h * ch)));
    const tol = (parseInt(chromaTol.value) || 0) / 100 * 160;
    const sub = s.canvas.getContext('2d').getImageData(x, y, w, h);
    r.area = bgMask(w, h, sub, r.bgColor, tol, x, y);
    r.baseW = cw; r.baseH = ch; // 背景色选区像素坐标基于当前画布尺寸
    if (r.parent != null) syncMergedAncestors(r, s.canvas.width, s.canvas.height);
}
// 背景色选区高亮临时隐藏（按住 O 查看原图）
let maskPreviewHidden = false;
function maskPreviewKey(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); }
document.addEventListener('keydown', (e) => {
    if (maskPreviewKey(e)) return;
    if ((e.key === 'o' || e.key === 'O') && !maskPreviewHidden) { maskPreviewHidden = true; renderEditor(); }
});
document.addEventListener('keyup', (e) => {
    if (maskPreviewKey(e)) return;
    if ((e.key === 'o' || e.key === 'O') && maskPreviewHidden) { maskPreviewHidden = false; renderEditor(); }
});
chromaTol.addEventListener('input', () => { chromaTolVal.textContent = chromaTol.value; updateBgMaskFromColor(); renderEditor(); });

// ---- 选区排序：拖动顶层选区调整覆盖顺序（参照帧排序：自动找最近插入点 + 黑色横线提示） ----
(function initRegionSort() {
    let dragIdx = null, dropLine = null, dropPos = null, dropBefore = null;
    function ensureLine() {
        // drop 后 renderRegionList() 会用 innerHTML='' 清空列表，旧横线元素被销毁；
        // 若缓存指向的旧元素已脱离 DOM（isConnected=false），需重建，否则横线会"消失"
        if (dropLine && dropLine.isConnected) return dropLine;
        dropLine = document.createElement('div');
        dropLine.id = 'regionDropLine';
        dropLine.className = 'region-drop-line';
        regionList.appendChild(dropLine);
        return dropLine;
    }
    regionList.addEventListener('dragstart', e => {
        const t = e.target.closest('[data-rindex]');
        if (!t) return;
        dragIdx = parseInt(t.getAttribute('data-rindex'), 10);
        dropBefore = null; dropPos = null;
        // 复位横线，避免上一次残留状态影响本次
        if (dropLine) dropLine.style.display = 'none';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(dragIdx));
        t.classList.add('dragging');
    });
    regionList.addEventListener('dragover', e => {
        if (dragIdx === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const s = editorState;
        const a = s.regions[dragIdx];
        const rect = regionList.getBoundingClientRect();
        const my = e.clientY - rect.top;
        const items = [...regionList.children].filter(el => el.getAttribute && el.getAttribute('data-rindex') !== null && el.getAttribute('data-rindex') !== String(dragIdx));
        // 只有与拖动项同父类的选区可作为插入目标：不同父类的槽位不合法，不显示横线、不可 drop
        // （顶层选区父类统一为根 null，可互相交换；合并选区的子选区父类为所属合并选区，仅同合并内可交换）
        const legal = a ? items.filter(el => {
            const t = s.regions[parseInt(el.getAttribute('data-rindex'), 10)];
            return t && t.parent === a.parent;
        }) : [];
        if (!legal.length) { dropPos = 'none'; dropBefore = null; if (dropLine) dropLine.style.display = 'none'; return; }
        let beforeEl = null, lineTop;
        for (const el of legal) {
            const r = el.getBoundingClientRect();
            if (my <= r.top - rect.top + r.height / 2) { beforeEl = el; break; }
        }
        if (beforeEl) { dropPos = 'before'; dropBefore = s.regions[parseInt(beforeEl.getAttribute('data-rindex'), 10)] || null; lineTop = beforeEl.getBoundingClientRect().top - rect.top; }
        else { dropPos = 'end'; dropBefore = null; const last = legal[legal.length - 1]; lineTop = last.getBoundingClientRect().bottom - rect.top; }
        const line = ensureLine();
        line.style.top = lineTop + 'px';
        line.style.display = 'block';
    });
    regionList.addEventListener('drop', e => {
        if (dragIdx === null) return;
        e.preventDefault();
        const s = editorState;
        const a = s.regions[dragIdx];
        if (a && dropPos && dropPos !== 'none') {
            // 记住选中身份，移动后按对象重建选中索引（数组索引会位移）
            const selObjs = s.activeRegions.map(i => s.regions[i]).filter(Boolean);
            s.regions.splice(dragIdx, 1);
            if (dropPos === 'before' && dropBefore) {
                const target = s.regions.indexOf(dropBefore);
                s.regions.splice(target < 0 ? s.regions.length : target, 0, a);
            } else {
                s.regions.push(a);
            }
            s.activeRegions = selObjs.map(o => s.regions.indexOf(o)).filter(i => i >= 0);
            s.activeRegion = s.activeRegions.length ? s.activeRegions[s.activeRegions.length - 1] : null;
            // 移动的是子选区：同步父合并选区的 children 顺序（按 regions 数组当前顺序）并重算负责区域
            if (a.parent != null) {
                const f = s.regions.find(r => r.children && r.children.indexOf(a) >= 0);
                if (f) {
                    f.children.sort((x, y) => s.regions.indexOf(x) - s.regions.indexOf(y));
                    f.area = mergedArea(f, s.canvas.width, s.canvas.height);
                    f.baseW = s.canvas.width; f.baseH = s.canvas.height;
                }
            }
            renderRegionList();
            renderEditor(); // 覆盖顺序变化，重建画布以反映新的覆盖顺序
        }
        dragIdx = null; dropPos = null; dropBefore = null;
        if (dropLine) dropLine.style.display = 'none';
    });
    regionList.addEventListener('dragend', () => {
        dragIdx = null; dropPos = null; dropBefore = null;
        if (dropLine) dropLine.style.display = 'none';
        regionList.querySelectorAll('.region-item.dragging').forEach(el => el.classList.remove('dragging'));
    });
})();


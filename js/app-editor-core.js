// app-editor-core.js —— 编辑器渲染/状态核心：DOM引用、editorState、Canvas工具、视图、renderEditor/openEditor、画布事件分发、导出单帧
// app-editor.js —— 图片编辑器（画布、选区、标注、调色、导出单帧）
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
const chromaTolVal = document.getElementById('chromaTolVal');
const chromaHint = document.getElementById('chromaHint');
const brushToolBtn = document.getElementById('brushToolBtn');
const arrowToolBtn = document.getElementById('arrowToolBtn');
const textToolBtn = document.getElementById('textToolBtn');
const selectToolBtn = document.getElementById('selectToolBtn');
const textSizeIn = document.getElementById('textSizeIn');
const textColorIn = document.getElementById('textColorIn');
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
    arrowSize: 5,
    selectedObj: null,
    undoStack: [],
    redoStack: [],
    view: { scale: 1, ox: 0, oy: 0 },
    regions: [],
    activeRegion: null,
    draftRegion: null,
    draftLasso: [],
    eraseOps: [],
    maskErase: true, // 编辑选区当前工具：true=橡皮(清除选中)，false=画笔(增加选中)
    maskPenSize: 20, // 画笔笔刷粗细（像素）
    maskEraseSize: 40, // 橡皮笔刷粗细（像素）
    activeRegions: [], // 多选：当前选中的区域索引集合
    nextRegionId: 0, // 区域自增唯一 id（删除不复用）
    maskEditUnion: null, // 编辑选区多选时的临时并集区域对象
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
// ==================== 负责区域（Area）系统 ====================
// 选区负责区域两种形态：
//   - 节省型（shape）：{ kind:'shape', shapeType, x,y,w,h, r } 用几何参数表达，不占像素内存（矩形 / 椭圆）
//   - 标准型（points）：{ kind:'points', data:Set<number> } 逐像素记录，key=(x<<16)|y（32 位，前16位x后16位y）
// 所有集合运算 / 图片操作统一用标准型（points），仅存储时可保留节省型，通过 getRegionArea 查询时转换。
const RegionShape = { RECT: 0, ELLIPSE: 1, LASSO: 2, BG: 3, MERGED: 4 };
function pointKey(x, y) { return (x << 16) | y; }
function pointXY(key) { return [key >> 16, key & 0xFFFF]; }
function mkEmptyArea() { return { kind: 'points', shapeType: RegionShape.MERGED, data: new Set() }; }
// 查询函数：返回选区负责区域的标准型（points）。若该选区以节省型（几何）存储，则在此计算并转换为标准型。
function getRegionArea(r, cw, ch) {
    if (!r || !r.area) return mkEmptyArea();
    if (r.area.kind === 'points') return r.area;
    // 节省型（几何）→ 枚举区域内像素转标准型
    const pts = new Set();
    const X = Math.max(0, Math.round(r.x * cw)), Y = Math.max(0, Math.round(r.y * ch));
    const W = Math.max(0, Math.min(cw - X, Math.round(r.w * cw))), H = Math.max(0, Math.min(ch - Y, Math.round(r.h * ch)));
    if (r.area.shapeType === RegionShape.RECT) {
        for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) pts.add(pointKey(X + xx, Y + yy));
    } else if (r.area.shapeType === RegionShape.ELLIPSE) {
        const rx = Math.max(1, W / 2), ry = Math.max(1, H / 2), cx = X + rx, cy = Y + ry;
        for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
            const dx = (X + xx - cx) / rx, dy = (Y + yy - cy) / ry;
            if (dx * dx + dy * dy <= 1) pts.add(pointKey(X + xx, Y + yy));
        }
    }
    return { kind: 'points', shapeType: r.area.shapeType, data: pts };
}
// 集合运算（标准型 points，返回标准型）
function areaUnion(a, b) { const d = new Set(a.data); for (const k of b.data) d.add(k); return { kind: 'points', data: d }; }
function areaIntersect(a, b) { const d = new Set(); for (const k of a.data) if (b.data.has(k)) d.add(k); return { kind: 'points', data: d }; }
function areaSubtract(a, b) { const d = new Set(a.data); for (const k of b.data) d.delete(k); return { kind: 'points', data: d }; }
// 递归计算合并选区的负责区域（差集 = 并集 - 交集，即对称差）
function mergedArea(r, cw, ch) {
    if (!r.children || !r.children.length) return mkEmptyArea();
    const first = getRegionArea(r.children[0], cw, ch);
    if (r.unionType === 'union') {
        let acc = first; for (let ci = 1; ci < r.children.length; ci++) acc = areaUnion(acc, getRegionArea(r.children[ci], cw, ch)); return acc;
    } else if (r.unionType === 'intersect') {
        let acc = first; for (let ci = 1; ci < r.children.length; ci++) acc = areaIntersect(acc, getRegionArea(r.children[ci], cw, ch)); return acc;
    } else { // subtract：并集 减去 交集
        let uni = first, inter = first;
        for (let ci = 1; ci < r.children.length; ci++) { const b = getRegionArea(r.children[ci], cw, ch); uni = areaUnion(uni, b); inter = areaIntersect(inter, b); }
        return areaSubtract(uni, inter);
    }
}
// 把多个区域合并为一个整图坐标的临时并集区域对象（负责区域 = 各区域负责区域的并集）
function unionRegions(rs, cw, ch) {
    const pts = new Set();
    rs.forEach(r => { const a = getRegionArea(r, cw, ch); for (const k of a.data) pts.add(k); });
    return { x: 0, y: 0, w: 1, h: 1, shape: 'union', area: { kind: 'points', shapeType: RegionShape.MERGED, data: pts }, brightness: rs[0].brightness, contrast: rs[0].contrast, saturation: rs[0].saturation, pixelate: rs[0].pixelate, transparent: rs.some(r => r.transparent), fillColor: rs[0].fillColor || null, children: null, unionType: null, parent: null };
}
function applyRegions(canvas, s) {
    if (!s.regions.length) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width, ch = canvas.height;
    // 全图原始快照：每项都从这张快照取像素，重叠区不会重复处理
    const base = ctx.getImageData(0, 0, cw, ch);
    const selected = s.activeRegions.length ? s.activeRegions : (s.activeRegion !== null ? [s.activeRegion] : []);
    const selectedSet = new Set(selected);
    // 所有区域都应用（子选区已裁剪到父合并负责区域），选中/取消合并选区都不会丢失子选区上已设的操作
    const items = [];
    if (s.maskEditUnion) {
        // 正在编辑选区（多选）：用可编辑的临时并集替代选中的并集，未选中照常
        const sel = [...selectedSet].map(i => s.regions[i]).filter(Boolean);
        if (sel.length) {
            s.maskEditUnion.brightness = sel[0].brightness; s.maskEditUnion.contrast = sel[0].contrast; s.maskEditUnion.saturation = sel[0].saturation; s.maskEditUnion.pixelate = sel[0].pixelate;
            s.maskEditUnion.transparent = sel.some(r => r.transparent); s.maskEditUnion.fillColor = sel[0].fillColor || null;
        }
        items.push(s.maskEditUnion);
        s.regions.forEach((r, i) => { if (!selectedSet.has(i)) items.push(r); });
    } else if (selectedSet.size > 1) {
        const sel = [...selectedSet].map(i => s.regions[i]).filter(Boolean);
        if (sel.length > 1) items.push(unionRegions(sel, cw, ch));
        s.regions.forEach((r, i) => { if (!selectedSet.has(i)) items.push(r); });
    } else {
        s.regions.forEach((r, i) => { items.push(r); });
    }
    items.forEach(r => {
        const needAdjust = !(r.brightness === 100 && r.contrast === 100 && r.saturation === 100);
        const needPixelate = r.pixelate > 1;
        const needTransparent = !!r.transparent;
        const needFill = !!r.fillColor;
        if (!needAdjust && !needPixelate && !needTransparent && !needFill) return;
        // 通过查询函数取标准型负责区域（像素点集），统一按像素操作
        let area = getRegionArea(r, cw, ch);
        // 子选区：操作裁剪到父合并负责区域（与显示一致），超出合并负责区域的部分不参与操作
        if (r.parent != null) {
            const p = s.regions.find(x => x.id === r.parent);
            if (p && p.children && p.unionType) area = areaIntersect(area, getRegionArea(p, cw, ch));
        }
        if (!area.data.size) return;
        // out 基于当前画布（保留其它选区已应用的效果）；负责像素从 base 快照取原值应用，后写覆盖
        const out = ctx.getImageData(0, 0, cw, ch);
        if (needAdjust || needFill || needTransparent) {
            const b = r.brightness / 100, c = r.contrast / 100, sat = r.saturation / 100;
            const fr = r.fillColor ? r.fillColor[0] : 0, fg = r.fillColor ? r.fillColor[1] : 0, fb = r.fillColor ? r.fillColor[2] : 0;
            for (const key of area.data) {
                const x = key >> 16, y = key & 0xFFFF;
                if (x >= cw || y >= ch) continue;
                const o = (y * cw + x) * 4;
                let R = base.data[o], G = base.data[o + 1], B = base.data[o + 2];
                if (needAdjust) {
                    if (b !== 1) { R *= b; G *= b; B *= b; }
                    if (c !== 1) { R = (R - 128) * c + 128; G = (G - 128) * c + 128; B = (B - 128) * c + 128; }
                    if (sat !== 1) { const L = 0.213 * R + 0.715 * G + 0.072 * B; R = L + (R - L) * sat; G = L + (G - L) * sat; B = L + (B - L) * sat; }
                }
                if (needFill) { R = fr; G = fg; B = fb; }
                out.data[o] = R; out.data[o + 1] = G; out.data[o + 2] = B;
                if (needTransparent) out.data[o + 3] = 0;
            }
        }
        // 像素化：按块分组，块内只统计负责像素，取平均
        if (needPixelate) {
            const p = r.pixelate;
            const groups = new Map();
            for (const key of area.data) {
                const x = key >> 16, y = key & 0xFFFF;
                if (x >= cw || y >= ch) continue;
                const gk = ((y / p) | 0) + '|' + ((x / p) | 0);
                if (!groups.has(gk)) groups.set(gk, []);
                groups.get(gk).push(key);
            }
            for (const keys of groups.values()) {
                let sr = 0, sg = 0, sb = 0, n = 0;
                for (const key of keys) { const x = key >> 16, y = key & 0xFFFF; const o = (y * cw + x) * 4; sr += out.data[o]; sg += out.data[o + 1]; sb += out.data[o + 2]; n++; }
                if (!n) continue;
                sr /= n; sg /= n; sb /= n;
                for (const key of keys) { const x = key >> 16, y = key & 0xFFFF; const o = (y * cw + x) * 4; out.data[o] = sr; out.data[o + 1] = sg; out.data[o + 2] = sb; }
            }
        }
        ctx.putImageData(out, 0, 0);
    });
}
// 套索多边形负责像素（even-odd 填充），pts 为相对该区域 bbox 的归一化点；返回相对 bbox 的像素点集 key=(px<<16)|py
function lassoMask(w, h, pts) {
    const out = new Set();
    if (!pts || pts.length < 3) return out;
    const poly = pts.map(p => [Math.max(0, Math.min(w - 1, Math.round(p[0] * (w - 1)))), Math.max(0, Math.min(h - 1, Math.round(p[1] * (h - 1))))]);
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            let inside = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
                if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
            }
            if (inside) out.add(pointKey(px, py));
        }
    }
    return out;
}
// 背景色负责区域（标准型 points）：色差 ≤ 容差 的像素记录为控制像素（x0,y0 为该 imgData 对应画布区域的起点）
function bgMask(w, h, imgData, bgColor, tol, x0, y0) {
    const pts = new Set();
    const d = imgData.data;
    for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
            const o = (yy * w + xx) * 4;
            const dr = d[o] - bgColor[0], dg = d[o + 1] - bgColor[1], db = d[o + 2] - bgColor[2];
            if (dr * dr + dg * dg + db * db <= tol * tol) pts.add(pointKey(x0 + xx, y0 + yy));
        }
    }
    return { kind: 'points', shapeType: RegionShape.BG, data: pts };
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
    chromaHint.textContent = (r.bgColor && r.area && r.area.data.size) ? `区域 #${s.activeRegion}（背景色）已生成同色选区。可调节容差后重新取色；“清除选区(透明)”可把它删成透明。` : `区域 #${s.activeRegion}（背景色）：点“点图取背景色”，在该范围内点击背景，把同色像素选为区域`;
}
// 滑块当前作用对象：有活动区域时作用于该区域，否则作用于整张图
function adjustTarget(s) {
    if (s.activeRegion !== null && s.regions[s.activeRegion]) return s.regions[s.activeRegion];
    return s;
}
// 多选：返回当前所有选中区域的数组；无选中时返回 [s]（作用于整张图）
function adjustTargets(s) {
    const list = s.activeRegions.length ? s.activeRegions : (s.activeRegion !== null ? [s.activeRegion] : []);
    const arr = list.map(i => s.regions[i]).filter(Boolean);
    return arr.length ? arr : [s];
}
// 区域级操作（清除 / 填充）：返回选中区域数组，无选中返回空
function selectedRegions(s) {
    const list = s.activeRegions.length ? s.activeRegions : (s.activeRegion !== null ? [s.activeRegion] : []);
    return list.map(i => s.regions[i]).filter(Boolean);
}
function clearRegions() {
    editorState.regions = [];
    editorState.activeRegion = null;
    editorState.activeRegions = [];
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
// 命中当前选中区域（矩形 / 背景色）的角点手柄；命中返回 {idx, ci}，否则 null
function regionCornerHit(e) {
    const s = editorState;
    if (s.activeRegion === null) return null;
    const r = s.regions[s.activeRegion];
    if (!r || (r.shape !== 'rect' && r.shape !== 'bg' && r.shape !== 'ellipse')) return null;
    const cw = s.canvas.width, ch = s.canvas.height;
    const rect = editorDisplay.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    for (let ci = 0; ci < 4; ci++) {
        const sx = s.view.ox + corners[ci][0] * cw * s.view.scale;
        const sy = s.view.oy + corners[ci][1] * ch * s.view.scale;
        if (Math.hypot(mx - sx, my - sy) < 14) return { idx: s.activeRegion, ci };
    }
    return null;
}
// 文字标注对象类：包含要显示的文字、字号大小、颜色
class EditorText {
    constructor(o = {}) {
        this.type = 'text';
        this.text = o.text != null ? String(o.text) : '';
        this.fontSize = o.fontSize != null ? o.fontSize : (o.h != null ? o.h : 0.05); // 归一化字号（相对图片高）
        this.color = o.color || '#ff0000';
        this.x = o.x != null ? o.x : 0.2;
        this.y = o.y != null ? o.y : 0.2;
        this.w = o.w != null ? o.w : 0.25;
        this.h = o.h != null ? o.h : 0.15;
        this.angle = o.angle || 0;
    }
}
function layoutText(ctx, text, maxWidth) {
    const chars = String(text || '').split('');
    const lines = []; let cur = '';
    for (const c of chars) {
        const t = cur + c;
        if (cur && ctx.measureText(t).width > maxWidth) { lines.push(cur); cur = c; }
        else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
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
            const fs = Math.max(6, (st.fontSize != null ? st.fontSize : st.h * 0.8) * h);
            ctx.save();
            ctx.font = 'bold ' + fs + 'px sans-serif';
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            const pad = fs * 0.5, lineH = fs * 1.2;
            let tw = st.w * w, th = st.h * h;
            const ox = st.x + st.w / 2, oy = st.y + st.h / 2;
            // 文字必须永远在框内，框自动"刚好容纳"（字号不变）：优先单行扩宽，放不下才按框宽换行、按行数扩高
            const fullW = st.text ? ctx.measureText(st.text).width : 0;
            let lines, needW = 0, needH;
            if (fullW + pad * 2 <= Math.max(tw, w - pad * 2)) {
                tw = Math.max(tw, fullW + pad * 2);
                st.w = tw / w; tw = st.w * w;
                lines = [String(st.text || '')];
            } else {
                lines = layoutText(ctx, st.text, Math.max(10, tw - pad * 2));
                for (const ln of lines) needW = Math.max(needW, ctx.measureText(ln).width);
                if (needW + pad * 2 > tw) { st.w = (needW + pad * 2) / w; tw = st.w * w; lines = layoutText(ctx, st.text, Math.max(10, tw - pad * 2)); }
            }
            needW = 0; for (const ln of lines) needW = Math.max(needW, ctx.measureText(ln).width);
            needH = Math.max(1, lines.length) * lineH; // 文字块高度（不含 padding）
            // 扩充不设图片尺寸上限：框可超出图片边界（超出部分在图片画布上自然被裁剪不显示），字号保持不变
            if (needH + pad * 2 > th) { st.h = (needH + pad * 2) / h; th = st.h * h; }
            st.x = ox - st.w / 2; st.y = oy - st.h / 2; // 扩充后保持中心不变
            const cx = st.x * w + tw / 2, cy = st.y * h + th / 2;
            ctx.translate(cx, cy);
            ctx.rotate((st.angle || 0) * Math.PI / 180);
            ctx.fillStyle = st.color;
            // 文字块（宽 needW、高 needH）在框内水平 + 垂直居中；框比文字大时文字居中，扩到容纳时中心对齐
            const blockX = -needW / 2, blockY = -needH / 2;
            lines.forEach((ln, i) => ctx.fillText(ln, blockX, blockY + i * lineH));
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
    // contain 并四周留白：图片约占显示区域 80%，四周露出棋盘格空白，
    // 便于从图片之外开始拖拽框选，从而能完全选中整张图片（含边缘）
    s.view.scale = Math.min(dispW / canvas.width, dispH / canvas.height) * 0.80;
    s.view.ox = (dispW - canvas.width * s.view.scale) / 2;
    s.view.oy = (dispH - canvas.height * s.view.scale) / 2;
    clampPan();
}
function dispToImg(e, allowOut) {
    const s = editorState;
    const canvas = s.canvas;
    if (!canvas.width) return null;
    const rect = editorDisplay.getBoundingClientRect();
    const ix = (e.clientX - rect.left - s.view.ox) / s.view.scale;
    const iy = (e.clientY - rect.top - s.view.oy) / s.view.scale;
    if (!allowOut && (ix < 0 || iy < 0 || ix > canvas.width || iy > canvas.height)) return null;
    return { nx: ix / canvas.width, ny: iy / canvas.height };
}
// 沿合并选区掩码的边缘描轮廓（显示其实际负责区域的形状，而非包围盒矩形）
// 沿负责区域（points）边缘像素描边（颜色 / 线型沿用外层 ctx 设置）
function strokeAreaOutline(ctx, area, cw, ch, ox, oy, scale) {
    const data = area.data;
    if (!data.size) return;
    ctx.beginPath();
    for (const key of data) {
        const x = key >> 16, y = key & 0xFFFF;
        if (x >= cw || y >= ch) continue;
        const px = ox + x * scale, py = oy + y * scale;
        const up = data.has(pointKey(x, y - 1)), dn = data.has(pointKey(x, y + 1));
        const lt = data.has(pointKey(x - 1, y)), rt = data.has(pointKey(x + 1, y));
        if (y === 0 || !up) { ctx.moveTo(px, py); ctx.lineTo(px + scale, py); }
        if (y === ch - 1 || !dn) { ctx.moveTo(px, py + scale); ctx.lineTo(px + scale, py + scale); }
        if (x === 0 || !lt) { ctx.moveTo(px, py); ctx.lineTo(px, py + scale); }
        if (x === cw - 1 || !rt) { ctx.moveTo(px + scale, py); ctx.lineTo(px + scale, py + scale); }
    }
    ctx.stroke();
}
// 合并选区轮廓：沿负责区域（points）的边缘像素描边
function strokeMergedMask(ctx, r, cw, ch, ox, oy, scale) {
    strokeAreaOutline(ctx, getRegionArea(r, cw, ch), cw, ch, ox, oy, scale);
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
    // 选区预览：背景色区域平时显示红色高亮；进入“编辑选区”后，选中区域（单选）或并集（多选）的负责区域都显示红色高亮（按住 O 临时隐藏查看原图）
    if (!maskPreviewHidden && (s.activeRegion !== null || s.maskEditUnion)) {
        const br = s.maskEditUnion || ((s.activeRegion !== null && s.regions[s.activeRegion]) ? s.regions[s.activeRegion] : null);
        if (br && (s.mode === 'maskedit' || (br.shape === 'bg' && br.bgColor))) {
            const cw = canvas.width, ch = canvas.height;
            const area = getRegionArea(br, cw, ch);
            if (area.data.size) {
                const ov = document.createElement('canvas');
                ov.width = cw; ov.height = ch;
                const oc = ov.getContext('2d');
                const id = oc.createImageData(cw, ch);
                const dd = id.data;
                for (const key of area.data) {
                    const x = key >> 16, y = key & 0xFFFF;
                    if (x >= cw || y >= ch) continue;
                    const o = (y * cw + x) * 4;
                    dd[o] = 255; dd[o + 1] = 60; dd[o + 2] = 60; dd[o + 3] = 60;
                }
                oc.putImageData(id, 0, 0);
                ctx.drawImage(ov, s.view.ox, s.view.oy, cw * s.view.scale, ch * s.view.scale);
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
        // 只显示选中区域（可多选）的选区边框；主选中区域额外显示四角手柄，未选中的区域不显示
        const shown = s.activeRegions.length ? s.activeRegions : (s.activeRegion !== null ? [s.activeRegion] : []);
        shown.forEach(ri => {
            const r = s.regions[ri];
            if (!r) return;
            const isMerged = !!(r.children && r.unionType);
            const x1 = s.view.ox + r.x * cw * s.view.scale;
            const y1 = s.view.oy + r.y * ch * s.view.scale;
            const x2 = s.view.ox + (r.x + r.w) * cw * s.view.scale;
            const y2 = s.view.oy + (r.y + r.h) * ch * s.view.scale;
            ctx.strokeStyle = isMerged ? '#8e24aa' : '#1565c0';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            if (isMerged) {
                strokeMergedMask(ctx, r, cw, ch, s.view.ox, s.view.oy, s.view.scale);
            } else if (r.parent != null) {
                // 子选区：只显示它与父合并负责区域的交集，超出合并负责区域的部分不显示
                const p = s.regions.find(x => x.id === r.parent);
                if (p) {
                    const clipped = areaIntersect(getRegionArea(r, cw, ch), getRegionArea(p, cw, ch));
                    if (clipped.data.size) strokeAreaOutline(ctx, clipped, cw, ch, s.view.ox, s.view.oy, s.view.scale);
                }
            } else if (r.shape === 'ellipse') {
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
            // 主选中区域画四角手柄（矩形 / 椭圆 / 背景色均可拖动调整）
            if (ri === s.activeRegion && !isMerged && (r.shape === 'rect' || r.shape === 'ellipse' || r.shape === 'bg')) {
                drawHandle(x1, y1); drawHandle(x2, y1); drawHandle(x2, y2); drawHandle(x1, y2);
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
            if (s.mode === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / 2, (y2 - y1) / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            }
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
    // 选中对象时在“选择”右侧动态显示该对象的属性控件
    updateSelProps();
    drawView();
}

function setEditorMode(mode) {
    editorState.mode = mode;
    if (mode !== 'maskedit') editorState.maskEditUnion = null; // 离开编辑选区，释放临时并集
    if (mode === 'maskedit') updateMaskCursor();
    else editorDisplay.style.cursor = (mode === 'none') ? 'grab' : 'crosshair';
    cropModeBtn.classList.toggle('active', mode === 'crop');
    regionModeBtn.classList.toggle('active', mode === 'region');
    ellipseModeBtn.classList.toggle('active', mode === 'ellipse');
    lassoModeBtn.classList.toggle('active', mode === 'lasso');
    bgselModeBtn.classList.toggle('active', mode === 'bgsel');
    eraseBtn.classList.toggle('active', mode === 'erase');
    pickBgBtn.classList.toggle('active', mode === 'pick');
    maskEditBtn.classList.toggle('active', mode === 'maskedit');
    maskPenBtn.classList.toggle('active', mode === 'maskedit' && !editorState.maskErase);
    maskEraseBtn.classList.toggle('active', mode === 'maskedit' && editorState.maskErase);
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
    s.activeRegions = [];
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
    // 来源判断：直接上传图片进入的编辑器，禁用“应用到帧”类按钮（无视频帧可写回）
    const fromImageSource = !!frames[index].fromUpload;
    editorTitle.textContent = fromImageSource ? '编辑图片' : `编辑帧 #${index}（${frames[index].time.toFixed(2)}s）`;
    applyOneBtn.disabled = fromImageSource;
    applyAllBtn.disabled = fromImageSource;
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

// 下载当前编辑结果（上传图片直接编辑的场景尤其有用）
downloadEditBtn.addEventListener('click', exportCurrentImage);
function exportCurrentImage() {
    const s = editorState;
    if (s.frameIndex === null) return;
    const f = frames[s.frameIndex];
    let final = buildPipelineCanvas(f.orig, s);
    final = buildCrop(final, s);
    final.willReadFrequently = true;
    applyRegions(final, s);
    applyEraseOps(final, s);
    drawStrokes(final.getContext('2d'), final.width, final.height, s.strokes);
    const a = document.createElement('a');
    a.href = final.toDataURL('image/png');
    a.download = f.fromUpload ? 'edited-image.png' : `frame_${s.frameIndex}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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


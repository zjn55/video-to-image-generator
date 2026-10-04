// app-editor-canvas.js —— 画布交互（平移、镜头缩放、裁剪/绘制/选区鼠标事件）
// ---- 画布交互（平移 + 镜头缩放 + 裁剪/绘制） ----
editorDisplay.addEventListener('pointerdown', e => {
    const s = editorState;
    // 命中当前选中区域（矩形 / 背景色）的角点手柄 → 优先进入四角调整
    const cp = regionCornerHit(e);
    if (cp) {
        const p = dispToImg(e, true);
        editorDrag = { kind: 'region-resize', region: cp.idx, corner: cp.ci, six: p.nx, siy: p.ny };
        editorDisplay.setPointerCapture(e.pointerId);
        return;
    }
    if (s.mode === 'select') { startSelectDrag(e); return; }
    if (s.mode === 'none') {
        // 无工具时：左键拖动平移视图
        panDrag = { startX: e.clientX, startY: e.clientY, startOx: s.view.ox, startOy: s.view.oy };
        editorDisplay.style.cursor = 'grabbing';
        editorDisplay.setPointerCapture(e.pointerId);
        return;
    }
    const p = dispToImg(e, ['region', 'ellipse', 'bgsel', 'lasso', 'erase', 'crop'].includes(s.mode));
    if (!p) return;
    if (s.mode === 'maskedit') {
        editorDrag = { kind: 'mask' };
        applyMaskBrush(p, true);
    } else if (s.mode === 'crop') {
        editorDrag = { kind: 'crop', x: p.nx, y: p.ny };
    } else if (s.mode === 'brush') {
        pushStrokeUndo();
        editorDrag = { kind: 'brush', points: [[p.nx, p.ny]] };
        s.strokes.push({ type: 'brush', color: s.brushColor, size: s.brushSize, points: editorDrag.points });
        renderEditor();
    } else if (s.mode === 'arrow') {
        pushStrokeUndo();
        editorDrag = { kind: 'arrow' };
        s.strokes.push({ type: 'arrow', color: s.brushColor, size: s.arrowSize, x1: p.nx, y1: p.ny, x2: p.nx, y2: p.ny });
        renderEditor();
    } else if (s.mode === 'text') {
        // 点击放置一个文字框，立即进入内联编辑
        const fs = parseInt(textSizeIn.value) || 28;
        const cw = s.canvas.width, ch = s.canvas.height;
        const h = Math.max(0.02, fs / ch);
        const w = Math.max(0.08, (fs * 6) / cw);
        const idx = s.strokes.length;
        pushStrokeUndo();
        s.strokes.push(new EditorText({ x: p.nx, y: p.ny, w, h, fontSize: fs / ch, text: '', color: textColorIn.value, angle: 0 }));
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
            const tol = (parseInt(chromaTol.value) || 0) / 100 * 160;
            const xr = Math.max(0, Math.round(r.x * s.canvas.width)), yr = Math.max(0, Math.round(r.y * s.canvas.height));
            const wr = Math.max(1, Math.min(s.canvas.width - xr, Math.round(r.w * s.canvas.width)));
            const hr = Math.max(1, Math.min(s.canvas.height - yr, Math.round(r.h * s.canvas.height)));
            const sub = cctx.getImageData(xr, yr, wr, hr);
            r.area = bgMask(wr, hr, sub, bg, tol, xr, yr);
            r.bgColor = bg;
            if (r.parent != null) syncMergedAncestors(r, s.canvas.width, s.canvas.height);
            setEditorMode('none');
            syncChromaUI();
            renderEditor();
            regionHint.textContent = `已为区域 #${s.activeRegion}（背景色）选取背景色。红色高亮即会选中的像素，可拖动容差实时预览；按住 O 临时查看原图`;
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
    const p = dispToImg(e, ['region', 'lasso', 'erase', 'crop', 'region-resize'].includes(editorDrag.kind));
    if (!p) return;
    if (editorDrag.kind === 'mask') {
        applyMaskBrush(p, false);
    } else if (editorDrag.kind === 'region-resize') {
        // 拖动矩形 / 背景色区域的一个角点，对边固定，矩形整体调整（clip 到图片内）
        const r = s.regions[editorDrag.region];
        if (!r) return;
        const cw = s.canvas.width, ch = s.canvas.height;
        const ci = editorDrag.corner;
        const fixed = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]][(ci + 2) % 4];
        const nx0 = Math.max(0, Math.min(1, Math.min(fixed[0], p.nx)));
        const nx1 = Math.max(0, Math.min(1, Math.max(fixed[0], p.nx)));
        const ny0 = Math.max(0, Math.min(1, Math.min(fixed[1], p.ny)));
        const ny1 = Math.max(0, Math.min(1, Math.max(fixed[1], p.ny)));
        if (nx1 - nx0 > 0.002 && ny1 - ny0 > 0.002) {
            r.x = nx0; r.y = ny0; r.w = nx1 - nx0; r.h = ny1 - ny0;
            if (r.shape === 'bg') { r.area = mkEmptyArea(); r.bgColor = null; } // 矩形变了，旧的取色选区需重新取色
            else if (r.shape === 'ellipse') { r.area = { kind: 'shape', shapeType: RegionShape.ELLIPSE, x: r.x, y: r.y, w: r.w, h: r.h, r: Math.min(r.w, r.h) / 2 }; } // 椭圆几何自适应，查询时转像素
            // 若调整的是子选区，同步更新其父合并选区及祖先
            if (r.parent != null) syncMergedAncestors(r, s.canvas.width, s.canvas.height);
        }
        renderEditor();
    } else if (editorDrag.kind === 'crop') {
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
        const dd = editorState.draftRegion;
        const shape = (editorDrag.shape === 'ellipse') ? 'ellipse' : ((editorDrag.shape === 'bgsel') ? 'bg' : 'rect');
        // 把框选范围裁剪到图片内：允许从图片外开始框选，最终区域覆盖到图片边缘且不越界
        const x0 = Math.max(0, Math.min(1, dd.x)), y0 = Math.max(0, Math.min(1, dd.y));
        const x1 = Math.max(0, Math.min(1, dd.x + dd.w)), y1 = Math.max(0, Math.min(1, dd.y + dd.h));
        if (x1 - x0 > 0.01 && y1 - y0 > 0.01) {
            const d = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
            const reg = buildRegionFromDraft(d, shape, editorState.canvas);
            editorState.regions.push(reg);
            editorState.activeRegion = editorState.regions.length - 1;
            editorState.activeRegions = [editorState.regions.length - 1];
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
            editorState.activeRegions = [editorState.regions.length - 1];
            renderRegionList();
            syncAdjustUI();
            syncChromaUI();
        }
        editorState.draftLasso = [];
        setEditorMode('none');
    }
    if (editorDrag && editorDrag.kind === 'erase' && editorState.draftRegion) {
        const dd = editorState.draftRegion;
        const x0 = Math.max(0, Math.min(1, dd.x)), y0 = Math.max(0, Math.min(1, dd.y));
        const x1 = Math.max(0, Math.min(1, dd.x + dd.w)), y1 = Math.max(0, Math.min(1, dd.y + dd.h));
        if (x1 - x0 > 0.01 && y1 - y0 > 0.01) {
            editorState.eraseOps.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
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


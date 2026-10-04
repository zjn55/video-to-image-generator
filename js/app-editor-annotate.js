// app-editor-annotate.js —— 绘制标注（画笔/箭头/文字）、撤销与重做、文字内联编辑
// ---- 绘制 / 标注 ----
brushToolBtn.addEventListener('click', () => { if (editorState.mode === 'brush') setEditorMode('none'); else { editorState.cropping = false; setEditorMode('brush'); } });
arrowToolBtn.addEventListener('click', () => { if (editorState.mode === 'arrow') setEditorMode('none'); else { editorState.cropping = false; setEditorMode('arrow'); } });
textToolBtn.addEventListener('click', () => { if (editorState.mode === 'text') setEditorMode('none'); else { editorState.cropping = false; setEditorMode('text'); } });
selectToolBtn.addEventListener('click', () => {
    if (editorState.mode === 'select') { editorState.selectedObj = null; setEditorMode('none'); renderEditor(); }
    else { editorState.cropping = false; setEditorMode('select'); renderEditor(); }
});
// 文字字号（创建用）：新文字创建时读取此值；选中对象后在“选择”右侧动态显示属性控件
// 在“选择”右侧动态生成当前选中对象的属性控件：文字→字号/颜色；箭头或画笔→粗细/颜色
function updateSelProps() {
    const s = editorState;
    const box = document.getElementById('selProps');
    const lbl = document.getElementById('selTypeLabel');
    const st = (s.selectedObj != null && s.strokes[s.selectedObj]) ? s.strokes[s.selectedObj] : null;
    // 标题行右侧显示所选对象类型名；未选中则留空
    if (lbl) lbl.textContent = st ? ({ text: '文字', arrow: '箭头', brush: '画笔' }[st.type] || '') : '';
    if (!box) return;
    box.innerHTML = '';
    if (!st) return;
    const mk = (label) => {
        const l = document.createElement('label');
        l.className = 'draw-lbl';
        l.textContent = label;
        box.appendChild(l);
    };
    if (st.type === 'text') {
        mk('字号');
        const n = document.createElement('input');
        n.type = 'number'; n.min = 8; n.max = 400;
        n.value = Math.round(st.fontSize * s.canvas.height);
        n.style.width = '54px';
        n.title = '字号（按回车或确认后生效）';
        box.appendChild(n);
        const px = document.createElement('span'); px.className = 'draw-px'; px.textContent = 'px'; box.appendChild(px);
        n.addEventListener('change', () => {
            const st2 = (s.selectedObj != null && s.strokes[s.selectedObj] && s.strokes[s.selectedObj].type === 'text') ? s.strokes[s.selectedObj] : null;
            if (!st2) return;
            const v = parseInt(n.value, 10);
            if (isNaN(v) || v <= 0) { n.value = Math.round(st2.fontSize * s.canvas.height); return; }
            pushStrokeUndo();
            st2.fontSize = Math.max(0.02, v / s.canvas.height);
            renderEditor();
        });
        mk('颜色');
        const c = document.createElement('input');
        c.type = 'color'; c.value = st.color;
        c.title = '选中文字的颜色';
        box.appendChild(c);
        c.addEventListener('input', () => {
            const st2 = (s.selectedObj != null && s.strokes[s.selectedObj] && s.strokes[s.selectedObj].type === 'text') ? s.strokes[s.selectedObj] : null;
            if (!st2) return;
            st2.color = c.value;
            renderEditor();
        });
    } else if (st.type === 'arrow' || st.type === 'brush') {
        mk('粗细');
        const n = document.createElement('input');
        n.type = 'number'; n.min = 1; n.max = 200;
        n.value = st.size || 3;
        n.style.width = '54px';
        n.title = '粗细（按回车或确认后生效）';
        box.appendChild(n);
        const px = document.createElement('span'); px.className = 'draw-px'; px.textContent = 'px'; box.appendChild(px);
        n.addEventListener('change', () => {
            const st2 = (s.selectedObj != null && s.strokes[s.selectedObj] && (s.strokes[s.selectedObj].type === 'arrow' || s.strokes[s.selectedObj].type === 'brush')) ? s.strokes[s.selectedObj] : null;
            if (!st2) return;
            const v = parseInt(n.value, 10);
            if (isNaN(v) || v <= 0) { n.value = st2.size; return; }
            pushStrokeUndo();
            st2.size = v;
            renderEditor();
        });
        mk('颜色');
        const c = document.createElement('input');
        c.type = 'color'; c.value = st.color || '#ff0000';
        c.title = '选中对象的颜色';
        box.appendChild(c);
        c.addEventListener('input', () => {
            const st2 = (s.selectedObj != null && s.strokes[s.selectedObj] && (s.strokes[s.selectedObj].type === 'arrow' || s.strokes[s.selectedObj].type === 'brush')) ? s.strokes[s.selectedObj] : null;
            if (!st2) return;
            st2.color = c.value;
            renderEditor();
        });
    }
}
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
drawColor.addEventListener('input', () => {
    editorState.brushColor = drawColor.value;
});
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
// 箭头粗细（与画笔分开）
arrowSize.addEventListener('input', () => {
    editorState.arrowSize = parseInt(arrowSize.value) || 1;
    arrowSizeIn.value = editorState.arrowSize;
});
arrowSizeIn.addEventListener('input', () => {
    let v = parseInt(arrowSizeIn.value);
    if (isNaN(v) || v < 1) v = 1;
    editorState.arrowSize = v;
    arrowSize.value = Math.min(v, parseInt(arrowSize.max) || 40);
});
arrowSizeIn.addEventListener('change', () => {
    let v = parseInt(arrowSizeIn.value);
    if (isNaN(v) || v < 1) v = 1;
    const max = parseInt(arrowSizeIn.max) || 200;
    if (v > max) v = max;
    arrowSizeIn.value = v;
    editorState.arrowSize = v;
    arrowSize.value = Math.min(v, parseInt(arrowSize.max) || 40);
});

// ---- 文字内联编辑：把可编辑文本框覆盖在文字框位置上 ----
let textEditorEl = null;
function ensureTextEditor() {
    if (textEditorEl) return textEditorEl;
    textEditorEl = document.createElement('textarea');
    textEditorEl.style.cssText = 'position:absolute;display:none;resize:none;overflow:hidden;padding:0;margin:0;border:none;outline:none;background:transparent;color:transparent;caret-color:#e91e63;font-family:sans-serif;font-weight:bold;line-height:1.2;z-index:5;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:break-word;text-align:center;';
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
    const fs = (st.fontSize != null ? st.fontSize : st.h * 0.8) * ch;
    ta.value = st.text;
    ta.style.fontSize = Math.max(8, fs) + 'px';
    const sc = s.view.scale;
    const x = s.view.ox + st.x * cw * sc, y = s.view.oy + st.y * ch * sc;
    ta.style.left = x + 'px';
    ta.style.top = y + 'px';
    ta.style.width = (st.w * cw * sc) + 'px';
    ta.style.height = (st.h * ch * sc) + 'px';
    ta.style.color = st.color; // 输入时文字用文字颜色显示，背景透明、有竖线光标，贴近市面编辑软件
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
// 删除选中对象（在输入框 / 编辑框里按键时不做删除，避免误删文字对象）
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const ae = document.activeElement;
        const inField = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
        if (inField) return;
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
    // 缩小下限与打开时的留白比例一致（0.80），保证能缩回四周有空白、便于框选整张图
    ns = Math.max(fitScale * 0.80, Math.min(ns, fitScale * 20));
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


// app-editor-adjust.js —— 旋转/翻转、裁剪、缩放尺寸、调色、像素化
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
    const sr = editorState.activeRegions.length ? editorState.activeRegions : (editorState.activeRegion !== null ? [editorState.activeRegion] : []);
    adjustScope.textContent = sr.length ? `（作用于区域 #${sr.join(',')}）` : '（作用于整张图）';
}
function bindAdjust(slider, num, key) {
    slider.addEventListener('input', () => {
        const v = parseInt(slider.value) || 0;
        adjustTargets(editorState).forEach(t => t[key] = v);
        num.value = v;
        syncAdjustUI();
        renderEditor();
    });
    num.addEventListener('input', () => {
        const v = clampAdjust(num.value);
        if (v === null) return; // 输入中，暂不处理
        adjustTargets(editorState).forEach(t => t[key] = v);
        slider.value = v;
        renderEditor();
    });
    num.addEventListener('change', () => {
        const v = clampAdjust(num.value);
        const val = (v === null) ? 100 : v;
        adjustTargets(editorState).forEach(t => t[key] = val);
        num.value = val;
        slider.value = val;
        renderEditor();
    });
}
bindAdjust(brightnessIn, brightnessNum, 'brightness');
bindAdjust(contrastIn, contrastNum, 'contrast');
bindAdjust(saturationIn, saturationNum, 'saturation');
resetBrightnessBtn.addEventListener('click', () => { adjustTargets(editorState).forEach(t => t.brightness = 100); syncAdjustUI(); renderEditor(); });
resetContrastBtn.addEventListener('click', () => { adjustTargets(editorState).forEach(t => t.contrast = 100); syncAdjustUI(); renderEditor(); });
resetSaturationBtn.addEventListener('click', () => { adjustTargets(editorState).forEach(t => t.saturation = 100); syncAdjustUI(); renderEditor(); });

// ---- 像素化 ----
pixelateIn.addEventListener('input', () => {
    const v = parseInt(pixelateIn.value);
    adjustTargets(editorState).forEach(t => t.pixelate = v);
    pixelVal.textContent = v > 1 ? v + 'px' : '关';
    renderEditor();
});


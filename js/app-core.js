// app-core.js —— 全局状态、DOM 引用、公共基础（需最先加载）

const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const imageUploadArea = document.getElementById('imageUploadArea');
const imageInput = document.getElementById('imageInput');
const downloadEditBtn = document.getElementById('downloadEditBtn');
const maskEditBtn = document.getElementById('maskEditBtn');
const maskPenBtn = document.getElementById('maskPenBtn');
const maskEraseBtn = document.getElementById('maskEraseBtn');
const maskPenSizeIn = document.getElementById('maskPenSizeIn');
const maskEraseSizeIn = document.getElementById('maskEraseSizeIn');
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

// ===== 全局导出保存路径 =====
// 图片编辑器导出、视频帧逐个导出 / 精灵图导出共用；持久化到 localStorage，默认系统下载文件夹
let exportDir = '';
const EXPORT_DIR_KEY = 'vti_export_dir';
function getExportDir() {
    return exportDir || '';
}
function setExportDir(dir) {
    exportDir = dir || '';
    try { localStorage.setItem(EXPORT_DIR_KEY, exportDir); } catch (e) {}
}
function loadExportDir() {
    try { exportDir = localStorage.getItem(EXPORT_DIR_KEY) || ''; } catch (e) { exportDir = ''; }
    return exportDir;
}
// Blob/ArrayBuffer 转 base64（桌面版保存导出文件用）
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => { const s = fr.result; resolve(s.split(',')[1]); };
        fr.onerror = reject;
        fr.readAsDataURL(blob);
    });
}
// 屏幕中央提示（几秒后自动消失）
let toastTimer = null;
function showToast(msg, isError) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg || '';
    t.classList.toggle('toast-error', !!isError);
    t.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.add('hidden'); }, 2500);
}


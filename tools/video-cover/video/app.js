<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#F4F1EA">
<title>视频封面</title>

<script>
(function () {
  const ts = Date.now();
  function withTs(url) { return url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + ts; }
  function loadStyle(href) {
    return new Promise(function (resolve, reject) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = withTs(href);
      l.onload = resolve; l.onerror = function () { reject(new Error('加载失败：' + href)); };
      document.head.appendChild(l);
    });
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script'); s.src = withTs(src);
      s.onload = resolve; s.onerror = function () { reject(new Error('加载失败：' + src)); };
      document.head.appendChild(s);
    });
  }
  window.__bootPromise = (async function () {
    await Promise.all([
      loadScript('../../../shared/ui-icons.js'),
      loadStyle('../../../shared/theme.css'),
      loadStyle('style.css')
    ]);
    await Promise.all([
      loadScript('../../../shared/gi-icons/icon-loader.js'),
      loadScript('../../../shared/gi-icons/icon-dict.js')
    ]);
    await loadScript('app.js');
  })();
})();
</script>

<style>
  body { visibility: hidden; }
  body.ready { visibility: visible; }
  .boot-loading {
    position: fixed; inset: 0; z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-base, #F4F1EA); color: var(--text-tertiary, #A69E95);
    font-size: 13px; font-family: var(--std-font, sans-serif);
    visibility: visible;
  }
  body.ready .boot-loading { display: none; }
</style>
</head>
<body>

<div class="boot-loading">正在载入视频封面…</div>

<div class="video-preview-wrap">
  <div class="preview-frame" id="previewFrame">
    <div id="svgPreviewHost"></div>
    <div class="float-toolbar" id="floatToolbar">
      <button type="button" class="float-btn" id="btnGuides" title="参考线" data-icon="guides"></button>
      <button type="button" class="float-btn" id="btnExportVideo" title="导出配置" data-icon="export"></button>
      <button type="button" class="float-btn" id="btnImportVideo" title="导入配置" data-icon="import"></button>
      <button type="button" class="float-btn float-btn-danger" id="btnClearVideo" title="清空" data-icon="trash"></button>
      <input type="file" id="importVideoInput" accept=".json" class="hidden">
    </div>
  </div>
</div>

<main class="video-form">
  <section>
    <div class="panel-header">字体（仅作用于导出图片）</div>
    <div class="panel">
      <div class="panel-row">
        <div class="font-label" id="labelVideoFont">默认系统字体</div>
        <button type="button" class="btn-sm btn-primary" onclick="App.openFontPicker()">选择字体</button>
      </div>
    </div>
  </section>

  <section>
    <div class="panel-header">游戏 Logo</div>
    <div class="panel">
      <div class="panel-row">
        <img id="logoThumb" class="clickable-thumb" alt="">
        <select id="logoSelect"></select>
      </div>
    </div>
  </section>

  <section>
    <div class="panel-header">画布背景</div>
    <div class="panel">
      <div class="panel-row upload-row" onclick="document.getElementById('bgFile').click()">
        <img id="bgThumb" class="clickable-thumb" alt="">
        <div class="flex-1">
          <div class="upload-text" id="bgFileName">点击上传背景图</div>
        </div>
        <input type="file" id="bgFile" accept="image/*" class="hidden">
      </div>
      <div class="control-item row-pad">
        <div class="control-header"><span>背景亮度</span></div>
        <div class="slider-row">
          <input type="range" id="midBrightness" min="-100" max="100" value="-50" oninput="App.syncVal('midBrightness', this.value)">
          <div class="num-box"><input type="number" id="midBrightnessInput" min="-100" max="100" value="-50" oninput="App.syncVal('midBrightness', this.value)"><span class="unit-tag">%</span></div>
        </div>
      </div>
      <div class="control-item row-pad">
        <div class="control-header"><span>背景模糊</span></div>
        <div class="slider-row">
          <input type="range" id="midBlur" min="0" max="100" value="50" oninput="App.syncVal('midBlur', this.value)">
          <div class="num-box"><input type="number" id="midBlurInput" min="0" max="100" value="50" oninput="App.syncVal('midBlur', this.value)"><span class="unit-tag">%</span></div>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="panel-header">攻略模式</div>
    <div class="tab-bar">
      <button type="button" class="tab-btn active" data-type="character" onclick="App.setGuideType('character')">角色攻略</button>
      <button type="button" class="tab-btn" data-type="boss" onclick="App.setGuideType('boss')">Boss攻略</button>
      <button type="button" class="tab-btn" data-type="custom" onclick="App.setGuideType('custom')">自定义</button>
    </div>

    <div id="characterPanel" class="panel">
      <div class="control-item row-pad">
        <div class="control-header"><span>立绘 X 位置</span></div>
        <div class="slider-row">
          <input type="range" id="characterX" min="0" max="3840" value="2650" oninput="App.syncVal('characterX', this.value)">
          <div class="num-box"><input type="number" id="characterXInput" min="0" max="3840" value="2650" oninput="App.syncVal('characterX', this.value)"><span class="unit-tag">px</span></div>
        </div>
      </div>
    </div>

    <div id="customPanel" class="panel hidden">
      <div class="panel-row custom-head">
        <span class="custom-head-label">浮动素材</span>
        <button type="button" class="btn-xs btn-primary" onclick="App.addFloat()">
          <span class="icon-slot" data-icon="plus"></span>
          <span class="btn-text">添加素材</span>
        </button>
      </div>
      <div id="floatList" class="float-list row-pad"></div>
    </div>
  </section>

  <section id="capSection">
    <div class="panel-header">胶囊标签</div>
    <div class="panel">
      <label class="field row-pad">标签文字
        <input type="text" id="capTextInput" placeholder="如：攻略 / 速刷" oninput="App.set('capText', this.value)">
      </label>
      <div class="control-item row-pad">
        <div class="control-header"><span>文字亮度</span></div>
        <div class="slider-row">
          <input type="range" id="capTextBrightness" min="0" max="200" value="100" oninput="App.syncVal('capTextBrightness', this.value)">
          <div class="num-box"><input type="number" id="capTextBrightnessInput" min="0" max="200" value="100" oninput="App.syncVal('capTextBrightness', this.value)"><span class="unit-tag">%</span></div>
        </div>
      </div>
    </div>
  </section>

  <section id="mainSection">
    <div class="panel-header">主标题</div>
    <div class="panel">
      <label class="field row-pad">
        <textarea id="mainTextInput" rows="2" placeholder="输入主标题（支持回车两行）" oninput="App.set('mainText', this.value)"></textarea>
      </label>
    </div>
  </section>

  <section>
    <div class="panel-header">副标题</div>
    <div class="panel">
      <label class="field row-pad">
        <span id="sub1Label">第一行</span>
        <input type="text" id="sub1Input" placeholder="第一行文字" oninput="App.onSub1Input(this.value)" onblur="App.onSub1Blur(this.value)">
      </label>
      <label class="field row-pad hidden" id="sub1SizeRow">
        字号
        <select id="sub1Select" onchange="App.setSubSize(1, this.value)">
          <option value="200">小字号</option>
          <option value="250">大字号</option>
        </select>
      </label>
      <label class="field row-pad">
        <span id="sub2Label">第二行</span>
        <input type="text" id="sub2Input" placeholder="第二行文字" oninput="App.onSub2Input(this.value)" onblur="App.onSub2Blur(this.value)">
      </label>
      <label class="field row-pad hidden" id="sub2SizeRow">
        字号
        <select id="sub2Select" onchange="App.setSubSize(2, this.value)">
          <option value="200">小字号</option>
          <option value="250">大字号</option>
        </select>
      </label>
    </div>
  </section>
</main>

<div class="bottom-dock">
  <button class="export-btn-main" onclick="App.exportPNG()">导出图片</button>
</div>

<div class="tab-sheet-backdrop" id="fontSheetBackdrop" onclick="App.closeFontPicker()"></div>
<div class="tab-sheet" id="fontSheet">
  <div class="tab-sheet-handle"></div>
  <div class="tab-sheet-header">选择字体</div>
  <div class="tab-sheet-list" id="fontSheetList"></div>
</div>

<div class="toast-container" id="toastContainer"></div>
<div class="modal-backdrop" id="modalBackdrop">
  <div class="modal-box">
    <div class="modal-title" id="modalTitle">提示</div>
    <div class="modal-message" id="modalMessage"></div>
    <div class="modal-actions">
      <button type="button" id="modalCancel">取消</button>
      <button type="button" class="btn-primary" id="modalConfirm">确定</button>
    </div>
  </div>
</div>

</body>
</html>

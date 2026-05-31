import { b as create_ssr_component, d as escape, c as createEventDispatcher, a as add_attribute, e as each, o as onDestroy, v as validate_component } from "../../chunks/ssr.js";
import "y-protocols/awareness";
import "phoenix";
import "y-protocols/sync";
import { EditorView } from "@codemirror/view";
import * as Y from "yjs";
import { diffLines } from "diff";
EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#1e1e1e",
    color: "#d4d4d4",
    contain: "strict"
  },
  ".cm-content": {
    caretColor: "#ffffff",
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
    fontSize: "14px",
    lineHeight: "1.6",
    padding: "8px 0"
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#ffffff",
    borderLeftWidth: "2px",
    marginLeft: "-1px"
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "#264f78"
  },
  ".cm-gutters": {
    backgroundColor: "#252526",
    color: "#858585",
    border: "none",
    borderRight: "1px solid #3e3e42"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#2a2d2e",
    color: "#c6c6c6"
  },
  ".cm-activeLine": {
    backgroundColor: "#2a2d2e"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 8px",
    minWidth: "40px",
    textAlign: "right"
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "#888"
  },
  ".cm-tooltip": {
    backgroundColor: "#252526",
    border: "1px solid #454545"
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: "#04395e",
      color: "#ffffff"
    }
  },
  ".cm-ySelection": {
    caretColor: "var(--y-caret-color)",
    position: "relative"
  },
  ".cm-ySelectionCaret": {
    position: "relative",
    borderLeft: "2px solid var(--y-caret-color)",
    marginLeft: "-1px",
    animation: "cm-y-blink 1s steps(1) infinite"
  },
  "@keyframes cm-y-blink": {
    "50%": { opacity: "0" }
  },
  ".cm-ySelectionInfo": {
    position: "absolute",
    top: "-1.2em",
    left: "0",
    backgroundColor: "var(--y-caret-color)",
    color: "white",
    fontSize: "0.75em",
    padding: "1px 4px",
    borderRadius: "3px 3px 3px 0",
    whiteSpace: "nowrap",
    opacity: "0.9",
    zIndex: "1000",
    pointerEvents: "none"
  }
}, { dark: true });
const css$4 = {
  code: ".status-bar.svelte-14mhhzr{display:flex;justify-content:space-between;align-items:center;padding:6px 16px;background-color:#007acc;color:white;font-size:12px;flex-shrink:0}.status-left.svelte-14mhhzr{display:flex;align-items:center;gap:8px}.status-indicator.svelte-14mhhzr{width:10px;height:10px;border-radius:50%;box-shadow:0 0 4px currentColor}.status-text.svelte-14mhhzr{font-weight:500}.offline-hint.svelte-14mhhzr{opacity:0.8;font-style:italic}.status-right.svelte-14mhhzr{display:flex;align-items:center;gap:16px}.doc-info.svelte-14mhhzr,.storage-info.svelte-14mhhzr{opacity:0.9}",
  map: '{"version":3,"file":"StatusBar.svelte","sources":["StatusBar.svelte"],"sourcesContent":["<script lang=\\"ts\\">export let connectionState;\\nexport let docId;\\n$: statusText = getStatusText(connectionState);\\n$: statusColor = getStatusColor(connectionState);\\nfunction getStatusText(state) {\\n  if (!state.isOnline) {\\n    return \\"\\\\u79BB\\\\u7EBF\\";\\n  }\\n  if (state.isConnected && state.isSynced) {\\n    return \\"\\\\u5DF2\\\\u8FDE\\\\u63A5 \\\\xB7 \\\\u5DF2\\\\u540C\\\\u6B65\\";\\n  }\\n  if (state.isConnected && !state.isSynced) {\\n    return \\"\\\\u5DF2\\\\u8FDE\\\\u63A5 \\\\xB7 \\\\u540C\\\\u6B65\\\\u4E2D...\\";\\n  }\\n  if (!state.isConnected && state.isOnline) {\\n    return \\"\\\\u8FDE\\\\u63A5\\\\u4E2D...\\";\\n  }\\n  return \\"\\\\u5DF2\\\\u65AD\\\\u5F00\\";\\n}\\nfunction getStatusColor(state) {\\n  if (!state.isOnline) {\\n    return \\"#f44747\\";\\n  }\\n  if (state.isConnected && state.isSynced) {\\n    return \\"#89d185\\";\\n  }\\n  if (state.isConnected && !state.isSynced) {\\n    return \\"#cca700\\";\\n  }\\n  return \\"#f44747\\";\\n}\\n<\/script>\\r\\n\\r\\n<footer class=\\"status-bar\\">\\r\\n  <div class=\\"status-left\\">\\r\\n    <span class=\\"status-indicator\\" style=\\"background-color: {statusColor}\\"></span>\\r\\n    <span class=\\"status-text\\">{statusText}</span>\\r\\n    {#if !connectionState.isOnline}\\r\\n      <span class=\\"offline-hint\\">（编辑内容将在网络恢复后自动同步）</span>\\r\\n    {/if}\\r\\n  </div>\\r\\n  <div class=\\"status-right\\">\\r\\n    <span class=\\"doc-info\\">📄 {docId}</span>\\r\\n    <span class=\\"storage-info\\">💾 IndexedDB 本地存储</span>\\r\\n  </div>\\r\\n</footer>\\r\\n\\r\\n<style scoped>\\r\\n  .status-bar {\\r\\n    display: flex;\\r\\n    justify-content: space-between;\\r\\n    align-items: center;\\r\\n    padding: 6px 16px;\\r\\n    background-color: #007acc;\\r\\n    color: white;\\r\\n    font-size: 12px;\\r\\n    flex-shrink: 0;\\r\\n  }\\r\\n\\r\\n  .status-left {\\r\\n    display: flex;\\r\\n    align-items: center;\\r\\n    gap: 8px;\\r\\n  }\\r\\n\\r\\n  .status-indicator {\\r\\n    width: 10px;\\r\\n    height: 10px;\\r\\n    border-radius: 50%;\\r\\n    box-shadow: 0 0 4px currentColor;\\r\\n  }\\r\\n\\r\\n  .status-text {\\r\\n    font-weight: 500;\\r\\n  }\\r\\n\\r\\n  .offline-hint {\\r\\n    opacity: 0.8;\\r\\n    font-style: italic;\\r\\n  }\\r\\n\\r\\n  .status-right {\\r\\n    display: flex;\\r\\n    align-items: center;\\r\\n    gap: 16px;\\r\\n  }\\r\\n\\r\\n  .doc-info,\\r\\n  .storage-info {\\r\\n    opacity: 0.9;\\r\\n  }\\r\\n</style>\\r\\n"],"names":[],"mappings":"AAgDE,0BAAY,CACV,OAAO,CAAE,IAAI,CACb,eAAe,CAAE,aAAa,CAC9B,WAAW,CAAE,MAAM,CACnB,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,gBAAgB,CAAE,OAAO,CACzB,KAAK,CAAE,KAAK,CACZ,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,CACf,CAEA,2BAAa,CACX,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,GAAG,CAAE,GACP,CAEA,gCAAkB,CAChB,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,aAAa,CAAE,GAAG,CAClB,UAAU,CAAE,CAAC,CAAC,CAAC,CAAC,GAAG,CAAC,YACtB,CAEA,2BAAa,CACX,WAAW,CAAE,GACf,CAEA,4BAAc,CACZ,OAAO,CAAE,GAAG,CACZ,UAAU,CAAE,MACd,CAEA,4BAAc,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,GAAG,CAAE,IACP,CAEA,wBAAS,CACT,4BAAc,CACZ,OAAO,CAAE,GACX"}'
};
function getStatusText(state) {
  if (!state.isOnline) {
    return "离线";
  }
  if (state.isConnected && state.isSynced) {
    return "已连接 · 已同步";
  }
  if (state.isConnected && !state.isSynced) {
    return "已连接 · 同步中...";
  }
  if (!state.isConnected && state.isOnline) {
    return "连接中...";
  }
  return "已断开";
}
function getStatusColor(state) {
  if (!state.isOnline) {
    return "#f44747";
  }
  if (state.isConnected && state.isSynced) {
    return "#89d185";
  }
  if (state.isConnected && !state.isSynced) {
    return "#cca700";
  }
  return "#f44747";
}
const StatusBar = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let statusText;
  let statusColor;
  let { connectionState } = $$props;
  let { docId } = $$props;
  if ($$props.connectionState === void 0 && $$bindings.connectionState && connectionState !== void 0) $$bindings.connectionState(connectionState);
  if ($$props.docId === void 0 && $$bindings.docId && docId !== void 0) $$bindings.docId(docId);
  $$result.css.add(css$4);
  statusText = getStatusText(connectionState);
  statusColor = getStatusColor(connectionState);
  return `<footer class="status-bar svelte-14mhhzr"><div class="status-left svelte-14mhhzr"><span class="status-indicator svelte-14mhhzr" style="${"background-color: " + escape(statusColor, true)}"></span> <span class="status-text svelte-14mhhzr">${escape(statusText)}</span> ${!connectionState.isOnline ? `<span class="offline-hint svelte-14mhhzr" data-svelte-h="svelte-tupmdb">（编辑内容将在网络恢复后自动同步）</span>` : ``}</div> <div class="status-right svelte-14mhhzr"><span class="doc-info svelte-14mhhzr">📄 ${escape(docId)}</span> <span class="storage-info svelte-14mhhzr" data-svelte-h="svelte-h79vpp">💾 IndexedDB 本地存储</span></div> </footer>`;
});
const css$3 = {
  code: ".language-selector.svelte-nyxnv8.svelte-nyxnv8{display:flex;align-items:center;gap:8px}.language-label.svelte-nyxnv8.svelte-nyxnv8{font-size:13px;color:#ccc}.language-select.svelte-nyxnv8.svelte-nyxnv8{padding:6px 12px;background-color:#3c3c3c;color:#d4d4d4;border:1px solid #555;border-radius:4px;font-size:13px;cursor:pointer;outline:none}.language-select.svelte-nyxnv8.svelte-nyxnv8:hover{background-color:#454545}.language-select.svelte-nyxnv8.svelte-nyxnv8:focus{border-color:#0e639c}.language-select.svelte-nyxnv8 option.svelte-nyxnv8{background-color:#252526;color:#d4d4d4}",
  map: '{"version":3,"file":"LanguageSelector.svelte","sources":["LanguageSelector.svelte"],"sourcesContent":["<script lang=\\"ts\\">import { createEventDispatcher } from \\"svelte\\";\\nexport let current;\\nconst dispatch = createEventDispatcher();\\nconst languages = [\\n  { value: \\"javascript\\", label: \\"JavaScript\\" },\\n  { value: \\"typescript\\", label: \\"TypeScript\\" },\\n  { value: \\"python\\", label: \\"Python\\" },\\n  { value: \\"html\\", label: \\"HTML\\" },\\n  { value: \\"css\\", label: \\"CSS\\" },\\n  { value: \\"plaintext\\", label: \\"\\\\u7EAF\\\\u6587\\\\u672C\\" }\\n];\\nfunction handleChange(event) {\\n  const target = event.target;\\n  dispatch(\\"change\\", target.value);\\n}\\n<\/script>\\r\\n\\r\\n<div class=\\"language-selector\\">\\r\\n  <label for=\\"language\\" class=\\"language-label\\">语言:</label>\\r\\n  <select id=\\"language\\" value={current} on:change={handleChange} class=\\"language-select\\">\\r\\n    {#each languages as lang}\\r\\n      <option value={lang.value} selected={lang.value === current}>\\r\\n        {lang.label}\\r\\n      </option>\\r\\n    {/each}\\r\\n  </select>\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .language-selector {\\r\\n    display: flex;\\r\\n    align-items: center;\\r\\n    gap: 8px;\\r\\n  }\\r\\n\\r\\n  .language-label {\\r\\n    font-size: 13px;\\r\\n    color: #ccc;\\r\\n  }\\r\\n\\r\\n  .language-select {\\r\\n    padding: 6px 12px;\\r\\n    background-color: #3c3c3c;\\r\\n    color: #d4d4d4;\\r\\n    border: 1px solid #555;\\r\\n    border-radius: 4px;\\r\\n    font-size: 13px;\\r\\n    cursor: pointer;\\r\\n    outline: none;\\r\\n  }\\r\\n\\r\\n  .language-select:hover {\\r\\n    background-color: #454545;\\r\\n  }\\r\\n\\r\\n  .language-select:focus {\\r\\n    border-color: #0e639c;\\r\\n  }\\r\\n\\r\\n  .language-select option {\\r\\n    background-color: #252526;\\r\\n    color: #d4d4d4;\\r\\n  }\\r\\n</style>\\r\\n"],"names":[],"mappings":"AA6BE,8CAAmB,CACjB,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,GAAG,CAAE,GACP,CAEA,2CAAgB,CACd,SAAS,CAAE,IAAI,CACf,KAAK,CAAE,IACT,CAEA,4CAAiB,CACf,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,gBAAgB,CAAE,OAAO,CACzB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,IAAI,CACtB,aAAa,CAAE,GAAG,CAClB,SAAS,CAAE,IAAI,CACf,MAAM,CAAE,OAAO,CACf,OAAO,CAAE,IACX,CAEA,4CAAgB,MAAO,CACrB,gBAAgB,CAAE,OACpB,CAEA,4CAAgB,MAAO,CACrB,YAAY,CAAE,OAChB,CAEA,8BAAgB,CAAC,oBAAO,CACtB,gBAAgB,CAAE,OAAO,CACzB,KAAK,CAAE,OACT"}'
};
const LanguageSelector = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { current } = $$props;
  createEventDispatcher();
  const languages = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "python", label: "Python" },
    { value: "html", label: "HTML" },
    { value: "css", label: "CSS" },
    {
      value: "plaintext",
      label: "纯文本"
    }
  ];
  if ($$props.current === void 0 && $$bindings.current && current !== void 0) $$bindings.current(current);
  $$result.css.add(css$3);
  return `<div class="language-selector svelte-nyxnv8"><label for="language" class="language-label svelte-nyxnv8" data-svelte-h="svelte-s7rtp9">语言:</label> <select id="language"${add_attribute("value", current, 0)} class="language-select svelte-nyxnv8">${each(languages, (lang) => {
    return `<option${add_attribute("value", lang.value, 0)} ${lang.value === current ? "selected" : ""} class="svelte-nyxnv8">${escape(lang.label)} </option>`;
  })}</select> </div>`;
});
const css$2 = {
  code: ".sidebar.svelte-19d5d06.svelte-19d5d06{position:fixed;top:0;right:0;width:320px;height:100vh;background-color:#252526;border-left:1px solid #3e3e42;display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.3s ease;z-index:1000}.sidebar.open.svelte-19d5d06.svelte-19d5d06{transform:translateX(0)}.sidebar-header.svelte-19d5d06.svelte-19d5d06{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #3e3e42;flex-shrink:0}.sidebar-title.svelte-19d5d06.svelte-19d5d06{margin:0;font-size:16px;color:#ffffff}.sidebar-actions.svelte-19d5d06.svelte-19d5d06{display:flex;gap:8px}.refresh-btn.svelte-19d5d06.svelte-19d5d06,.close-btn.svelte-19d5d06.svelte-19d5d06{width:28px;height:28px;display:flex;align-items:center;justify-content:center;background-color:#3e3e42;border:none;border-radius:4px;color:#d4d4d4;cursor:pointer;font-size:14px;transition:background-color 0.2s}.refresh-btn.svelte-19d5d06.svelte-19d5d06:hover,.close-btn.svelte-19d5d06.svelte-19d5d06:hover{background-color:#0e639c}.refresh-btn.svelte-19d5d06.svelte-19d5d06:disabled{opacity:0.5;cursor:not-allowed}.sidebar-content.svelte-19d5d06.svelte-19d5d06{flex:1;overflow-y:auto}.loading.svelte-19d5d06.svelte-19d5d06,.empty.svelte-19d5d06.svelte-19d5d06{padding:24px 16px;text-align:center;color:#888}.error.svelte-19d5d06.svelte-19d5d06{padding:24px 16px;text-align:center;color:#f48771}.retry-btn.svelte-19d5d06.svelte-19d5d06{margin-top:12px;padding:6px 16px;background-color:#0e639c;border:none;border-radius:4px;color:white;cursor:pointer}.version-list.svelte-19d5d06.svelte-19d5d06{padding:8px}.version-item.svelte-19d5d06.svelte-19d5d06{padding:12px;margin-bottom:4px;background-color:#2d2d30;border-radius:4px;cursor:pointer;transition:background-color 0.2s}.version-item.svelte-19d5d06.svelte-19d5d06:hover{background-color:#3e3e42}.version-item.selected.svelte-19d5d06.svelte-19d5d06{background-color:#0e639c;outline:2px solid #1177bb}.version-header.svelte-19d5d06.svelte-19d5d06{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.version-number.svelte-19d5d06.svelte-19d5d06{font-weight:600;color:#ffffff;font-size:14px}.version-client.svelte-19d5d06.svelte-19d5d06{font-size:12px;color:#888;background-color:#3e3e42;padding:2px 6px;border-radius:3px}.version-item.selected.svelte-19d5d06 .version-client.svelte-19d5d06{background-color:rgba(255, 255, 255, 0.2);color:#d4d4d4}.version-time.svelte-19d5d06.svelte-19d5d06{font-size:12px;color:#888}.version-item.selected.svelte-19d5d06 .version-time.svelte-19d5d06{color:#d4d4d4}",
  map: `{"version":3,"file":"VersionHistorySidebar.svelte","sources":["VersionHistorySidebar.svelte"],"sourcesContent":["<script lang=\\"ts\\">import { createEventDispatcher, onMount } from \\"svelte\\";\\nexport let docId;\\nexport let isOpen;\\nexport let selectedVersion = null;\\nconst dispatch = createEventDispatcher();\\nlet versions = [];\\nlet loading = false;\\nlet error = null;\\nasync function loadVersions() {\\n  if (!docId) return;\\n  loading = true;\\n  error = null;\\n  try {\\n    const response = await fetch(\`http://localhost:4000/api/docs/\${docId}/versions?limit=50\`);\\n    if (!response.ok) {\\n      throw new Error(\`HTTP \${response.status}\`);\\n    }\\n    const data = await response.json();\\n    versions = data.versions || [];\\n  } catch (e) {\\n    error = e.message;\\n    console.error(\\"[VersionHistory] Failed to load versions:\\", e);\\n  } finally {\\n    loading = false;\\n  }\\n}\\nfunction selectVersion(version) {\\n  selectedVersion = version.version;\\n  dispatch(\\"select\\", version);\\n}\\nfunction closeSidebar() {\\n  dispatch(\\"close\\");\\n}\\nfunction refresh() {\\n  loadVersions();\\n}\\n$: if (isOpen && docId) {\\n  loadVersions();\\n}\\nfunction formatDate(isoString) {\\n  const date = new Date(isoString);\\n  return date.toLocaleString(\\"zh-CN\\", {\\n    year: \\"numeric\\",\\n    month: \\"2-digit\\",\\n    day: \\"2-digit\\",\\n    hour: \\"2-digit\\",\\n    minute: \\"2-digit\\",\\n    second: \\"2-digit\\"\\n  });\\n}\\nfunction formatClientId(clientId) {\\n  if (!clientId) return \\"Unknown\\";\\n  if (clientId.startsWith(\\"elixir-\\")) {\\n    return \\"Server\\";\\n  }\\n  if (clientId.startsWith(\\"user-\\")) {\\n    return clientId.substring(5, 13).toUpperCase();\\n  }\\n  return clientId.substring(0, 8).toUpperCase();\\n}\\n<\/script>\\r\\n\\r\\n<div class=\\"sidebar {isOpen ? 'open' : ''}\\">\\r\\n  <div class=\\"sidebar-header\\">\\r\\n    <h3 class=\\"sidebar-title\\">📜 历史版本</h3>\\r\\n    <div class=\\"sidebar-actions\\">\\r\\n      <button class=\\"refresh-btn\\" on:click={refresh} disabled={loading} title=\\"刷新\\">\\r\\n        🔄\\r\\n      </button>\\r\\n      <button class=\\"close-btn\\" on:click={closeSidebar}>✕</button>\\r\\n    </div>\\r\\n  </div>\\r\\n\\r\\n  <div class=\\"sidebar-content\\">\\r\\n    {#if loading}\\r\\n      <div class=\\"loading\\">加载中...</div>\\r\\n    {:else if error}\\r\\n      <div class=\\"error\\">\\r\\n        加载失败: {error}\\r\\n        <button class=\\"retry-btn\\" on:click={loadVersions}>重试</button>\\r\\n      </div>\\r\\n    {:else if versions.length === 0}\\r\\n      <div class=\\"empty\\">暂无历史版本</div>\\r\\n    {:else}\\r\\n      <div class=\\"version-list\\">\\r\\n        {#each versions as version}\\r\\n          <div\\r\\n            class=\\"version-item {selectedVersion === version.version ? 'selected' : ''}\\"\\r\\n            on:click={() => selectVersion(version)}\\r\\n          >\\r\\n            <div class=\\"version-header\\">\\r\\n              <span class=\\"version-number\\">v{version.version}</span>\\r\\n              <span class=\\"version-client\\">{formatClientId(version.client_id)}</span>\\r\\n            </div>\\r\\n            <div class=\\"version-time\\">{formatDate(version.inserted_at)}</div>\\r\\n          </div>\\r\\n        {/each}\\r\\n      </div>\\r\\n    {/if}\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style scoped>\\r\\n  .sidebar {\\r\\n    position: fixed;\\r\\n    top: 0;\\r\\n    right: 0;\\r\\n    width: 320px;\\r\\n    height: 100vh;\\r\\n    background-color: #252526;\\r\\n    border-left: 1px solid #3e3e42;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    transform: translateX(100%);\\r\\n    transition: transform 0.3s ease;\\r\\n    z-index: 1000;\\r\\n  }\\r\\n\\r\\n  .sidebar.open {\\r\\n    transform: translateX(0);\\r\\n  }\\r\\n\\r\\n  .sidebar-header {\\r\\n    display: flex;\\r\\n    justify-content: space-between;\\r\\n    align-items: center;\\r\\n    padding: 16px;\\r\\n    border-bottom: 1px solid #3e3e42;\\r\\n    flex-shrink: 0;\\r\\n  }\\r\\n\\r\\n  .sidebar-title {\\r\\n    margin: 0;\\r\\n    font-size: 16px;\\r\\n    color: #ffffff;\\r\\n  }\\r\\n\\r\\n  .sidebar-actions {\\r\\n    display: flex;\\r\\n    gap: 8px;\\r\\n  }\\r\\n\\r\\n  .refresh-btn,\\r\\n  .close-btn {\\r\\n    width: 28px;\\r\\n    height: 28px;\\r\\n    display: flex;\\r\\n    align-items: center;\\r\\n    justify-content: center;\\r\\n    background-color: #3e3e42;\\r\\n    border: none;\\r\\n    border-radius: 4px;\\r\\n    color: #d4d4d4;\\r\\n    cursor: pointer;\\r\\n    font-size: 14px;\\r\\n    transition: background-color 0.2s;\\r\\n  }\\r\\n\\r\\n  .refresh-btn:hover,\\r\\n  .close-btn:hover {\\r\\n    background-color: #0e639c;\\r\\n  }\\r\\n\\r\\n  .refresh-btn:disabled {\\r\\n    opacity: 0.5;\\r\\n    cursor: not-allowed;\\r\\n  }\\r\\n\\r\\n  .sidebar-content {\\r\\n    flex: 1;\\r\\n    overflow-y: auto;\\r\\n  }\\r\\n\\r\\n  .loading,\\r\\n  .empty {\\r\\n    padding: 24px 16px;\\r\\n    text-align: center;\\r\\n    color: #888;\\r\\n  }\\r\\n\\r\\n  .error {\\r\\n    padding: 24px 16px;\\r\\n    text-align: center;\\r\\n    color: #f48771;\\r\\n  }\\r\\n\\r\\n  .retry-btn {\\r\\n    margin-top: 12px;\\r\\n    padding: 6px 16px;\\r\\n    background-color: #0e639c;\\r\\n    border: none;\\r\\n    border-radius: 4px;\\r\\n    color: white;\\r\\n    cursor: pointer;\\r\\n  }\\r\\n\\r\\n  .version-list {\\r\\n    padding: 8px;\\r\\n  }\\r\\n\\r\\n  .version-item {\\r\\n    padding: 12px;\\r\\n    margin-bottom: 4px;\\r\\n    background-color: #2d2d30;\\r\\n    border-radius: 4px;\\r\\n    cursor: pointer;\\r\\n    transition: background-color 0.2s;\\r\\n  }\\r\\n\\r\\n  .version-item:hover {\\r\\n    background-color: #3e3e42;\\r\\n  }\\r\\n\\r\\n  .version-item.selected {\\r\\n    background-color: #0e639c;\\r\\n    outline: 2px solid #1177bb;\\r\\n  }\\r\\n\\r\\n  .version-header {\\r\\n    display: flex;\\r\\n    justify-content: space-between;\\r\\n    align-items: center;\\r\\n    margin-bottom: 4px;\\r\\n  }\\r\\n\\r\\n  .version-number {\\r\\n    font-weight: 600;\\r\\n    color: #ffffff;\\r\\n    font-size: 14px;\\r\\n  }\\r\\n\\r\\n  .version-client {\\r\\n    font-size: 12px;\\r\\n    color: #888;\\r\\n    background-color: #3e3e42;\\r\\n    padding: 2px 6px;\\r\\n    border-radius: 3px;\\r\\n  }\\r\\n\\r\\n  .version-item.selected .version-client {\\r\\n    background-color: rgba(255, 255, 255, 0.2);\\r\\n    color: #d4d4d4;\\r\\n  }\\r\\n\\r\\n  .version-time {\\r\\n    font-size: 12px;\\r\\n    color: #888;\\r\\n  }\\r\\n\\r\\n  .version-item.selected .version-time {\\r\\n    color: #d4d4d4;\\r\\n  }\\r\\n</style>\\r\\n"],"names":[],"mappings":"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"}`
};
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
function formatClientId(clientId) {
  if (!clientId) return "Unknown";
  if (clientId.startsWith("elixir-")) {
    return "Server";
  }
  if (clientId.startsWith("user-")) {
    return clientId.substring(5, 13).toUpperCase();
  }
  return clientId.substring(0, 8).toUpperCase();
}
const VersionHistorySidebar = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { docId } = $$props;
  let { isOpen } = $$props;
  let { selectedVersion = null } = $$props;
  createEventDispatcher();
  let versions = [];
  let loading = false;
  let error = null;
  async function loadVersions() {
    if (!docId) return;
    loading = true;
    error = null;
    try {
      const response = await fetch(`http://localhost:4000/api/docs/${docId}/versions?limit=50`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      versions = data.versions || [];
    } catch (e) {
      error = e.message;
      console.error("[VersionHistory] Failed to load versions:", e);
    } finally {
      loading = false;
    }
  }
  if ($$props.docId === void 0 && $$bindings.docId && docId !== void 0) $$bindings.docId(docId);
  if ($$props.isOpen === void 0 && $$bindings.isOpen && isOpen !== void 0) $$bindings.isOpen(isOpen);
  if ($$props.selectedVersion === void 0 && $$bindings.selectedVersion && selectedVersion !== void 0) $$bindings.selectedVersion(selectedVersion);
  $$result.css.add(css$2);
  {
    if (isOpen && docId) {
      loadVersions();
    }
  }
  return `<div class="${"sidebar " + escape(isOpen ? "open" : "", true) + " svelte-19d5d06"}"><div class="sidebar-header svelte-19d5d06"><h3 class="sidebar-title svelte-19d5d06" data-svelte-h="svelte-497t0f">📜 历史版本</h3> <div class="sidebar-actions svelte-19d5d06"><button class="refresh-btn svelte-19d5d06" ${loading ? "disabled" : ""} title="刷新">🔄</button> <button class="close-btn svelte-19d5d06" data-svelte-h="svelte-1y3hq4r">✕</button></div></div> <div class="sidebar-content svelte-19d5d06">${loading ? `<div class="loading svelte-19d5d06" data-svelte-h="svelte-kabxjd">加载中...</div>` : `${error ? `<div class="error svelte-19d5d06">加载失败: ${escape(error)} <button class="retry-btn svelte-19d5d06" data-svelte-h="svelte-1lqu0rz">重试</button></div>` : `${versions.length === 0 ? `<div class="empty svelte-19d5d06" data-svelte-h="svelte-639apo">暂无历史版本</div>` : `<div class="version-list svelte-19d5d06">${each(versions, (version) => {
    return `<div class="${"version-item " + escape(selectedVersion === version.version ? "selected" : "", true) + " svelte-19d5d06"}"><div class="version-header svelte-19d5d06"><span class="version-number svelte-19d5d06">v${escape(version.version)}</span> <span class="version-client svelte-19d5d06">${escape(formatClientId(version.client_id))}</span></div> <div class="version-time svelte-19d5d06">${escape(formatDate(version.inserted_at))}</div> </div>`;
  })}</div>`}`}`}</div> </div>`;
});
const css$1 = {
  code: ".modal-overlay.svelte-yez7mn.svelte-yez7mn{position:fixed;top:0;left:0;right:0;bottom:0;background-color:rgba(0, 0, 0, 0.7);display:flex;align-items:center;justify-content:center;z-index:2000}.modal.svelte-yez7mn.svelte-yez7mn{width:90%;max-width:1000px;max-height:85vh;background-color:#252526;border-radius:8px;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0, 0, 0, 0.5)}.modal-header.svelte-yez7mn.svelte-yez7mn{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #3e3e42;flex-shrink:0}.modal-title.svelte-yez7mn.svelte-yez7mn{margin:0;font-size:18px;color:#ffffff;display:flex;align-items:center;gap:12px}.version-badge.svelte-yez7mn.svelte-yez7mn{font-size:14px;font-weight:normal;background-color:#0e639c;padding:2px 10px;border-radius:12px}.close-btn.svelte-yez7mn.svelte-yez7mn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background-color:#3e3e42;border:none;border-radius:4px;color:#d4d4d4;cursor:pointer;font-size:16px;transition:background-color 0.2s}.close-btn.svelte-yez7mn.svelte-yez7mn:hover{background-color:#4e4e52}.modal-body.svelte-yez7mn.svelte-yez7mn{flex:1;overflow:hidden;display:flex;flex-direction:column;padding:16px 20px}.loading.svelte-yez7mn.svelte-yez7mn{padding:40px;text-align:center;color:#888}.error.svelte-yez7mn.svelte-yez7mn{padding:40px;text-align:center;color:#f48771}.retry-btn.svelte-yez7mn.svelte-yez7mn{margin-top:12px;padding:8px 20px;background-color:#0e639c;border:none;border-radius:4px;color:white;cursor:pointer}.diff-stats.svelte-yez7mn.svelte-yez7mn{display:flex;gap:20px;padding:12px 16px;background-color:#2d2d30;border-radius:4px;margin-bottom:12px;flex-shrink:0}.stat.svelte-yez7mn.svelte-yez7mn{font-size:14px;font-weight:500}.stat.added.svelte-yez7mn.svelte-yez7mn{color:#89ca78}.stat.removed.svelte-yez7mn.svelte-yez7mn{color:#f48771}.diff-container.svelte-yez7mn.svelte-yez7mn{flex:1;overflow:auto;background-color:#1e1e1e;border-radius:4px}.diff-content.svelte-yez7mn.svelte-yez7mn{padding:8px 0;font-family:'Fira Code', 'Consolas', 'Monaco', monospace;font-size:13px;line-height:1.5}.diff-line.svelte-yez7mn.svelte-yez7mn{display:flex;padding:0 12px}.diff-line.svelte-yez7mn.svelte-yez7mn:hover{background-color:rgba(255, 255, 255, 0.05)}.diff-line.added.svelte-yez7mn.svelte-yez7mn{background-color:rgba(137, 202, 120, 0.15)}.diff-line.removed.svelte-yez7mn.svelte-yez7mn{background-color:rgba(244, 135, 113, 0.15)}.line-marker.svelte-yez7mn.svelte-yez7mn{display:inline-block;width:20px;flex-shrink:0;text-align:center;color:#888;user-select:none}.diff-line.added.svelte-yez7mn .line-marker.svelte-yez7mn{color:#89ca78}.diff-line.removed.svelte-yez7mn .line-marker.svelte-yez7mn{color:#f48771}.line-text.svelte-yez7mn.svelte-yez7mn{flex:1;white-space:pre;color:#d4d4d4}.diff-line.added.svelte-yez7mn .line-text.svelte-yez7mn{color:#89ca78}.diff-line.removed.svelte-yez7mn .line-text.svelte-yez7mn{color:#f48771;text-decoration:line-through;opacity:0.8}.modal-footer.svelte-yez7mn.svelte-yez7mn{display:flex;justify-content:flex-end;gap:12px;padding:16px 20px;border-top:1px solid #3e3e42;flex-shrink:0}.btn.svelte-yez7mn.svelte-yez7mn{padding:10px 24px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;transition:background-color 0.2s}.btn.svelte-yez7mn.svelte-yez7mn:disabled{opacity:0.5;cursor:not-allowed}.btn-secondary.svelte-yez7mn.svelte-yez7mn{background-color:#3e3e42;color:#d4d4d4}.btn-secondary.svelte-yez7mn.svelte-yez7mn:hover:not(:disabled){background-color:#4e4e52}.btn-danger.svelte-yez7mn.svelte-yez7mn{background-color:#c93c37;color:white}.btn-danger.svelte-yez7mn.svelte-yez7mn:hover:not(:disabled){background-color:#e04b46}",
  map: `{"version":3,"file":"VersionDiffModal.svelte","sources":["VersionDiffModal.svelte"],"sourcesContent":["<script lang=\\"ts\\">import { createEventDispatcher, onMount } from \\"svelte\\";\\nimport * as Y from \\"yjs\\";\\nimport { diffLines, Change } from \\"diff\\";\\nexport let isOpen;\\nexport let docId;\\nexport let version = null;\\nexport let currentContent = \\"\\";\\nconst dispatch = createEventDispatcher();\\nlet historicalContent = \\"\\";\\nlet loading = false;\\nlet error = null;\\nlet diffChanges = [];\\nlet rollingBack = false;\\n$: if (isOpen && docId && version !== null) {\\n  loadHistoricalVersion();\\n}\\nasync function loadHistoricalVersion() {\\n  if (!docId || version === null) return;\\n  loading = true;\\n  error = null;\\n  historicalContent = \\"\\";\\n  diffChanges = [];\\n  try {\\n    const response = await fetch(\`http://localhost:4000/api/docs/\${docId}/versions/\${version}\`);\\n    if (!response.ok) {\\n      throw new Error(\`HTTP \${response.status}\`);\\n    }\\n    const data = await response.json();\\n    const tempDoc = new Y.Doc();\\n    const updateBinary = base64ToUint8Array(data.update_base64);\\n    Y.applyUpdate(tempDoc, updateBinary);\\n    const ytext = tempDoc.getText(\\"codemirror\\");\\n    historicalContent = ytext.toString();\\n    computeDiff();\\n  } catch (e) {\\n    error = e.message;\\n    console.error(\\"[VersionDiff] Failed to load historical version:\\", e);\\n  } finally {\\n    loading = false;\\n  }\\n}\\nfunction computeDiff() {\\n  const diff = diffLines(currentContent, historicalContent);\\n  diffChanges = diff;\\n}\\nasync function rollback() {\\n  if (!docId || version === null || rollingBack) return;\\n  if (!confirm(\`\\\\u786E\\\\u5B9A\\\\u8981\\\\u56DE\\\\u6EDA\\\\u5230\\\\u7248\\\\u672C v\${version} \\\\u5417\\\\uFF1F\\\\u8FD9\\\\u5C06\\\\u8986\\\\u76D6\\\\u5F53\\\\u524D\\\\u6240\\\\u6709\\\\u5185\\\\u5BB9\\\\uFF01\`)) {\\n    return;\\n  }\\n  rollingBack = true;\\n  try {\\n    const formData = new URLSearchParams();\\n    formData.append(\\"version\\", String(version));\\n    const response = await fetch(\`http://localhost:4000/api/docs/\${docId}/rollback\`, {\\n      method: \\"POST\\",\\n      headers: {\\n        \\"Content-Type\\": \\"application/x-www-form-urlencoded\\"\\n      },\\n      body: formData\\n    });\\n    if (!response.ok) {\\n      throw new Error(\`HTTP \${response.status}\`);\\n    }\\n    dispatch(\\"rolledback\\", { version });\\n    close();\\n  } catch (e) {\\n    error = e.message;\\n    console.error(\\"[VersionDiff] Failed to rollback:\\", e);\\n  } finally {\\n    rollingBack = false;\\n  }\\n}\\nfunction close() {\\n  dispatch(\\"close\\");\\n}\\nfunction base64ToUint8Array(base64) {\\n  const binary_string = atob(base64);\\n  const len = binary_string.length;\\n  const bytes = new Uint8Array(len);\\n  for (let i = 0; i < len; i++) {\\n    bytes[i] = binary_string.charCodeAt(i);\\n  }\\n  return bytes;\\n}\\nfunction getLineClass(change) {\\n  if (change.added) return \\"added\\";\\n  if (change.removed) return \\"removed\\";\\n  return \\"unchanged\\";\\n}\\nlet addCount = 0;\\nlet removeCount = 0;\\n$: {\\n  addCount = 0;\\n  removeCount = 0;\\n  for (const change of diffChanges) {\\n    if (change.added) {\\n      addCount += change.count || 0;\\n    } else if (change.removed) {\\n      removeCount += change.count || 0;\\n    }\\n  }\\n}\\n<\/script>\\r\\n\\r\\n{#if isOpen}\\r\\n  <div class=\\"modal-overlay\\" on:click|self={close}>\\r\\n    <div class=\\"modal\\">\\r\\n      <div class=\\"modal-header\\">\\r\\n        <h3 class=\\"modal-title\\">\\r\\n          📋 版本对比\\r\\n          {#if version !== null}\\r\\n            <span class=\\"version-badge\\">v{version}</span>\\r\\n          {/if}\\r\\n        </h3>\\r\\n        <button class=\\"close-btn\\" on:click={close}>✕</button>\\r\\n      </div>\\r\\n\\r\\n      <div class=\\"modal-body\\">\\r\\n        {#if loading}\\r\\n          <div class=\\"loading\\">加载历史版本中...</div>\\r\\n        {:else if error}\\r\\n          <div class=\\"error\\">\\r\\n            错误: {error}\\r\\n            <button class=\\"retry-btn\\" on:click={loadHistoricalVersion}>重试</button>\\r\\n          </div>\\r\\n        {:else}\\r\\n          <div class=\\"diff-stats\\">\\r\\n            <span class=\\"stat added\\">+ {addCount} 行新增</span>\\r\\n            <span class=\\"stat removed\\">- {removeCount} 行删除</span>\\r\\n          </div>\\r\\n\\r\\n          <div class=\\"diff-container\\">\\r\\n            <div class=\\"diff-content\\">\\r\\n              {#each diffChanges as change}\\r\\n                {#each change.value.split('\\\\n').slice(0, -1) as line}\\r\\n                  <div class=\\"diff-line {getLineClass(change)}\\">\\r\\n                    <span class=\\"line-marker\\">\\r\\n                      {change.added ? '+' : change.removed ? '-' : ' '}\\r\\n                    </span>\\r\\n                    <span class=\\"line-text\\">{line || ' '}</span>\\r\\n                  </div>\\r\\n                {/each}\\r\\n              {/each}\\r\\n            </div>\\r\\n          </div>\\r\\n        {/if}\\r\\n      </div>\\r\\n\\r\\n      <div class=\\"modal-footer\\">\\r\\n        <button class=\\"btn btn-secondary\\" on:click={close}>\\r\\n          关闭\\r\\n        </button>\\r\\n        <button\\r\\n          class=\\"btn btn-danger\\"\\r\\n          on:click={rollback}\\r\\n          disabled={loading || rollingBack || version === null}\\r\\n        >\\r\\n          {rollingBack ? '回滚中...' : '回滚到此版本'}\\r\\n        </button>\\r\\n      </div>\\r\\n    </div>\\r\\n  </div>\\r\\n{/if}\\r\\n\\r\\n<style scoped>\\r\\n  .modal-overlay {\\r\\n    position: fixed;\\r\\n    top: 0;\\r\\n    left: 0;\\r\\n    right: 0;\\r\\n    bottom: 0;\\r\\n    background-color: rgba(0, 0, 0, 0.7);\\r\\n    display: flex;\\r\\n    align-items: center;\\r\\n    justify-content: center;\\r\\n    z-index: 2000;\\r\\n  }\\r\\n\\r\\n  .modal {\\r\\n    width: 90%;\\r\\n    max-width: 1000px;\\r\\n    max-height: 85vh;\\r\\n    background-color: #252526;\\r\\n    border-radius: 8px;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);\\r\\n  }\\r\\n\\r\\n  .modal-header {\\r\\n    display: flex;\\r\\n    justify-content: space-between;\\r\\n    align-items: center;\\r\\n    padding: 16px 20px;\\r\\n    border-bottom: 1px solid #3e3e42;\\r\\n    flex-shrink: 0;\\r\\n  }\\r\\n\\r\\n  .modal-title {\\r\\n    margin: 0;\\r\\n    font-size: 18px;\\r\\n    color: #ffffff;\\r\\n    display: flex;\\r\\n    align-items: center;\\r\\n    gap: 12px;\\r\\n  }\\r\\n\\r\\n  .version-badge {\\r\\n    font-size: 14px;\\r\\n    font-weight: normal;\\r\\n    background-color: #0e639c;\\r\\n    padding: 2px 10px;\\r\\n    border-radius: 12px;\\r\\n  }\\r\\n\\r\\n  .close-btn {\\r\\n    width: 32px;\\r\\n    height: 32px;\\r\\n    display: flex;\\r\\n    align-items: center;\\r\\n    justify-content: center;\\r\\n    background-color: #3e3e42;\\r\\n    border: none;\\r\\n    border-radius: 4px;\\r\\n    color: #d4d4d4;\\r\\n    cursor: pointer;\\r\\n    font-size: 16px;\\r\\n    transition: background-color 0.2s;\\r\\n  }\\r\\n\\r\\n  .close-btn:hover {\\r\\n    background-color: #4e4e52;\\r\\n  }\\r\\n\\r\\n  .modal-body {\\r\\n    flex: 1;\\r\\n    overflow: hidden;\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    padding: 16px 20px;\\r\\n  }\\r\\n\\r\\n  .loading {\\r\\n    padding: 40px;\\r\\n    text-align: center;\\r\\n    color: #888;\\r\\n  }\\r\\n\\r\\n  .error {\\r\\n    padding: 40px;\\r\\n    text-align: center;\\r\\n    color: #f48771;\\r\\n  }\\r\\n\\r\\n  .retry-btn {\\r\\n    margin-top: 12px;\\r\\n    padding: 8px 20px;\\r\\n    background-color: #0e639c;\\r\\n    border: none;\\r\\n    border-radius: 4px;\\r\\n    color: white;\\r\\n    cursor: pointer;\\r\\n  }\\r\\n\\r\\n  .diff-stats {\\r\\n    display: flex;\\r\\n    gap: 20px;\\r\\n    padding: 12px 16px;\\r\\n    background-color: #2d2d30;\\r\\n    border-radius: 4px;\\r\\n    margin-bottom: 12px;\\r\\n    flex-shrink: 0;\\r\\n  }\\r\\n\\r\\n  .stat {\\r\\n    font-size: 14px;\\r\\n    font-weight: 500;\\r\\n  }\\r\\n\\r\\n  .stat.added {\\r\\n    color: #89ca78;\\r\\n  }\\r\\n\\r\\n  .stat.removed {\\r\\n    color: #f48771;\\r\\n  }\\r\\n\\r\\n  .diff-container {\\r\\n    flex: 1;\\r\\n    overflow: auto;\\r\\n    background-color: #1e1e1e;\\r\\n    border-radius: 4px;\\r\\n  }\\r\\n\\r\\n  .diff-content {\\r\\n    padding: 8px 0;\\r\\n    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;\\r\\n    font-size: 13px;\\r\\n    line-height: 1.5;\\r\\n  }\\r\\n\\r\\n  .diff-line {\\r\\n    display: flex;\\r\\n    padding: 0 12px;\\r\\n  }\\r\\n\\r\\n  .diff-line:hover {\\r\\n    background-color: rgba(255, 255, 255, 0.05);\\r\\n  }\\r\\n\\r\\n  .diff-line.added {\\r\\n    background-color: rgba(137, 202, 120, 0.15);\\r\\n  }\\r\\n\\r\\n  .diff-line.removed {\\r\\n    background-color: rgba(244, 135, 113, 0.15);\\r\\n  }\\r\\n\\r\\n  .line-marker {\\r\\n    display: inline-block;\\r\\n    width: 20px;\\r\\n    flex-shrink: 0;\\r\\n    text-align: center;\\r\\n    color: #888;\\r\\n    user-select: none;\\r\\n  }\\r\\n\\r\\n  .diff-line.added .line-marker {\\r\\n    color: #89ca78;\\r\\n  }\\r\\n\\r\\n  .diff-line.removed .line-marker {\\r\\n    color: #f48771;\\r\\n  }\\r\\n\\r\\n  .line-text {\\r\\n    flex: 1;\\r\\n    white-space: pre;\\r\\n    color: #d4d4d4;\\r\\n  }\\r\\n\\r\\n  .diff-line.added .line-text {\\r\\n    color: #89ca78;\\r\\n  }\\r\\n\\r\\n  .diff-line.removed .line-text {\\r\\n    color: #f48771;\\r\\n    text-decoration: line-through;\\r\\n    opacity: 0.8;\\r\\n  }\\r\\n\\r\\n  .modal-footer {\\r\\n    display: flex;\\r\\n    justify-content: flex-end;\\r\\n    gap: 12px;\\r\\n    padding: 16px 20px;\\r\\n    border-top: 1px solid #3e3e42;\\r\\n    flex-shrink: 0;\\r\\n  }\\r\\n\\r\\n  .btn {\\r\\n    padding: 10px 24px;\\r\\n    border: none;\\r\\n    border-radius: 4px;\\r\\n    font-size: 14px;\\r\\n    font-weight: 500;\\r\\n    cursor: pointer;\\r\\n    transition: background-color 0.2s;\\r\\n  }\\r\\n\\r\\n  .btn:disabled {\\r\\n    opacity: 0.5;\\r\\n    cursor: not-allowed;\\r\\n  }\\r\\n\\r\\n  .btn-secondary {\\r\\n    background-color: #3e3e42;\\r\\n    color: #d4d4d4;\\r\\n  }\\r\\n\\r\\n  .btn-secondary:hover:not(:disabled) {\\r\\n    background-color: #4e4e52;\\r\\n  }\\r\\n\\r\\n  .btn-danger {\\r\\n    background-color: #c93c37;\\r\\n    color: white;\\r\\n  }\\r\\n\\r\\n  .btn-danger:hover:not(:disabled) {\\r\\n    background-color: #e04b46;\\r\\n  }\\r\\n</style>\\r\\n"],"names":[],"mappings":"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"}`
};
function base64ToUint8Array(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}
function getLineClass(change) {
  if (change.added) return "added";
  if (change.removed) return "removed";
  return "unchanged";
}
const VersionDiffModal = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { isOpen } = $$props;
  let { docId } = $$props;
  let { version = null } = $$props;
  let { currentContent = "" } = $$props;
  createEventDispatcher();
  let historicalContent = "";
  let loading = false;
  let error = null;
  let diffChanges = [];
  let rollingBack = false;
  async function loadHistoricalVersion() {
    if (!docId || version === null) return;
    loading = true;
    error = null;
    historicalContent = "";
    diffChanges = [];
    try {
      const response = await fetch(`http://localhost:4000/api/docs/${docId}/versions/${version}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const tempDoc = new Y.Doc();
      const updateBinary = base64ToUint8Array(data.update_base64);
      Y.applyUpdate(tempDoc, updateBinary);
      const ytext = tempDoc.getText("codemirror");
      historicalContent = ytext.toString();
      computeDiff();
    } catch (e) {
      error = e.message;
      console.error("[VersionDiff] Failed to load historical version:", e);
    } finally {
      loading = false;
    }
  }
  function computeDiff() {
    const diff = diffLines(currentContent, historicalContent);
    diffChanges = diff;
  }
  let addCount = 0;
  let removeCount = 0;
  if ($$props.isOpen === void 0 && $$bindings.isOpen && isOpen !== void 0) $$bindings.isOpen(isOpen);
  if ($$props.docId === void 0 && $$bindings.docId && docId !== void 0) $$bindings.docId(docId);
  if ($$props.version === void 0 && $$bindings.version && version !== void 0) $$bindings.version(version);
  if ($$props.currentContent === void 0 && $$bindings.currentContent && currentContent !== void 0) $$bindings.currentContent(currentContent);
  $$result.css.add(css$1);
  {
    if (isOpen && docId && version !== null) {
      loadHistoricalVersion();
    }
  }
  {
    {
      addCount = 0;
      removeCount = 0;
      for (const change of diffChanges) {
        if (change.added) {
          addCount += change.count || 0;
        } else if (change.removed) {
          removeCount += change.count || 0;
        }
      }
    }
  }
  return `${isOpen ? `<div class="modal-overlay svelte-yez7mn"><div class="modal svelte-yez7mn"><div class="modal-header svelte-yez7mn"><h3 class="modal-title svelte-yez7mn">📋 版本对比
          ${version !== null ? `<span class="version-badge svelte-yez7mn">v${escape(version)}</span>` : ``}</h3> <button class="close-btn svelte-yez7mn" data-svelte-h="svelte-m2cmlv">✕</button></div> <div class="modal-body svelte-yez7mn">${loading ? `<div class="loading svelte-yez7mn" data-svelte-h="svelte-14lm6h9">加载历史版本中...</div>` : `${error ? `<div class="error svelte-yez7mn">错误: ${escape(error)} <button class="retry-btn svelte-yez7mn" data-svelte-h="svelte-1emmw58">重试</button></div>` : `<div class="diff-stats svelte-yez7mn"><span class="stat added svelte-yez7mn">+ ${escape(addCount)} 行新增</span> <span class="stat removed svelte-yez7mn">- ${escape(removeCount)} 行删除</span></div> <div class="diff-container svelte-yez7mn"><div class="diff-content svelte-yez7mn">${each(diffChanges, (change) => {
    return `${each(change.value.split("\n").slice(0, -1), (line) => {
      return `<div class="${"diff-line " + escape(getLineClass(change), true) + " svelte-yez7mn"}"><span class="line-marker svelte-yez7mn">${escape(change.added ? "+" : change.removed ? "-" : " ")}</span> <span class="line-text svelte-yez7mn">${escape(line || " ")}</span> </div>`;
    })}`;
  })}</div></div>`}`}</div> <div class="modal-footer svelte-yez7mn"><button class="btn btn-secondary svelte-yez7mn" data-svelte-h="svelte-11ksmjm">关闭</button> <button class="btn btn-danger svelte-yez7mn" ${loading || rollingBack || version === null ? "disabled" : ""}>${escape("回滚到此版本")}</button></div></div></div>` : ``}`;
});
const css = {
  code: ".editor-container.svelte-fytsxo{display:flex;flex-direction:column;height:100vh;width:100vw;background-color:#1e1e1e;color:#d4d4d4}.header.svelte-fytsxo{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;background-color:#252526;border-bottom:1px solid #3e3e42;flex-shrink:0}.header-left.svelte-fytsxo{display:flex;align-items:center;gap:16px}.title.svelte-fytsxo{font-size:18px;font-weight:600;color:#ffffff;margin:0}.doc-id.svelte-fytsxo{font-size:13px;color:#888;background-color:#2d2d30;padding:4px 10px;border-radius:4px}.header-right.svelte-fytsxo{display:flex;align-items:center;gap:12px}.history-btn.svelte-fytsxo{padding:8px 16px;background-color:#6c5ce7;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;transition:background-color 0.2s}.history-btn.svelte-fytsxo:hover{background-color:#5b4cdb}.history-btn.svelte-fytsxo:active{background-color:#4a3bc4}.sync-btn.svelte-fytsxo{padding:8px 16px;background-color:#0e639c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;transition:background-color 0.2s}.sync-btn.svelte-fytsxo:hover{background-color:#1177bb}.sync-btn.svelte-fytsxo:active{background-color:#0a4c7a}.editor-main.svelte-fytsxo{flex:1;display:flex;overflow:hidden}.editor-wrapper.svelte-fytsxo{flex:1;overflow:hidden}",
  map: '{"version":3,"file":"+page.svelte","sources":["+page.svelte"],"sourcesContent":["<script lang=\\"ts\\">import { onMount, onDestroy } from \\"svelte\\";\\nimport { YjsProvider } from \\"$lib/yjsProvider\\";\\nimport { createEditor } from \\"$lib/codemirror/editor\\";\\nimport StatusBar from \\"$lib/components/StatusBar.svelte\\";\\nimport LanguageSelector from \\"$lib/components/LanguageSelector.svelte\\";\\nimport VersionHistorySidebar from \\"$lib/components/VersionHistorySidebar.svelte\\";\\nimport VersionDiffModal from \\"$lib/components/VersionDiffModal.svelte\\";\\nlet yjsProvider = null;\\nlet editor = null;\\nlet container = null;\\nlet connectionState = {\\n  isConnected: false,\\n  isOnline: true,\\n  isSynced: false\\n};\\nlet currentLanguage = \\"javascript\\";\\nlet docId = \\"demo-document\\";\\nlet unsubscribeState = null;\\nlet hasSetInitialContent = false;\\nlet sidebarOpen = false;\\nlet diffModalOpen = false;\\nlet selectedVersion = null;\\nconst DEFAULT_CONTENT = `// \\\\u6B22\\\\u8FCE\\\\u4F7F\\\\u7528\\\\u534F\\\\u540C\\\\u6587\\\\u672C\\\\u7F16\\\\u8F91\\\\u5668!\\n// \\\\u652F\\\\u6301\\\\u591A\\\\u4EBA\\\\u5B9E\\\\u65F6\\\\u534F\\\\u4F5C\\\\u7F16\\\\u8F91\\n// \\\\u5373\\\\u4F7F\\\\u65AD\\\\u7F51\\\\u4E5F\\\\u53EF\\\\u4EE5\\\\u7EE7\\\\u7EED\\\\u7F16\\\\u8F91\\\\uFF0C\\\\u7F51\\\\u7EDC\\\\u6062\\\\u590D\\\\u540E\\\\u81EA\\\\u52A8\\\\u540C\\\\u6B65\\n\\nfunction hello() {\\n  console.log(\\"Hello, Collaborative Editor!\\");\\n  return true;\\n}\\n\\n// \\\\u8BD5\\\\u8BD5\\\\u5728\\\\u4E24\\\\u4E2A\\\\u6D4F\\\\u89C8\\\\u5668\\\\u7A97\\\\u53E3\\\\u4E2D\\\\u540C\\\\u65F6\\\\u7F16\\\\u8F91\\\\u8FD9\\\\u4E2A\\\\u6587\\\\u4EF6\\n// \\\\u4F60\\\\u4F1A\\\\u770B\\\\u5230\\\\u5B9E\\\\u65F6\\\\u540C\\\\u6B65\\\\u6548\\\\u679C\\n`;\\nasync function initEditor() {\\n  if (!container) return;\\n  const urlParams = new URLSearchParams(window.location.search);\\n  const idFromUrl = urlParams.get(\\"doc\\");\\n  if (idFromUrl) {\\n    docId = idFromUrl;\\n  }\\n  yjsProvider = new YjsProvider(docId, \\"ws://localhost:4000/socket/websocket\\");\\n  unsubscribeState = yjsProvider.onStateChange((state) => {\\n    connectionState = state;\\n    if (state.isSynced && !hasSetInitialContent) {\\n      setInitialContentIfEmpty();\\n    }\\n  });\\n  await yjsProvider.connect();\\n  editor = createEditor({\\n    container,\\n    yjsProvider,\\n    language: currentLanguage\\n  });\\n  setTimeout(() => {\\n    editor?.focus();\\n  }, 100);\\n}\\nfunction setInitialContentIfEmpty() {\\n  if (!yjsProvider || hasSetInitialContent) return;\\n  const ytext = yjsProvider.getText(\\"codemirror\\");\\n  if (ytext.length === 0) {\\n    ytext.insert(0, DEFAULT_CONTENT);\\n  }\\n  hasSetInitialContent = true;\\n}\\nfunction changeLanguage(language) {\\n  if (!container || !yjsProvider) return;\\n  currentLanguage = language;\\n  if (editor) {\\n    editor.destroy();\\n    editor = null;\\n  }\\n  editor = createEditor({\\n    container,\\n    yjsProvider,\\n    language\\n  });\\n  setTimeout(() => {\\n    editor?.focus();\\n  }, 100);\\n}\\nfunction forceSync() {\\n  yjsProvider?.forceSync();\\n}\\nfunction openSidebar() {\\n  sidebarOpen = true;\\n}\\nfunction closeSidebar() {\\n  sidebarOpen = false;\\n}\\nfunction selectVersion(event) {\\n  selectedVersion = event.detail.version;\\n  diffModalOpen = true;\\n}\\nfunction closeDiffModal() {\\n  diffModalOpen = false;\\n}\\nasync function handleRollback(event) {\\n  console.log(`Rolled back to version v${event.detail.version}`);\\n  closeDiffModal();\\n  closeSidebar();\\n  selectedVersion = null;\\n  if (yjsProvider) {\\n    yjsProvider.forceSync();\\n  }\\n}\\nfunction getCurrentContent() {\\n  if (!yjsProvider) return \\"\\";\\n  const ytext = yjsProvider.getText(\\"codemirror\\");\\n  return ytext.toString();\\n}\\nonMount(() => {\\n  initEditor();\\n});\\nonDestroy(() => {\\n  if (unsubscribeState) {\\n    unsubscribeState();\\n    unsubscribeState = null;\\n  }\\n  if (editor) {\\n    editor.destroy();\\n    editor = null;\\n  }\\n  if (yjsProvider) {\\n    yjsProvider.disconnect();\\n    yjsProvider = null;\\n  }\\n});\\n<\/script>\\r\\n\\r\\n<div class=\\"editor-container\\">\\r\\n  <header class=\\"header\\">\\r\\n    <div class=\\"header-left\\">\\r\\n      <h1 class=\\"title\\">📝 协同文本编辑器</h1>\\r\\n      <span class=\\"doc-id\\">文档: {docId}</span>\\r\\n    </div>\\r\\n    <div class=\\"header-right\\">\\r\\n      <LanguageSelector current={currentLanguage} on:change={(e) => changeLanguage(e.detail)} />\\r\\n      <button class=\\"history-btn\\" on:click={openSidebar} title=\\"查看历史版本\\">\\r\\n        📜 历史版本\\r\\n      </button>\\r\\n      <button class=\\"sync-btn\\" on:click={forceSync} title=\\"强制同步\\">\\r\\n        🔄 同步\\r\\n      </button>\\r\\n    </div>\\r\\n  </header>\\r\\n\\r\\n  <main class=\\"editor-main\\">\\r\\n    <div bind:this={container} class=\\"editor-wrapper\\"></div>\\r\\n  </main>\\r\\n\\r\\n  <StatusBar {connectionState} {docId} />\\r\\n</div>\\r\\n\\r\\n<VersionHistorySidebar\\r\\n  {docId}\\r\\n  isOpen={sidebarOpen}\\r\\n  selectedVersion={selectedVersion}\\r\\n  on:close={closeSidebar}\\r\\n  on:select={selectVersion}\\r\\n/>\\r\\n\\r\\n<VersionDiffModal\\r\\n  isOpen={diffModalOpen}\\r\\n  {docId}\\r\\n  version={selectedVersion}\\r\\n  currentContent={getCurrentContent()}\\r\\n  on:close={closeDiffModal}\\r\\n  on:rolledback={handleRollback}\\r\\n/>\\r\\n\\r\\n<style scoped>\\r\\n  .editor-container {\\r\\n    display: flex;\\r\\n    flex-direction: column;\\r\\n    height: 100vh;\\r\\n    width: 100vw;\\r\\n    background-color: #1e1e1e;\\r\\n    color: #d4d4d4;\\r\\n  }\\r\\n\\r\\n  .header {\\r\\n    display: flex;\\r\\n    justify-content: space-between;\\r\\n    align-items: center;\\r\\n    padding: 12px 20px;\\r\\n    background-color: #252526;\\r\\n    border-bottom: 1px solid #3e3e42;\\r\\n    flex-shrink: 0;\\r\\n  }\\r\\n\\r\\n  .header-left {\\r\\n    display: flex;\\r\\n    align-items: center;\\r\\n    gap: 16px;\\r\\n  }\\r\\n\\r\\n  .title {\\r\\n    font-size: 18px;\\r\\n    font-weight: 600;\\r\\n    color: #ffffff;\\r\\n    margin: 0;\\r\\n  }\\r\\n\\r\\n  .doc-id {\\r\\n    font-size: 13px;\\r\\n    color: #888;\\r\\n    background-color: #2d2d30;\\r\\n    padding: 4px 10px;\\r\\n    border-radius: 4px;\\r\\n  }\\r\\n\\r\\n  .header-right {\\r\\n    display: flex;\\r\\n    align-items: center;\\r\\n    gap: 12px;\\r\\n  }\\r\\n\\r\\n  .history-btn {\\r\\n    padding: 8px 16px;\\r\\n    background-color: #6c5ce7;\\r\\n    color: white;\\r\\n    border: none;\\r\\n    border-radius: 4px;\\r\\n    cursor: pointer;\\r\\n    font-size: 13px;\\r\\n    transition: background-color 0.2s;\\r\\n  }\\r\\n\\r\\n  .history-btn:hover {\\r\\n    background-color: #5b4cdb;\\r\\n  }\\r\\n\\r\\n  .history-btn:active {\\r\\n    background-color: #4a3bc4;\\r\\n  }\\r\\n\\r\\n  .sync-btn {\\r\\n    padding: 8px 16px;\\r\\n    background-color: #0e639c;\\r\\n    color: white;\\r\\n    border: none;\\r\\n    border-radius: 4px;\\r\\n    cursor: pointer;\\r\\n    font-size: 13px;\\r\\n    transition: background-color 0.2s;\\r\\n  }\\r\\n\\r\\n  .sync-btn:hover {\\r\\n    background-color: #1177bb;\\r\\n  }\\r\\n\\r\\n  .sync-btn:active {\\r\\n    background-color: #0a4c7a;\\r\\n  }\\r\\n\\r\\n  .editor-main {\\r\\n    flex: 1;\\r\\n    display: flex;\\r\\n    overflow: hidden;\\r\\n  }\\r\\n\\r\\n  .editor-wrapper {\\r\\n    flex: 1;\\r\\n    overflow: hidden;\\r\\n  }\\r\\n</style>\\r\\n"],"names":[],"mappings":"AA6KE,+BAAkB,CAChB,OAAO,CAAE,IAAI,CACb,cAAc,CAAE,MAAM,CACtB,MAAM,CAAE,KAAK,CACb,KAAK,CAAE,KAAK,CACZ,gBAAgB,CAAE,OAAO,CACzB,KAAK,CAAE,OACT,CAEA,qBAAQ,CACN,OAAO,CAAE,IAAI,CACb,eAAe,CAAE,aAAa,CAC9B,WAAW,CAAE,MAAM,CACnB,OAAO,CAAE,IAAI,CAAC,IAAI,CAClB,gBAAgB,CAAE,OAAO,CACzB,aAAa,CAAE,GAAG,CAAC,KAAK,CAAC,OAAO,CAChC,WAAW,CAAE,CACf,CAEA,0BAAa,CACX,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,GAAG,CAAE,IACP,CAEA,oBAAO,CACL,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,GAAG,CAChB,KAAK,CAAE,OAAO,CACd,MAAM,CAAE,CACV,CAEA,qBAAQ,CACN,SAAS,CAAE,IAAI,CACf,KAAK,CAAE,IAAI,CACX,gBAAgB,CAAE,OAAO,CACzB,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,aAAa,CAAE,GACjB,CAEA,2BAAc,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,GAAG,CAAE,IACP,CAEA,0BAAa,CACX,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,gBAAgB,CAAE,OAAO,CACzB,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,IAAI,CACZ,aAAa,CAAE,GAAG,CAClB,MAAM,CAAE,OAAO,CACf,SAAS,CAAE,IAAI,CACf,UAAU,CAAE,gBAAgB,CAAC,IAC/B,CAEA,0BAAY,MAAO,CACjB,gBAAgB,CAAE,OACpB,CAEA,0BAAY,OAAQ,CAClB,gBAAgB,CAAE,OACpB,CAEA,uBAAU,CACR,OAAO,CAAE,GAAG,CAAC,IAAI,CACjB,gBAAgB,CAAE,OAAO,CACzB,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,IAAI,CACZ,aAAa,CAAE,GAAG,CAClB,MAAM,CAAE,OAAO,CACf,SAAS,CAAE,IAAI,CACf,UAAU,CAAE,gBAAgB,CAAC,IAC/B,CAEA,uBAAS,MAAO,CACd,gBAAgB,CAAE,OACpB,CAEA,uBAAS,OAAQ,CACf,gBAAgB,CAAE,OACpB,CAEA,0BAAa,CACX,IAAI,CAAE,CAAC,CACP,OAAO,CAAE,IAAI,CACb,QAAQ,CAAE,MACZ,CAEA,6BAAgB,CACd,IAAI,CAAE,CAAC,CACP,QAAQ,CAAE,MACZ"}'
};
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let container = null;
  let connectionState = {
    isConnected: false,
    isOnline: true,
    isSynced: false
  };
  let currentLanguage = "javascript";
  let docId = "demo-document";
  let sidebarOpen = false;
  let diffModalOpen = false;
  let selectedVersion = null;
  function getCurrentContent() {
    return "";
  }
  onDestroy(() => {
  });
  $$result.css.add(css);
  return `<div class="editor-container svelte-fytsxo"><header class="header svelte-fytsxo"><div class="header-left svelte-fytsxo"><h1 class="title svelte-fytsxo" data-svelte-h="svelte-bandvw">📝 协同文本编辑器</h1> <span class="doc-id svelte-fytsxo">文档: ${escape(docId)}</span></div> <div class="header-right svelte-fytsxo">${validate_component(LanguageSelector, "LanguageSelector").$$render($$result, { current: currentLanguage }, {}, {})} <button class="history-btn svelte-fytsxo" title="查看历史版本" data-svelte-h="svelte-1xcelak">📜 历史版本</button> <button class="sync-btn svelte-fytsxo" title="强制同步" data-svelte-h="svelte-1nsp0an">🔄 同步</button></div></header> <main class="editor-main svelte-fytsxo"><div class="editor-wrapper svelte-fytsxo"${add_attribute("this", container, 0)}></div></main> ${validate_component(StatusBar, "StatusBar").$$render($$result, { connectionState, docId }, {}, {})}</div> ${validate_component(VersionHistorySidebar, "VersionHistorySidebar").$$render(
    $$result,
    {
      docId,
      isOpen: sidebarOpen,
      selectedVersion
    },
    {},
    {}
  )} ${validate_component(VersionDiffModal, "VersionDiffModal").$$render(
    $$result,
    {
      isOpen: diffModalOpen,
      docId,
      version: selectedVersion,
      currentContent: getCurrentContent()
    },
    {},
    {}
  )}`;
});
export {
  Page as default
};

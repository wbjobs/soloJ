import { c as create_ssr_component, f as subscribe, o as onDestroy, a as add_attribute, e as each, b as escape, v as validate_component } from "../../chunks/ssr.js";
import { d as derived, w as writable } from "../../chunks/index.js";
const structuralParams = writable({
  lattice_constant: 0.05,
  cylinder_radius: 0.015,
  cylinder_height: 0.03
});
const materialParams = writable({
  matrix_density: 1200,
  matrix_speed_of_sound: 2500,
  scatterer_density: 7800,
  scatterer_speed_of_sound: 5e3
});
const fillingFraction = writable(0.28);
const allParams = derived(
  [structuralParams, materialParams, fillingFraction],
  ([$structural, $material, $ff]) => ({
    ...$structural,
    ...$material,
    filling_fraction: $ff
  })
);
const targetBandGap = writable({
  start: 500,
  end: 800
});
const optimizationConfig = writable({
  budget: 50,
  num_workers: 2
});
const optimizationStatus = writable("idle");
const optimizationJobId = writable(null);
const optimizationHistory = writable([]);
const bandStructureData = writable(null);
const transmissionLossData = writable(null);
const bestResult = writable(null);
const paramRanges = writable({
  lattice_constant: { min: 0.02, max: 0.1, step: 1e-3, unit: "m", label: "晶格常数" },
  cylinder_radius: { min: 5e-3, max: 0.04, step: 1e-3, unit: "m", label: "柱体半径" },
  cylinder_height: { min: 0.01, max: 0.08, step: 1e-3, unit: "m", label: "柱体高度" },
  matrix_density: { min: 800, max: 2e3, step: 10, unit: "kg/m³", label: "基体密度" },
  matrix_speed_of_sound: { min: 1500, max: 4e3, step: 50, unit: "m/s", label: "基体声速" },
  scatterer_density: { min: 2e3, max: 1e4, step: 100, unit: "kg/m³", label: "散射体密度" },
  scatterer_speed_of_sound: { min: 3e3, max: 8e3, step: 50, unit: "m/s", label: "散射体声速" },
  filling_fraction: { min: 0.1, max: 0.6, step: 0.01, unit: "", label: "填充率" }
});
const css$6 = {
  code: ".viewer-container.svelte-uznfa2{position:relative;width:100%;height:100%;border-radius:8px;overflow:hidden;background:#0a0e1a}canvas.svelte-uznfa2{width:100%;height:100%;display:block}.viewer-overlay.svelte-uznfa2{position:absolute;top:12px;left:12px;pointer-events:none}.overlay-label.svelte-uznfa2{font-size:12px;color:#94a3b8;background:rgba(10, 14, 26, 0.7);padding:4px 10px;border-radius:4px;backdrop-filter:blur(4px)}.viewer-actions.svelte-uznfa2{position:absolute;top:12px;right:12px;display:flex;gap:8px}.btn-sm.svelte-uznfa2{padding:6px 12px;font-size:12px}",
  map: null
};
const ModelViewer = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $$unsubscribe_fillingFraction;
  let $$unsubscribe_structuralParams;
  $$unsubscribe_fillingFraction = subscribe(fillingFraction, (value) => value);
  $$unsubscribe_structuralParams = subscribe(structuralParams, (value) => value);
  let canvas;
  onDestroy(() => {
  });
  $$result.css.add(css$6);
  $$unsubscribe_fillingFraction();
  $$unsubscribe_structuralParams();
  return `<div class="viewer-container svelte-uznfa2"><canvas class="svelte-uznfa2"${add_attribute("this", canvas, 0)}></canvas> <div class="viewer-overlay svelte-uznfa2" data-svelte-h="svelte-13m55gl"><span class="overlay-label svelte-uznfa2">3D 晶格结构预览</span></div> <div class="viewer-actions svelte-uznfa2"><button class="btn btn-secondary btn-sm svelte-uznfa2" data-svelte-h="svelte-1mhbf8k">⬇ 导出 STL</button></div> </div>`;
});
const css$5 = {
  code: ".params-panel.svelte-1yjtph5.svelte-1yjtph5{padding:4px 0}.panel-header.svelte-1yjtph5.svelte-1yjtph5{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.panel-header.svelte-1yjtph5 h3.svelte-1yjtph5{font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px}.btn-sm.svelte-1yjtph5.svelte-1yjtph5{padding:4px 10px;font-size:11px}",
  map: null
};
function formatValue(val, key) {
  if (key === "filling_fraction") return val.toFixed(2);
  if (val >= 1e3) return val.toFixed(0);
  if (val >= 1) return val.toFixed(1);
  return val.toFixed(3);
}
const ParameterPanel = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $fillingFraction, $$unsubscribe_fillingFraction;
  let $materialParams, $$unsubscribe_materialParams;
  let $structuralParams, $$unsubscribe_structuralParams;
  let $paramRanges, $$unsubscribe_paramRanges;
  $$unsubscribe_fillingFraction = subscribe(fillingFraction, (value) => $fillingFraction = value);
  $$unsubscribe_materialParams = subscribe(materialParams, (value) => $materialParams = value);
  $$unsubscribe_structuralParams = subscribe(structuralParams, (value) => $structuralParams = value);
  $$unsubscribe_paramRanges = subscribe(paramRanges, (value) => $paramRanges = value);
  const structuralKeys = ["lattice_constant", "cylinder_radius", "cylinder_height"];
  const materialKeys = [
    "matrix_density",
    "matrix_speed_of_sound",
    "scatterer_density",
    "scatterer_speed_of_sound"
  ];
  $$result.css.add(css$5);
  $$unsubscribe_fillingFraction();
  $$unsubscribe_materialParams();
  $$unsubscribe_structuralParams();
  $$unsubscribe_paramRanges();
  return `<div class="params-panel svelte-1yjtph5"><div class="panel-header svelte-1yjtph5"><h3 class="svelte-1yjtph5" data-svelte-h="svelte-1v7x7m5">结构参数</h3> <button class="btn btn-secondary btn-sm svelte-1yjtph5" data-svelte-h="svelte-1k1a5qd">重置</button></div> ${each(structuralKeys, (key) => {
    let range = $paramRanges[key], value = $structuralParams[key];
    return `  <div class="slider-container"><div class="slider-label"><span>${escape(range.label)}</span> <span class="slider-value">${escape(formatValue(value, key))} ${escape(range.unit)}</span></div> <input type="range"${add_attribute("min", range.min, 0)}${add_attribute("max", range.max, 0)}${add_attribute("step", range.step, 0)}${add_attribute("value", value, 0)}> </div>`;
  })} <div class="slider-container"><div class="slider-label"><span>${escape($paramRanges.filling_fraction.label)}</span> <span class="slider-value">${escape(formatValue($fillingFraction, "filling_fraction"))}</span></div> <input type="range"${add_attribute("min", $paramRanges.filling_fraction.min, 0)}${add_attribute("max", $paramRanges.filling_fraction.max, 0)}${add_attribute("step", $paramRanges.filling_fraction.step, 0)}${add_attribute("value", $fillingFraction, 0)}></div> <div class="panel-header svelte-1yjtph5" style="margin-top: 16px;" data-svelte-h="svelte-1wqikyx"><h3 class="svelte-1yjtph5">材料参数</h3></div> ${each(materialKeys, (key) => {
    let range = $paramRanges[key], value = $materialParams[key];
    return `  <div class="slider-container"><div class="slider-label"><span>${escape(range.label)}</span> <span class="slider-value">${escape(formatValue(value, key))} ${escape(range.unit)}</span></div> <input type="range"${add_attribute("min", range.min, 0)}${add_attribute("max", range.max, 0)}${add_attribute("step", range.step, 0)}${add_attribute("value", value, 0)}> </div>`;
  })} </div>`;
});
const css$4 = {
  code: ".band-structure-container.svelte-oiz9a6{width:100%;height:100%;position:relative}canvas.svelte-oiz9a6{width:100%;height:100%}",
  map: null
};
const BandStructureChart = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $$unsubscribe_targetBandGap;
  let $$unsubscribe_bandStructureData;
  $$unsubscribe_targetBandGap = subscribe(targetBandGap, (value) => value);
  $$unsubscribe_bandStructureData = subscribe(bandStructureData, (value) => value);
  let canvas;
  onDestroy(() => {
  });
  $$result.css.add(css$4);
  $$unsubscribe_targetBandGap();
  $$unsubscribe_bandStructureData();
  return `<div class="band-structure-container svelte-oiz9a6"><canvas class="svelte-oiz9a6"${add_attribute("this", canvas, 0)}></canvas> </div>`;
});
const css$3 = {
  code: ".optimization-panel.svelte-1cfmd5i.svelte-1cfmd5i{display:flex;flex-direction:column;gap:16px}.panel-header.svelte-1cfmd5i.svelte-1cfmd5i{display:flex;justify-content:space-between;align-items:center}.panel-header.svelte-1cfmd5i h3.svelte-1cfmd5i{font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px}.section-label.svelte-1cfmd5i.svelte-1cfmd5i{font-size:12px;color:var(--text-muted);margin-bottom:8px}.freq-inputs.svelte-1cfmd5i.svelte-1cfmd5i{display:flex;align-items:flex-end;gap:8px}.input-group.svelte-1cfmd5i.svelte-1cfmd5i{flex:1}.input-group.svelte-1cfmd5i label.svelte-1cfmd5i{display:block;font-size:11px;color:var(--text-muted);margin-bottom:4px}.freq-separator.svelte-1cfmd5i.svelte-1cfmd5i{color:var(--text-muted);padding-bottom:8px}.progress-section.svelte-1cfmd5i.svelte-1cfmd5i{display:flex;flex-direction:column;gap:6px}.progress-bar-container.svelte-1cfmd5i.svelte-1cfmd5i{height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden}.progress-bar.svelte-1cfmd5i.svelte-1cfmd5i{height:100%;background:linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));border-radius:3px;transition:width 0.5s ease}.progress-text.svelte-1cfmd5i.svelte-1cfmd5i{font-size:11px;color:var(--text-muted);text-align:center}.actions.svelte-1cfmd5i.svelte-1cfmd5i{display:flex;gap:8px}.actions.svelte-1cfmd5i .btn.svelte-1cfmd5i{flex:1}.result-section.svelte-1cfmd5i.svelte-1cfmd5i{background:var(--bg-input);border-radius:var(--radius);padding:12px}.result-params.svelte-1cfmd5i.svelte-1cfmd5i{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px}.result-param.svelte-1cfmd5i.svelte-1cfmd5i{display:flex;justify-content:space-between;font-size:11px}.param-key.svelte-1cfmd5i.svelte-1cfmd5i{color:var(--text-muted)}.param-val.svelte-1cfmd5i.svelte-1cfmd5i{color:var(--accent-secondary);font-family:monospace}.band-gap-results.svelte-1cfmd5i.svelte-1cfmd5i{margin-top:12px}.gap-item.svelte-1cfmd5i.svelte-1cfmd5i{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-primary);padding:4px 0}",
  map: null
};
const OptimizationPanel = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let statusText;
  let statusBadgeClass;
  let progress;
  let $optimizationConfig, $$unsubscribe_optimizationConfig;
  let $optimizationHistory, $$unsubscribe_optimizationHistory;
  let $bestResult, $$unsubscribe_bestResult;
  let $$unsubscribe_optimizationJobId;
  let $optimizationStatus, $$unsubscribe_optimizationStatus;
  let $targetBandGap, $$unsubscribe_targetBandGap;
  $$unsubscribe_optimizationConfig = subscribe(optimizationConfig, (value) => $optimizationConfig = value);
  $$unsubscribe_optimizationHistory = subscribe(optimizationHistory, (value) => $optimizationHistory = value);
  $$unsubscribe_bestResult = subscribe(bestResult, (value) => $bestResult = value);
  $$unsubscribe_optimizationJobId = subscribe(optimizationJobId, (value) => value);
  $$unsubscribe_optimizationStatus = subscribe(optimizationStatus, (value) => $optimizationStatus = value);
  $$unsubscribe_targetBandGap = subscribe(targetBandGap, (value) => $targetBandGap = value);
  $$result.css.add(css$3);
  statusText = {
    idle: "就绪",
    queued: "排队中",
    running: "优化中...",
    completed: "已完成",
    failed: "失败"
  }[$optimizationStatus] || "未知";
  statusBadgeClass = {
    idle: "badge-info",
    queued: "badge-warning",
    running: "badge-warning",
    completed: "badge-success",
    failed: "badge-error"
  }[$optimizationStatus] || "badge-info";
  progress = $optimizationHistory.length > 0 && $optimizationConfig.budget > 0 ? Math.min($optimizationHistory.length / $optimizationConfig.budget * 100, 100) : 0;
  $$unsubscribe_optimizationConfig();
  $$unsubscribe_optimizationHistory();
  $$unsubscribe_bestResult();
  $$unsubscribe_optimizationJobId();
  $$unsubscribe_optimizationStatus();
  $$unsubscribe_targetBandGap();
  return `<div class="optimization-panel svelte-1cfmd5i"><div class="panel-header svelte-1cfmd5i"><h3 class="svelte-1cfmd5i" data-svelte-h="svelte-vlbtob">优化控制</h3> <span class="${"badge " + escape(statusBadgeClass, true) + " svelte-1cfmd5i"}">${escape(statusText)}</span></div> <div class="target-section"><div class="section-label svelte-1cfmd5i" data-svelte-h="svelte-1omlzld">目标带隙频率范围 (Hz)</div> <div class="freq-inputs svelte-1cfmd5i"><div class="input-group svelte-1cfmd5i"><label class="svelte-1cfmd5i" data-svelte-h="svelte-2d7mou">起始频率</label> <input type="number" min="100" max="5000" step="10"${add_attribute("value", $targetBandGap.start, 0)}></div> <span class="freq-separator svelte-1cfmd5i" data-svelte-h="svelte-101v1d9">—</span> <div class="input-group svelte-1cfmd5i"><label class="svelte-1cfmd5i" data-svelte-h="svelte-1f4o2su">结束频率</label> <input type="number" min="100" max="5000" step="10"${add_attribute("value", $targetBandGap.end, 0)}></div></div></div> <div class="config-section"><div class="slider-container"><div class="slider-label"><span data-svelte-h="svelte-1nepvqd">优化迭代次数</span> <span class="slider-value">${escape($optimizationConfig.budget)}</span></div> <input type="range" min="20" max="200" step="10"${add_attribute("value", $optimizationConfig.budget, 0)}></div> <div class="slider-container"><div class="slider-label"><span data-svelte-h="svelte-ymnrbt">并行工作数</span> <span class="slider-value">${escape($optimizationConfig.num_workers)}</span></div> <input type="range" min="1" max="8" step="1"${add_attribute("value", $optimizationConfig.num_workers, 0)}></div></div> ${$optimizationStatus === "running" || $optimizationStatus === "queued" ? `<div class="progress-section svelte-1cfmd5i"><div class="progress-bar-container svelte-1cfmd5i"><div class="progress-bar svelte-1cfmd5i" style="${"width: " + escape(progress, true) + "%"}"></div></div> <div class="progress-text svelte-1cfmd5i">迭代: ${escape($optimizationHistory.length)} / ${escape($optimizationConfig.budget)}</div></div>` : ``} <div class="actions svelte-1cfmd5i"><button class="btn btn-primary svelte-1cfmd5i" ${$optimizationStatus === "running" || $optimizationStatus === "queued" ? "disabled" : ""}>${$optimizationStatus === "running" || $optimizationStatus === "queued" ? `<span class="animate-spin" data-svelte-h="svelte-1qy6d4a">⟳</span>
                优化进行中` : `▶ 开始优化`}</button> <button class="btn btn-secondary svelte-1cfmd5i" data-svelte-h="svelte-1gng47i">重置</button></div> ${$bestResult ? `<div class="result-section svelte-1cfmd5i"><div class="section-label svelte-1cfmd5i" data-svelte-h="svelte-xweaac">最优结果</div> <div class="result-params svelte-1cfmd5i">${each(Object.entries($bestResult.params), ([key, value]) => {
    return `<div class="result-param svelte-1cfmd5i"><span class="param-key svelte-1cfmd5i">${escape(key)}</span> <span class="param-val svelte-1cfmd5i">${escape(typeof value === "number" ? value.toPrecision(4) : value)}</span> </div>`;
  })}</div> ${$bestResult.band_gaps && $bestResult.band_gaps.length > 0 ? `<div class="band-gap-results svelte-1cfmd5i"><div class="section-label svelte-1cfmd5i" data-svelte-h="svelte-65en9">发现的带隙</div> ${each($bestResult.band_gaps, (gap, i) => {
    return `<div class="gap-item svelte-1cfmd5i"><span class="badge badge-success">带隙 ${escape(i + 1)}</span> <span>${escape(Math.round(gap.start))} - ${escape(Math.round(gap.end))} Hz</span> </div>`;
  })}</div>` : ``}</div>` : ``} </div>`;
});
const css$2 = {
  code: ".history-chart-container.svelte-1v57vjk{width:100%;height:100%}canvas.svelte-1v57vjk{width:100%;height:100%}",
  map: null
};
const OptimizationHistoryChart = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $$unsubscribe_optimizationHistory;
  $$unsubscribe_optimizationHistory = subscribe(optimizationHistory, (value) => value);
  let canvas;
  $$result.css.add(css$2);
  $$unsubscribe_optimizationHistory();
  return `<div class="history-chart-container svelte-1v57vjk"><canvas class="svelte-1v57vjk"${add_attribute("this", canvas, 0)}></canvas> </div>`;
});
const css$1 = {
  code: ".radar-container.svelte-1idine6{position:relative;width:100%;height:100%}canvas.svelte-1idine6{width:100%;height:100%}.loading-overlay.svelte-1idine6{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(10, 14, 26, 0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;backdrop-filter:blur(4px)}.loading-text.svelte-1idine6{font-size:14px;color:var(--text-secondary);font-weight:500}.loading-subtext.svelte-1idine6{font-size:11px;color:var(--text-muted)}",
  map: null
};
const SensitivityRadarChart = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { sensitivityData = null } = $$props;
  let { loading = false } = $$props;
  let canvas;
  function resize() {
    return;
  }
  onDestroy(() => {
    window.removeEventListener("resize", resize);
  });
  if ($$props.sensitivityData === void 0 && $$bindings.sensitivityData && sensitivityData !== void 0) $$bindings.sensitivityData(sensitivityData);
  if ($$props.loading === void 0 && $$bindings.loading && loading !== void 0) $$bindings.loading(loading);
  $$result.css.add(css$1);
  return `<div class="radar-container svelte-1idine6"><canvas class="svelte-1idine6"${add_attribute("this", canvas, 0)}></canvas> ${loading ? `<div class="loading-overlay svelte-1idine6"><span class="animate-spin" style="font-size: 24px;" data-svelte-h="svelte-1gq3sau">⟳</span> <span class="loading-text svelte-1idine6" data-svelte-h="svelte-1wxgmco">Sobol敏感性分析中...</span> <span class="loading-subtext svelte-1idine6">分析 ${escape(sensitivityData?.sample_count || 4096)} 个样本</span></div>` : ``} </div>`;
});
const css = {
  code: ".app-layout.svelte-251ly0.svelte-251ly0{height:100vh;display:grid;grid-template-rows:52px 1fr 220px;gap:8px;padding:8px;background:var(--bg-primary)}.app-header.svelte-251ly0.svelte-251ly0{display:flex;justify-content:space-between;align-items:center;padding:0 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius)}.header-left.svelte-251ly0.svelte-251ly0{display:flex;align-items:center;gap:12px}.header-title.svelte-251ly0 h1.svelte-251ly0{font-size:15px;font-weight:600;background:linear-gradient(135deg, #3b82f6, #06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.subtitle.svelte-251ly0.svelte-251ly0{font-size:10px;color:var(--text-muted);letter-spacing:1px}.header-right.svelte-251ly0.svelte-251ly0{display:flex;align-items:center;gap:8px}.status-dot.svelte-251ly0.svelte-251ly0{width:8px;height:8px;border-radius:50%;background:var(--success)}.status-dot.active.svelte-251ly0.svelte-251ly0{background:var(--warning);animation:pulse 1.5s ease-in-out infinite}.status-text.svelte-251ly0.svelte-251ly0{font-size:12px;color:var(--text-muted)}.app-main.svelte-251ly0.svelte-251ly0{display:grid;grid-template-columns:280px 1fr 300px;gap:8px;min-height:0}.sidebar-left.svelte-251ly0.svelte-251ly0{overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--border-color) transparent}.center-panel.svelte-251ly0.svelte-251ly0{display:flex;flex-direction:column;gap:8px;min-height:0}.viewer-section.svelte-251ly0.svelte-251ly0{flex:1;min-height:0}.actions-bar.svelte-251ly0.svelte-251ly0{display:flex;gap:8px;justify-content:center}.sidebar-right.svelte-251ly0.svelte-251ly0{overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--border-color) transparent;display:flex;flex-direction:column;gap:8px}.sidebar-tabs.svelte-251ly0.svelte-251ly0{display:flex;gap:4px}.tab-btn.svelte-251ly0.svelte-251ly0{flex:1;padding:8px 12px;border:1px solid var(--border-color);background:var(--bg-card);border-radius:var(--radius);color:var(--text-muted);cursor:pointer;font-size:12px;transition:all 0.2s}.tab-btn.svelte-251ly0.svelte-251ly0:hover{border-color:var(--primary);color:var(--text-primary)}.tab-btn.active.svelte-251ly0.svelte-251ly0{background:var(--primary);border-color:var(--primary);color:white}.sidebar-content.svelte-251ly0.svelte-251ly0{flex:1;min-height:0;overflow-y:auto}.analysis-section.svelte-251ly0.svelte-251ly0{height:100%}.optimization-section.svelte-251ly0.svelte-251ly0{height:100%}.app-footer.svelte-251ly0.svelte-251ly0{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;min-height:0}.footer-chart.svelte-251ly0.svelte-251ly0{display:flex;flex-direction:column;overflow:hidden}.chart-header.svelte-251ly0.svelte-251ly0{padding:8px 12px;border-bottom:1px solid var(--border-color)}.chart-title.svelte-251ly0.svelte-251ly0{font-size:12px;font-weight:600;color:var(--text-secondary)}.chart-content.svelte-251ly0.svelte-251ly0{flex:1;min-height:0}",
  map: null
};
const Page = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $$unsubscribe_transmissionLossData;
  let $$unsubscribe_bandStructureData;
  let $$unsubscribe_allParams;
  let $optimizationStatus, $$unsubscribe_optimizationStatus;
  $$unsubscribe_transmissionLossData = subscribe(transmissionLossData, (value) => value);
  $$unsubscribe_bandStructureData = subscribe(bandStructureData, (value) => value);
  $$unsubscribe_allParams = subscribe(allParams, (value) => value);
  $$unsubscribe_optimizationStatus = subscribe(optimizationStatus, (value) => $optimizationStatus = value);
  $$result.css.add(css);
  $$unsubscribe_transmissionLossData();
  $$unsubscribe_bandStructureData();
  $$unsubscribe_allParams();
  $$unsubscribe_optimizationStatus();
  return `${$$result.head += `<!-- HEAD_svelte-1mnt88x_START -->${$$result.title = `<title>声学超材料逆向设计系统</title>`, ""}<!-- HEAD_svelte-1mnt88x_END -->`, ""} <div class="app-layout svelte-251ly0"><header class="app-header svelte-251ly0"><div class="header-left svelte-251ly0" data-svelte-h="svelte-oq12a4"><div class="logo"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="1.5"></circle><circle cx="12" cy="12" r="6" stroke="#06b6d4" stroke-width="1.5"></circle><circle cx="12" cy="12" r="2" fill="#8b5cf6"></circle><line x1="12" y1="2" x2="12" y2="22" stroke="#1e3a5f" stroke-width="0.5"></line><line x1="2" y1="12" x2="22" y2="12" stroke="#1e3a5f" stroke-width="0.5"></line></svg></div> <div class="header-title svelte-251ly0"><h1 class="svelte-251ly0">声学超材料逆向设计系统</h1> <span class="subtitle svelte-251ly0">Acoustic Metamaterial Inverse Design</span></div></div> <div class="header-right svelte-251ly0"><span class="${["status-dot svelte-251ly0", $optimizationStatus === "running" ? "active" : ""].join(" ").trim()}"></span> <span class="status-text svelte-251ly0">${$optimizationStatus === "running" ? `优化运行中` : `系统就绪`}</span></div></header> <main class="app-main svelte-251ly0"><aside class="sidebar-left card svelte-251ly0">${validate_component(ParameterPanel, "ParameterPanel").$$render($$result, {}, {}, {})}</aside> <section class="center-panel svelte-251ly0"><div class="viewer-section card svelte-251ly0">${validate_component(ModelViewer, "ModelViewer").$$render($$result, {}, {}, {})}</div> <div class="actions-bar svelte-251ly0"><button class="btn btn-primary" ${""}>${`⚡ 计算能带结构`}</button></div></section> <aside class="sidebar-right svelte-251ly0"><div class="sidebar-tabs svelte-251ly0"><button class="${["tab-btn svelte-251ly0", "active"].join(" ").trim()}" data-svelte-h="svelte-1f0jwh5">🎯 优化</button> <button class="${["tab-btn svelte-251ly0", ""].join(" ").trim()}" data-svelte-h="svelte-1rbksk7">📊 分析</button></div> <div class="${[
    "sidebar-content svelte-251ly0",
    "optimization "
  ].join(" ").trim()}">${`<div class="optimization-section card svelte-251ly0">${validate_component(OptimizationPanel, "OptimizationPanel").$$render($$result, {}, {}, {})}</div>`}</div></aside></main> <footer class="app-footer svelte-251ly0"><div class="footer-chart card svelte-251ly0"><div class="chart-header svelte-251ly0" data-svelte-h="svelte-5yc16o"><span class="chart-title svelte-251ly0">能带结构</span></div> <div class="chart-content svelte-251ly0">${validate_component(BandStructureChart, "BandStructureChart").$$render($$result, {}, {}, {})}</div></div> <div class="footer-chart card svelte-251ly0"><div class="chart-header svelte-251ly0" data-svelte-h="svelte-9i4ije"><span class="chart-title svelte-251ly0">优化历史</span></div> <div class="chart-content svelte-251ly0">${validate_component(OptimizationHistoryChart, "OptimizationHistoryChart").$$render($$result, {}, {}, {})}</div></div> <div class="footer-chart card svelte-251ly0"><div class="chart-header svelte-251ly0" data-svelte-h="svelte-1v734fx"><span class="chart-title svelte-251ly0">参数敏感性</span></div> <div class="chart-content svelte-251ly0">${validate_component(SensitivityRadarChart, "SensitivityRadarChart").$$render($$result, {}, {}, {})}</div></div></footer> </div>`;
});
export {
  Page as default
};

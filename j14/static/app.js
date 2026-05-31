(function () {
  const eqInput = document.getElementById("equation");
  const solveBtn = document.getElementById("solveBtn");
  const parseBtn = document.getElementById("parseBtn");
  const clearBtn = document.getElementById("clearBtn");
  const infoEl = document.getElementById("info");
  const typesEl = document.getElementById("types");
  const stepsEl = document.getElementById("steps");
  const generalEl = document.getElementById("general");
  const particularEl = document.getElementById("particular");
  const verEl = document.getElementById("verification");
  const errorPanel = document.getElementById("error");
  const errorMsg = document.getElementById("errorMsg");
  const statusEl = document.getElementById("status");
  const numPanel = document.getElementById("numPanel");
  const numMetricsEl = document.getElementById("numMetrics");
  const numPlotEl = document.getElementById("numPlot");
  const numErrorReportEl = document.getElementById("numErrorReport");

  function getFormat() {
    const radios = document.querySelectorAll("input[name=format]");
    for (const r of radios) if (r.checked) return r.value;
    return "latex";
  }

  function setStatus(text) { statusEl.textContent = text || ""; }

  function showError(msg) {
    errorPanel.classList.remove("hidden");
    errorMsg.textContent = msg;
  }
  function clearError() {
    errorPanel.classList.add("hidden");
    errorMsg.textContent = "";
  }

  function clearResults() {
    infoEl.innerHTML = "";
    typesEl.innerHTML = "";
    stepsEl.innerHTML = "";
    generalEl.innerHTML = "";
    particularEl.innerHTML = "";
    verEl.innerHTML = "";
    numPanel.classList.add("hidden");
    numMetricsEl.innerHTML = "";
    numPlotEl.innerHTML = "";
    numErrorReportEl.innerHTML = "";
  }

  function renderInfo(input) {
    if (!input) return;
    const items = [
      { k: "原方程", v: input.eq ? (input.eq.latex || input.eq.str) : "" },
      { k: "未知函数", v: input.func ? `${input.func}(${input.var})` : "" },
      { k: "自变量", v: input.var },
      { k: "阶数", v: input.order },
      { k: "自由参数", v: (input.free_params || []).join(", ") || "无" },
    ];
    infoEl.innerHTML = items.map(i => `
      <div class="info-item">
        <div class="k">${i.k}</div>
        <div class="v">${i.v || "—"}</div>
      </div>
    `).join("");
  }

  function renderTypes(types, primaryCode) {
    if (!types || !types.length) {
      typesEl.innerHTML = '<div class="info-item"><div class="k">未匹配到特定类型</div></div>';
      return;
    }
    typesEl.innerHTML = types.map(t => `
      <div class="type-card ${t.code === primaryCode ? "primary" : ""}">
        <span class="score">匹配度 ${t.match_score}</span>
        <div class="code">${t.code}</div>
        <div class="name">${t.name_cn} <small style="color:var(--muted)">${t.name_en}</small></div>
        <div class="desc">${t.description}</div>
        <div class="math" style="background:#0b0d18;padding:6px 8px;border-radius:6px;margin-top:6px;overflow-x:auto;">
          $$ ${t.canonical_form} $$
        </div>
      </div>
    `).join("");
  }

  function renderSteps(steps) {
    if (!steps || !steps.length) {
      stepsEl.innerHTML = '<li class="step"><div class="title">暂无步骤</div></li>';
      return;
    }
    stepsEl.innerHTML = steps.map(s => `
      <li class="step">
        <div class="title">${s.title}</div>
        <div class="desc">${s.description || ""}</div>
        ${s.math ? `<div class="math">$$ ${s.math} $$</div>` : ""}
      </li>
    `).join("");
  }

  function renderSolutions(general, particular) {
    generalEl.innerHTML = (general && general.length)
      ? general.map(s => `<li>$$ ${s.latex || s.str} $$</li>`).join("")
      : '<li style="color:var(--muted);">无</li>';
    particularEl.innerHTML = (particular && particular.length)
      ? particular.map(s => `<li>$$ ${s.latex || s.str} $$</li>`).join("")
      : '<li style="color:var(--muted);">无</li>';
  }

  function renderVerification(list) {
    if (!list || !list.length) {
      verEl.innerHTML = '<li>无验证结果</li>';
      return;
    }
    verEl.innerHTML = list.map(v => {
      const flag = v.verified
        ? '<span class="ok">✓ 验证通过</span>'
        : '<span class="bad">✗ 残差非零</span>';
      return `<li>
        ${flag}
        <div>解: $$ ${v.solution.latex || v.solution.str} $$</div>
        <div>残差: <code>${v.residual && v.residual.latex ? "" : ""}</code>
          $$ ${v.residual ? (v.residual.latex || v.residual.str) : "0"} $$
        </div>
        <div style="color:var(--muted);font-size:12px;margin-top:4px;">${v.message}</div>
      </li>`;
    }).join("");
  }

  function reprocessMath() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(() => {});
    }
  }

  function renderNumerical(num) {
    if (!num || !num.x_values || !num.x_values.length) {
      numPanel.classList.add("hidden");
      return;
    }

    numPanel.classList.remove("hidden");

    const statusOk = num.status === "success" || num.status === "warning";
    const maeBad = num.mae > 1e-4;
    const rmseBad = num.rmse > 1e-4;

    numMetricsEl.innerHTML = `
      <div class="metric-card good">
        <div class="label">MAE (平均绝对误差)</div>
        <div class="value">${num.mae.toExponential(3)}</div>
      </div>
      <div class="metric-card ${maeBad ? 'bad' : 'good'}">
        <div class="label">RMSE (均方根误差)</div>
        <div class="value">${num.rmse.toExponential(3)}</div>
      </div>
      <div class="metric-card">
        <div class="label">最大误差</div>
        <div class="value">${num.max_error.toExponential(3)}</div>
      </div>
      <div class="metric-card">
        <div class="label">最大误差点 x</div>
        <div class="value">${num.max_error_x.toFixed(4)}</div>
      </div>
    `;

    if (window.Plotly) {
      const traceSymbolic = {
        x: num.x_values,
        y: num.y_symbolic,
        mode: 'lines',
        name: '符号解',
        line: { color: '#6ea8ff', width: 2.5 }
      };
      const traceNumerical = {
        x: num.x_values,
        y: num.y_numerical,
        mode: 'lines',
        name: '数值解 (RK45)',
        line: { color: '#8affc1', width: 1.5, dash: 'dot' }
      };

      const data = [traceSymbolic, traceNumerical];

      const validCount = num.y_symbolic.filter(v => isFinite(v)).length;
      const totalCount = num.x_values.length;

      const layout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#e6e8f2', family: 'Segoe UI' },
        title: { text: '符号解 vs 数值解对比', font: { size: 14, color: '#8affc1' } },
        xaxis: {
          title: 'x',
          gridcolor: '#2b3054',
          zerolinecolor: '#2b3054',
        },
        yaxis: {
          title: 'y(x)',
          gridcolor: '#2b3054',
          zerolinecolor: '#2b3054',
        },
        legend: { x: 0.01, y: 0.99, bgcolor: 'rgba(23,26,46,0.8)' },
        margin: { t: 40, r: 20, b: 40, l: 50 },
        hovermode: 'x unified',
        annotations: []
      };

      if (!statusOk) {
        layout.annotations.push({
          text: num.status === 'warning'
            ? `⚠️ 仅 ${validCount}/${totalCount} 个点有效`
            : `❌ ${num.error_message || '数值求解失败'}`,
          x: 0.5, y: 1.08, xref: 'paper', yref: 'paper',
          showarrow: false,
          font: { color: '#ffb86b', size: 12 },
        });
      }

      const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false,
      };

      Plotly.newPlot(numPlotEl, data, layout, config);
    } else {
      numPlotEl.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center;">Plotly 加载失败</div>';
    }

    const errReport = [];
    if (num.initial_condition) {
      errReport.push({ k: '初始条件', v: `y(${num.initial_condition.x0}) = ${num.initial_condition.y0}` });
    }
    if (num.params_values && Object.keys(num.params_values).length > 0) {
      const pv = Object.entries(num.params_values).map(([k, v]) => `${k}=${v}`).join(', ');
      errReport.push({ k: '参数取值', v: pv });
    }
    if (num.ode_rhs_expr) {
      errReport.push({ k: "y' =", v: num.ode_rhs_expr });
    }
    errReport.push({ k: '区间', v: `[${num.x_values[0]}, ${num.x_values[num.x_values.length - 1]}]` });
    errReport.push({ k: '采样点数', v: num.x_values.length });
    errReport.push({ k: '有效点数', v: `${validCount}/${totalCount}` });

    numErrorReportEl.innerHTML = `
      <h3>误差分析报告</h3>
      ${errReport.map(r => `
        <div class="error-report-row">
          <span class="k">${r.k}</span>
          <span class="v">${r.v}</span>
        </div>
      `).join('')}
    `;
  }

  async function doParse() {
    clearError();
    const raw = eqInput.value.trim();
    if (!raw) { showError("请输入方程"); return; }
    setStatus("解析中...");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equation: raw, format: getFormat() })
      });
      const data = await res.json();
      if (!data.ok) { showError(data.error || "解析失败"); setStatus(""); return; }
      clearResults();
      renderInfo(data.input);
      setStatus("解析完成");
      reprocessMath();
    } catch (e) {
      showError(String(e));
      setStatus("");
    }
  }

  async function doSolve() {
    clearError();
    const raw = eqInput.value.trim();
    if (!raw) { showError("请输入方程"); return; }
    setStatus("求解中...");
    solveBtn.disabled = true;

    const computeNum = document.getElementById("computeNum").checked;
    const numX0 = parseFloat(document.getElementById("numX0").value);
    const numXEnd = parseFloat(document.getElementById("numXEnd").value);
    const numY0 = parseFloat(document.getElementById("numY0").value);
    const numPoints = parseInt(document.getElementById("numPoints").value);

    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equation: raw,
          format: getFormat(),
          compute_numerical: computeNum,
          num_x_start: numX0,
          num_x_end: numXEnd,
          num_points: numPoints,
          num_y0: numY0,
        })
      });
      const data = await res.json();
      if (!data.ok) { showError(data.error || "求解失败"); setStatus(""); solveBtn.disabled = false; return; }
      clearResults();
      renderInfo(data.ode_input);
      renderTypes(data.matched_types, data.primary_type && data.primary_type.code);
      renderSteps(data.steps);
      renderSolutions(data.general_solutions, data.particular_solutions);
      renderVerification(data.verification);

      if (data.numerical_comparison) {
        renderNumerical(data.numerical_comparison);
      }

      const cacheTag = data.cached ? "（缓存命中）" : "";
      setStatus(`完成 · ${data.elapsed_ms || ""} ms ${cacheTag}`);
      reprocessMath();
    } catch (e) {
      showError(String(e));
      setStatus("");
    } finally {
      solveBtn.disabled = false;
    }
  }

  solveBtn.addEventListener("click", doSolve);
  parseBtn.addEventListener("click", doParse);
  clearBtn.addEventListener("click", () => {
    eqInput.value = "";
    clearResults();
    clearError();
    setStatus("");
  });

  eqInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") doSolve();
  });

  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      eqInput.value = chip.dataset.eq;
    });
  });
})();

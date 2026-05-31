const socket = io();

const WORLD_MAP_PATH = 'm 117.46,125.06 c 3.81,-0.44 8.71,-1.08 11.83,-1.42 3.13,-0.35 5.82,-0.52 9.4,-0.94 3.58,-0.42 7.88,-0.9 10.06,-1.47 2.18,-0.57 2.93,-1.22 4.13,-1.95 1.2,-0.73 2.86,-1.59 4.2,-2.05 1.34,-0.46 2.36,-0.51 4.2,-0.64 1.84,-0.13 4.34,-0.22 6.05,0.04 1.7,0.26 2.67,0.69 4.08,1.33 1.41,0.64 2.57,1.52 4.33,2.39 1.76,0.87 3.77,1.73 5.83,2.05 2.06,0.32 4.59,-0.07 6.35,-0.37 1.76,-0.3 2.81,-0.48 4.52,-0.81 1.71,-0.33 4.09,-0.8 5.78,-1.15 1.69,-0.35 2.77,-0.52 4.58,-0.6 1.81,-0.08 4.15,0.09 5.54,0.45 1.39,0.36 2.3,0.91 3.89,1.6 1.59,0.69 3.51,1.54 5.51,1.63 2,0.09 4.31,-0.54 6.22,-0.85 1.91,-0.31 3.67,-0.32 5.64,-0.46 1.97,-0.14 4.35,-0.32 5.94,-0.53 1.59,-0.21 2.78,-0.45 4.47,-0.57 1.69,-0.12 3.97,-0.16 5.64,-0.28 1.67,-0.12 2.71,-0.33 4.36,-0.49 1.65,-0.16 3.79,-0.36 5.37,-0.22 1.58,0.14 2.56,0.49 4.04,1.06 1.48,0.57 3.46,1.38 5.51,1.55 2.05,0.17 4.68,-0.09 6.82,-0.11 2.14,-0.02 4.9,0.27 7.08,0.12 2.18,-0.15 4.46,-0.64 6.58,-0.68 2.12,-0.04 4.56,0.35 6.61,0.69 2.05,0.34 3.47,0.77 4.73,1.38 1.26,0.61 2.54,1.37 4.42,1.77 1.88,0.4 4.36,0.45 6.68,0.58 2.32,0.13 4.97,0.24 7.04,0.04 2.07,-0.2 3.5,-0.71 4.97,-1.2 1.47,-0.49 2.97,-1.02 5.03,-1.05 2.06,-0.03 4.67,0.44 6.65,0.84 1.98,0.4 3.84,0.88 6.12,0.88 2.28,0 4.9,-0.38 7.05,-0.58 2.15,-0.2 4.16,-0.38 6.51,-0.38 2.35,0 5.04,0 7.38,-0.17 2.34,-0.17 4.34,-0.52 6.52,-0.72 2.18,-0.2 4.54,-0.29 6.62,-0.47 2.08,-0.18 4.06,-0.49 6.14,-0.62 2.08,-0.13 4.45,-0.13 6.51,-0.07 2.06,0.06 3.97,0.27 6.03,0.33 2.06,0.06 4.37,-0.03 6.38,-0.16 2.01,-0.13 3.89,-0.4 5.92,-0.43 2.03,-0.03 4.37,0.06 6.3,0.36 1.93,0.3 3.69,0.74 5.74,0.74 2.05,0 4.4,-0.3 6.36,-0.47 1.96,-0.17 3.81,-0.33 5.84,-0.28 2.03,0.05 4.27,0.18 6.17,0.02 1.9,-0.16 3.67,-0.5 5.68,-0.5 2.01,0 4.35,0.14 6.24,-0.06 1.89,-0.2 3.66,-0.5 5.69,-0.5 2.03,0 4.36,0.14 6.25,-0.06 z';

function generateWorldMap() {
  const svg = document.getElementById('worldMap');
  const width = 1000;
  const height = 500;
  
  svg.innerHTML = '';
  
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
  const glowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  glowFilter.setAttribute('id', 'nodeGlow');
  glowFilter.innerHTML = `
    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  `;
  defs.appendChild(glowFilter);
  
  const mapGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  mapGradient.setAttribute('id', 'mapGradient');
  mapGradient.setAttribute('x1', '0%');
  mapGradient.setAttribute('y1', '0%');
  mapGradient.setAttribute('x2', '100%');
  mapGradient.setAttribute('y2', '100%');
  mapGradient.innerHTML = `
    <stop offset="0%" style="stop-color:#1e3a5f;stop-opacity:0.8" />
    <stop offset="50%" style="stop-color:#2d5a87;stop-opacity:0.9" />
    <stop offset="100%" style="stop-color:#1e3a5f;stop-opacity:0.8" />
  `;
  defs.appendChild(mapGradient);
  
  svg.appendChild(defs);
  
  const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  gridGroup.setAttribute('opacity', '0.1');
  
  for (let i = 0; i <= 12; i++) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', i * (width / 12));
    line.setAttribute('y1', 0);
    line.setAttribute('x2', i * (width / 12));
    line.setAttribute('y2', height);
    line.setAttribute('stroke', '#64ffda');
    line.setAttribute('stroke-width', '0.5');
    gridGroup.appendChild(line);
  }
  
  for (let i = 0; i <= 6; i++) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('y1', i * (height / 6));
    line.setAttribute('x2', width);
    line.setAttribute('y2', i * (height / 6));
    line.setAttribute('stroke', '#64ffda');
    line.setAttribute('stroke-width', '0.5');
    gridGroup.appendChild(line);
  }
  
  svg.appendChild(gridGroup);
  
  drawContinents(svg);
  
  const equator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  equator.setAttribute('x1', 0);
  equator.setAttribute('y1', height / 2);
  equator.setAttribute('x2', width);
  equator.setAttribute('y2', height / 2);
  equator.setAttribute('stroke', '#64ffda');
  equator.setAttribute('stroke-width', '0.5');
  equator.setAttribute('stroke-dasharray', '5,5');
  equator.setAttribute('opacity', '0.3');
  svg.appendChild(equator);
  
  const primeMeridian = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  primeMeridian.setAttribute('x1', width / 2);
  primeMeridian.setAttribute('y1', 0);
  primeMeridian.setAttribute('x2', width / 2);
  primeMeridian.setAttribute('y2', height);
  primeMeridian.setAttribute('stroke', '#64ffda');
  primeMeridian.setAttribute('stroke-width', '0.5');
  primeMeridian.setAttribute('stroke-dasharray', '5,5');
  primeMeridian.setAttribute('opacity', '0.3');
  svg.appendChild(primeMeridian);
  
  const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nodesGroup.setAttribute('id', 'nodesGroup');
  svg.appendChild(nodesGroup);
  
  const connectionsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  connectionsGroup.setAttribute('id', 'connectionsGroup');
  svg.appendChild(connectionsGroup);
}

function drawContinents(svg) {
  const continents = [
    { d: 'M 150,120 Q 200,100 250,120 Q 300,140 350,130 Q 400,120 450,140 Q 500,160 550,150 Q 600,140 650,160 L 650,200 Q 600,220 550,210 Q 500,200 450,220 Q 400,240 350,230 Q 300,220 250,240 Q 200,260 150,250 Z', name: '北美洲' },
    { d: 'M 180,280 Q 230,260 280,290 Q 330,320 360,310 Q 390,300 410,330 Q 420,370 400,410 Q 380,450 350,440 Q 320,430 290,450 Q 260,470 230,450 Q 200,430 190,400 Q 180,370 180,340 Z', name: '南美洲' },
    { d: 'M 450,130 Q 520,110 590,130 Q 660,150 730,140 Q 800,130 850,150 Q 900,170 880,200 Q 860,230 820,240 Q 780,250 740,240 Q 700,230 660,250 Q 620,270 580,260 Q 540,250 500,270 Q 460,290 430,270 Q 400,250 410,220 Q 420,190 450,180 Z', name: '欧亚大陆' },
    { d: 'M 520,290 Q 580,270 640,290 Q 700,310 740,300 Q 780,290 810,310 Q 820,340 800,370 Q 780,400 750,390 Q 720,380 680,400 Q 640,420 600,410 Q 560,400 540,380 Q 520,360 520,330 Z', name: '非洲' },
    { d: 'M 780,380 Q 830,370 880,390 Q 920,410 910,440 Q 900,470 870,460 Q 840,450 810,470 Q 780,490 750,470 Q 720,450 730,420 Q 740,390 780,380 Z', name: '大洋洲' },
    { d: 'M 250,450 Q 350,440 450,450 Q 550,460 650,450 Q 750,440 850,450 L 850,480 Q 750,490 650,485 Q 550,480 450,485 Q 350,490 250,480 Z', name: '南极洲' }
  ];
  
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  continents.forEach(continent => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', continent.d);
    path.setAttribute('fill', 'url(#mapGradient)');
    path.setAttribute('stroke', '#64ffda');
    path.setAttribute('stroke-width', '0.5');
    path.setAttribute('opacity', '0.6');
    group.appendChild(path);
  });
  
  svg.insertBefore(group, svg.firstChild.nextSibling);
}

function latLngToXY(lat, lng, width = 1000, height = 500) {
  const x = (lng + 180) * (width / 360);
  const y = (90 - lat) * (height / 180);
  return { x, y };
}

function updateNodes(workers) {
  const nodesGroup = document.getElementById('nodesGroup');
  const connectionsGroup = document.getElementById('connectionsGroup');
  
  nodesGroup.innerHTML = '';
  connectionsGroup.innerHTML = '';
  
  if (workers.length === 0) return;
  
  const centerX = 500;
  const centerY = 250;
  
  workers.forEach((worker, index) => {
    if (!worker.location) return;
    
    const { lat, lng, city, country } = worker.location;
    const { x, y } = latLngToXY(lat, lng);
    
    const markerId = `node-${worker.id}`;
    
    const glowCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glowCircle.setAttribute('cx', x);
    glowCircle.setAttribute('cy', y);
    glowCircle.setAttribute('r', 15 + Math.min(worker.cores * 2, 20));
    glowCircle.setAttribute('fill', worker.isBackground ? '#f59e0b' : '#10b981');
    glowCircle.setAttribute('opacity', '0.15');
    glowCircle.setAttribute('class', 'node-pulse');
    glowCircle.setAttribute('style', `animation-delay: ${index * 0.3}s`);
    nodesGroup.appendChild(glowCircle);
    
    const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outerCircle.setAttribute('cx', x);
    outerCircle.setAttribute('cy', y);
    outerCircle.setAttribute('r', 8 + Math.min(worker.cores, 8));
    outerCircle.setAttribute('fill', 'none');
    outerCircle.setAttribute('stroke', worker.isBackground ? '#f59e0b' : '#10b981');
    outerCircle.setAttribute('stroke-width', '1.5');
    outerCircle.setAttribute('opacity', '0.5');
    nodesGroup.appendChild(outerCircle);
    
    const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerCircle.setAttribute('cx', x);
    innerCircle.setAttribute('cy', y);
    innerCircle.setAttribute('r', 4 + Math.min(worker.cores * 0.5, 4));
    innerCircle.setAttribute('fill', worker.isBackground ? '#f59e0b' : '#10b981');
    innerCircle.setAttribute('filter', 'url(#nodeGlow)');
    innerCircle.setAttribute('class', 'node-marker');
    innerCircle.setAttribute('data-worker-id', worker.id);
    nodesGroup.appendChild(innerCircle);
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', y + 18 + Math.min(worker.cores, 8));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'node-label');
    label.textContent = city;
    nodesGroup.appendChild(label);
    
    innerCircle.addEventListener('mouseenter', (e) => showTooltip(e, worker));
    innerCircle.addEventListener('mousemove', moveTooltip);
    innerCircle.addEventListener('mouseleave', hideTooltip);
    
    const connection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const midX = (x + centerX) / 2;
    const midY = Math.min(y, centerY) - 50;
    const d = `M ${x} ${y} Q ${midX} ${midY} ${centerX} ${centerY}`;
    connection.setAttribute('d', d);
    connection.setAttribute('stroke', worker.isBackground ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.4)');
    connection.setAttribute('stroke-width', '1');
    connection.setAttribute('fill', 'none');
    connection.setAttribute('stroke-dasharray', '4,4');
    connection.setAttribute('class', 'heat-connection');
    connection.setAttribute('style', `animation: dash 3s linear infinite; animation-delay: ${index * 0.2}s`);
    connectionsGroup.appendChild(connection);
  });
  
  const serverGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  serverGlow.setAttribute('cx', centerX);
  serverGlow.setAttribute('cy', centerY);
  serverGlow.setAttribute('r', 30);
  serverGlow.setAttribute('fill', '#64ffda');
  serverGlow.setAttribute('opacity', '0.2');
  serverGlow.setAttribute('class', 'node-pulse');
  connectionsGroup.appendChild(serverGlow);
  
  const serverCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  serverCircle.setAttribute('cx', centerX);
  serverCircle.setAttribute('cy', centerY);
  serverCircle.setAttribute('r', 12);
  serverCircle.setAttribute('fill', '#64ffda');
  serverCircle.setAttribute('filter', 'url(#nodeGlow)');
  serverCircle.setAttribute('stroke', '#0a0e1a');
  serverCircle.setAttribute('stroke-width', '2');
  connectionsGroup.appendChild(serverCircle);
  
  const serverLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  serverLabel.setAttribute('x', centerX);
  serverLabel.setAttribute('y', centerY + 4);
  serverLabel.setAttribute('text-anchor', 'middle');
  serverLabel.setAttribute('dominant-baseline', 'middle');
  serverLabel.setAttribute('fill', '#0a0e1a');
  serverLabel.setAttribute('font-family', 'Space Mono, monospace');
  serverLabel.setAttribute('font-size', '8');
  serverLabel.setAttribute('font-weight', 'bold');
  serverLabel.textContent = 'SRV';
  connectionsGroup.appendChild(serverLabel);
}

function showTooltip(e, worker) {
  const tooltip = document.getElementById('nodeTooltip');
  const { city, country, ip, source } = worker.location;
  
  tooltip.innerHTML = `
    <div class="tooltip-title">${city}, ${country}</div>
    <div class="tooltip-row">
      <span>节点 ID:</span>
      <span class="tooltip-value">${worker.id.substring(0, 10)}...</span>
    </div>
    <div class="tooltip-row">
      <span>CPU 核心:</span>
      <span class="tooltip-value">${worker.cores} 核</span>
    </div>
    <div class="tooltip-row">
      <span>已完成:</span>
      <span class="tooltip-value">${worker.tilesCompleted} 块</span>
    </div>
    <div class="tooltip-row">
      <span>累计时长:</span>
      <span class="tooltip-value">${formatTime(worker.totalRenderTime)}</span>
    </div>
    <div class="tooltip-row">
      <span>状态:</span>
      <span class="tooltip-value" style="color: ${worker.isBackground ? '#f59e0b' : '#10b981'}">${worker.isBackground ? '后台运行' : '活跃'}</span>
    </div>
    <div class="tooltip-row">
      <span>IP 来源:</span>
      <span class="tooltip-value" style="font-size: 0.7rem; opacity: 0.7;">${ip} (${source === 'real' ? '真实定位' : '模拟定位'})</span>
    </div>
  `;
  
  tooltip.style.opacity = '1';
  moveTooltip(e);
}

function moveTooltip(e) {
  const tooltip = document.getElementById('nodeTooltip');
  tooltip.style.left = (e.clientX + 15) + 'px';
  tooltip.style.top = (e.clientY + 15) + 'px';
}

function hideTooltip() {
  const tooltip = document.getElementById('nodeTooltip');
  tooltip.style.opacity = '0';
}

function formatTime(ms) {
  if (!ms) return '0s';
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  if (ms < 3600000) return (ms / 60000).toFixed(1) + 'm';
  return (ms / 3600000).toFixed(1) + 'h';
}

function updateStats(stats) {
  document.getElementById('activeWorkers').textContent = stats.activeWorkers;
  document.getElementById('totalCores').textContent = stats.totalCores;
  document.getElementById('totalTiles').textContent = stats.totalTiles;
  document.getElementById('backgroundWorkers').textContent = stats.backgroundWorkers;
  document.getElementById('nodeCount').textContent = stats.activeWorkers + ' 节点';
  document.getElementById('workerCount').textContent = stats.activeWorkers;
  document.getElementById('totalTime').textContent = formatTime(stats.totalRenderTime);
  
  if (stats.jobsRunning !== undefined) {
    document.getElementById('jobsRunning').textContent = stats.jobsRunning;
    document.getElementById('jobsCompleted').textContent = stats.jobsCompleted;
    
    const totalTilesAll = stats.totalTilesAllTime || 1;
    const completedTiles = stats.completedTilesAllTime || 0;
    const progress = totalTilesAll > 0 ? Math.floor((completedTiles / totalTilesAll) * 100) : 0;
    document.getElementById('totalProgress').textContent = progress + '%';
  }
  
  updateWorkersList(stats.workers || []);
  updateTopWorkers(stats.workers || []);
  updateNodes(stats.workers || []);
}

function updateWorkersList(workers) {
  const list = document.getElementById('workersList');
  
  if (workers.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-secondary);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;">🔌</div>
        <div>暂无连接的节点</div>
      </div>
    `;
    return;
  }
  
  list.innerHTML = workers
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .map(worker => `
      <div class="worker-item ${worker.isBackground ? 'background' : ''}">
        <div class="worker-header">
          <span class="worker-id">${worker.id.substring(0, 8)}...</span>
          <div class="worker-status ${worker.isBackground ? 'background' : 'active'}"></div>
        </div>
        <div class="worker-location">
          <span>📍</span>
          <span>${worker.location ? worker.location.city + ', ' + worker.location.country : '未知位置'}</span>
        </div>
        <div class="worker-stats">
          <div class="worker-stat">
            <span class="worker-stat-label">核心</span>
            <span class="worker-stat-value">${worker.cores}</span>
          </div>
          <div class="worker-stat">
            <span class="worker-stat-label">完成</span>
            <span class="worker-stat-value">${worker.tilesCompleted}</span>
          </div>
          <div class="worker-stat">
            <span class="worker-stat-label">总时长</span>
            <span class="worker-stat-value">${formatTime(worker.totalRenderTime)}</span>
          </div>
          <div class="worker-stat">
            <span class="worker-stat-label">状态</span>
            <span class="worker-stat-value" style="color: ${worker.isBackground ? '#f59e0b' : '#10b981'}">${worker.isBackground ? '后台' : '活跃'}</span>
          </div>
        </div>
      </div>
    `).join('');
}

function updateTopWorkers(workers) {
  const list = document.getElementById('topWorkers');
  
  if (workers.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 1rem; color: var(--text-secondary);">
        <div>等待数据...</div>
      </div>
    `;
    return;
  }
  
  const topWorkers = [...workers]
    .sort((a, b) => b.tilesCompleted - a.tilesCompleted)
    .slice(0, 5);
  
  const maxTiles = Math.max(...topWorkers.map(w => w.tilesCompleted), 1);
  
  list.innerHTML = topWorkers.map((worker, idx) => `
    <div class="worker-item ${worker.isBackground ? 'background' : ''}" style="margin-bottom: 0.375rem; padding: 0.5rem 0.75rem;">
      <div class="worker-header">
        <span class="worker-id" style="font-size: 0.75rem;">#${idx + 1} ${worker.location?.city || '未知'}</span>
        <div class="worker-status ${worker.isBackground ? 'background' : 'active'}" style="width: 6px; height: 6px;"></div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
        <div style="flex: 1; height: 4px; background: rgba(100, 255, 218, 0.1); border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; width: ${(worker.tilesCompleted / maxTiles) * 100}%; background: linear-gradient(90deg, #64ffda, #4cc9f0); border-radius: 2px;"></div>
        </div>
        <span style="font-family: 'Space Mono', monospace; font-size: 0.7rem; color: var(--accent-primary); min-width: 2rem; text-align: right;">${worker.tilesCompleted}</span>
      </div>
    </div>
  `).join('');
}

function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
  document.getElementById('currentTime').textContent = timeStr;
}

generateWorldMap();
updateTime();
setInterval(updateTime, 1000);

socket.on('connect', () => {
  document.getElementById('serverStatus').textContent = '● 在线';
  document.getElementById('serverStatus').style.color = 'var(--success)';
  document.getElementById('refreshRate').textContent = '实时';
  
  fetch('/api/global-stats')
    .then(res => res.json())
    .then(data => updateStats(data))
    .catch(err => console.error('Failed to load stats:', err));
});

socket.on('disconnect', () => {
  document.getElementById('serverStatus').textContent = '● 离线';
  document.getElementById('serverStatus').style.color = 'var(--error)';
  document.getElementById('refreshRate').textContent = '连接断开';
});

socket.on('globalStats', (stats) => {
  updateStats(stats);
});

socket.on('workerUpdate', (workers) => {
  updateWorkersList(workers);
  updateTopWorkers(workers);
  updateNodes(workers);
  
  document.getElementById('activeWorkers').textContent = workers.length;
  document.getElementById('nodeCount').textContent = workers.length + ' 节点';
  document.getElementById('workerCount').textContent = workers.length;
  document.getElementById('backgroundWorkers').textContent = workers.filter(w => w.isBackground).length;
});

setInterval(() => {
  if (socket.connected) {
    fetch('/api/global-stats')
      .then(res => res.json())
      .then(data => updateStats(data))
      .catch(() => {});
  }
}, 5000);

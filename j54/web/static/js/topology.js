(function () {
    "use strict";

    const NODE_COLORS = {
        Chart: "#3b82f6",
        Image: "#10b981",
        Dependency: "#f59e0b",
    };

    const VULN_COLORS = {
        CRITICAL: "#ef4444",
        HIGH: "#f97316",
        MEDIUM: "#f59e0b",
        LOW: "#10b981",
        NONE: null,
    };

    const LINK_COLORS = {
        USES_IMAGE: "#10b981",
        DEPENDS_ON: "#f59e0b",
    };

    const NODE_RADIUS = {
        Chart: 22,
        Image: 16,
        Dependency: 16,
    };

    let simulation, svg, linkGroup, nodeGroup, linkElements, nodeElements, zoom;
    let currentData = { nodes: [], links: [] };

    const container = document.getElementById("topology-container");
    const tooltip = document.getElementById("tooltip");
    const sidebar = document.getElementById("sidebar");
    const sidebarTitle = document.getElementById("sidebar-title");
    const sidebarContent = document.getElementById("sidebar-content");

    function getWidth() {
        return container.clientWidth;
    }

    function getHeight() {
        return container.clientHeight;
    }

    function getNodeVulnInfo(d) {
        if (!d || d.label !== "Image" || !d.properties) return null;
        const sev = d.properties.highest_severity;
        if (!sev || sev === "NONE") return null;
        return {
            severity: sev,
            color: VULN_COLORS[sev] || null,
            hasPulse: sev === "CRITICAL" || sev === "HIGH",
            pulseClass: sev.toLowerCase(),
            total: d.properties.total_vulnerabilities || 0,
            severity_counts: d.properties.severity_counts,
            cve_list: d.properties.cve_list,
        };
    }

    function getNodeFillColor(d) {
        const vuln = getNodeVulnInfo(d);
        if (vuln && vuln.color) return vuln.color;
        return NODE_COLORS[d.label] || "#64748b";
    }

    function initSvg() {
        d3.select("#topology-container").select("svg").remove();

        svg = d3
            .select("#topology-container")
            .append("svg")
            .attr("width", getWidth())
            .attr("height", getHeight());

        zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", zoomed);
        svg.call(zoom);

        svg.append("defs")
            .append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 28)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#64748b");

        linkGroup = svg.append("g").attr("class", "links");
        nodeGroup = svg.append("g").attr("class", "nodes");
    }

    function zoomed(event) {
        linkGroup.attr("transform", event.transform);
        nodeGroup.attr("transform", event.transform);
    }

    function getForceParams(nodeCount) {
        if (nodeCount <= 20) {
            return { linkDistance: 120, charge: -400, collision: 40, alphaMin: 0.001 };
        } else if (nodeCount <= 50) {
            return { linkDistance: 100, charge: -350, collision: 35, alphaMin: 0.001 };
        } else if (nodeCount <= 100) {
            return { linkDistance: 80, charge: -300, collision: 30, alphaMin: 0.0005 };
        } else {
            return { linkDistance: 60, charge: -250, collision: 25, alphaMin: 0.0001 };
        }
    }

    function initSimulation() {
        const params = getForceParams(currentData.nodes.length);
        simulation = d3
            .forceSimulation(currentData.nodes)
            .force(
                "link",
                d3
                    .forceLink(currentData.links)
                    .id((d) => d.id)
                    .distance(params.linkDistance)
                    .iterations(3)
            )
            .force("charge", d3.forceManyBody().strength(params.charge).distanceMax(400))
            .force("center", d3.forceCenter(getWidth() / 2, getHeight() / 2))
            .force("collision", d3.forceCollide().radius(params.collision).iterations(2))
            .force("x", d3.forceX(getWidth() / 2).strength(0.05))
            .force("y", d3.forceY(getHeight() / 2).strength(0.05))
            .alphaMin(params.alphaMin)
            .velocityDecay(0.4);
    }

    function render() {
        const nodeCount = currentData.nodes.length;
        const showLabels = nodeCount <= 50;

        linkElements = linkGroup
            .selectAll("line")
            .data(currentData.links, (d) => `${d.source}-${d.target}-${d.type}`)
            .join("line")
            .attr("stroke", (d) => LINK_COLORS[d.type] || "#475569")
            .attr("stroke-width", nodeCount > 100 ? 0.8 : 1.5)
            .attr("stroke-opacity", nodeCount > 100 ? 0.3 : 0.6)
            .attr("marker-end", nodeCount > 100 ? null : "url(#arrowhead)");

        const nodeGroups = nodeGroup
            .selectAll("g.node")
            .data(currentData.nodes, (d) => d.id)
            .join("g")
            .attr("class", "node")
            .call(
                d3
                    .drag()
                    .on("start", dragStarted)
                    .on("drag", dragged)
                    .on("end", dragEnded)
            );

        nodeGroups.selectAll("*").remove();

        nodeGroups.each(function (d) {
            const g = d3.select(this);
            const radius = NODE_RADIUS[d.label] || 16;
            const vuln = getNodeVulnInfo(d);

            if (vuln && vuln.hasPulse) {
                g.append("circle")
                    .attr("class", `vuln-pulse-ring ${vuln.pulseClass}`)
                    .attr("r", radius + 4);
                g.append("circle")
                    .attr("class", `vuln-pulse-ring ${vuln.pulseClass}`)
                    .attr("r", radius + 4)
                    .style("animation-delay", "0.75s");
            }

            g.append("circle")
                .attr("r", radius)
                .attr("fill", getNodeFillColor(d))
                .attr("stroke", "#1e293b")
                .attr("stroke-width", 2)
                .attr("cursor", "pointer");

            if (showLabels) {
                g.append("text")
                    .attr("class", "node-label")
                    .attr("dy", radius + 14)
                    .text(truncateLabel(d.name));
            }
        });

        nodeGroups
            .on("mouseover", onMouseOver)
            .on("mouseout", onMouseOut)
            .on("click", onNodeClick);

        nodeElements = nodeGroups;

        simulation.nodes(currentData.nodes).on("tick", ticked);
        simulation.force("link").links(currentData.links);
        simulation.alpha(1).restart();
    }

    function truncateLabel(name) {
        if (!name) return "";
        return name.length > 20 ? name.substring(0, 18) + "..." : name;
    }

    function ticked() {
        linkElements
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);

        nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
    }

    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = Math.max(0, Math.min(getWidth(), event.x));
        d.fy = Math.max(0, Math.min(getHeight(), event.y));
    }

    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
    }

    function onMouseOver(event, d) {
        tooltip.classList.remove("hidden");
        let html = `<div class="tt-label">${d.label}</div><div class="tt-value">${d.name}</div>`;

        const vuln = getNodeVulnInfo(d);
        if (vuln) {
            html += `<div class="tt-label" style="margin-top:6px;color:${vuln.color}">Highest Severity</div>`;
            html += `<div class="tt-value">${vuln.severity} (${vuln.total} total)</div>`;
        }

        tooltip.innerHTML = html;
        positionTooltip(event);
    }

    function onMouseOut() {
        tooltip.classList.add("hidden");
    }

    function positionTooltip(event) {
        const rect = container.getBoundingClientRect();
        let x = event.pageX - rect.left + 12;
        let y = event.pageY - rect.top - 10;
        if (x + 300 > rect.width) x = x - 320;
        if (y + 120 > rect.height) y = y - 120;
        tooltip.style.left = x + "px";
        tooltip.style.top = y + "px";
    }

    function parseJsonProp(val) {
        if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
            try {
                return JSON.parse(val);
            } catch (e) {
                return val;
            }
        }
        return val;
    }

    function onNodeClick(event, d) {
        event.stopPropagation();
        sidebarTitle.textContent = d.name;
        let html = "";
        html += `<div class="detail-row"><div class="detail-key">Type</div><div class="detail-val">${d.label}</div></div>`;

        const vuln = getNodeVulnInfo(d);
        if (vuln) {
            const sevCounts = parseJsonProp(vuln.severity_counts || "{}");
            html += `<div class="vuln-summary">`;
            html += `<div class="detail-row"><div class="detail-key">Highest Severity</div><div class="detail-val vuln-${vuln.pulseClass}">${vuln.severity}</div></div>`;
            html += `<div class="detail-row"><div class="detail-key">Total CVEs</div><div class="detail-val">${vuln.total}</div></div>`;
            if (typeof sevCounts === "object") {
                for (const [sev, count] of Object.entries(sevCounts)) {
                    if (count > 0) {
                        const cls = sev.toLowerCase();
                        html += `<div class="vuln-count"><span class="vuln-${cls}">${sev}</span><span>${count}</span></div>`;
                    }
                }
            }
            html += `</div>`;

            const cveList = parseJsonProp(vuln.cve_list || "[]");
            if (Array.isArray(cveList) && cveList.length > 0) {
                html += `<div class="detail-row" style="margin-top:12px"><div class="detail-key">Vulnerabilities</div></div>`;
                cveList.slice(0, 8).forEach((cve) => {
                    const sevCls = (cve.severity || "UNKNOWN").toLowerCase();
                    html += `<div class="cve-item ${sevCls}">`;
                    html += `<div class="cve-id vuln-${sevCls}">${cve.vulnerability_id}</div>`;
                    html += `<div class="cve-pkg">${cve.package_name} ${cve.installed_version} → ${cve.fixed_version || "unfixed"}</div>`;
                    if (cve.title) html += `<div class="cve-title">${cve.title}</div>`;
                    html += `</div>`;
                });
                if (cveList.length > 8) {
                    html += `<div class="detail-val" style="margin-top:8px;color:#94a3b8">... and ${cveList.length - 8} more</div>`;
                }
            }
        } else if (d.properties) {
            for (const [k, v] of Object.entries(d.properties)) {
                if (k === "name" || k === "image_id") continue;
                if (k === "severity_counts" || k === "cve_list") continue;
                html += `<div class="detail-row"><div class="detail-key">${k}</div><div class="detail-val">${v}</div></div>`;
            }
        }

        const connectedLinks = currentData.links.filter(
            (l) => (l.source.id || l.source) === d.id || (l.target.id || l.target) === d.id
        );
        if (connectedLinks.length > 0) {
            html += `<div class="detail-row" style="margin-top:12px"><div class="detail-key">Relationships</div></div>`;
            connectedLinks.forEach((l) => {
                const other = (l.source.id || l.source) === d.id ? l.target : l.source;
                const otherName = typeof other === "object" ? other.name : other;
                html += `<div class="detail-row"><div class="detail-val">${l.type} → ${otherName}</div></div>`;
            });
        }

        sidebarContent.innerHTML = html;
        sidebar.classList.remove("hidden");

        highlightNode(d.id);
    }

    function highlightNode(nodeId) {
        const connected = new Set([nodeId]);
        currentData.links.forEach((l) => {
            const sid = l.source.id || l.source;
            const tid = l.target.id || l.target;
            if (sid === nodeId) connected.add(tid);
            if (tid === nodeId) connected.add(sid);
        });

        nodeElements
            .select("circle")
            .attr("stroke", (d) => (connected.has(d.id) ? "#f8fafc" : "#1e293b"))
            .attr("stroke-width", (d) => (connected.has(d.id) ? 3 : 2))
            .attr("opacity", (d) => (connected.has(d.id) ? 1 : 0.3));

        linkElements
            .attr("stroke-opacity", (d) => {
                const sid = d.source.id || d.source;
                const tid = d.target.id || d.target;
                return connected.has(sid) && connected.has(tid) ? 0.8 : 0.1;
            });
    }

    function resetHighlight() {
        nodeElements
            .select("circle")
            .attr("stroke", "#1e293b")
            .attr("stroke-width", 2)
            .attr("opacity", 1);
        linkElements.attr("stroke-opacity", currentData.nodes.length > 100 ? 0.3 : 0.6);
    }

    async function fetchTopology() {
        try {
            const resp = await fetch("/api/topology");
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            currentData.nodes = data.nodes || [];
            currentData.links = data.links || [];
            initSimulation();
            render();
            fitView();
        } catch (err) {
            console.error("Failed to fetch topology:", err);
        }
    }

    function fitView() {
        if (currentData.nodes.length === 0) return;
        const xs = currentData.nodes.map((d) => d.x || getWidth() / 2);
        const ys = currentData.nodes.map((d) => d.y || getHeight() / 2);
        const minX = Math.min(...xs),
            maxX = Math.max(...xs);
        const minY = Math.min(...ys),
            maxY = Math.max(...ys);
        const w = maxX - minX || 1;
        const h = maxY - minY || 1;
        const padding = 80;
        const scale = Math.min((getWidth() - padding * 2) / w, (getHeight() - padding * 2) / h, 1);
        const tx = (getWidth() - (minX + maxX) * scale) / 2;
        const ty = (getHeight() - (minY + maxY) * scale) / 2;
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    function resetView() {
        sidebar.classList.add("hidden");
        resetHighlight();
        currentData.nodes.forEach((d) => {
            d.fx = null;
            d.fy = null;
        });
        initSimulation();
        simulation.alpha(1).restart();
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    }

    document.getElementById("btn-refresh").addEventListener("click", fetchTopology);
    document.getElementById("btn-reset").addEventListener("click", resetView);
    document.getElementById("btn-close-sidebar").addEventListener("click", () => {
        sidebar.classList.add("hidden");
        resetHighlight();
    });

    window.addEventListener("resize", () => {
        if (svg) {
            svg.attr("width", getWidth()).attr("height", getHeight());
            simulation.force("center", d3.forceCenter(getWidth() / 2, getHeight() / 2));
            simulation.force("x", d3.forceX(getWidth() / 2).strength(0.05));
            simulation.force("y", d3.forceY(getHeight() / 2).strength(0.05));
            simulation.alpha(0.3).restart();
        }
    });

    initSvg();
    initSimulation();
    fetchTopology();
})();

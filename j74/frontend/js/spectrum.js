class SpectrumRenderer {
    constructor(svgId) {
        this.svgId = svgId;
        this.data = null;
        this.margin = { top: 20, right: 30, bottom: 50, left: 60 };
    }

    render(wavelengths, fluxes, unitInfo) {
        if (!wavelengths || !fluxes || wavelengths.length === 0 || fluxes.length === 0) {
            return;
        }

        this.data = wavelengths.map((w, i) => ({
            wavelength: w,
            flux: !isFinite(fluxes[i]) ? 0 : fluxes[i]
        }));

        const container = d3.select(`#${this.svgId}`).node().parentElement;
        const width = container.clientWidth - this.margin.left - this.margin.right;
        const height = 280 - this.margin.top - this.margin.bottom;

        d3.select(`#${this.svgId}`).selectAll('*').remove();

        const svg = d3.select(`#${this.svgId}`)
            .attr('width', width + this.margin.left + this.margin.right)
            .attr('height', height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        const xExtent = d3.extent(this.data, d => d.wavelength);
        const yExtent = d3.extent(this.data, d => d.flux);

        const xScale = d3.scaleLinear()
            .domain(xExtent[0] === xExtent[1] ? [xExtent[0] - 1, xExtent[0] + 1] : xExtent)
            .range([0, width]);

        const yMin = yExtent[0] < 0 ? yExtent[0] * 1.05 : yExtent[0] * 0.95;
        const yMax = yExtent[1] > 0 ? yExtent[1] * 1.05 : yExtent[1] * 0.95;
        const yScale = d3.scaleLinear()
            .domain(yMin === yMax ? [yMin - 1, yMax + 1] : [yMin, yMax])
            .range([height, 0]);

        const xAxis = d3.axisBottom(xScale)
            .ticks(10)
            .tickSize(-height)
            .tickPadding(8);

        const yAxis = d3.axisLeft(yScale)
            .ticks(6)
            .tickSize(-width)
            .tickPadding(6);

        svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis)
            .selectAll('.tick line')
            .attr('stroke', 'rgba(255,255,255,0.1)')
            .attr('stroke-dasharray', '2,2');

        svg.append('g')
            .attr('class', 'grid')
            .call(yAxis)
            .selectAll('.tick line')
            .attr('stroke', 'rgba(255,255,255,0.1)')
            .attr('stroke-dasharray', '2,2');

        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis)
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .style('font-size', '11px');

        svg.append('g')
            .call(yAxis)
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .style('font-size', '11px');

        svg.selectAll('.domain')
            .attr('stroke', '#334155');

        const line = d3.line()
            .x(d => xScale(d.wavelength))
            .y(d => yScale(d.flux))
            .curve(d3.curveMonotoneX);

        const area = d3.area()
            .x(d => xScale(d.wavelength))
            .y0(yScale(0))
            .y1(d => yScale(d.flux))
            .curve(d3.curveMonotoneX);

        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'spectrumGradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#a78bfa')
            .attr('stop-opacity', 0.8);

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#3b82f6')
            .attr('stop-opacity', 0.1);

        svg.append('path')
            .datum(this.data)
            .attr('fill', 'url(#spectrumGradient)')
            .attr('d', area);

        svg.append('path')
            .datum(this.data)
            .attr('fill', 'none')
            .attr('stroke', '#818cf8')
            .attr('stroke-width', 1.5)
            .attr('d', line);

        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('padding', '8px 12px')
            .style('background', 'rgba(17, 24, 39, 0.95)')
            .style('border', '1px solid #374151')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('color', '#e2e8f0')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('z-index', 100);

        const bisect = d3.bisector(d => d.wavelength).left;

        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('mousemove', (event) => {
                const [mouseX] = d3.pointer(event);
                const x0 = xScale.invert(mouseX);
                const i = bisect(this.data, x0, 1);
                const d0 = this.data[i - 1];
                const d1 = this.data[i];
                if (!d0 || !d1) return;
                const d = x0 - d0.wavelength > d1.wavelength - x0 ? d1 : d0;

                tooltip
                    .style('opacity', 1)
                    .html(`波长: ${d.wavelength.toExponential(3)}<br/>流量: ${d.flux.toExponential(3)}`)
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', () => {
                tooltip.style('opacity', 0);
            });

        const xLabel = unitInfo && unitInfo.ctype1 ? `波长 (${unitInfo.ctype1})` : '波长';
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height + 40)
            .attr('text-anchor', 'middle')
            .attr('fill', '#94a3b8')
            .style('font-size', '12px')
            .text(xLabel);

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -45)
            .attr('text-anchor', 'middle')
            .attr('fill', '#94a3b8')
            .style('font-size', '12px')
            .text('流量强度');
    }
}

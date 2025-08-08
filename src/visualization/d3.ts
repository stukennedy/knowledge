import * as d3 from 'd3';
import { BaseGraphVisualizer } from './base';
import type { GraphSnapshot, VisualNode, VisualEdge, VisualizationEvents } from './types';

/**
 * D3.js implementation of graph visualizer
 *
 * Features:
 * - Force-directed layout
 * - Zoom and pan
 * - Node dragging
 * - Interactive tooltips
 * - Custom styling
 * - Export to SVG/PNG
 */
export class D3GraphVisualizer extends BaseGraphVisualizer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<any, any> | null = null;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;

  protected async initializeBackend(): Promise<void> {
    if (!this.container) return;

    // Create SVG container
    this.svg = d3.select(this.container).append('svg').attr('width', '100%').attr('height', '100%').style('background-color', '#f8f9fa');

    // Create main group for zoom/pan
    this.g = this.svg.append('g');

    // Setup zoom behavior
    this.zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        if (this.g) {
          this.g.attr('transform', event.transform);
        }
        if (this.events.onZoom) {
          this.events.onZoom(event.transform.k, event);
        }
      });

    if (this.options.enableZoom !== false) {
      this.svg.call(this.zoom);
    }

    // Create tooltip
    this.tooltip = d3
      .select(this.container)
      .append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Add canvas click handler
    if (this.svg && this.events.onCanvasClick) {
      this.svg.on('click', (event) => {
        if (event.target === this.svg?.node()) {
          this.events.onCanvasClick!(event);
        }
      });
    }
  }

  protected async renderBackend(snapshot: GraphSnapshot): Promise<void> {
    if (!this.g || !this.svg) return;

    // Clear existing content
    this.g.selectAll('*').remove();

    // Create arrow marker for edges
    this.createArrowMarker();

    // Create force simulation
    const simulationNodes = snapshot.nodes.map((n: any) => ({ ...n }));
    const simulationEdges = snapshot.edges.map((e: any) => ({ ...e, source: e.from, target: e.to }));
    
    this.simulation = d3
      .forceSimulation(simulationNodes)
      .force(
        'link',
        d3
          .forceLink(simulationEdges)
          .id((d: any) => d.id)
          .distance(this.options.layoutOptions?.force?.linkDistance || 100)
      )
      .force('charge', d3.forceManyBody().strength(this.options.layoutOptions?.force?.charge || -1000))
      .force('center', d3.forceCenter(this.container!.clientWidth / 2, this.container!.clientHeight / 2))
      .force(
        'collision',
        d3.forceCollide().radius((d: any) => (d.size || 15) + 5)
      );

    // Create edges
    const edges = this.g
      .append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(snapshot.edges)
      .enter()
      .append('line')
      .attr('stroke', (d) => d.color || this.options.defaultEdgeColor || '#999999')
      .attr('stroke-width', (d) => d.width || this.options.defaultEdgeWidth || 2)
      .attr('stroke-opacity', (d) => d.opacity || 0.6)
      .attr('marker-end', 'url(#arrow)')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (this.events.onEdgeClick) {
          this.events.onEdgeClick(d, event);
        }
      })
      .on('mouseover', (event, d) => {
        d3.select(event.target).attr('stroke-width', ((d as any).width || 2) * 2);
        if (this.events.onEdgeHover) {
          this.events.onEdgeHover(d, event);
        }
        this.showTooltip(event, this.createEdgeTooltip(d));
      })
      .on('mouseout', (event, d) => {
        d3.select(event.target).attr('stroke-width', (d as any).width || 2);
        this.hideTooltip();
      });

    // Create nodes
    const nodes = this.g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(snapshot.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(this.dragBehavior());

    // Add node circles
    nodes
      .append('circle')
      .attr('r', (d) => d.size || this.options.defaultNodeSize || 15)
      .attr('fill', (d) => d.color || this.options.defaultNodeColor || '#666666')
      .attr('stroke', (d) => d.borderColor || '#ffffff')
      .attr('stroke-width', (d) => d.borderWidth || 2)
      .attr('opacity', (d) => d.opacity || 1);

    // Add node labels
    nodes
      .append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ffffff')
      .style('pointer-events', 'none');

    // Add event handlers to nodes
    nodes
      .on('click', (event, d) => {
        if (this.events.onNodeClick) {
          this.events.onNodeClick(d, event);
        }
      })
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget)
          .select('circle')
          .attr('r', (d.size || 15) * 1.2);
        if (this.events.onNodeHover) {
          this.events.onNodeHover(d, event);
        }
        this.showTooltip(event, this.createNodeTooltip(d));
      })
      .on('mouseout', (event, d) => {
        d3.select(event.currentTarget)
          .select('circle')
          .attr('r', d.size || 15);
        this.hideTooltip();
      });

    // Update positions on simulation tick
    this.simulation.on('tick', () => {
      edges
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y);

      nodes.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Fit to container after initial layout
    setTimeout(() => {
      this.fitToContainer();
    }, 1000);
  }

  protected async updateBackend(snapshot: GraphSnapshot): Promise<void> {
    // For D3, we can reuse the render method
    await this.renderBackend(snapshot);
  }

  protected setBackendEvents(_events: VisualizationEvents): void {
    // Events are handled in the render method
    // This method is called when setEvents is called
  }

  protected getBackendViewState(): any {
    if (!this.svg || !this.zoom) return null;

    const transform = d3.zoomTransform(this.svg.node()!);
    return {
      x: transform.x,
      y: transform.y,
      k: transform.k,
    };
  }

  protected setBackendViewState(state: any): void {
    if (!this.svg || !this.zoom || !state) return;

    const transform = d3.zoomIdentity.translate(state.x || 0, state.y || 0).scale(state.k || 1);

    this.svg.call(this.zoom.transform, transform);
  }

  protected fitBackendToContainer(): void {
    if (!this.svg || !this.g || !this.container) return;

    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;

    // Get the bounding box of all nodes
    const nodes = this.g.selectAll('.node').data();
    if (nodes.length === 0) return;

    const xExtent = d3.extent(nodes, (d: any) => d.x) as [number, number];
    const yExtent = d3.extent(nodes, (d: any) => d.y) as [number, number];

    const graphWidth = xExtent[1] - xExtent[0];
    const graphHeight = yExtent[1] - yExtent[0];

    const scale = Math.min((containerWidth - 100) / graphWidth, (containerHeight - 100) / graphHeight, 1);

    const transform = d3.zoomIdentity
      .translate(containerWidth / 2 - ((xExtent[0] + xExtent[1]) / 2) * scale, containerHeight / 2 - ((yExtent[0] + yExtent[1]) / 2) * scale)
      .scale(scale);

    if (this.zoom) {
      this.svg.call(this.zoom.transform, transform);
    }
  }

  protected centerBackendOnNode(nodeId: string): void {
    if (!this.svg || !this.g) return;

    const node = this.g
      .selectAll('.node')
      .filter((d: any) => d.id === nodeId)
      .datum() as VisualNode;

    if (!node || node.x === undefined || node.y === undefined) return;

    const transform = d3.zoomIdentity.translate(this.container!.clientWidth / 2 - node.x, this.container!.clientHeight / 2 - node.y).scale(1.5);

    if (this.zoom) {
      this.svg.call(this.zoom.transform, transform);
    }
  }

  protected highlightBackendNodes(nodeIds: string[]): void {
    if (!this.g) return;

    // Reset all nodes
    this.g
      .selectAll('.node')
      .select('circle')
      .attr('stroke', (d: any) => d.borderColor || '#ffffff')
      .attr('stroke-width', (d: any) => d.borderWidth || 2);

    // Highlight selected nodes
    this.g
      .selectAll('.node')
      .filter((d: any) => nodeIds.includes(d.id))
      .select('circle')
      .attr('stroke', '#ff0000')
      .attr('stroke-width', 4);
  }

  protected clearBackendHighlights(): void {
    if (!this.g) return;

    this.g
      .selectAll('.node')
      .select('circle')
      .attr('stroke', (d: any) => d.borderColor || '#ffffff')
      .attr('stroke-width', (d: any) => d.borderWidth || 2);
  }

  protected async exportBackendImage(format: 'png' | 'svg' | 'jpg', options?: Record<string, any>): Promise<string> {
    if (!this.svg) throw new Error('SVG not initialized');

    if (format === 'svg') {
      // Export as SVG
      const svgData = new XMLSerializer().serializeToString(this.svg.node()!);
      return `data:image/svg+xml;base64,${btoa(svgData)}`;
    } else {
      // Export as PNG/JPEG using canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const svgData = new XMLSerializer().serializeToString(this.svg.node()!);
      const img = new Image();

      return new Promise((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(mimeType, options?.quality || 0.8);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
      });
    }
  }

  protected destroyBackend(): void {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }

    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }

    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }

    this.g = null;
    this.zoom = null;
  }

  private createArrowMarker(): void {
    if (!this.g) return;

    const defs = this.g.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999999');
  }

  private dragBehavior(): d3.DragBehavior<SVGGElement, any, any> {
    return d3
      .drag<SVGGElement, any>()
      .on('start', (event, d: any) => {
        if (!this.simulation) return;
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        if (this.events.onNodeDrag) {
          this.events.onNodeDrag(d, event);
        }
      })
      .on('drag', (event, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
        if (this.events.onNodeDrag) {
          this.events.onNodeDrag(d, event);
        }
      })
      .on('end', (event, d: any) => {
        if (!this.simulation) return;
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        if (this.events.onNodeDrag) {
          this.events.onNodeDrag(d, event);
        }
      });
  }

  private showTooltip(event: any, content: string): void {
    if (!this.tooltip) return;

    this.tooltip
      .style('visibility', 'visible')
      .html(content)
      .style('left', event.pageX + 10 + 'px')
      .style('top', event.pageY - 10 + 'px');
  }

  private hideTooltip(): void {
    if (!this.tooltip) return;
    this.tooltip.style('visibility', 'hidden');
  }

  private createNodeTooltip(node: VisualNode): string {
    return `
      <div>
        <strong>${node.label}</strong><br>
        Type: ${node.type}<br>
        Confidence: ${(node.confidence * 100).toFixed(1)}%<br>
        ${Object.entries(node.properties || {})
          .map(([key, value]) => `${key}: ${value}`)
          .join('<br>')}
      </div>
    `;
  }

  private createEdgeTooltip(edge: VisualEdge): string {
    return `
      <div>
        <strong>${edge.type}</strong><br>
        Confidence: ${(edge.confidence * 100).toFixed(1)}%<br>
        ${Object.entries(edge.properties || {})
          .map(([key, value]) => `${key}: ${value}`)
          .join('<br>')}
      </div>
    `;
  }
}

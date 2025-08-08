import { BaseGraphVisualizer } from './base';
import type { GraphSnapshot, VisualizationEvents } from './types';

// Dynamic import for cytoscape to support optional dependency
let cytoscape: any;
let cytoscapeAvailable = false;

try {
  cytoscape = require('cytoscape');
  cytoscapeAvailable = true;
} catch (e) {
  // cytoscape is not available - will throw error when class is instantiated
}

type Core = any;
type LayoutOptions = any;

/**
 * Cytoscape.js implementation of graph visualizer
 *
 * Features:
 * - Professional-grade graph visualization
 * - Extensive layout algorithms
 * - Advanced styling
 * - Graph analysis algorithms
 * - Export capabilities
 * - Touch support
 */
export class CytoscapeGraphVisualizer extends BaseGraphVisualizer {
  private cy: Core | null = null;

  protected async initializeBackend(): Promise<void> {
    if (!cytoscapeAvailable) {
      throw new Error('Cytoscape is not installed. Please install it with: npm install cytoscape --save-optional');
    }
    if (!this.container) return;

    // Create cytoscape instance
    this.cy = cytoscape({
      container: this.container,
      style: this.getCytoscapeStyle(),
      layout: this.getLayoutOptions(),
      wheelSensitivity: 0.1,
      autoungrabify: false,
      autolock: false,
      autounselectify: false,
      boxSelectionEnabled: this.options.enableSelection !== false,
      selectionType: 'single',
      touchTapThreshold: 8,
      desktopTapThreshold: 4,
      userZoomingEnabled: this.options.enableZoom !== false,
      userPanningEnabled: this.options.enablePan !== false,
      minZoom: 0.1,
      maxZoom: 4,
    });

    // Setup event handlers
    this.setupEventHandlers();
  }

  protected async renderBackend(snapshot: GraphSnapshot): Promise<void> {
    if (!this.cy) return;

    // Clear existing elements
    this.cy.elements().remove();

    // Transform nodes
    const cytoscapeNodes = snapshot.nodes.map((node) => ({
      group: 'nodes' as const,
      data: {
        id: node.id,
        label: node.label,
        type: node.type,
        properties: node.properties,
        confidence: node.confidence,
        // Visual properties
        size: node.size || this.options.defaultNodeSize,
        color: node.color || this.options.defaultNodeColor,
        shape: this.mapShape(node.shape),
        opacity: node.opacity || 1,
        borderColor: node.borderColor || '#ffffff',
        borderWidth: node.borderWidth || 2,
        // Store original data for events
        originalData: node,
      },
      position: node.x && node.y ? { x: node.x, y: node.y } : undefined,
    }));

    // Transform edges
    const cytoscapeEdges = snapshot.edges.map((edge) => ({
      group: 'edges' as const,
      data: {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: edge.type,
        type: edge.type,
        properties: edge.properties,
        confidence: edge.confidence,
        // Visual properties
        width: edge.width || this.options.defaultEdgeWidth,
        color: edge.color || this.options.defaultEdgeColor,
        style: edge.style || 'solid',
        opacity: edge.opacity || 0.6,
        arrows: edge.arrows || 'to',
        // Store original data for events
        originalData: edge,
      },
    }));

    // Add elements to cytoscape
    this.cy.add([...cytoscapeNodes, ...cytoscapeEdges]);

    // Apply layout if no positions are provided
    if (!snapshot.nodes.some((node) => node.x !== undefined && node.y !== undefined)) {
      const layout = this.cy.layout(this.getLayoutOptions());
      layout.run();
    }

    // Fit to container after layout
    setTimeout(() => {
      this.fitToContainer();
    }, 500);
  }

  protected async updateBackend(snapshot: GraphSnapshot): Promise<void> {
    // For Cytoscape, we can reuse the render method
    await this.renderBackend(snapshot);
  }

  protected setBackendEvents(_events: VisualizationEvents): void {
    // Events are handled in the setupEventHandlers method
    // This method is called when setEvents is called
  }

  protected getBackendViewState(): any {
    if (!this.cy) return null;

    const pan = this.cy.pan();
    const zoom = this.cy.zoom();

    return {
      x: pan.x,
      y: pan.y,
      scale: zoom,
    };
  }

  protected setBackendViewState(state: any): void {
    if (!this.cy || !state) return;

    this.cy.pan({
      x: state.x || 0,
      y: state.y || 0,
    });
    this.cy.zoom({
      level: state.scale || 1,
      renderedPosition: { x: this.container!.clientWidth / 2, y: this.container!.clientHeight / 2 }
    });
  }

  protected fitBackendToContainer(): void {
    if (!this.cy) return;
    this.cy.fit();
  }

  protected centerBackendOnNode(nodeId: string): void {
    if (!this.cy) return;

    const node = this.cy.getElementById(nodeId);
    if (node.length > 0) {
      this.cy.center(node);
      this.cy.zoom({
        level: 1.5,
        renderedPosition: { x: node.position().x, y: node.position().y },
      });
    }
  }

  protected highlightBackendNodes(nodeIds: string[]): void {
    if (!this.cy) return;

    // Clear existing selection
    this.cy.elements().unselect();

    // Select specified nodes
    const nodes = this.cy.elements().filter((node: any) => nodeIds.includes(node.id()));
    nodes.select();
  }

  protected clearBackendHighlights(): void {
    if (!this.cy) return;
    this.cy.elements().unselect();
  }

  protected async exportBackendImage(format: 'png' | 'svg' | 'jpg', options?: Record<string, any>): Promise<string> {
    if (!this.cy) throw new Error('Cytoscape not initialized');

    const exportOptions = {
      output: format === 'svg' ? 'svg' : 'base64',
      bg: '#ffffff',
      full: true,
      scale: 1,
      maxWidth: options?.maxWidth || 1920,
      maxHeight: options?.maxHeight || 1080,
      quality: options?.quality || 0.8,
    };

    if (format === 'svg') {
      const svg = (this.cy as any).svg(exportOptions);
      return `data:image/svg+xml;base64,${btoa(svg)}`;
    } else {
      const pngOptions: any = {
        output: 'base64' as const,
        bg: '#ffffff',
        full: true,
        scale: 1,
        maxWidth: options?.maxWidth || 1920,
        maxHeight: options?.maxHeight || 1080,
      };
      if (format === 'jpg') {
        pngOptions.quality = options?.quality || 0.8;
      }
      const png = this.cy.png(pngOptions);
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${png}`;
    }
  }

  protected destroyBackend(): void {
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
  }

  private getCytoscapeStyle(): any[] {
    return [
      // Node styles
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          'border-color': 'data(borderColor)',
          'border-width': 'data(borderWidth)',
          width: 'data(size)',
          height: 'data(size)',
          shape: 'data(shape)',
          opacity: 'data(opacity)',
          label: 'data(label)',
          color: '#ffffff',
          'font-size': '12px',
          'font-weight': 'bold',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '80px',
          'text-outline-color': '#000000',
          'text-outline-width': '2px',
          'text-outline-opacity': '0.8',
        },
      },
      // Edge styles
      {
        selector: 'edge',
        style: {
          width: 'data(width)',
          'line-color': 'data(color)',
          opacity: 'data(opacity)',
          'curve-style': 'data(style) === "curved" ? "bezier" : "straight"',
          'line-style': 'data(style) === "dashed" ? "dashed" : data(style) === "dotted" ? "dotted" : "solid"',
          'target-arrow-color': 'data(color)',
          'target-arrow-shape': 'data(arrows) === "to" || data(arrows) === "both" ? "triangle" : "none"',
          'source-arrow-color': 'data(color)',
          'source-arrow-shape': 'data(arrows) === "from" || data(arrows) === "both" ? "triangle" : "none"',
          'arrow-scale': '1.5',
          label: 'data(label)',
          'font-size': '10px',
          color: '#666666',
          'text-rotation': 'autorotate',
          'text-margin-y': '5px',
        },
      },
      // Selected node styles
      {
        selector: 'node:selected',
        style: {
          'border-color': '#ff0000',
          'border-width': '4px',
          'background-color': 'data(color)',
        },
      },
      // Selected edge styles
      {
        selector: 'edge:selected',
        style: {
          width: 'data(width) * 2',
          'line-color': '#ff0000',
        },
      },
      // Hover styles
      {
        selector: 'node:hover',
        style: {
          width: 'data(size) * 1.2',
          height: 'data(size) * 1.2',
        },
      },
      {
        selector: 'edge:hover',
        style: {
          width: 'data(width) * 2',
        },
      },
    ];
  }

  private getLayoutOptions(): LayoutOptions {
    const layout = this.options.layout || 'force';

    switch (layout) {
      case 'hierarchical':
        return {
          name: 'dagre',
          nodeSep: 50,
          rankSep: 100,
          padding: 50,
          ...({
            rankDir: 'TB'
          } as any)
        } as LayoutOptions;
      case 'circular':
        return {
          name: 'circle',
          radius: undefined,
          startAngle: 0,
          sweep: undefined,
          clockwise: true,
          sort: undefined,
          animate: false,
          animationDuration: 500,
          animationEasing: undefined,
          fit: true,
          padding: 30,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: false,
          spacingFactor: undefined,
          animateFilter: () => true,
          ready: undefined,
          stop: undefined,
        };
      case 'grid':
        return {
          name: 'grid',
          rows: undefined,
          cols: undefined,
          position: undefined,
          sort: undefined,
          animate: false,
          animationDuration: 500,
          animationEasing: undefined,
          fit: true,
          padding: 30,
          avoidOverlap: true,
          avoidOverlapPadding: 10,
          nodeDimensionsIncludeLabels: false,
          animateFilter: () => true,
          ready: undefined,
          stop: undefined,
        };
      case 'random':
        return {
          name: 'random',
          fit: true,
          padding: 30,
          animate: false,
          animationDuration: 500,
          animationEasing: undefined,
          animateFilter: () => true,
          ready: undefined,
          stop: undefined,
        };
      default:
        return {
          name: 'cose',
          nodeDimensionsIncludeLabels: false,
          fit: true,
          padding: 30,
          animate: false,
          animationDuration: 500,
          animationEasing: undefined,
          animateFilter: () => true,
          ready: undefined,
          stop: undefined,
          // Cose specific options
          randomize: false,
          componentSpacing: 100,
          nodeRepulsion: 400000,
          nodeOverlap: 20,
          idealEdgeLength: 100,
          edgeElasticity: 100,
          nestingFactor: 5,
          gravity: 80,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0,
        };
    }
  }

  private setupEventHandlers(): void {
    if (!this.cy) return;

    // Node events
    this.cy.on('tap', 'node', (event: any) => {
      const node = event.target;
      const originalData = node.data('originalData');
      if (originalData && this.events.onNodeClick) {
        this.events.onNodeClick(originalData, event);
      }
    });

    this.cy.on('mouseover', 'node', (event: any) => {
      const node = event.target;
      const originalData = node.data('originalData');
      if (originalData && this.events.onNodeHover) {
        this.events.onNodeHover(originalData, event);
      }
    });

    // Edge events
    this.cy.on('tap', 'edge', (event: any) => {
      const edge = event.target;
      const originalData = edge.data('originalData');
      if (originalData && this.events.onEdgeClick) {
        this.events.onEdgeClick(originalData, event);
      }
    });

    this.cy.on('mouseover', 'edge', (event: any) => {
      const edge = event.target;
      const originalData = edge.data('originalData');
      if (originalData && this.events.onEdgeHover) {
        this.events.onEdgeHover(originalData, event);
      }
    });

    // Canvas events
    this.cy.on('tap', (event: any) => {
      if (event.target === this.cy) {
        if (this.events.onCanvasClick) {
          this.events.onCanvasClick(event);
        }
      }
    });

    // Zoom events
    this.cy.on('zoom', (event: any) => {
      if (this.events.onZoom) {
        this.events.onZoom(this.cy!.zoom(), event);
      }
    });

    // Pan events
    this.cy.on('pan', (event: any) => {
      if (this.events.onPan) {
        const pan = this.cy!.pan();
        this.events.onPan(pan.x, pan.y, event);
      }
    });

    // Drag events
    this.cy.on('drag', 'node', (event: any) => {
      const node = event.target;
      const originalData = node.data('originalData');
      if (originalData && this.events.onNodeDrag) {
        this.events.onNodeDrag(originalData, event);
      }
    });
  }

  private mapShape(shape?: string): string {
    switch (shape) {
      case 'square':
        return 'rectangle';
      case 'triangle':
        return 'triangle';
      case 'diamond':
        return 'diamond';
      case 'star':
        return 'star';
      default:
        return 'ellipse';
    }
  }
}

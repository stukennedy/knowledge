import { BaseGraphVisualizer } from './base';
import type { GraphSnapshot, VisualizationEvents, VisualNode, VisualEdge } from './types';

// Dynamic imports for vis-network to support optional dependency
let Network: unknown;
let DataSet: unknown;
let visNetworkAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const visNetwork = require('vis-network');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const visData = require('vis-data');
  Network = visNetwork.Network;
  DataSet = visData.DataSet;
  visNetworkAvailable = true;
} catch {
  // vis-network is not available - will throw error when class is instantiated
}

/**
 * vis-network implementation of graph visualizer
 *
 * Features:
 * - Multiple layout algorithms
 * - Physics simulation
 * - Clustering
 * - Navigation controls
 * - Export capabilities
 * - Touch support
 */
export class VisNetworkGraphVisualizer extends BaseGraphVisualizer {
  private network: any | null = null;
  private nodes: any | null = null;
  private edges: any | null = null;

  protected async initializeBackend(): Promise<void> {
    if (!visNetworkAvailable) {
      throw new Error('vis-network is not installed. Please install it with: npm install vis-network vis-data --save-optional');
    }
    if (!this.container) return;

    // Create datasets
    this.nodes = new DataSet();
    this.edges = new DataSet();

    // Create network
    this.network = new Network(
      this.container,
      {
        nodes: this.nodes,
        edges: this.edges,
      },
      this.getVisOptions()
    );

    // Setup event handlers
    this.setupEventHandlers();
  }

  protected async renderBackend(snapshot: GraphSnapshot): Promise<void> {
    if (!this.nodes || !this.edges) return;

    // Clear existing data
    this.nodes.clear();
    this.edges.clear();

    // Transform and add nodes
    const visNodes = snapshot.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      title: this.createNodeTooltip(node),
      color: {
        background: node.color || this.options.defaultNodeColor,
        border: node.borderColor || '#ffffff',
        highlight: {
          background: node.color || this.options.defaultNodeColor,
          border: '#ff0000',
        },
      },
      size: node.size || this.options.defaultNodeSize,
      shape: this.mapShape(node.shape),
      opacity: node.opacity || 1,
      font: {
        color: '#ffffff',
        size: 12,
        face: 'Arial',
        bold: true,
      },
      // Store original data for events
      originalData: node,
    }));

    // Transform and add edges
    const visEdges = snapshot.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.type,
      title: this.createEdgeTooltip(edge),
      color: {
        color: edge.color || this.options.defaultEdgeColor,
        opacity: edge.opacity || 0.6,
        highlight: edge.color || this.options.defaultEdgeColor,
      },
      width: edge.width || this.options.defaultEdgeWidth,
      arrows: this.mapArrows(edge.arrows),
      dashes: edge.style === 'dashed',
      smooth: {
        type: edge.style === 'curved' ? 'curvedCW' : 'straight',
      },
      // Store original data for events
      originalData: edge,
    }));

    // Add data to datasets
    this.nodes.add(visNodes);
    this.edges.add(visEdges);

    // Fit to container after data is loaded
    setTimeout(() => {
      this.fitToContainer();
    }, 100);
  }

  protected async updateBackend(snapshot: GraphSnapshot): Promise<void> {
    // For vis-network, we can reuse the render method
    await this.renderBackend(snapshot);
  }

  protected setBackendEvents(_events: VisualizationEvents): void {
    // Events are handled in the setupEventHandlers method
    // This method is called when setEvents is called
  }

  protected getBackendViewState(): any {
    if (!this.network) return null;

    return this.network.getViewPosition();
  }

  protected setBackendViewState(state: any): void {
    if (!this.network || !state) return;

    this.network.moveTo({
      position: { x: state.x || 0, y: state.y || 0 },
      scale: state.scale || 1,
    });
  }

  protected fitBackendToContainer(): void {
    if (!this.network) return;
    this.network.fit();
  }

  protected centerBackendOnNode(nodeId: string): void {
    if (!this.network) return;

    this.network.focus(nodeId, {
      scale: 1.5,
      animation: {
        duration: 500,
        easingFunction: 'easeInOutQuad',
      },
    });
  }

  protected highlightBackendNodes(nodeIds: string[]): void {
    if (!this.network) return;

    // Reset all nodes
    this.network.selectNodes([]);

    // Highlight selected nodes
    this.network.selectNodes(nodeIds);
  }

  protected clearBackendHighlights(): void {
    if (!this.network) return;
    this.network.selectNodes([]);
  }

  protected async exportBackendImage(format: 'png' | 'svg' | 'jpg', options?: Record<string, any>): Promise<string> {
    if (!this.network) throw new Error('Network not initialized');

    const canvas = (this.network as any).canvas.frame.canvas;

    if (format === 'svg') {
      // For SVG export, we need to convert canvas to SVG
      // This is a simplified approach - in practice you might want to use a library like canvg
      const dataUrl = canvas.toDataURL('image/svg+xml');
      return dataUrl;
    } else {
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, options?.quality || 0.8);
      return dataUrl;
    }
  }

  protected destroyBackend(): void {
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }

    if (this.nodes) {
      this.nodes.clear();
      this.nodes = null;
    }

    if (this.edges) {
      this.edges.clear();
      this.edges = null;
    }
  }

  private getVisOptions(): any {
    const layoutOptions = this.getLayoutOptions();

    return {
      // Layout
      layout: layoutOptions,

      // Physics
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 100,
          springConstant: 0.08,
          damping: 0.4,
          avoidOverlap: 0.5,
        },
        stabilization: {
          enabled: true,
          iterations: 1000,
          updateInterval: 100,
        },
      },

      // Interaction
      interaction: {
        hover: this.options.enableHover !== false,
        tooltipDelay: 200,
        hideEdgesOnDrag: false,
        navigationButtons: true,
        keyboard: {
          enabled: true,
          speed: {
            x: 10,
            y: 10,
            zoom: 0.1,
          },
        },
      },

      // Manipulation
      manipulation: {
        enabled: false,
      },

      // Edges
      edges: {
        smooth: {
          enabled: true,
          type: 'continuous',
          forceDirection: 'none' as any,
          roundness: 0.5
        },
        font: {
          size: 10,
          color: '#666666',
        },
        color: {
          color: this.options.defaultEdgeColor,
          opacity: 0.6,
        },
        width: this.options.defaultEdgeWidth,
        selectionWidth: 3,
        hoverWidth: 2,
      },

      // Nodes
      nodes: {
        font: {
          size: 12,
          color: '#ffffff',
          face: 'Arial',
          bold: true as any,
        },
        borderWidth: 2,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.3)',
          size: 10,
          x: 5,
          y: 5,
        },
      },

      // Groups (for clustering)
      groups: this.createGroups(),

      // Custom options
      ...this.options.customOptions,
    };
  }

  private getLayoutOptions(): any {
    const layout = this.options.layout || 'force';

    switch (layout) {
      case 'hierarchical':
        return {
          hierarchical: {
            enabled: true,
            direction: 'UD',
            sortMethod: 'directed',
            nodeSpacing: 150,
            levelSeparation: 200,
          },
        };
      case 'circular':
        return {
          circular: {
            enabled: true,
            nodeSpacing: 100,
          },
        };
      case 'grid':
        return {
          grid: {
            enabled: true,
            nodeSpacing: 100,
          },
        };
      case 'random':
        return {
          randomSeed: Math.random(),
        };
      default:
        return {}; // Use physics layout
    }
  }

  private createGroups(): Record<string, any> {
    const groups: Record<string, any> = {};

    // Create groups based on node types
    Object.entries(this.options.nodeColors || {}).forEach(([type, color]) => {
      groups[type] = {
        color: {
          background: color,
          border: '#ffffff',
          highlight: {
            background: color,
            border: '#ff0000',
          },
        },
        font: {
          color: '#ffffff',
        },
      };
    });

    return groups;
  }

  private setupEventHandlers(): void {
    if (!this.network) return;

    // Node events
    this.network.on('click', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = this.nodes?.get(nodeId);
        if (node && this.events.onNodeClick) {
          this.events.onNodeClick((node as any).originalData, params);
        }
      } else if (params.edges.length > 0) {
        const edgeId = params.edges[0];
        const edge = this.edges?.get(edgeId);
        if (edge && this.events.onEdgeClick) {
          this.events.onEdgeClick((edge as any).originalData, params);
        }
      } else {
        if (this.events.onCanvasClick) {
          this.events.onCanvasClick(params);
        }
      }
    });

    this.network.on('hoverNode', (params: any) => {
      const node = this.nodes?.get(params.node);
      if (node && this.events.onNodeHover) {
        this.events.onNodeHover((node as any).originalData, params);
      }
    });

    this.network.on('blurNode', () => {
      // Handle node blur if needed
    });

    // Edge events
    this.network.on('hoverEdge', (params: any) => {
      const edge = this.edges?.get(params.edge);
      if (edge && this.events.onEdgeHover) {
        this.events.onEdgeHover((edge as any).originalData, params);
      }
    });

    // Zoom events
    this.network.on('zoom', (params: any) => {
      if (this.events.onZoom) {
        this.events.onZoom(params.scale, params);
      }
    });

    // Drag events
    this.network.on('dragStart', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = this.nodes?.get(nodeId);
        if (node && this.events.onNodeDrag) {
          this.events.onNodeDrag((node as any).originalData, params);
        }
      }
    });

    this.network.on('dragEnd', (params: any) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = this.nodes?.get(nodeId);
        if (node && this.events.onNodeDrag) {
          this.events.onNodeDrag((node as any).originalData, params);
        }
      }
    });
  }

  private mapShape(shape?: string): string {
    switch (shape) {
      case 'square':
        return 'box';
      case 'triangle':
        return 'triangle';
      case 'diamond':
        return 'diamond';
      case 'star':
        return 'star';
      default:
        return 'circle';
    }
  }

  private mapArrows(arrows?: boolean | string): string | boolean {
    if (typeof arrows === 'boolean') {
      return arrows ? 'to' : false;
    }
    switch (arrows) {
      case 'from':
        return 'from';
      case 'both':
        return 'to;from';
      default:
        return 'to';
    }
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

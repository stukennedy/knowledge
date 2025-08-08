import type { VisualizationBackend, GraphVisualizer, VisualizerFactoryOptions, GraphSnapshot, SnapshotOptions } from './types';
import { D3GraphVisualizer } from './d3';
import { VisNetworkGraphVisualizer } from './vis-network';
import { CytoscapeGraphVisualizer } from './cytoscape';
import { ThreeGraphVisualizer } from './three';
import { GraphSnapshotCreator } from './base';
import type { KnowledgeGraph } from '../core/KnowledgeGraph';

/**
 * Factory function to create graph visualizers
 */
export function createGraphVisualizer(options: VisualizerFactoryOptions): GraphVisualizer {
  switch (options.backend) {
    case 'd3':
      return new D3GraphVisualizer();
    case 'vis-network':
      return new VisNetworkGraphVisualizer();
    case 'cytoscape':
      return new CytoscapeGraphVisualizer();
    case 'three':
      return new ThreeGraphVisualizer();
    default:
      throw new Error(`Unsupported visualization backend: ${options.backend}`);
  }
}

/**
 * Utility class for creating and managing graph visualizations
 */
export class GraphVisualizationManager {
  private visualizer: GraphVisualizer | null = null;
  public readonly snapshotCreator: GraphSnapshotCreator;

  constructor(graph: KnowledgeGraph) {
    this.snapshotCreator = new GraphSnapshotCreator(graph);
  }

  /**
   * Initialize a visualization with the specified backend
   */
  async initializeVisualization(backend: VisualizationBackend, container: HTMLElement, options?: any): Promise<GraphVisualizer> {
    // Destroy existing visualizer if any
    if (this.visualizer) {
      this.visualizer.destroy();
    }

    // Create new visualizer
    this.visualizer = createGraphVisualizer({
      backend,
      container,
      options: options?.visualization || {},
      events: options?.events || {},
    });

    // Initialize the visualizer
    await this.visualizer.initialize(container, options?.visualization);

    return this.visualizer;
  }

  /**
   * Create and render a snapshot from a query result
   */
  async visualizeQueryResult(queryResult: any, options?: SnapshotOptions): Promise<void> {
    if (!this.visualizer) {
      throw new Error('Visualization not initialized. Call initializeVisualization() first.');
    }

    const snapshot = await this.snapshotCreator.createFromQueryResult(queryResult, options);
    await this.visualizer.render(snapshot);
  }

  /**
   * Create and render a snapshot from a specific node
   */
  async visualizeNode(nodeId: string, depth: number = 2, options?: SnapshotOptions): Promise<void> {
    if (!this.visualizer) {
      throw new Error('Visualization not initialized. Call initializeVisualization() first.');
    }

    const snapshot = await this.snapshotCreator.createFromNode(nodeId, depth, options);
    await this.visualizer.render(snapshot);
  }

  /**
   * Create and render a snapshot from a search query
   */
  async visualizeSearch(query: string, options?: SnapshotOptions): Promise<void> {
    if (!this.visualizer) {
      throw new Error('Visualization not initialized. Call initializeVisualization() first.');
    }

    const snapshot = await this.snapshotCreator.createFromSearch(query, options);
    await this.visualizer.render(snapshot);
  }

  /**
   * Create and render a snapshot from node types
   */
  async visualizeNodeTypes(nodeTypes: string[], options?: SnapshotOptions): Promise<void> {
    if (!this.visualizer) {
      throw new Error('Visualization not initialized. Call initializeVisualization() first.');
    }

    const snapshot = await this.snapshotCreator.createFromNodeTypes(nodeTypes, options);
    await this.visualizer.render(snapshot);
  }

  /**
   * Update the visualization with new data
   */
  async updateVisualization(snapshot: GraphSnapshot): Promise<void> {
    if (!this.visualizer) {
      throw new Error('Visualization not initialized. Call initializeVisualization() first.');
    }

    await this.visualizer.update(snapshot);
  }

  /**
   * Get the current visualizer
   */
  getVisualizer(): GraphVisualizer | null {
    return this.visualizer;
  }

  /**
   * Destroy the current visualization
   */
  destroyVisualization(): void {
    if (this.visualizer) {
      this.visualizer.destroy();
      this.visualizer = null;
    }
  }

  /**
   * Export the current visualization as an image
   */
  async exportImage(format: 'png' | 'svg' | 'jpg', options?: Record<string, any>): Promise<string> {
    if (!this.visualizer) {
      throw new Error('Visualization not initialized. Call initializeVisualization() first.');
    }

    return await this.visualizer.exportImage(format, options);
  }
}

/**
 * Color utilities for graph visualization
 */
export class ColorUtils {
  /**
   * Generate a color palette for node types
   */
  static generateNodeColorPalette(nodeTypes: string[]): Record<string, string> {
    const colors = [
      '#4CAF50',
      '#2196F3',
      '#FF9800',
      '#9C27B0',
      '#F44336',
      '#607D8B',
      '#795548',
      '#E91E63',
      '#3F51B5',
      '#009688',
      '#FF5722',
      '#673AB7',
      '#FFC107',
      '#00BCD4',
      '#8BC34A',
    ];

    const palette: Record<string, string> = {};
    nodeTypes.forEach((type, index) => {
      palette[type] = colors[index % colors.length]!
    });

    return palette;
  }

  /**
   * Generate a color palette for edge types
   */
  static generateEdgeColorPalette(edgeTypes: string[]): Record<string, string> {
    const colors = ['#666666', '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#607D8B', '#795548', '#E91E63', '#3F51B5'];

    const palette: Record<string, string> = {};
    edgeTypes.forEach((type, index) => {
      palette[type] = colors[index % colors.length]!
    });

    return palette;
  }

  /**
   * Get a color based on confidence level
   */
  static getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#4CAF50'; // Green for high confidence
    if (confidence >= 0.6) return '#FF9800'; // Orange for medium confidence
    return '#F44336'; // Red for low confidence
  }

  /**
   * Interpolate between two colors
   */
  static interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);

    if (!c1 || !c2) return color1;

    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);

    return this.rgbToHex(r, g, b);
  }

  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1]!, 16),
          g: parseInt(result[2]!, 16),
          b: parseInt(result[3]!, 16),
        }
      : null;
  }

  private static rgbToHex(r: number, g: number, b: number): string {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        })
        .join('')
    );
  }
}

/**
 * Layout utilities for graph visualization
 */
export class LayoutUtils {
  /**
   * Calculate optimal node sizes based on graph statistics
   */
  static calculateOptimalNodeSizes(nodeTypes: Record<string, number>, totalNodes: number): Record<string, number> {
    const sizes: Record<string, number> = {};
    const baseSize = 15;
    const maxSize = 30;

    Object.entries(nodeTypes).forEach(([type, count]) => {
      const frequency = count / totalNodes;
      const size = Math.max(baseSize, Math.min(maxSize, baseSize + frequency * 20));
      sizes[type] = Math.round(size);
    });

    return sizes;
  }

  /**
   * Calculate optimal edge widths based on edge types
   */
  static calculateOptimalEdgeWidths(edgeTypes: Record<string, number>, totalEdges: number): Record<string, number> {
    const widths: Record<string, number> = {};
    const baseWidth = 2;
    const maxWidth = 6;

    Object.entries(edgeTypes).forEach(([type, count]) => {
      const frequency = count / totalEdges;
      const width = Math.max(baseWidth, Math.min(maxWidth, baseWidth + frequency * 4));
      widths[type] = Math.round(width);
    });

    return widths;
  }

  /**
   * Generate layout options for different graph sizes
   */
  static getLayoutOptionsForGraphSize(nodeCount: number, _edgeCount: number): any {
    if (nodeCount < 50) {
      return {
        layout: 'force',
        layoutOptions: {
          force: {
            charge: -500,
            linkDistance: 80,
            gravity: 0.1,
          },
        },
      };
    } else if (nodeCount < 200) {
      return {
        layout: 'force',
        layoutOptions: {
          force: {
            charge: -1000,
            linkDistance: 100,
            gravity: 0.05,
          },
        },
      };
    } else {
      return {
        layout: 'force',
        layoutOptions: {
          force: {
            charge: -2000,
            linkDistance: 120,
            gravity: 0.02,
          },
        },
      };
    }
  }
}

/**
 * Performance utilities for graph visualization
 */
export class PerformanceUtils {
  /**
   * Check if the graph size is suitable for real-time visualization
   */
  static isSuitableForRealTime(nodeCount: number, edgeCount: number): boolean {
    return nodeCount <= 1000 && edgeCount <= 2000;
  }

  /**
   * Get recommended visualization backend based on graph size
   */
  static getRecommendedBackend(nodeCount: number, _edgeCount: number): VisualizationBackend {
    if (nodeCount <= 100) {
      return 'd3'; // Best for small graphs with custom styling
    } else if (nodeCount <= 500) {
      return 'vis-network'; // Good balance of features and performance
    } else if (nodeCount <= 1000) {
      return 'cytoscape'; // Professional features for larger graphs
    } else {
      return 'vis-network'; // Best performance for very large graphs
    }
  }

  /**
   * Optimize snapshot for performance
   */
  static optimizeSnapshot(snapshot: GraphSnapshot, maxNodes: number = 1000): GraphSnapshot {
    if (snapshot.nodes.length <= maxNodes) {
      return snapshot;
    }

    // Sort nodes by importance (confidence, degree, etc.)
    const nodeImportance = new Map<string, number>();
    snapshot.nodes.forEach((node) => {
      let importance = node.confidence;

      // Add degree-based importance
      const degree = snapshot.edges.filter((edge) => edge.from === node.id || edge.to === node.id).length;
      importance += degree * 0.1;

      nodeImportance.set(node.id, importance);
    });

    // Select top nodes
    const sortedNodes = snapshot.nodes.sort((a, b) => (nodeImportance.get(b.id) || 0) - (nodeImportance.get(a.id) || 0)).slice(0, maxNodes);

    const selectedNodeIds = new Set(sortedNodes.map((n) => n.id));
    const selectedEdges = snapshot.edges.filter((edge) => selectedNodeIds.has(edge.from) && selectedNodeIds.has(edge.to));

    return {
      nodes: sortedNodes,
      edges: selectedEdges,
      metadata: snapshot.metadata,
    };
  }
}

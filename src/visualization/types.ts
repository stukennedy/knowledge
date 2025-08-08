/**
 * Visualization backend types
 */
export type VisualizationBackend = 'd3' | 'vis-network' | 'cytoscape' | 'three';

/**
 * Node visualization data
 */
export interface VisualNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
  confidence: number;
  // Visual properties
  x?: number;
  y?: number;
  z?: number;
  size?: number;
  color?: string;
  shape?: 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'custom';
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
  // Custom styling
  style?: Record<string, any>;
}

/**
 * Edge visualization data
 */
export interface VisualEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  properties: Record<string, any>;
  confidence: number;
  // Visual properties
  width?: number;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted' | 'curved' | Record<string, any>;
  opacity?: number;
  arrows?: boolean | 'from' | 'to' | 'both';
}

/**
 * Graph snapshot for visualization
 */
export interface GraphSnapshot {
  nodes: VisualNode[];
  edges: VisualEdge[];
  metadata?: {
    nodeCount: number;
    edgeCount: number;
    nodeTypes: Record<string, number>;
    edgeTypes: Record<string, number>;
    timestamp: Date;
  };
}

/**
 * Visualization options
 */
export interface VisualizationOptions {
  // Layout options
  layout?: 'force' | 'hierarchical' | 'circular' | 'grid' | 'random' | 'custom';
  layoutOptions?: Record<string, any>;

  // Styling options
  nodeColors?: Record<string, string>;
  edgeColors?: Record<string, string>;
  nodeSizes?: Record<string, number>;
  defaultNodeColor?: string;
  defaultEdgeColor?: string;
  defaultNodeSize?: number;
  defaultEdgeWidth?: number;

  // Interaction options
  enableZoom?: boolean;
  enablePan?: boolean;
  enableDrag?: boolean;
  enableSelection?: boolean;
  enableHover?: boolean;

  // Performance options
  maxNodes?: number;
  maxEdges?: number;
  animationDuration?: number;

  // Custom options
  customOptions?: Record<string, any>;
}

/**
 * Event handlers for visualization interactions
 */
export interface VisualizationEvents {
  onNodeClick?: (node: VisualNode, event: any) => void;
  onNodeHover?: (node: VisualNode, event: any) => void;
  onNodeDrag?: (node: VisualNode, event: any) => void;
  onEdgeClick?: (edge: VisualEdge, event: any) => void;
  onEdgeHover?: (edge: VisualEdge, event: any) => void;
  onCanvasClick?: (event: any) => void;
  onZoom?: (scale: number, event: any) => void;
  onPan?: (x: number, y: number, event: any) => void;
}

/**
 * Base visualization interface
 */
export interface GraphVisualizer {
  /**
   * Initialize the visualization
   */
  initialize(container: HTMLElement, options?: VisualizationOptions): Promise<void>;

  /**
   * Render the graph snapshot
   */
  render(snapshot: GraphSnapshot): Promise<void>;

  /**
   * Update the visualization with new data
   */
  update(snapshot: GraphSnapshot): Promise<void>;

  /**
   * Set event handlers
   */
  setEvents(events: VisualizationEvents): void;

  /**
   * Get the current view state
   */
  getViewState(): any;

  /**
   * Set the view state
   */
  setViewState(state: any): void;

  /**
   * Fit the graph to the container
   */
  fitToContainer(): void;

  /**
   * Center on a specific node
   */
  centerOnNode(nodeId: string): void;

  /**
   * Highlight nodes
   */
  highlightNodes(nodeIds: string[]): void;

  /**
   * Clear highlights
   */
  clearHighlights(): void;

  /**
   * Export the visualization as an image
   */
  exportImage(format: 'png' | 'svg' | 'jpg', options?: Record<string, any>): Promise<string>;

  /**
   * Destroy the visualization
   */
  destroy(): void;
}

/**
 * Visualization factory options
 */
export interface VisualizerFactoryOptions {
  backend: VisualizationBackend;
  container: HTMLElement;
  options?: VisualizationOptions;
  events?: VisualizationEvents;
}

/**
 * Visualization Registry interface
 */
export interface VisualizationRegistry {
  visualizers: Map<string, any>;
  register(name: string, visualizer: any): void;
  get(name: string): any | undefined;
  list(): string[];
  getAvailableBackends(): string[];
}

/**
 * Snapshot creation options
 */
export interface SnapshotOptions {
  maxNodes?: number;
  maxEdges?: number;
  nodeTypes?: string[];
  edgeTypes?: string[];
  minConfidence?: number;
  includeMetadata?: boolean;
  transformOptions?: {
    nodeColorMapping?: Record<string, string>;
    edgeColorMapping?: Record<string, string>;
    nodeSizeMapping?: Record<string, number>;
    edgeWidthMapping?: Record<string, number>;
  };
}

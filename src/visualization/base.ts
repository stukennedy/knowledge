import type { KnowledgeGraph } from '../core/KnowledgeGraph';
import type { QueryResult } from '../types';
import type { GraphVisualizer, GraphSnapshot, VisualNode, VisualEdge, VisualizationOptions, VisualizationEvents, SnapshotOptions } from './types';

/**
 * Base class for graph visualizers
 */
export abstract class BaseGraphVisualizer implements GraphVisualizer {
  protected container: HTMLElement | null = null;
  protected options: VisualizationOptions = {};
  protected events: VisualizationEvents = {};
  protected isInitialized = false;
  protected currentSnapshot: GraphSnapshot | null = null;

  /**
   * Initialize the visualization
   */
  async initialize(container: HTMLElement, options?: VisualizationOptions): Promise<void> {
    this.container = container;
    this.options = { ...this.getDefaultOptions(), ...options };
    this.isInitialized = true;
    await this.initializeBackend();
  }

  /**
   * Render the graph snapshot
   */
  async render(snapshot: GraphSnapshot): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Visualizer not initialized. Call initialize() first.');
    }

    this.currentSnapshot = snapshot;
    await this.renderBackend(snapshot);
  }

  /**
   * Update the visualization with new data
   */
  async update(snapshot: GraphSnapshot): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Visualizer not initialized. Call initialize() first.');
    }

    this.currentSnapshot = snapshot;
    await this.updateBackend(snapshot);
  }

  /**
   * Set event handlers
   */
  setEvents(events: VisualizationEvents): void {
    this.events = { ...this.events, ...events };
    this.setBackendEvents(events);
  }

  /**
   * Get the current view state
   */
  getViewState(): any {
    return this.getBackendViewState();
  }

  /**
   * Set the view state
   */
  setViewState(state: any): void {
    this.setBackendViewState(state);
  }

  /**
   * Fit the graph to the container
   */
  fitToContainer(): void {
    this.fitBackendToContainer();
  }

  /**
   * Center on a specific node
   */
  centerOnNode(nodeId: string): void {
    this.centerBackendOnNode(nodeId);
  }

  /**
   * Highlight nodes
   */
  highlightNodes(nodeIds: string[]): void {
    this.highlightBackendNodes(nodeIds);
  }

  /**
   * Clear highlights
   */
  clearHighlights(): void {
    this.clearBackendHighlights();
  }

  /**
   * Export the visualization as an image
   */
  async exportImage(format: 'png' | 'svg' | 'jpg', options?: Record<string, any>): Promise<string> {
    return await this.exportBackendImage(format, options);
  }

  /**
   * Destroy the visualization
   */
  destroy(): void {
    this.destroyBackend();
    this.container = null;
    this.isInitialized = false;
    this.currentSnapshot = null;
  }

  /**
   * Get default visualization options
   */
  protected getDefaultOptions(): VisualizationOptions {
    return {
      layout: 'force',
      layoutOptions: {
        force: {
          charge: -1000,
          linkDistance: 100,
          gravity: 0.1,
        },
      },
      nodeColors: {
        PERSON: '#4CAF50',
        ORGANIZATION: '#2196F3',
        LOCATION: '#FF9800',
        CONCEPT: '#9C27B0',
        EVENT: '#F44336',
        DOCUMENT: '#607D8B',
      },
      edgeColors: {
        RELATED_TO: '#666666',
        KNOWS: '#4CAF50',
        EMPLOYED_BY: '#2196F3',
        LOCATED_IN: '#FF9800',
        PART_OF: '#9C27B0',
      },
      nodeSizes: {
        PERSON: 20,
        ORGANIZATION: 25,
        LOCATION: 18,
        CONCEPT: 15,
        EVENT: 22,
        DOCUMENT: 16,
      },
      defaultNodeColor: '#666666',
      defaultEdgeColor: '#999999',
      defaultNodeSize: 15,
      defaultEdgeWidth: 2,
      enableZoom: true,
      enablePan: true,
      enableDrag: true,
      enableSelection: true,
      enableHover: true,
      maxNodes: 1000,
      maxEdges: 2000,
      animationDuration: 300,
    };
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract initializeBackend(): Promise<void>;
  protected abstract renderBackend(snapshot: GraphSnapshot): Promise<void>;
  protected abstract updateBackend(snapshot: GraphSnapshot): Promise<void>;
  protected abstract setBackendEvents(events: VisualizationEvents): void;
  protected abstract getBackendViewState(): any;
  protected abstract setBackendViewState(state: any): void;
  protected abstract fitBackendToContainer(): void;
  protected abstract centerBackendOnNode(nodeId: string): void;
  protected abstract highlightBackendNodes(nodeIds: string[]): void;
  protected abstract clearBackendHighlights(): void;
  protected abstract exportBackendImage(format: 'png' | 'svg' | 'jpg', options?: Record<string, any>): Promise<string>;
  protected abstract destroyBackend(): void;
}

/**
 * Utility class for creating graph snapshots from knowledge graphs
 */
export class GraphSnapshotCreator {
  constructor(private graph: KnowledgeGraph) {}

  /**
   * Create a snapshot from a query result
   */
  async createFromQueryResult(queryResult: QueryResult, options?: SnapshotOptions): Promise<GraphSnapshot> {
    const visualNodes = this.transformNodes(queryResult.nodes, options);
    const visualEdges = this.transformEdges(queryResult.edges, options);

    const snapshot: GraphSnapshot = {
      nodes: visualNodes,
      edges: visualEdges,
    };

    if (options?.includeMetadata) {
      snapshot.metadata = await this.createMetadata(queryResult, options);
    }

    return snapshot;
  }

  /**
   * Create a snapshot from a specific node and its neighborhood
   */
  async createFromNode(nodeId: string, depth: number = 2, options?: SnapshotOptions): Promise<GraphSnapshot> {
    const queryResult = await this.graph.queryRelated(nodeId, {
      depth,
      includeEdges: true,
    });

    return this.createFromQueryResult(queryResult, options);
  }

  /**
   * Create a snapshot from a search query
   */
  async createFromSearch(query: string, options?: SnapshotOptions): Promise<GraphSnapshot> {
    const queryResult = await this.graph.search({
      query,
      limit: options?.maxNodes || 50,
    });

    return this.createFromQueryResult(queryResult, options);
  }

  /**
   * Create a snapshot from all nodes of specific types
   */
  async createFromNodeTypes(nodeTypes: string[], options?: SnapshotOptions): Promise<GraphSnapshot> {
    const allNodes: any[] = [];
    const allEdges: any[] = [];

    for (const nodeType of nodeTypes) {
      const result = await this.graph.queryByType(nodeType, {
        limit: options?.maxNodes || 100,
        includeEdges: true,
      });
      allNodes.push(...result.nodes);
      allEdges.push(...result.edges);
    }

    const queryResult: QueryResult = {
      nodes: allNodes,
      edges: allEdges,
    };

    return this.createFromQueryResult(queryResult, options);
  }

  /**
   * Transform knowledge nodes to visual nodes
   */
  private transformNodes(nodes: any[], options?: SnapshotOptions): VisualNode[] {
    return nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      properties: node.properties,
      confidence: node.confidence,
      size: options?.transformOptions?.nodeSizeMapping?.[node.type] || 15,
      color: options?.transformOptions?.nodeColorMapping?.[node.type] || '#666666',
      opacity: node.confidence,
    }));
  }

  /**
   * Transform knowledge edges to visual edges
   */
  private transformEdges(edges: any[], options?: SnapshotOptions): VisualEdge[] {
    return edges.map((edge) => ({
      id: edge.id,
      from: edge.fromNodeId,
      to: edge.toNodeId,
      type: edge.type,
      properties: edge.properties,
      confidence: edge.confidence,
      width: options?.transformOptions?.edgeWidthMapping?.[edge.type] || 2,
      color: options?.transformOptions?.edgeColorMapping?.[edge.type] || '#999999',
      opacity: edge.confidence,
      arrows: 'to',
    }));
  }

  /**
   * Create metadata for the snapshot
   */
  private async createMetadata(queryResult: QueryResult, _options?: SnapshotOptions): Promise<GraphSnapshot['metadata']> {
    const nodeTypes: Record<string, number> = {};
    const edgeTypes: Record<string, number> = {};

    for (const node of queryResult.nodes) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }

    for (const edge of queryResult.edges) {
      edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
    }

    return {
      nodeCount: queryResult.nodes.length,
      edgeCount: queryResult.edges.length,
      nodeTypes,
      edgeTypes,
      timestamp: new Date(),
    };
  }
}

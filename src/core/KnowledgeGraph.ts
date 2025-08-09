import { DatabaseAdapter } from '../adapters/base';
import {
  KnowledgeNode,
  KnowledgeEdge,
  NodeType,
  EdgeType,
  QueryResult,
  QueryOptions,
  NodeOptions,
  EdgeOptions,
  TraversalOptions,
  Path,
  GraphStats,
  SearchOptions,
  BatchResult,
} from '../types';
import type { NewNode, NewEdge } from '../schema';

/**
 * Main KnowledgeGraph class that provides high-level graph operations
 */
export class KnowledgeGraph<TNodeType extends string = string> {
  private adapter: DatabaseAdapter;
  private initialized = false;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  /**
   * Initialize the knowledge graph
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.adapter.initialize();
    this.initialized = true;
  }

  /**
   * Ensure the graph is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // ============ Node Operations ============

  /**
   * Add a new node to the graph
   */
  async addNode(options: NodeOptions<TNodeType>): Promise<KnowledgeNode> {
    await this.ensureInitialized();

    const id = crypto.randomUUID();
    const now = new Date();

    const newNode: NewNode = {
      id,
      type: options.type,
      label: options.label,
      properties: JSON.stringify(options.properties || {}),
      confidence: options.confidence || 1.0,
      createdAt: now,
      updatedAt: now,
      sourceSessionIds: options.sourceSessionId ? JSON.stringify([options.sourceSessionId]) : undefined,
    };

    const node = await this.adapter.insertNode(newNode);

    // Add to search index
    await this.indexNodeForSearch(node);

    // Add to type index
    await this.adapter.insertNodeIndex({
      indexKey: `type:${node.type}`,
      nodeId: node.id,
      createdAt: now,
    });

    return this.normalizeNode(node);
  }

  /**
   * Update an existing node
   */
  async updateNode(nodeId: string, updates: Partial<NodeOptions<TNodeType>>, mergeProperties = true): Promise<KnowledgeNode | null> {
    await this.ensureInitialized();

    const existingNode = await this.adapter.getNode(nodeId);
    if (!existingNode) return null;

    const existingProperties = existingNode.properties as unknown as Record<string, any>;
    const properties = mergeProperties && updates.properties ? { ...existingProperties, ...updates.properties } : updates.properties || existingProperties;

    const nodeUpdates: Partial<NewNode> = {
      type: updates.type,
      label: updates.label,
      properties: JSON.stringify(properties),
      confidence: updates.confidence,
      updatedAt: new Date(),
    };

    if (updates.sourceSessionId) {
      const existingSessionIds = Array.isArray(existingNode.sourceSessionIds) ? (existingNode.sourceSessionIds as string[]) : [];
      if (!existingSessionIds.includes(updates.sourceSessionId)) {
        existingSessionIds.push(updates.sourceSessionId);
        nodeUpdates.sourceSessionIds = JSON.stringify(existingSessionIds);
      }
    }

    const updatedNode = await this.adapter.updateNode(nodeId, nodeUpdates);
    if (!updatedNode) return null;

    // Update search index
    await this.adapter.deleteSearchIndex(nodeId);
    await this.indexNodeForSearch(updatedNode);

    return this.normalizeNode(updatedNode);
  }

  /**
   * Delete a node and all its edges
   */
  async deleteNode(nodeId: string): Promise<boolean> {
    await this.ensureInitialized();

    // Edges are cascade deleted via foreign key constraints
    return await this.adapter.deleteNode(nodeId);
  }

  /**
   * Get a node by ID
   */
  async getNode(nodeId: string): Promise<KnowledgeNode | null> {
    await this.ensureInitialized();

    const node = await this.adapter.getNode(nodeId);
    return node ? this.normalizeNode(node) : null;
  }

  /**
   * Find nodes by label (exact or partial match)
   */
  async findNodesByLabel(label: string, exact = false): Promise<KnowledgeNode[]> {
    await this.ensureInitialized();

    if (exact) {
      const nodes = await this.adapter.queryNodes({ label }, 100);
      return nodes.map((n) => this.normalizeNode(n));
    }

    // Use search index for partial matching
    const searchResults = await this.adapter.searchNodes(label.toLowerCase());
    const nodeIds = [...new Set(searchResults.map((r) => r.nodeId))];

    if (nodeIds.length === 0) return [];

    const nodes = await this.adapter.getNodes(nodeIds);
    return nodes.map((n) => this.normalizeNode(n));
  }

  // ============ Edge Operations ============

  /**
   * Add an edge between two nodes
   */
  async addEdge(options: EdgeOptions): Promise<KnowledgeEdge> {
    await this.ensureInitialized();

    // Verify both nodes exist
    const [fromNode, toNode] = await Promise.all([this.adapter.getNode(options.fromNodeId), this.adapter.getNode(options.toNodeId)]);

    if (!fromNode) {
      throw new Error(`From node ${options.fromNodeId} does not exist`);
    }
    if (!toNode) {
      throw new Error(`To node ${options.toNodeId} does not exist`);
    }

    const id = crypto.randomUUID();
    const now = new Date();

    const newEdge: NewEdge = {
      id,
      type: options.type,
      fromNodeId: options.fromNodeId,
      toNodeId: options.toNodeId,
      properties: JSON.stringify(options.properties || {}),
      confidence: options.confidence || 1.0,
      createdAt: now,
      sourceSessionIds: options.sourceSessionId ? JSON.stringify([options.sourceSessionId]) : undefined,
    };

    const edge = await this.adapter.insertEdge(newEdge);

    // Add to indices
    await Promise.all([
      this.adapter.insertEdgeIndex({
        indexKey: `from:${options.fromNodeId}:${options.type}`,
        edgeId: id,
        createdAt: now,
      }),
      this.adapter.insertEdgeIndex({
        indexKey: `to:${options.toNodeId}:${options.type}`,
        edgeId: id,
        createdAt: now,
      }),
      this.adapter.insertEdgeIndex({
        indexKey: `type:${options.type}`,
        edgeId: id,
        createdAt: now,
      }),
    ]);

    // Add bidirectional edge if requested
    if (options.bidirectional) {
      await this.addEdge({
        ...options,
        fromNodeId: options.toNodeId,
        toNodeId: options.fromNodeId,
        bidirectional: false, // Prevent infinite recursion
      });
    }

    return this.normalizeEdge(edge);
  }

  /**
   * Delete an edge
   */
  async deleteEdge(edgeId: string): Promise<boolean> {
    await this.ensureInitialized();
    return await this.adapter.deleteEdge(edgeId);
  }

  /**
   * Get edges between two nodes
   */
  async getEdgesBetween(fromNodeId: string, toNodeId: string, edgeType?: EdgeType | string): Promise<KnowledgeEdge[]> {
    await this.ensureInitialized();

    const conditions: Record<string, any> = {
      fromNodeId: fromNodeId,
      toNodeId: toNodeId,
    };

    if (edgeType) {
      conditions.type = edgeType;
    }

    const edges = await this.adapter.queryEdges(conditions);
    return edges.map((e) => this.normalizeEdge(e));
  }

  // ============ Query Operations ============

  /**
   * Query nodes by type
   */
  async queryByType(nodeType: NodeType | string, options?: QueryOptions): Promise<QueryResult> {
    await this.ensureInitialized();

    const nodes = await this.adapter.queryNodes({ type: nodeType }, options?.limit || 100, options?.offset || 0);

    const edges: KnowledgeEdge[] = [];

    if (options?.includeEdges && nodes.length > 0) {
      const nodeIds = nodes.map((n) => n.id);
      const edgeResults = await Promise.all([this.adapter.queryEdges({ fromNodeId: nodeIds[0] }), this.adapter.queryEdges({ toNodeId: nodeIds[0] })]);

      edges.push(...edgeResults.flat().map((e) => this.normalizeEdge(e)));
    }

    return {
      nodes: nodes.map((n) => this.normalizeNode(n)),
      edges,
      relevanceScore: 1.0,
    };
  }

  /**
   * Query related nodes starting from a given node
   */
  async queryRelated(nodeId: string, options?: QueryOptions): Promise<QueryResult> {
    await this.ensureInitialized();

    const startNode = await this.adapter.getNode(nodeId);
    if (!startNode) {
      return { nodes: [], edges: [], relevanceScore: 0 };
    }

    const visitedNodes = new Map<string, KnowledgeNode>();
    const visitedEdges = new Map<string, KnowledgeEdge>();

    visitedNodes.set(nodeId, this.normalizeNode(startNode));

    await this.traverseGraph(nodeId, options?.depth || 1, options?.direction || 'both', options?.edgeTypes, visitedNodes, visitedEdges);

    return {
      nodes: Array.from(visitedNodes.values()),
      edges: Array.from(visitedEdges.values()),
      relevanceScore: this.calculateRelevance(visitedNodes.size, visitedEdges.size),
    };
  }

  /**
   * Search nodes using text query
   */
  async search(options: SearchOptions): Promise<QueryResult> {
    await this.ensureInitialized();

    const searchTerms = options.query.toLowerCase().split(/\s+/);
    const nodeScores = new Map<string, number>();

    // Search for each term
    for (const term of searchTerms) {
      const results = await this.adapter.searchNodes(term, options.limit || 50);

      for (const result of results) {
        const currentScore = nodeScores.get(result.nodeId) || 0;
        nodeScores.set(result.nodeId, currentScore + result.weight);
      }
    }

    // Filter by minimum score if specified
    const minScore = options.minScore || 0;
    const qualifiedNodeIds = Array.from(nodeScores.entries())
      .filter(([_, score]) => score >= minScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, options.limit || 50)
      .map(([id]) => id);

    if (qualifiedNodeIds.length === 0) {
      return { nodes: [], edges: [], relevanceScore: 0 };
    }

    const nodes = await this.adapter.getNodes(qualifiedNodeIds);

    // Filter by node types if specified
    const filteredNodes = options.nodeTypes ? nodes.filter((n) => options.nodeTypes!.includes(n.type)) : nodes;

    return {
      nodes: filteredNodes.map((n) => this.normalizeNode(n)),
      edges: [],
      relevanceScore: qualifiedNodeIds[0] ? nodeScores.get(qualifiedNodeIds[0]) || 0 : 0,
    };
  }

  // ============ Graph Traversal ============

  /**
   * Traverse the graph from a starting node
   */
  async traverse(options: TraversalOptions): Promise<QueryResult> {
    await this.ensureInitialized();

    const visitedNodes = new Map<string, KnowledgeNode>();
    const visitedEdges = new Map<string, KnowledgeEdge>();
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: options.startNodeId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (visited.has(nodeId) && options.visitOnce !== false) continue;
      if (depth > (options.maxDepth || Infinity)) continue;

      visited.add(nodeId);

      const node = await this.adapter.getNode(nodeId);
      if (!node) continue;

      const normalizedNode = this.normalizeNode(node);

      if (!options.nodeFilter || options.nodeFilter(normalizedNode)) {
        visitedNodes.set(nodeId, normalizedNode);
      }

      // Get edges based on direction
      const edges: KnowledgeEdge[] = [];

      if (options.direction === 'out' || options.direction === 'both') {
        const outEdges = await this.adapter.queryEdges({ fromNodeId: nodeId });
        edges.push(...outEdges.map((e) => this.normalizeEdge(e)));
      }

      if (options.direction === 'in' || options.direction === 'both') {
        const inEdges = await this.adapter.queryEdges({ toNodeId: nodeId });
        edges.push(...inEdges.map((e) => this.normalizeEdge(e)));
      }

      for (const edge of edges) {
        if (options.edgeTypes && !options.edgeTypes.includes(edge.type)) continue;
        if (options.edgeFilter && !options.edgeFilter(edge)) continue;

        visitedEdges.set(edge.id, edge);

        const nextNodeId = edge.fromNodeId === nodeId ? edge.toNodeId : edge.fromNodeId;
        if (!visited.has(nextNodeId) || options.visitOnce === false) {
          queue.push({ nodeId: nextNodeId, depth: depth + 1 });
        }
      }
    }

    return {
      nodes: Array.from(visitedNodes.values()),
      edges: Array.from(visitedEdges.values()),
      relevanceScore: 1.0,
    };
  }

  /**
   * Find shortest path between two nodes
   */
  async findShortestPath(fromNodeId: string, toNodeId: string, options?: { edgeTypes?: (EdgeType | string)[] }): Promise<Path | null> {
    await this.ensureInitialized();

    const queue: Array<{ nodeId: string; path: string[]; edges: string[] }> = [{ nodeId: fromNodeId, path: [fromNodeId], edges: [] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path, edges } = queue.shift()!;

      if (nodeId === toNodeId) {
        // Found the target node
        const nodes = await this.adapter.getNodes(path);
        const edgeObjects = edges.length > 0 ? await this.adapter.getEdges(edges) : [];

        return {
          nodes: nodes.map((n) => this.normalizeNode(n)),
          edges: edgeObjects.map((e) => this.normalizeEdge(e)),
          length: path.length - 1,
        };
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // Get all outgoing edges
      const outEdges = await this.adapter.queryEdges({ fromNodeId: nodeId });

      for (const edge of outEdges) {
        if (options?.edgeTypes && !options.edgeTypes.includes(edge.type)) continue;

        const nextNodeId = edge.toNodeId;
        if (!visited.has(nextNodeId)) {
          queue.push({
            nodeId: nextNodeId,
            path: [...path, nextNodeId],
            edges: [...edges, edge.id],
          });
        }
      }
    }

    return null; // No path found
  }

  // ============ Statistics ============

  /**
   * Get graph statistics
   */
  async getStats(): Promise<GraphStats> {
    await this.ensureInitialized();

    const dbStats = await this.adapter.getStats();

    // Count nodes and edges by type
    const nodeTypes = await this.execute<{ type: string; count: number }>('SELECT type, COUNT(*) as count FROM kg_nodes GROUP BY type');

    const edgeTypes = await this.execute<{ type: string; count: number }>('SELECT type, COUNT(*) as count FROM kg_edges GROUP BY type');

    const nodesByType: Record<string, number> = {};
    for (const { type, count } of nodeTypes) {
      nodesByType[type] = count;
    }

    const edgesByType: Record<string, number> = {};
    for (const { type, count } of edgeTypes) {
      edgesByType[type] = count;
    }

    // Calculate average degree
    const averageDegree = dbStats.nodeCount > 0 ? (dbStats.edgeCount * 2) / dbStats.nodeCount : 0;

    // Calculate density (actual edges / possible edges)
    const possibleEdges = dbStats.nodeCount * (dbStats.nodeCount - 1);
    const density = possibleEdges > 0 ? dbStats.edgeCount / possibleEdges : 0;

    return {
      nodeCount: dbStats.nodeCount,
      edgeCount: dbStats.edgeCount,
      nodesByType,
      edgesByType,
      averageDegree,
      density,
      lastUpdated: new Date(),
    };
  }

  // ============ Batch Operations ============

  /**
   * Batch insert nodes
   */
  async batchAddNodes(nodes: NodeOptions<TNodeType>[]): Promise<BatchResult> {
    await this.ensureInitialized();

    const successful: string[] = [];
    const errors: Array<{ item: any; error: Error }> = [];

    for (const nodeOptions of nodes) {
      try {
        const node = await this.addNode(nodeOptions);
        successful.push(node.id);
      } catch (error) {
        errors.push({ item: nodeOptions, error: error as Error });
      }
    }

    return {
      successful: successful.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Batch insert edges
   */
  async batchAddEdges(edges: EdgeOptions[]): Promise<BatchResult> {
    await this.ensureInitialized();

    const successful: string[] = [];
    const errors: Array<{ item: any; error: Error }> = [];

    for (const edgeOptions of edges) {
      try {
        const edge = await this.addEdge(edgeOptions);
        successful.push(edge.id);
      } catch (error) {
        errors.push({ item: edgeOptions, error: error as Error });
      }
    }

    return {
      successful: successful.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ============ Maintenance ============

  /**
   * Vacuum the database to reclaim space
   */
  async vacuum(): Promise<void> {
    await this.ensureInitialized();
    await this.adapter.vacuum();
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.adapter.close();
    this.initialized = false;
  }

  // ============ Helper Methods ============

  /**
   * Execute raw SQL query (for advanced use cases)
   */
  private async execute<T>(query: string, params: any[] = []): Promise<T[]> {
    return await this.adapter.execute<T>(query, params);
  }

  /**
   * Normalize a node from database format
   */
  private normalizeNode(node: any): KnowledgeNode {
    return {
      id: node.id,
      type: node.type,
      label: node.label,
      properties: typeof node.properties === 'string' ? JSON.parse(node.properties) : node.properties,
      confidence: node.confidence,
      createdAt: node.createdAt instanceof Date ? node.createdAt : new Date(node.createdAt),
      updatedAt: node.updatedAt instanceof Date ? node.updatedAt : new Date(node.updatedAt),
      sourceSessionIds: node.sourceSessionIds ? (typeof node.sourceSessionIds === 'string' ? JSON.parse(node.sourceSessionIds) : node.sourceSessionIds) : undefined,
    };
  }

  /**
   * Normalize an edge from database format
   */
  private normalizeEdge(edge: any): KnowledgeEdge {
    return {
      id: edge.id,
      type: edge.type,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      properties: typeof edge.properties === 'string' ? JSON.parse(edge.properties) : edge.properties,
      confidence: edge.confidence,
      createdAt: edge.createdAt instanceof Date ? edge.createdAt : new Date(edge.createdAt),
      sourceSessionIds: edge.sourceSessionIds ? (typeof edge.sourceSessionIds === 'string' ? JSON.parse(edge.sourceSessionIds) : edge.sourceSessionIds) : undefined,
    };
  }

  /**
   * Index a node for search
   */
  private async indexNodeForSearch(node: any): Promise<void> {
    const searchTerms = new Set<string>();

    // Index label
    const labelTerms = node.label.toLowerCase().split(/\s+/);
    labelTerms.forEach((term: string) => searchTerms.add(term));

    // Index important properties
    const properties = typeof node.properties === 'string' ? JSON.parse(node.properties) : node.properties;

    for (const [, value] of Object.entries(properties)) {
      if (typeof value === 'string') {
        const terms = value.toLowerCase().split(/\s+/);
        terms.forEach((term: string) => searchTerms.add(term));
      }
    }

    // Insert search indices
    for (const term of searchTerms) {
      await this.adapter.insertSearchIndex({
        term,
        nodeId: node.id,
        field: 'label',
        weight: 1.0,
      });
    }
  }

  /**
   * Traverse graph helper
   */
  private async traverseGraph(
    nodeId: string,
    depth: number,
    direction: 'in' | 'out' | 'both',
    edgeTypes: (EdgeType | string)[] | undefined,
    visitedNodes: Map<string, KnowledgeNode>,
    visitedEdges: Map<string, KnowledgeEdge>,
    currentDepth = 0
  ): Promise<void> {
    if (currentDepth >= depth) return;

    // Get edges based on direction
    const edges: any[] = [];

    if (direction === 'out' || direction === 'both') {
      const outEdges = await this.adapter.queryEdges({ fromNodeId: nodeId });
      edges.push(...outEdges);
    }

    if (direction === 'in' || direction === 'both') {
      const inEdges = await this.adapter.queryEdges({ toNodeId: nodeId });
      edges.push(...inEdges);
    }

    for (const edge of edges) {
      if (edgeTypes && !edgeTypes.includes(edge.type)) continue;

      visitedEdges.set(edge.id, this.normalizeEdge(edge));

      const nextNodeId = edge.fromNodeId === nodeId ? edge.toNodeId : edge.fromNodeId;

      if (!visitedNodes.has(nextNodeId)) {
        const nextNode = await this.adapter.getNode(nextNodeId);
        if (nextNode) {
          visitedNodes.set(nextNodeId, this.normalizeNode(nextNode));

          await this.traverseGraph(nextNodeId, depth, direction, edgeTypes, visitedNodes, visitedEdges, currentDepth + 1);
        }
      }
    }
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(nodeCount: number, edgeCount: number): number {
    return Math.min(1, (nodeCount + edgeCount) / 10);
  }
}

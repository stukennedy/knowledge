import { BaseAdapter, TransactionContext, DatabaseStats, AdapterConfig } from './base';
import type { Node, Edge, NodeIndex, EdgeIndex, SearchIndex, NewNode, NewEdge, NewNodeIndex, NewEdgeIndex, NewSearchIndex } from '../schema';

/**
 * SqlStorage interface - matches the browser's SqlStorage API
 */
interface SqlStorage {
  exec(query: string, ...params: any[]): {
    toArray(): any[];
    rowsWritten?: number;
  };
}

/**
 * SqlStorage adapter for browser environments
 * Works with browser-based SQL storage implementations
 */
export class SqlStorageAdapter extends BaseAdapter {
  private sql: SqlStorage | null = null;

  constructor(config: AdapterConfig = {}) {
    super(config);
  }

  /**
   * Set the SqlStorage instance
   * Must be called before using the adapter
   */
  setSqlStorage(sql: SqlStorage): void {
    this.sql = sql;
  }

  async initialize(): Promise<void> {
    if (!this.sql) {
      throw new Error('SqlStorage not set. Call setSqlStorage() first.');
    }

    try {
      if (this.config.autoCreate !== false) {
        await this.createTables();
      }

      this.log('SqlStorage adapter initialized');
    } catch (error) {
      this.error('Failed to initialize SqlStorage adapter', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.sql) throw new Error('SqlStorage not initialized');

    // Create nodes table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS kg_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source_session_ids TEXT
      )
    `);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON kg_nodes(type)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_label ON kg_nodes(label)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON kg_nodes(created_at)`);

    // Create edges table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS kg_edges (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        from_node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
        to_node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        source_session_ids TEXT
      )
    `);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_edges_type ON kg_edges(type)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_edges_from_node ON kg_edges(from_node_id)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_edges_to_node ON kg_edges(to_node_id)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_edges_from_type ON kg_edges(from_node_id, type)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_edges_to_type ON kg_edges(to_node_id, type)`);

    // Create node indices table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS kg_node_indices (
        index_key TEXT NOT NULL,
        node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (index_key, node_id)
      )
    `);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_node_indices_key ON kg_node_indices(index_key)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_node_indices_node ON kg_node_indices(node_id)`);

    // Create edge indices table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS kg_edge_indices (
        index_key TEXT NOT NULL,
        edge_id TEXT NOT NULL REFERENCES kg_edges(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (index_key, edge_id)
      )
    `);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_edge_indices_key ON kg_edge_indices(index_key)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_edge_indices_edge ON kg_edge_indices(edge_id)`);

    // Create search index table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS kg_search_index (
        term TEXT NOT NULL,
        node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
        field TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1.0,
        PRIMARY KEY (term, node_id, field)
      )
    `);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_search_term ON kg_search_index(term)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_search_node ON kg_search_index(node_id)`);

    // Create graph metadata table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS kg_graph_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  async execute<T = unknown>(query: string, params: any[] = []): Promise<T[]> {
    if (!this.sql) throw new Error('SqlStorage not initialized');

    try {
      const result = this.sql.exec(query, ...params);
      return result.toArray() as T[];
    } catch (error) {
      this.error('Query execution failed', { query, params, error });
      throw error;
    }
  }

  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    if (!this.sql) throw new Error('SqlStorage not initialized');

    // SqlStorage doesn't have native transaction support
    // We'll execute operations directly
    const tx: TransactionContext = {
      execute: async <U = unknown>(query: string, params: any[] = []): Promise<U[]> => {
        return this.execute<U>(query, params);
      },
      rollback: async () => {
        throw new Error('SqlStorage does not support transaction rollback');
      },
    };

    try {
      return await fn(tx);
    } catch (error) {
      this.error('Transaction failed', error);
      throw error;
    }
  }

  // Node operations
  async insertNode(node: NewNode): Promise<Node> {
    const now = Date.now();
    const id = node.id || this.generateId();
    const properties = JSON.stringify(node.properties || {});
    const sourceSessionIds = node.sourceSessionIds ? JSON.stringify(node.sourceSessionIds) : null;

    const query = `
      INSERT INTO kg_nodes (id, type, label, properties, confidence, created_at, updated_at, source_session_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.execute(query, [
      id,
      node.type,
      node.label,
      properties,
      node.confidence || 1.0,
      node.createdAt?.getTime() || now,
      node.updatedAt?.getTime() || now,
      sourceSessionIds,
    ]);

    const result = await this.getNode(id);
    if (!result) throw new Error('Failed to create node');
    return result;
  }

  async updateNode(id: string, updates: Partial<NewNode>): Promise<Node | null> {
    const current = await this.getNode(id);
    if (!current) return null;

    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.type !== undefined) {
      setClauses.push('type = ?');
      params.push(updates.type);
    }
    if (updates.label !== undefined) {
      setClauses.push('label = ?');
      params.push(updates.label);
    }
    if (updates.properties !== undefined) {
      setClauses.push('properties = ?');
      params.push(JSON.stringify(updates.properties));
    }
    if (updates.confidence !== undefined) {
      setClauses.push('confidence = ?');
      params.push(updates.confidence);
    }
    if (updates.sourceSessionIds !== undefined) {
      setClauses.push('source_session_ids = ?');
      params.push(JSON.stringify(updates.sourceSessionIds));
    }

    setClauses.push('updated_at = ?');
    params.push(Date.now());

    params.push(id);

    const query = `UPDATE kg_nodes SET ${setClauses.join(', ')} WHERE id = ?`;
    await this.execute(query, params);

    return this.getNode(id);
  }

  async deleteNode(id: string): Promise<boolean> {
    const query = `DELETE FROM kg_nodes WHERE id = ?`;
    const result = await this.execute(query, [id]);
    return Array.isArray(result) || result !== undefined;
  }

  async getNode(id: string): Promise<Node | null> {
    const query = `SELECT * FROM kg_nodes WHERE id = ? LIMIT 1`;
    const result = await this.execute<any>(query, [id]);
    
    if (!result || result.length === 0) return null;
    
    return this.deserializeNode(result[0]);
  }

  async getNodes(ids: string[]): Promise<Node[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT * FROM kg_nodes WHERE id IN (${placeholders})`;
    const result = await this.execute<any>(query, ids);
    
    return result.map((n: any) => this.deserializeNode(n));
  }

  async queryNodes(conditions: Record<string, any>, limit = 100, offset = 0): Promise<Node[]> {
    const whereClauses: string[] = [];
    const params: any[] = [];

    Object.entries(conditions).forEach(([key, value]) => {
      whereClauses.push(`${key} = ?`);
      params.push(value);
    });

    params.push(limit, offset);

    const query = `
      SELECT * FROM kg_nodes
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      LIMIT ? OFFSET ?
    `;

    const result = await this.execute<any>(query, params);
    return result.map((n: any) => this.deserializeNode(n));
  }

  // Edge operations
  async insertEdge(edge: NewEdge): Promise<Edge> {
    const now = Date.now();
    const id = edge.id || this.generateId();
    const properties = JSON.stringify(edge.properties || {});
    const sourceSessionIds = edge.sourceSessionIds ? JSON.stringify(edge.sourceSessionIds) : null;

    const query = `
      INSERT INTO kg_edges (id, type, from_node_id, to_node_id, properties, confidence, created_at, source_session_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.execute(query, [
      id,
      edge.type,
      edge.fromNodeId,
      edge.toNodeId,
      properties,
      edge.confidence || 1.0,
      edge.createdAt?.getTime() || now,
      sourceSessionIds,
    ]);

    const result = await this.getEdge(id);
    if (!result) throw new Error('Failed to create edge');
    return result;
  }

  async updateEdge(id: string, updates: Partial<NewEdge>): Promise<Edge | null> {
    const current = await this.getEdge(id);
    if (!current) return null;

    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.type !== undefined) {
      setClauses.push('type = ?');
      params.push(updates.type);
    }
    if (updates.fromNodeId !== undefined) {
      setClauses.push('from_node_id = ?');
      params.push(updates.fromNodeId);
    }
    if (updates.toNodeId !== undefined) {
      setClauses.push('to_node_id = ?');
      params.push(updates.toNodeId);
    }
    if (updates.properties !== undefined) {
      setClauses.push('properties = ?');
      params.push(JSON.stringify(updates.properties));
    }
    if (updates.confidence !== undefined) {
      setClauses.push('confidence = ?');
      params.push(updates.confidence);
    }
    if (updates.sourceSessionIds !== undefined) {
      setClauses.push('source_session_ids = ?');
      params.push(JSON.stringify(updates.sourceSessionIds));
    }

    params.push(id);

    const query = `UPDATE kg_edges SET ${setClauses.join(', ')} WHERE id = ?`;
    await this.execute(query, params);

    return this.getEdge(id);
  }

  async deleteEdge(id: string): Promise<boolean> {
    const query = `DELETE FROM kg_edges WHERE id = ?`;
    await this.execute(query, [id]);
    return true;
  }

  async getEdge(id: string): Promise<Edge | null> {
    const query = `SELECT * FROM kg_edges WHERE id = ? LIMIT 1`;
    const result = await this.execute<any>(query, [id]);
    
    if (!result || result.length === 0) return null;
    
    return this.deserializeEdge(result[0]);
  }

  async getEdges(ids: string[]): Promise<Edge[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT * FROM kg_edges WHERE id IN (${placeholders})`;
    const result = await this.execute<any>(query, ids);
    
    return result.map((e: any) => this.deserializeEdge(e));
  }

  async queryEdges(conditions: Record<string, any>, limit = 100, offset = 0): Promise<Edge[]> {
    const whereClauses: string[] = [];
    const params: any[] = [];

    Object.entries(conditions).forEach(([key, value]) => {
      // Convert camelCase to snake_case for database column names
      const dbKey = key === 'fromNodeId' ? 'from_node_id' : 
                    key === 'toNodeId' ? 'to_node_id' : 
                    key;
      whereClauses.push(`${dbKey} = ?`);
      params.push(value);
    });

    params.push(limit, offset);

    const query = `
      SELECT * FROM kg_edges
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      LIMIT ? OFFSET ?
    `;

    const result = await this.execute<any>(query, params);
    return result.map((e: any) => this.deserializeEdge(e));
  }

  // Index operations
  async insertNodeIndex(index: NewNodeIndex): Promise<NodeIndex> {
    const now = Date.now();
    const query = `
      INSERT INTO kg_node_indices (index_key, node_id, created_at)
      VALUES (?, ?, ?)
    `;

    await this.execute(query, [index.indexKey, index.nodeId, index.createdAt?.getTime() || now]);

    return {
      ...index,
      createdAt: index.createdAt || new Date(now),
    };
  }

  async deleteNodeIndex(indexKey: string, nodeId?: string): Promise<number> {
    const query = nodeId
      ? `DELETE FROM kg_node_indices WHERE index_key = ? AND node_id = ?`
      : `DELETE FROM kg_node_indices WHERE index_key = ?`;
    const params = nodeId ? [indexKey, nodeId] : [indexKey];

    const result = await this.execute(query, params);
    return Array.isArray(result) ? result.length : 0;
  }

  async getNodeIndices(indexKey: string): Promise<NodeIndex[]> {
    const query = `SELECT * FROM kg_node_indices WHERE index_key = ?`;
    const result = await this.execute<any>(query, [indexKey]);
    
    return result.map((idx: any) => ({
      indexKey: idx.index_key,
      nodeId: idx.node_id,
      createdAt: new Date(idx.created_at),
    }));
  }

  async insertEdgeIndex(index: NewEdgeIndex): Promise<EdgeIndex> {
    const now = Date.now();
    const query = `
      INSERT INTO kg_edge_indices (index_key, edge_id, created_at)
      VALUES (?, ?, ?)
    `;

    await this.execute(query, [index.indexKey, index.edgeId, index.createdAt?.getTime() || now]);

    return {
      ...index,
      createdAt: index.createdAt || new Date(now),
    };
  }

  async deleteEdgeIndex(indexKey: string, edgeId?: string): Promise<number> {
    const query = edgeId
      ? `DELETE FROM kg_edge_indices WHERE index_key = ? AND edge_id = ?`
      : `DELETE FROM kg_edge_indices WHERE index_key = ?`;
    const params = edgeId ? [indexKey, edgeId] : [indexKey];

    const result = await this.execute(query, params);
    return Array.isArray(result) ? result.length : 0;
  }

  async getEdgeIndices(indexKey: string): Promise<EdgeIndex[]> {
    const query = `SELECT * FROM kg_edge_indices WHERE index_key = ?`;
    const result = await this.execute<any>(query, [indexKey]);
    
    return result.map((idx: any) => ({
      indexKey: idx.index_key,
      edgeId: idx.edge_id,
      createdAt: new Date(idx.created_at),
    }));
  }

  // Search operations
  async insertSearchIndex(index: NewSearchIndex): Promise<SearchIndex> {
    const query = `
      INSERT OR REPLACE INTO kg_search_index (term, node_id, field, weight)
      VALUES (?, ?, ?, ?)
    `;

    await this.execute(query, [index.term, index.nodeId, index.field, index.weight || 1.0]);

    return {
      ...index,
      weight: index.weight || 1.0,
    };
  }

  async deleteSearchIndex(nodeId: string): Promise<number> {
    const query = `DELETE FROM kg_search_index WHERE node_id = ?`;
    const result = await this.execute(query, [nodeId]);
    return Array.isArray(result) ? result.length : 0;
  }

  async searchNodes(term: string, limit = 50): Promise<SearchIndex[]> {
    const query = `
      SELECT * FROM kg_search_index
      WHERE term LIKE ?
      LIMIT ?
    `;
    const result = await this.execute<any>(query, [`%${term}%`, limit]);
    
    return result.map((idx: any) => ({
      term: idx.term,
      nodeId: idx.node_id,
      field: idx.field,
      weight: idx.weight,
    }));
  }

  // Batch operations
  async batchInsertNodes(nodes: NewNode[]): Promise<Node[]> {
    const results: Node[] = [];
    
    for (const node of nodes) {
      const inserted = await this.insertNode(node);
      results.push(inserted);
    }
    
    return results;
  }

  async batchInsertEdges(edges: NewEdge[]): Promise<Edge[]> {
    const results: Edge[] = [];
    
    for (const edge of edges) {
      const inserted = await this.insertEdge(edge);
      results.push(inserted);
    }
    
    return results;
  }

  async batchDeleteNodes(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM kg_nodes WHERE id IN (${placeholders})`;
    const result = await this.execute(query, ids);
    return Array.isArray(result) ? result.length : ids.length;
  }

  async batchDeleteEdges(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM kg_edges WHERE id IN (${placeholders})`;
    const result = await this.execute(query, ids);
    return Array.isArray(result) ? result.length : ids.length;
  }

  // Maintenance operations
  async vacuum(): Promise<void> {
    if (!this.sql) throw new Error('SqlStorage not initialized');

    try {
      this.sql.exec('VACUUM');
      this.log('Database vacuumed');
    } catch {
      // SqlStorage might not support VACUUM
      this.log('VACUUM not supported by SqlStorage');
    }
  }

  async getStats(): Promise<DatabaseStats> {
    const nodeCountResult = await this.execute<any>('SELECT COUNT(*) as count FROM kg_nodes');
    const edgeCountResult = await this.execute<any>('SELECT COUNT(*) as count FROM kg_edges');
    const indexCountResult = await this.execute<any>('SELECT COUNT(*) as count FROM kg_node_indices');

    return {
      nodeCount: nodeCountResult[0]?.count || 0,
      edgeCount: edgeCountResult[0]?.count || 0,
      indexCount: indexCountResult[0]?.count || 0,
    };
  }

  async close(): Promise<void> {
    this.sql = null;
    this.log('SqlStorage adapter closed');
  }

  // Helper methods
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private deserializeNode(node: any): Node {
    return {
      id: node.id,
      type: node.type,
      label: node.label,
      properties: typeof node.properties === 'string' ? JSON.parse(node.properties) : node.properties,
      confidence: node.confidence,
      createdAt: new Date(node.created_at),
      updatedAt: new Date(node.updated_at),
      sourceSessionIds: node.source_session_ids 
        ? (typeof node.source_session_ids === 'string' ? JSON.parse(node.source_session_ids) : node.source_session_ids)
        : undefined,
    };
  }

  private deserializeEdge(edge: any): Edge {
    return {
      id: edge.id,
      type: edge.type,
      fromNodeId: edge.from_node_id,
      toNodeId: edge.to_node_id,
      properties: typeof edge.properties === 'string' ? JSON.parse(edge.properties) : edge.properties,
      confidence: edge.confidence,
      createdAt: new Date(edge.created_at),
      sourceSessionIds: edge.source_session_ids
        ? (typeof edge.source_session_ids === 'string' ? JSON.parse(edge.source_session_ids) : edge.source_session_ids)
        : undefined,
    };
  }
}
import type { D1Database } from '@cloudflare/workers-types';
import { BaseAdapter, TransactionContext, DatabaseStats, AdapterConfig } from './base';
import type { 
  Node, Edge, NodeIndex, EdgeIndex, SearchIndex,
  NewNode, NewEdge, NewNodeIndex, NewEdgeIndex, NewSearchIndex
} from '../schema';

/**
 * Cloudflare D1 adapter implementation
 * Uses raw SQL queries for compatibility with D1 in Durable Objects
 */
export class D1Adapter extends BaseAdapter {
  private db: D1Database | null = null;
  
  constructor(config: AdapterConfig & { database?: D1Database }) {
    super(config);
    if (config.database) {
      this.db = config.database;
    }
  }
  
  setDatabase(db: D1Database): void {
    this.db = db;
  }
  
  async initialize(): Promise<void> {
    if (!this.db) {
      throw new Error('D1 database not provided. Use setDatabase() or pass it in config.');
    }
    
    if (this.config.autoCreate !== false) {
      await this.createTables();
    }
    
    this.log('D1 adapter initialized');
  }
  
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Create nodes table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source_session_ids TEXT
      );
    `);
    
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON kg_nodes(type);`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_label ON kg_nodes(label);`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON kg_nodes(created_at);`);
    
    // Create edges table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_edges (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        from_node_id TEXT NOT NULL,
        to_node_id TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        source_session_ids TEXT,
        FOREIGN KEY (from_node_id) REFERENCES kg_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (to_node_id) REFERENCES kg_nodes(id) ON DELETE CASCADE
      );
    `);
    
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_type ON kg_edges(type);`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_from_node ON kg_edges(from_node_id);`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_to_node ON kg_edges(to_node_id);`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_from_type ON kg_edges(from_node_id, type);`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_to_type ON kg_edges(to_node_id, type);`);
    
    // Create indices tables
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_node_indices (
        index_key TEXT NOT NULL,
        node_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (index_key, node_id),
        FOREIGN KEY (node_id) REFERENCES kg_nodes(id) ON DELETE CASCADE
      );
    `);
    
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_node_indices_key ON kg_node_indices(index_key);`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_node_indices_node ON kg_node_indices(node_id);`);
    
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_edge_indices (
        index_key TEXT NOT NULL,
        edge_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (index_key, edge_id),
        FOREIGN KEY (edge_id) REFERENCES kg_edges(id) ON DELETE CASCADE
      );
    `);
    
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edge_indices_key ON kg_edge_indices(index_key);`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edge_indices_edge ON kg_edge_indices(edge_id);`);
    
    // Create search index table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_search_index (
        term TEXT NOT NULL,
        node_id TEXT NOT NULL,
        field TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1.0,
        PRIMARY KEY (term, node_id, field),
        FOREIGN KEY (node_id) REFERENCES kg_nodes(id) ON DELETE CASCADE
      );
    `);
    
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_search_term ON kg_search_index(term);`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_search_node ON kg_search_index(node_id);`);
    
    // Create metadata table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_graph_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }
  
  async execute<T = unknown>(query: string, params: unknown[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const stmt = this.db.prepare(query).bind(...params);
      const result = await stmt.all();
      return result.results as T[];
    } catch (error) {
      this.error('Query execution failed', { query, params, error });
      throw error;
    }
  }
  
  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');
    
    // D1 doesn't support explicit transactions in the same way
    // We'll simulate it with a try-catch and manual rollback if needed
    const tx: TransactionContext = {
      execute: async <U = unknown>(query: string, params: unknown[] = []): Promise<U[]> => {
        return this.execute<U>(query, params);
      },
      rollback: async () => {
        throw new Error('Transaction rollback');
      }
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
    const id = node.id || crypto.randomUUID();
    const now = Date.now();
    
    const query = `
      INSERT INTO kg_nodes (id, type, label, properties, confidence, created_at, updated_at, source_session_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.execute(query, [
      id,
      node.type,
      node.label,
      JSON.stringify(node.properties || {}),
      node.confidence || 1.0,
      node.createdAt?.getTime() || now,
      node.updatedAt?.getTime() || now,
      node.sourceSessionIds ? JSON.stringify(node.sourceSessionIds) : null
    ]);
    
    return this.getNode(id) as Promise<Node>;
  }
  
  async updateNode(id: string, updates: Partial<NewNode>): Promise<Node | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    
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
    await this.execute(query, [id]);
    return true;
  }
  
  async getNode(id: string): Promise<Node | null> {
    const query = `SELECT * FROM kg_nodes WHERE id = ? LIMIT 1`;
    const results = await this.execute<Record<string, unknown>>(query, [id]);
    
    if (results.length === 0) return null;
    
    return this.deserializeNode(results[0]!);
  }
  
  async getNodes(ids: string[]): Promise<Node[]> {
    if (ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT * FROM kg_nodes WHERE id IN (${placeholders})`;
    const results = await this.execute<Record<string, unknown>>(query, ids);
    
    return results.map(n => this.deserializeNode(n));
  }
  
  async queryNodes(conditions: Record<string, unknown>, limit = 100, offset = 0): Promise<Node[]> {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    
    for (const [key, value] of Object.entries(conditions)) {
      whereClauses.push(`${key} = ?`);
      params.push(value);
    }
    
    params.push(limit, offset);
    
    const query = `
      SELECT * FROM kg_nodes 
      ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      LIMIT ? OFFSET ?
    `;
    
    const results = await this.execute<Record<string, unknown>>(query, params);
    return results.map(n => this.deserializeNode(n));
  }
  
  // Edge operations
  async insertEdge(edge: NewEdge): Promise<Edge> {
    const id = edge.id || crypto.randomUUID();
    const now = Date.now();
    
    const query = `
      INSERT INTO kg_edges (id, type, from_node_id, to_node_id, properties, confidence, created_at, source_session_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.execute(query, [
      id,
      edge.type,
      edge.fromNodeId,
      edge.toNodeId,
      JSON.stringify(edge.properties || {}),
      edge.confidence || 1.0,
      edge.createdAt?.getTime() || now,
      edge.sourceSessionIds ? JSON.stringify(edge.sourceSessionIds) : null
    ]);
    
    return this.getEdge(id) as Promise<Edge>;
  }
  
  async updateEdge(id: string, updates: Partial<NewEdge>): Promise<Edge | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    
    if (updates.type !== undefined) {
      setClauses.push('type = ?');
      params.push(updates.type);
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
    const results = await this.execute<Record<string, unknown>>(query, [id]);
    
    if (results.length === 0) return null;
    
    return this.deserializeEdge(results[0]!);
  }
  
  async getEdges(ids: string[]): Promise<Edge[]> {
    if (ids.length === 0) return [];
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `SELECT * FROM kg_edges WHERE id IN (${placeholders})`;
    const results = await this.execute<Record<string, unknown>>(query, ids);
    
    return results.map(e => this.deserializeEdge(e));
  }
  
  async queryEdges(conditions: Record<string, unknown>, limit = 100, offset = 0): Promise<Edge[]> {
    const whereClauses: string[] = [];
    const params: unknown[] = [];
    
    for (const [key, value] of Object.entries(conditions)) {
      whereClauses.push(`${key} = ?`);
      params.push(value);
    }
    
    params.push(limit, offset);
    
    const query = `
      SELECT * FROM kg_edges 
      ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      LIMIT ? OFFSET ?
    `;
    
    const results = await this.execute<Record<string, unknown>>(query, params);
    return results.map(e => this.deserializeEdge(e));
  }
  
  // Index operations
  async insertNodeIndex(index: NewNodeIndex): Promise<NodeIndex> {
    const query = `
      INSERT INTO kg_node_indices (index_key, node_id, created_at)
      VALUES (?, ?, ?)
    `;
    
    await this.execute(query, [
      index.indexKey,
      index.nodeId,
      index.createdAt?.getTime() || Date.now()
    ]);
    
    return index as NodeIndex;
  }
  
  async deleteNodeIndex(indexKey: string, nodeId?: string): Promise<number> {
    const query = nodeId
      ? `DELETE FROM kg_node_indices WHERE index_key = ? AND node_id = ?`
      : `DELETE FROM kg_node_indices WHERE index_key = ?`;
    const params = nodeId ? [indexKey, nodeId] : [indexKey];
    
    await this.execute(query, params);
    return 1; // D1 doesn't provide change count easily
  }
  
  async getNodeIndices(indexKey: string): Promise<NodeIndex[]> {
    const query = `SELECT * FROM kg_node_indices WHERE index_key = ?`;
    const results = await this.execute<NodeIndex>(query, [indexKey]);
    return results;
  }
  
  async insertEdgeIndex(index: NewEdgeIndex): Promise<EdgeIndex> {
    const query = `
      INSERT INTO kg_edge_indices (index_key, edge_id, created_at)
      VALUES (?, ?, ?)
    `;
    
    await this.execute(query, [
      index.indexKey,
      index.edgeId,
      index.createdAt?.getTime() || Date.now()
    ]);
    
    return index as EdgeIndex;
  }
  
  async deleteEdgeIndex(indexKey: string, edgeId?: string): Promise<number> {
    const query = edgeId
      ? `DELETE FROM kg_edge_indices WHERE index_key = ? AND edge_id = ?`
      : `DELETE FROM kg_edge_indices WHERE index_key = ?`;
    const params = edgeId ? [indexKey, edgeId] : [indexKey];
    
    await this.execute(query, params);
    return 1;
  }
  
  async getEdgeIndices(indexKey: string): Promise<EdgeIndex[]> {
    const query = `SELECT * FROM kg_edge_indices WHERE index_key = ?`;
    const results = await this.execute<EdgeIndex>(query, [indexKey]);
    return results;
  }
  
  // Search operations
  async insertSearchIndex(index: NewSearchIndex): Promise<SearchIndex> {
    const query = `
      INSERT OR REPLACE INTO kg_search_index (term, node_id, field, weight)
      VALUES (?, ?, ?, ?)
    `;
    
    await this.execute(query, [
      index.term,
      index.nodeId,
      index.field,
      index.weight || 1.0
    ]);
    
    return index as SearchIndex;
  }
  
  async deleteSearchIndex(nodeId: string): Promise<number> {
    const query = `DELETE FROM kg_search_index WHERE node_id = ?`;
    await this.execute(query, [nodeId]);
    return 1;
  }
  
  async searchNodes(term: string, limit = 50): Promise<SearchIndex[]> {
    const query = `
      SELECT * FROM kg_search_index 
      WHERE term LIKE ? 
      ORDER BY weight DESC 
      LIMIT ?
    `;
    
    const results = await this.execute<SearchIndex>(query, [`%${term}%`, limit]);
    return results;
  }
  
  // Batch operations
  async batchInsertNodes(nodes: NewNode[]): Promise<Node[]> {
    const insertedNodes: Node[] = [];
    
    for (const node of nodes) {
      const inserted = await this.insertNode(node);
      insertedNodes.push(inserted);
    }
    
    return insertedNodes;
  }
  
  async batchInsertEdges(edges: NewEdge[]): Promise<Edge[]> {
    const insertedEdges: Edge[] = [];
    
    for (const edge of edges) {
      const inserted = await this.insertEdge(edge);
      insertedEdges.push(inserted);
    }
    
    return insertedEdges;
  }
  
  async batchDeleteNodes(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM kg_nodes WHERE id IN (${placeholders})`;
    await this.execute(query, ids);
    return ids.length;
  }
  
  async batchDeleteEdges(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM kg_edges WHERE id IN (${placeholders})`;
    await this.execute(query, ids);
    return ids.length;
  }
  
  // Maintenance operations
  async vacuum(): Promise<void> {
    // D1 handles vacuum automatically
    this.log('Vacuum not needed for D1 (handled automatically)');
  }
  
  async getStats(): Promise<DatabaseStats> {
    const nodeCount = await this.execute<{count: number}>('SELECT COUNT(*) as count FROM kg_nodes');
    const edgeCount = await this.execute<{count: number}>('SELECT COUNT(*) as count FROM kg_edges');
    const indexCount = await this.execute<{count: number}>('SELECT COUNT(*) as count FROM kg_node_indices');
    
    return {
      nodeCount: nodeCount[0]?.count || 0,
      edgeCount: edgeCount[0]?.count || 0,
      indexCount: indexCount[0]?.count || 0,
    };
  }
  
  async close(): Promise<void> {
    // D1 doesn't need explicit close
    this.db = null;
    this.log('D1 adapter closed');
  }
  
  // Helper methods
  private deserializeNode(row: Record<string, unknown>): Node {
    return {
      id: row.id as string,
      type: row.type as string,
      label: row.label as string,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties || {},
      confidence: row.confidence as number,
      createdAt: new Date(row.created_at as string | number),
      updatedAt: new Date(row.updated_at as string | number),
      sourceSessionIds: row.source_session_ids ? JSON.parse(row.source_session_ids as string) : undefined,
    };
  }
  
  private deserializeEdge(row: Record<string, unknown>): Edge {
    return {
      id: row.id as string,
      type: row.type as string,
      fromNodeId: row.from_node_id as string,
      toNodeId: row.to_node_id as string,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties || {},
      confidence: row.confidence as number,
      createdAt: new Date(row.created_at as string | number),
      sourceSessionIds: row.source_session_ids ? JSON.parse(row.source_session_ids as string) : undefined,
    };
  }
}
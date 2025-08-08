import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq, and, inArray, like } from 'drizzle-orm';
import { BaseAdapter, TransactionContext, DatabaseStats, AdapterConfig } from './base';
import * as schema from '../schema';
import type { Node, Edge, NodeIndex, EdgeIndex, SearchIndex, NewNode, NewEdge, NewNodeIndex, NewEdgeIndex, NewSearchIndex } from '../schema';

/**
 * SQLite adapter implementation using Bun's built-in SQLite
 */
export class BunSQLiteAdapter extends BaseAdapter {
  private db: Database | null = null;
  private drizzle: ReturnType<typeof drizzle> | null = null;

  constructor(config: AdapterConfig = {}) {
    super(config);
  }

  async initialize(): Promise<void> {
    try {
      const dbPath = (this.config.connection as string) || ':memory:';
      this.db = new Database(dbPath);
      this.drizzle = drizzle(this.db);

      // Enable foreign keys
      this.db.exec('PRAGMA foreign_keys = ON');

      if (this.config.autoCreate !== false) {
        await this.createTables();
      }

      if (this.config.debug) {
        console.log('[BunSQLiteAdapter] Initialized', { path: dbPath });
      }
    } catch (error) {
      console.error('[BunSQLiteAdapter Error] Failed to initialize:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.drizzle = null;
    }
  }

  async execute<T = unknown>(query: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(query);
      const result = stmt.all(...params);
      return result as T[];
    } catch (error) {
      console.error('[BunSQLiteAdapter] Execute error:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create tables using raw SQL
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence REAL DEFAULT 1.0,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        source_session_ids TEXT
      );

      CREATE TABLE IF NOT EXISTS kg_edges (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        from_node_id TEXT NOT NULL,
        to_node_id TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence REAL DEFAULT 1.0,
        created_at INTEGER DEFAULT (unixepoch()),
        source_session_ids TEXT,
        FOREIGN KEY (from_node_id) REFERENCES kg_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (to_node_id) REFERENCES kg_nodes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS kg_node_indices (
        index_key TEXT NOT NULL,
        node_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (index_key, node_id),
        FOREIGN KEY (node_id) REFERENCES kg_nodes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS kg_edge_indices (
        index_key TEXT NOT NULL,
        edge_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (index_key, edge_id),
        FOREIGN KEY (edge_id) REFERENCES kg_edges(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS kg_search_index (
        term TEXT NOT NULL,
        node_id TEXT NOT NULL,
        field TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        PRIMARY KEY (term, node_id, field),
        FOREIGN KEY (node_id) REFERENCES kg_nodes(id) ON DELETE CASCADE
      );

      -- Create indices for better performance
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON kg_nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_label ON kg_nodes(label);
      CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON kg_nodes(created_at);
      CREATE INDEX IF NOT EXISTS idx_edges_type ON kg_edges(type);
      CREATE INDEX IF NOT EXISTS idx_edges_from_node ON kg_edges(from_node_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to_node ON kg_edges(to_node_id);
      CREATE INDEX IF NOT EXISTS idx_edges_from_type ON kg_edges(from_node_id, type);
      CREATE INDEX IF NOT EXISTS idx_edges_to_type ON kg_edges(to_node_id, type);
      CREATE INDEX IF NOT EXISTS idx_node_indices ON kg_node_indices(index_key);
      CREATE INDEX IF NOT EXISTS idx_edge_indices ON kg_edge_indices(index_key);
      CREATE INDEX IF NOT EXISTS idx_search_term ON kg_search_index(term);
      CREATE INDEX IF NOT EXISTS idx_search_node ON kg_search_index(node_id);
    `);
  }

  // Node operations
  async getNode(id: string): Promise<Node | null> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.select().from(schema.nodes).where(eq(schema.nodes.id, id)).get();
    return result || null;
  }

  async insertNode(node: NewNode): Promise<Node> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.insert(schema.nodes).values(node).returning().get();
    return result;
  }

  async updateNode(id: string, updates: Partial<NewNode>): Promise<Node | null> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle
      .update(schema.nodes)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.nodes.id, id))
      .returning()
      .get();
    return result || null;
  }

  async deleteNode(id: string): Promise<boolean> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.delete(schema.nodes).where(eq(schema.nodes.id, id)).run();
    return result.changes > 0;
  }

  async queryNodes(criteria: { type?: string; properties?: any }): Promise<Node[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    let query = this.drizzle.select().from(schema.nodes);

    if (criteria.type) {
      query = query.where(eq(schema.nodes.type, criteria.type));
    }

    return query.all();
  }

  // Edge operations
  async getEdge(id: string): Promise<Edge | null> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.select().from(schema.edges).where(eq(schema.edges.id, id)).get();
    return result || null;
  }

  async insertEdge(edge: NewEdge): Promise<Edge> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.insert(schema.edges).values(edge).returning().get();
    return result;
  }

  async updateEdge(id: string, updates: Partial<NewEdge>): Promise<Edge | undefined> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle
      .update(schema.edges)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.edges.id, id))
      .returning()
      .get();
    return result;
  }

  async deleteEdge(id: string): Promise<boolean> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.delete(schema.edges).where(eq(schema.edges.id, id)).run();
    return result.changes > 0;
  }

  async queryEdges(criteria: { fromNodeId?: string; toNodeId?: string; type?: string; bidirectional?: boolean }): Promise<Edge[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    let query = this.drizzle.select().from(schema.edges);

    const conditions = [];
    if (criteria.fromNodeId) {
      if (criteria.bidirectional) {
        conditions.push(eq(schema.edges.fromNodeId, criteria.fromNodeId), eq(schema.edges.toNodeId, criteria.fromNodeId));
      } else {
        conditions.push(eq(schema.edges.fromNodeId, criteria.fromNodeId));
      }
    }
    if (criteria.toNodeId && !criteria.bidirectional) {
      conditions.push(eq(schema.edges.toNodeId, criteria.toNodeId));
    }
    if (criteria.type) {
      conditions.push(eq(schema.edges.type, criteria.type));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.all();
  }

  // Search operations
  async search(query: string, limit: number = 10): Promise<SearchIndex[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    return this.drizzle
      .select()
      .from(schema.searchIndex)
      .where(like(schema.searchIndex.term, `%${query}%`))
      .limit(limit)
      .all();
  }

  async insertSearchIndex(index: NewSearchIndex): Promise<SearchIndex> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.insert(schema.searchIndex).values(index).returning().get();
    return result;
  }

  async deleteSearchIndex(nodeId: string): Promise<number> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.delete(schema.searchIndex).where(eq(schema.searchIndex.nodeId, nodeId)).run();
    return result.changes;
  }

  // Index operations
  async insertNodeIndex(index: NewNodeIndex): Promise<NodeIndex> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.insert(schema.nodeIndices).values(index).returning().get();
    return result;
  }

  async insertEdgeIndex(index: NewEdgeIndex): Promise<EdgeIndex> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.insert(schema.edgeIndices).values(index).returning().get();
    return result;
  }

  async queryNodeIndex(field: string, value: string): Promise<NodeIndex[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    return this.drizzle
      .select()
      .from(schema.nodeIndices)
      .where(and(eq(schema.nodeIndices.field, field), eq(schema.nodeIndices.value, value)))
      .all();
  }

  async queryEdgeIndex(field: string, value: string): Promise<EdgeIndex[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    return this.drizzle
      .select()
      .from(schema.edgeIndices)
      .where(and(eq(schema.edgeIndices.field, field), eq(schema.edgeIndices.value, value)))
      .all();
  }

  // Transaction support
  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    if (!this.db || !this.drizzle) throw new Error('Database not initialized');

    return this.db.transaction(() => {
      return fn(this as TransactionContext);
    }) as T;
  }

  // Statistics
  async getStats(): Promise<DatabaseStats> {
    if (!this.db) throw new Error('Database not initialized');

    const nodeCount = this.db.query('SELECT COUNT(*) as count FROM kg_nodes').get() as { count: number };
    const edgeCount = this.db.query('SELECT COUNT(*) as count FROM kg_edges').get() as { count: number };

    const nodeTypes = this.db.query('SELECT type, COUNT(*) as count FROM kg_nodes GROUP BY type').all() as { type: string; count: number }[];

    const edgeTypes = this.db.query('SELECT type, COUNT(*) as count FROM kg_edges GROUP BY type').all() as { type: string; count: number }[];

    return {
      nodeCount: nodeCount.count,
      edgeCount: edgeCount.count,
      nodeTypes: Object.fromEntries(nodeTypes.map((r) => [r.type, r.count])),
      edgeTypes: Object.fromEntries(edgeTypes.map((r) => [r.type, r.count])),
    };
  }

  // Batch operations
  async batchInsertNodes(nodes: NewNode[]): Promise<Node[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.insert(schema.nodes).values(nodes).returning().all();
    return result;
  }

  async batchInsertEdges(edges: NewEdge[]): Promise<Edge[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.insert(schema.edges).values(edges).returning().all();
    return result;
  }

  async batchDeleteNodes(nodeIds: string[]): Promise<number> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.delete(schema.nodes).where(inArray(schema.nodes.id, nodeIds)).run();
    return result.changes;
  }

  async batchDeleteEdges(edgeIds: string[]): Promise<number> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const result = this.drizzle.delete(schema.edges).where(inArray(schema.edges.id, edgeIds)).run();
    return result.changes;
  }

  // Missing methods
  async getNodes(ids: string[]): Promise<Node[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    return this.drizzle.select().from(schema.nodes).where(inArray(schema.nodes.id, ids)).all();
  }

  async getEdges(ids: string[]): Promise<Edge[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    return this.drizzle.select().from(schema.edges).where(inArray(schema.edges.id, ids)).all();
  }

  async deleteNodeIndex(indexKey: string, nodeId?: string): Promise<number> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const conditions = [eq(schema.nodeIndices.indexKey, indexKey)];
    if (nodeId) {
      conditions.push(eq(schema.nodeIndices.nodeId, nodeId));
    }
    const result = this.drizzle
      .delete(schema.nodeIndices)
      .where(and(...conditions))
      .run();
    return result.changes;
  }

  async getNodeIndices(indexKey: string): Promise<NodeIndex[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    return this.drizzle.select().from(schema.nodeIndices).where(eq(schema.nodeIndices.indexKey, indexKey)).all();
  }

  async deleteEdgeIndex(indexKey: string, edgeId?: string): Promise<number> {
    if (!this.drizzle) throw new Error('Database not initialized');
    const conditions = [eq(schema.edgeIndices.indexKey, indexKey)];
    if (edgeId) {
      conditions.push(eq(schema.edgeIndices.edgeId, edgeId));
    }
    const result = this.drizzle
      .delete(schema.edgeIndices)
      .where(and(...conditions))
      .run();
    return result.changes;
  }

  async getEdgeIndices(indexKey: string): Promise<EdgeIndex[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    return this.drizzle.select().from(schema.edgeIndices).where(eq(schema.edgeIndices.indexKey, indexKey)).all();
  }

  async searchNodes(term: string, limit: number = 50): Promise<SearchIndex[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    return this.drizzle
      .select()
      .from(schema.searchIndex)
      .where(like(schema.searchIndex.term, `%${term}%`))
      .limit(limit)
      .all();
  }

  async vacuum(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('VACUUM');
  }
}

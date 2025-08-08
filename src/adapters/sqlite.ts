import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, inArray, like } from 'drizzle-orm';
import { BaseAdapter, TransactionContext, DatabaseStats, AdapterConfig } from './base';
import * as schema from '../schema';
import type { Node, Edge, NodeIndex, EdgeIndex, SearchIndex, NewNode, NewEdge, NewNodeIndex, NewEdgeIndex, NewSearchIndex } from '../schema';

/**
 * SQLite adapter implementation using better-sqlite3
 */
export class SQLiteAdapter extends BaseAdapter {
  private db: Database.Database | null = null;
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

      this.log('SQLite adapter initialized', { path: dbPath });
    } catch (error) {
      this.error('Failed to initialize SQLite adapter', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create nodes table
    this.db.exec(`
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
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON kg_nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_label ON kg_nodes(label);
      CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON kg_nodes(created_at);
    `);

    // Create edges table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_edges (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        from_node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
        to_node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        source_session_ids TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_edges_type ON kg_edges(type);
      CREATE INDEX IF NOT EXISTS idx_edges_from_node ON kg_edges(from_node_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to_node ON kg_edges(to_node_id);
      CREATE INDEX IF NOT EXISTS idx_edges_from_type ON kg_edges(from_node_id, type);
      CREATE INDEX IF NOT EXISTS idx_edges_to_type ON kg_edges(to_node_id, type);
    `);

    // Create node indices table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_node_indices (
        index_key TEXT NOT NULL,
        node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (index_key, node_id)
      );
      CREATE INDEX IF NOT EXISTS idx_node_indices_key ON kg_node_indices(index_key);
      CREATE INDEX IF NOT EXISTS idx_node_indices_node ON kg_node_indices(node_id);
    `);

    // Create edge indices table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_edge_indices (
        index_key TEXT NOT NULL,
        edge_id TEXT NOT NULL REFERENCES kg_edges(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (index_key, edge_id)
      );
      CREATE INDEX IF NOT EXISTS idx_edge_indices_key ON kg_edge_indices(index_key);
      CREATE INDEX IF NOT EXISTS idx_edge_indices_edge ON kg_edge_indices(edge_id);
    `);

    // Create search index table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kg_search_index (
        term TEXT NOT NULL,
        node_id TEXT NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
        field TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1.0,
        PRIMARY KEY (term, node_id, field)
      );
      CREATE INDEX IF NOT EXISTS idx_search_term ON kg_search_index(term);
      CREATE INDEX IF NOT EXISTS idx_search_node ON kg_search_index(node_id);
    `);

    // Create graph metadata table
    this.db.exec(`
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
      const stmt = this.db.prepare(query);
      return stmt.all(...params) as T[];
    } catch (error) {
      this.error('Query execution failed', { query, params, error });
      throw error;
    }
  }

  async executeUpdate(query: string, params: unknown[] = []): Promise<{ changes: number }> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(query);
      return stmt.run(...params);
    } catch (error) {
      this.error('Query execution failed', { query, params, error });
      throw error;
    }
  }

  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      try {
        if (!this.db) throw new Error('Database not initialized');
        const result = this.db.transaction(async () => {
          const tx: TransactionContext = {
            execute: async <U = unknown>(query: string, params: unknown[] = []): Promise<U[]> => {
              return this.execute<U>(query, params);
            },
            rollback: async () => {
              throw new Error('Transaction rollback');
            },
          };

          return await fn(tx);
        })();

        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Node operations
  async insertNode(node: NewNode): Promise<Node> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const result = await this.drizzle.insert(schema.nodes).values(node).returning();
    const insertedNode = result[0];
    if (!insertedNode) throw new Error('Failed to create node');
    return this.deserializeNode(insertedNode);
  }

  async updateNode(id: string, updates: Partial<NewNode>): Promise<Node | null> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const result = await this.drizzle
      .update(schema.nodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.nodes.id, id))
      .returning();

    return result[0] ? this.deserializeNode(result[0]) : null;
  }

  async deleteNode(id: string): Promise<boolean> {
    const query = `DELETE FROM kg_nodes WHERE id = ?`;
    const result = await this.executeUpdate(query, [id]);
    return result.changes > 0;
  }

  async getNode(id: string): Promise<Node | null> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const result = await this.drizzle.select().from(schema.nodes).where(eq(schema.nodes.id, id)).limit(1);

    return result[0] ? this.deserializeNode(result[0]) : null;
  }

  async getNodes(ids: string[]): Promise<Node[]> {
    if (!this.drizzle || ids.length === 0) return [];

    const result = await this.drizzle.select().from(schema.nodes).where(inArray(schema.nodes.id, ids));

    return result.map((n) => this.deserializeNode(n));
  }

  async queryNodes(conditions: Record<string, unknown>, limit = 100, offset = 0): Promise<Node[]> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const whereConditions = Object.entries(conditions).map(([key, value]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const column = (schema.nodes as any)[key];
      return eq(column, value);
    });

    const result = await this.drizzle
      .select()
      .from(schema.nodes)
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset);

    return result.map((n) => this.deserializeNode(n));
  }

  // Edge operations
  async insertEdge(edge: NewEdge): Promise<Edge> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const result = await this.drizzle.insert(schema.edges).values(edge).returning();
    const insertedEdge = result[0];
    if (!insertedEdge) throw new Error('Failed to create edge');
    return this.deserializeEdge(insertedEdge);
  }

  async updateEdge(id: string, updates: Partial<NewEdge>): Promise<Edge | null> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const result = await this.drizzle.update(schema.edges).set(updates).where(eq(schema.edges.id, id)).returning();

    return result[0] ? this.deserializeEdge(result[0]) : null;
  }

  async deleteEdge(id: string): Promise<boolean> {
    const query = `DELETE FROM kg_edges WHERE id = ?`;
    await this.execute(query, [id]);
    return true;
  }

  async getEdge(id: string): Promise<Edge | null> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const result = await this.drizzle.select().from(schema.edges).where(eq(schema.edges.id, id)).limit(1);

    return result[0] ? this.deserializeEdge(result[0]) : null;
  }

  async getEdges(ids: string[]): Promise<Edge[]> {
    if (!this.drizzle || ids.length === 0) return [];

    const result = await this.drizzle.select().from(schema.edges).where(inArray(schema.edges.id, ids));

    return result.map((e) => this.deserializeEdge(e));
  }

  async queryEdges(conditions: Record<string, unknown>, limit = 100, offset = 0): Promise<Edge[]> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const whereConditions = Object.entries(conditions).map(([key, value]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const column = (schema.edges as any)[key];
      return eq(column, value);
    });

    const result = await this.drizzle
      .select()
      .from(schema.edges)
      .where(and(...whereConditions))
      .limit(limit)
      .offset(offset);

    return result.map((e) => this.deserializeEdge(e));
  }

  // Index operations
  async insertNodeIndex(index: NewNodeIndex): Promise<NodeIndex> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const result = await this.drizzle.insert(schema.nodeIndices).values(index).returning();
    const insertedIndex = result[0];
    if (!insertedIndex) throw new Error('Failed to create node index');
    return insertedIndex;
  }

  async deleteNodeIndex(indexKey: string, nodeId?: string): Promise<number> {
    const query = nodeId ? `DELETE FROM kg_node_indices WHERE index_key = ? AND node_id = ?` : `DELETE FROM kg_node_indices WHERE index_key = ?`;
    const params = nodeId ? [indexKey, nodeId] : [indexKey];

    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(query);
    const info = stmt.run(params);
    return info.changes;
  }

  async getNodeIndices(indexKey: string): Promise<NodeIndex[]> {
    if (!this.drizzle) throw new Error('Database not initialized');

    return await this.drizzle.select().from(schema.nodeIndices).where(eq(schema.nodeIndices.indexKey, indexKey));
  }

  async insertEdgeIndex(index: NewEdgeIndex): Promise<EdgeIndex> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const result = await this.drizzle.insert(schema.edgeIndices).values(index).returning();
    const insertedIndex = result[0];
    if (!insertedIndex) throw new Error('Failed to create edge index');
    return insertedIndex;
  }

  async deleteEdgeIndex(indexKey: string, edgeId?: string): Promise<number> {
    const query = edgeId ? `DELETE FROM kg_edge_indices WHERE index_key = ? AND edge_id = ?` : `DELETE FROM kg_edge_indices WHERE index_key = ?`;
    const params = edgeId ? [indexKey, edgeId] : [indexKey];

    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(query);
    const info = stmt.run(params);
    return info.changes;
  }

  async getEdgeIndices(indexKey: string): Promise<EdgeIndex[]> {
    if (!this.drizzle) throw new Error('Database not initialized');

    return await this.drizzle.select().from(schema.edgeIndices).where(eq(schema.edgeIndices.indexKey, indexKey));
  }

  // Search operations
  async insertSearchIndex(index: NewSearchIndex): Promise<SearchIndex> {
    if (!this.drizzle) throw new Error('Database not initialized');

    const result = await this.drizzle.insert(schema.searchIndex).values(index).returning();
    const insertedIndex = result[0];
    if (!insertedIndex) throw new Error('Failed to create search index');
    return insertedIndex;
  }

  async deleteSearchIndex(nodeId: string): Promise<number> {
    const query = `DELETE FROM kg_search_index WHERE node_id = ?`;
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(query);
    const info = stmt.run([nodeId]);
    return info.changes;
  }

  async searchNodes(term: string, limit = 50): Promise<SearchIndex[]> {
    if (!this.drizzle) throw new Error('Database not initialized');

    return await this.drizzle
      .select()
      .from(schema.searchIndex)
      .where(like(schema.searchIndex.term, `%${term}%`))
      .limit(limit);
  }

  // Batch operations
  async batchInsertNodes(nodes: NewNode[]): Promise<Node[]> {
    if (!this.drizzle || nodes.length === 0) return [];

    const result = await this.drizzle.insert(schema.nodes).values(nodes).returning();
    return result.map((n) => this.deserializeNode(n));
  }

  async batchInsertEdges(edges: NewEdge[]): Promise<Edge[]> {
    if (!this.drizzle || edges.length === 0) return [];

    const result = await this.drizzle.insert(schema.edges).values(edges).returning();
    return result.map((e) => this.deserializeEdge(e));
  }

  async batchDeleteNodes(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM kg_nodes WHERE id IN (${placeholders})`;
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(query);
    const info = stmt.run(ids);
    return info.changes;
  }

  async batchDeleteEdges(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const query = `DELETE FROM kg_edges WHERE id IN (${placeholders})`;
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(query);
    const info = stmt.run(ids);
    return info.changes;
  }

  // Maintenance operations
  async vacuum(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec('VACUUM');
    this.log('Database vacuumed');
  }

  async getStats(): Promise<DatabaseStats> {
    if (!this.db) throw new Error('Database not initialized');

    const nodeCount = this.db.prepare('SELECT COUNT(*) as count FROM kg_nodes').get() as {count: number};
    const edgeCount = this.db.prepare('SELECT COUNT(*) as count FROM kg_edges').get() as {count: number};
    const indexCount = this.db.prepare('SELECT COUNT(*) as count FROM kg_node_indices').get() as {count: number};

    return {
      nodeCount: nodeCount.count,
      edgeCount: edgeCount.count,
      indexCount: indexCount.count,
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.drizzle = null;
      this.log('Database connection closed');
    }
  }

  // Helper methods
  private deserializeNode(node: schema.Node): Node {
    return {
      ...node,
      properties: JSON.parse(node.properties),
      sourceSessionIds: node.sourceSessionIds ? JSON.parse(node.sourceSessionIds) : undefined,
    };
  }

  private deserializeEdge(edge: schema.Edge): Edge {
    return {
      ...edge,
      properties: JSON.parse(edge.properties),
      sourceSessionIds: edge.sourceSessionIds ? JSON.parse(edge.sourceSessionIds) : undefined,
    };
  }
}

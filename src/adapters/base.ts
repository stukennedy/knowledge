import type { Node, Edge, NodeIndex, EdgeIndex, SearchIndex, NewNode, NewEdge, NewNodeIndex, NewEdgeIndex, NewSearchIndex } from '../schema';

/**
 * Base adapter interface for database operations
 * All adapters must implement this interface
 */
export interface DatabaseAdapter {
  /**
   * Initialize the database schema
   */
  initialize(): Promise<void>;

  /**
   * Execute a raw SQL query
   */
  execute<T = unknown>(query: string, params?: unknown[]): Promise<T[]>;

  /**
   * Begin a transaction
   */
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

  /**
   * Node operations
   */
  insertNode(node: NewNode): Promise<Node>;
  updateNode(id: string, updates: Partial<NewNode>): Promise<Node | null>;
  deleteNode(id: string): Promise<boolean>;
  getNode(id: string): Promise<Node | null>;
  getNodes(ids: string[]): Promise<Node[]>;
  queryNodes(conditions: Record<string, unknown>, limit?: number, offset?: number): Promise<Node[]>;

  /**
   * Edge operations
   */
  insertEdge(edge: NewEdge): Promise<Edge>;
  updateEdge(id: string, updates: Partial<NewEdge>): Promise<Edge | null>;
  deleteEdge(id: string): Promise<boolean>;
  getEdge(id: string): Promise<Edge | null>;
  getEdges(ids: string[]): Promise<Edge[]>;
  queryEdges(conditions: Record<string, unknown>, limit?: number, offset?: number): Promise<Edge[]>;

  /**
   * Index operations
   */
  insertNodeIndex(index: NewNodeIndex): Promise<NodeIndex>;
  deleteNodeIndex(indexKey: string, nodeId?: string): Promise<number>;
  getNodeIndices(indexKey: string): Promise<NodeIndex[]>;

  insertEdgeIndex(index: NewEdgeIndex): Promise<EdgeIndex>;
  deleteEdgeIndex(indexKey: string, edgeId?: string): Promise<number>;
  getEdgeIndices(indexKey: string): Promise<EdgeIndex[]>;

  /**
   * Search operations
   */
  insertSearchIndex(index: NewSearchIndex): Promise<SearchIndex>;
  deleteSearchIndex(nodeId: string): Promise<number>;
  searchNodes(term: string, limit?: number): Promise<SearchIndex[]>;

  /**
   * Batch operations
   */
  batchInsertNodes(nodes: NewNode[]): Promise<Node[]>;
  batchInsertEdges(edges: NewEdge[]): Promise<Edge[]>;
  batchDeleteNodes(ids: string[]): Promise<number>;
  batchDeleteEdges(ids: string[]): Promise<number>;

  /**
   * Cleanup and maintenance
   */
  vacuum(): Promise<void>;
  getStats(): Promise<DatabaseStats>;
  close(): Promise<void>;
}

/**
 * Transaction context for atomic operations
 */
export interface TransactionContext {
  execute<T = unknown>(query: string, params?: unknown[]): Promise<T[]>;
  rollback(): Promise<void>;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  nodeCount: number;
  edgeCount: number;
  indexCount: number;
  sizeInBytes?: number;
  lastVacuum?: Date;
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /**
   * Database connection string or configuration
   */
  connection?: string | Record<string, unknown>;

  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Custom table prefix
   */
  tablePrefix?: string;

  /**
   * Auto-create tables if they don't exist
   */
  autoCreate?: boolean;

  /**
   * Column naming convention for database fields
   * 'camelCase' (default): fromNodeId, toNodeId
   * 'snake_case': from_node_id, to_node_id
   */
  columnNaming?: 'camelCase' | 'snake_case';

  /**
   * Additional adapter-specific options
   */
  options?: Record<string, unknown>;
}

/**
 * Base adapter class with common functionality
 */
export abstract class BaseAdapter implements DatabaseAdapter {
  protected config: AdapterConfig;
  protected tablePrefix: string;
  protected columnNaming: 'camelCase' | 'snake_case';

  constructor(config: AdapterConfig = {}) {
    this.config = config;
    this.tablePrefix = config.tablePrefix || '';
    this.columnNaming = config.columnNaming || 'camelCase';
  }

  protected getTableName(table: string): string {
    return this.tablePrefix ? `${this.tablePrefix}_${table}` : table;
  }

  /**
   * Translate column names from camelCase to snake_case or vice versa
   */
  protected translateColumnName(name: string, toDatabase: boolean = true): string {
    if (this.columnNaming === 'snake_case') {
      if (toDatabase) {
        // camelCase to snake_case
        const mapping: Record<string, string> = {
          fromNodeId: 'from_node_id',
          toNodeId: 'to_node_id',
          createdAt: 'created_at',
          updatedAt: 'updated_at',
          sourceSessionIds: 'source_session_ids',
          indexKey: 'index_key',
          nodeId: 'node_id',
          edgeId: 'edge_id',
        };
        return mapping[name] || name;
      } else {
        // snake_case to camelCase
        const mapping: Record<string, string> = {
          from_node_id: 'fromNodeId',
          to_node_id: 'toNodeId',
          created_at: 'createdAt',
          updated_at: 'updatedAt',
          source_session_ids: 'sourceSessionIds',
          index_key: 'indexKey',
          node_id: 'nodeId',
          edge_id: 'edgeId',
        };
        return mapping[name] || name;
      }
    }
    return name;
  }

  /**
   * Translate all column names in a conditions object
   */
  protected translateConditions(conditions: Record<string, unknown>): Record<string, unknown> {
    if (this.columnNaming === 'snake_case') {
      const translated: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(conditions)) {
        translated[this.translateColumnName(key, true)] = value;
      }
      return translated;
    }
    return conditions;
  }

  /**
   * Translate result columns back from database format
   */
  protected translateResult<T extends Record<string, any>>(row: T): T {
    if (this.columnNaming === 'snake_case' && row) {
      const translated = { ...row };

      // Translate known fields
      const mappings: [string, string][] = [
        ['from_node_id', 'fromNodeId'],
        ['to_node_id', 'toNodeId'],
        ['created_at', 'createdAt'],
        ['updated_at', 'updatedAt'],
        ['source_session_ids', 'sourceSessionIds'],
        ['index_key', 'indexKey'],
        ['node_id', 'nodeId'],
        ['edge_id', 'edgeId'],
      ];

      for (const [snakeCase, camelCase] of mappings) {
        if (snakeCase in translated) {
          (translated as any)[camelCase] = (translated as any)[snakeCase];
          delete (translated as any)[snakeCase];
        }
      }

      return translated as T;
    }
    return row;
  }

  protected log(_message: string, ..._args: unknown[]): void {
    // Logging disabled for now to avoid console warnings
    // if (this.config.debug) {
    //   console.log(`[KnowledgeGraph] ${message}`, ...args);
    // }
  }

  protected error(message: string, error?: unknown): void {
    // Use console.error which is allowed by linter
    console.error(`[KnowledgeGraph Error] ${message}`, error);
  }

  // Abstract methods that must be implemented by subclasses
  abstract initialize(): Promise<void>;
  abstract execute<T = unknown>(query: string, params?: any[]): Promise<T[]>;
  abstract transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

  abstract insertNode(node: NewNode): Promise<Node>;
  abstract updateNode(id: string, updates: Partial<NewNode>): Promise<Node | null>;
  abstract deleteNode(id: string): Promise<boolean>;
  abstract getNode(id: string): Promise<Node | null>;
  abstract getNodes(ids: string[]): Promise<Node[]>;
  abstract queryNodes(conditions: Record<string, any>, limit?: number, offset?: number): Promise<Node[]>;

  abstract insertEdge(edge: NewEdge): Promise<Edge>;
  abstract updateEdge(id: string, updates: Partial<NewEdge>): Promise<Edge | null>;
  abstract deleteEdge(id: string): Promise<boolean>;
  abstract getEdge(id: string): Promise<Edge | null>;
  abstract getEdges(ids: string[]): Promise<Edge[]>;
  abstract queryEdges(conditions: Record<string, any>, limit?: number, offset?: number): Promise<Edge[]>;

  abstract insertNodeIndex(index: NewNodeIndex): Promise<NodeIndex>;
  abstract deleteNodeIndex(indexKey: string, nodeId?: string): Promise<number>;
  abstract getNodeIndices(indexKey: string): Promise<NodeIndex[]>;

  abstract insertEdgeIndex(index: NewEdgeIndex): Promise<EdgeIndex>;
  abstract deleteEdgeIndex(indexKey: string, edgeId?: string): Promise<number>;
  abstract getEdgeIndices(indexKey: string): Promise<EdgeIndex[]>;

  abstract insertSearchIndex(index: NewSearchIndex): Promise<SearchIndex>;
  abstract deleteSearchIndex(nodeId: string): Promise<number>;
  abstract searchNodes(term: string, limit?: number): Promise<SearchIndex[]>;

  abstract batchInsertNodes(nodes: NewNode[]): Promise<Node[]>;
  abstract batchInsertEdges(edges: NewEdge[]): Promise<Edge[]>;
  abstract batchDeleteNodes(ids: string[]): Promise<number>;
  abstract batchDeleteEdges(ids: string[]): Promise<number>;

  abstract vacuum(): Promise<void>;
  abstract getStats(): Promise<DatabaseStats>;
  abstract close(): Promise<void>;
}

/**
 * Core types for the knowledge graph system
 */

/**
 * Type for node types - users define their own enums
 */
export type NodeType = string;

/**
 * Common edge types that users can extend
 */
export enum CommonEdgeType {
  // Generic relationships
  RELATED_TO = 'RELATED_TO',
  SIMILAR_TO = 'SIMILAR_TO',
  OPPOSITE_OF = 'OPPOSITE_OF',
  PART_OF = 'PART_OF',
  HAS_PART = 'HAS_PART',

  // Personal relationships
  KNOWS = 'KNOWS',
  FRIEND_OF = 'FRIEND_OF',
  COLLEAGUE_OF = 'COLLEAGUE_OF',
  REPORTS_TO = 'REPORTS_TO',
  MANAGES = 'MANAGES',

  // Family relationships
  HAS_FAMILY_MEMBER = 'HAS_FAMILY_MEMBER',
  PARENT_OF = 'PARENT_OF',
  CHILD_OF = 'CHILD_OF',
  SPOUSE_OF = 'SPOUSE_OF',
  SIBLING_OF = 'SIBLING_OF',

  // Location relationships
  LIVES_AT = 'LIVES_AT',
  WORKS_AT = 'WORKS_AT',
  LOCATED_IN = 'LOCATED_IN',
  VISITED = 'VISITED',
  PLANS_TO_VISIT = 'PLANS_TO_VISIT',

  // Ownership relationships
  OWNS = 'OWNS',
  OWNED_BY = 'OWNED_BY',
  CREATED_BY = 'CREATED_BY',
  CREATED = 'CREATED',

  // Financial relationships
  PAID_TO = 'PAID_TO',
  RECEIVED_FROM = 'RECEIVED_FROM',
  SAVED_FOR = 'SAVED_FOR',
  SPENT_ON = 'SPENT_ON',
  EARNS_FROM = 'EARNS_FROM',
  INVESTS_IN = 'INVESTS_IN',

  // Career relationships
  EMPLOYED_BY = 'EMPLOYED_BY',
  EMPLOYS = 'EMPLOYS',
  HAS_SKILL = 'HAS_SKILL',
  REQUIRES_SKILL = 'REQUIRES_SKILL',
  STUDIED_AT = 'STUDIED_AT',
  GRADUATED_FROM = 'GRADUATED_FROM',

  // Temporal relationships
  HAPPENED_BEFORE = 'HAPPENED_BEFORE',
  HAPPENED_AFTER = 'HAPPENED_AFTER',
  HAPPENED_DURING = 'HAPPENED_DURING',
  CAUSED = 'CAUSED',
  CAUSED_BY = 'CAUSED_BY',

  // Preference relationships
  LIKES = 'LIKES',
  DISLIKES = 'DISLIKES',
  INTERESTED_IN = 'INTERESTED_IN',
  PREFERS = 'PREFERS',

  // Action relationships
  PARTICIPATED_IN = 'PARTICIPATED_IN',
  ATTENDED = 'ATTENDED',
  ORGANIZED = 'ORGANIZED',
  MENTIONED = 'MENTIONED',
  REFERENCED = 'REFERENCED',

  // Document/Information relationships
  CONTAINS = 'CONTAINS',
  CONTAINED_IN = 'CONTAINED_IN',
  DERIVED_FROM = 'DERIVED_FROM',
  BASED_ON = 'BASED_ON',
}

/**
 * Type for edge types - users can extend CommonEdgeType or define their own
 */
export type EdgeType = CommonEdgeType | string;

/**
 * Core knowledge node interface
 */
export interface KnowledgeNode<T = Record<string, unknown>> {
  id: string;
  type: NodeType | string;
  label: string;
  properties: T;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  sourceSessionIds?: string[];
}

/**
 * Core knowledge edge interface
 */
export interface KnowledgeEdge<T = Record<string, unknown>> {
  id: string;
  type: EdgeType | string;
  fromNodeId: string;
  toNodeId: string;
  properties: T;
  confidence: number;
  createdAt: Date;
  sourceSessionIds?: string[];
}

/**
 * Query result containing nodes and edges
 */
export interface QueryResult<N = KnowledgeNode, E = KnowledgeEdge> {
  nodes: N[];
  edges: E[];
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Options for graph queries
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  minConfidence?: number;
  includeEdges?: boolean;
  depth?: number;
  direction?: 'in' | 'out' | 'both';
  nodeTypes?: (NodeType | string)[];
  edgeTypes?: (EdgeType | string)[];
  orderBy?: 'confidence' | 'createdAt' | 'updatedAt' | 'relevance';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Options for node creation/update
 */
export interface NodeOptions<TNodeType extends string = string, TProperties = Record<string, unknown>> {
  type: TNodeType;
  label: string;
  properties?: TProperties;
  confidence?: number;
  sourceSessionId?: string;
  mergeStrategy?: 'replace' | 'merge' | 'skip';
}

/**
 * Options for edge creation/update
 */
export interface EdgeOptions<TEdgeType extends string = string, TProperties = Record<string, unknown>> {
  type: TEdgeType;
  fromNodeId: string;
  toNodeId: string;
  properties?: TProperties;
  confidence?: number;
  sourceSessionId?: string;
  bidirectional?: boolean;
}

/**
 * Graph traversal options
 */
export interface TraversalOptions {
  startNodeId: string;
  direction?: 'in' | 'out' | 'both';
  maxDepth?: number;
  edgeTypes?: (EdgeType | string)[];
  nodeFilter?: (node: KnowledgeNode) => boolean;
  edgeFilter?: (edge: KnowledgeEdge) => boolean;
  visitOnce?: boolean;
}

/**
 * Path finding result
 */
export interface Path<N = KnowledgeNode, E = KnowledgeEdge> {
  nodes: N[];
  edges: E[];
  length: number;
  weight?: number;
}

/**
 * Graph statistics
 */
export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  averageDegree: number;
  density: number;
  lastUpdated: Date;
}

/**
 * Extracted knowledge data for processing
 */
export interface ExtractedNodeData<T = Record<string, unknown>> {
  type: NodeType | string;
  label: string;
  properties: T;
  confidence: number;
  sourceSessionIds?: string[];
}

export interface ExtractedEdgeData<T = Record<string, unknown>> {
  type: EdgeType | string;
  fromNodeLabel: string;
  toNodeLabel: string;
  properties: T;
  confidence: number;
  sourceSessionIds?: string[];
}

export interface ExtractedKnowledge<N = ExtractedNodeData, E = ExtractedEdgeData> {
  nodes: N[];
  edges: E[];
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Search options
 */
export interface SearchOptions {
  query: string;
  fields?: ('label' | 'properties' | string)[];
  nodeTypes?: (NodeType | string)[];
  fuzzy?: boolean;
  limit?: number;
  minScore?: number;
}

/**
 * Batch operation results
 */
export interface BatchResult {
  successful: number;
  failed: number;
  errors?: Array<{ item: unknown; error: Error }>;
}

/**
 * Migration interface for version upgrades
 */
export interface Migration {
  version: string;
  up: (db: unknown) => Promise<void>;
  down: (db: unknown) => Promise<void>;
  description?: string;
}

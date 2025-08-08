import { sqliteTable, text, integer, index, primaryKey, real } from 'drizzle-orm/sqlite-core';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

/**
 * Nodes table - stores all graph nodes
 */
export const nodes = sqliteTable('kg_nodes', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  properties: text('properties').notNull(), // JSON string
  confidence: real('confidence').notNull().default(1.0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  sourceSessionIds: text('source_session_ids'), // JSON array of session IDs
}, (table) => ({
  typeIdx: index('idx_nodes_type').on(table.type),
  labelIdx: index('idx_nodes_label').on(table.label),
  createdAtIdx: index('idx_nodes_created_at').on(table.createdAt),
}));

/**
 * Edges table - stores relationships between nodes
 */
export const edges = sqliteTable('kg_edges', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  fromNodeId: text('from_node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  toNodeId: text('to_node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  properties: text('properties').notNull().default('{}'), // JSON string
  confidence: real('confidence').notNull().default(1.0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  sourceSessionIds: text('source_session_ids'), // JSON array of session IDs
}, (table) => ({
  typeIdx: index('idx_edges_type').on(table.type),
  fromNodeIdx: index('idx_edges_from_node').on(table.fromNodeId),
  toNodeIdx: index('idx_edges_to_node').on(table.toNodeId),
  fromTypeIdx: index('idx_edges_from_type').on(table.fromNodeId, table.type),
  toTypeIdx: index('idx_edges_to_type').on(table.toNodeId, table.type),
}));

/**
 * Node indices table - for efficient node lookups
 */
export const nodeIndices = sqliteTable('kg_node_indices', {
  indexKey: text('index_key').notNull(),
  nodeId: text('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  pk: primaryKey({ columns: [table.indexKey, table.nodeId] }),
  keyIdx: index('idx_node_indices_key').on(table.indexKey),
  nodeIdx: index('idx_node_indices_node').on(table.nodeId),
}));

/**
 * Edge indices table - for efficient edge lookups
 */
export const edgeIndices = sqliteTable('kg_edge_indices', {
  indexKey: text('index_key').notNull(),
  edgeId: text('edge_id').notNull().references(() => edges.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  pk: primaryKey({ columns: [table.indexKey, table.edgeId] }),
  keyIdx: index('idx_edge_indices_key').on(table.indexKey),
  edgeIdx: index('idx_edge_indices_edge').on(table.edgeId),
}));

/**
 * Search index table - for full-text search capabilities
 */
export const searchIndex = sqliteTable('kg_search_index', {
  term: text('term').notNull(),
  nodeId: text('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  field: text('field').notNull(), // 'label', 'property:key', etc.
  weight: real('weight').notNull().default(1.0),
}, (table) => ({
  pk: primaryKey({ columns: [table.term, table.nodeId, table.field] }),
  termIdx: index('idx_search_term').on(table.term),
  nodeIdx: index('idx_search_node').on(table.nodeId),
}));

/**
 * Graph metadata table - stores graph-level information
 */
export const graphMetadata = sqliteTable('kg_graph_metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Type exports
export type Node = InferSelectModel<typeof nodes>;
export type NewNode = InferInsertModel<typeof nodes>;
export type Edge = InferSelectModel<typeof edges>;
export type NewEdge = InferInsertModel<typeof edges>;
export type NodeIndex = InferSelectModel<typeof nodeIndices>;
export type NewNodeIndex = InferInsertModel<typeof nodeIndices>;
export type EdgeIndex = InferSelectModel<typeof edgeIndices>;
export type NewEdgeIndex = InferInsertModel<typeof edgeIndices>;
export type SearchIndex = InferSelectModel<typeof searchIndex>;
export type NewSearchIndex = InferInsertModel<typeof searchIndex>;
export type GraphMetadata = InferSelectModel<typeof graphMetadata>;
export type NewGraphMetadata = InferInsertModel<typeof graphMetadata>;
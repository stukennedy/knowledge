// Core exports
export { KnowledgeGraph } from './core/KnowledgeGraph';

// Type exports
export * from './types';
export { CommonEdgeType } from './types';

// Adapter exports
export type { DatabaseAdapter, AdapterConfig } from './adapters';
export { SQLiteAdapter, D1Adapter, SqlStorageAdapter, createAdapter, BaseAdapter } from './adapters';

// Extraction exports
export { KnowledgeExtractor, extractFromText, extractFromConversation, processExtractedKnowledge } from './extraction';

// Visualization exports
export * from './visualization';

// Schema exports (for advanced users)
export * as schema from './schema';

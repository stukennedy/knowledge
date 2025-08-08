// Core exports
export { KnowledgeGraph } from './core/KnowledgeGraph';

// Type exports
export * from './types';
export { CommonEdgeType } from './types';

// Adapter exports
export { DatabaseAdapter, AdapterConfig, SQLiteAdapter, D1Adapter, createAdapter } from './adapters';

// Extraction exports
export { KnowledgeExtractor, extractFromText, extractFromConversation, processExtractedKnowledge } from './extraction';

// Schema exports (for advanced users)
export * as schema from './schema';

// Convenience factory function
import { KnowledgeGraph } from './core/KnowledgeGraph';
import { createAdapter } from './adapters';

export function createKnowledgeGraph<TNodeType extends string = string>(adapterType: 'sqlite' | 'd1' | 'libsql', config?: any): KnowledgeGraph<TNodeType> {
  const adapter = createAdapter(adapterType, config);
  return new KnowledgeGraph<TNodeType>(adapter);
}

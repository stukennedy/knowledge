// Core exports
export { KnowledgeGraph } from './core/KnowledgeGraph';

// Type exports
export * from './types';
export { CommonEdgeType } from './types';

// Adapter exports
export type { DatabaseAdapter, AdapterConfig } from './adapters';
export { SQLiteAdapter, D1Adapter, createAdapter, BaseAdapter } from './adapters';

// Extraction exports
export { KnowledgeExtractor, extractFromText, extractFromConversation, processExtractedKnowledge } from './extraction';

// Visualization exports
export * from './visualization';

// Schema exports (for advanced users)
export * as schema from './schema';

// Convenience factory function
import { KnowledgeGraph } from './core/KnowledgeGraph';
import { createAdapter } from './adapters';

export async function createKnowledgeGraph<TNodeType extends string = string>(adapterType: 'sqlite' | 'd1' | 'libsql', config?: any): Promise<KnowledgeGraph<TNodeType>> {
  const adapter = await createAdapter(adapterType, config);
  return new KnowledgeGraph<TNodeType>(adapter);
}

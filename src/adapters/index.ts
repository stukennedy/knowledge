export { DatabaseAdapter, AdapterConfig, TransactionContext, DatabaseStats } from './base';
export { SQLiteAdapter } from './sqlite';
export { D1Adapter } from './d1';

import type { DatabaseAdapter } from './base';
import { SQLiteAdapter } from './sqlite';
import { D1Adapter } from './d1';

// Factory function to create appropriate adapter
export function createAdapter(type: 'sqlite' | 'd1' | 'libsql', config?: any): DatabaseAdapter {
  switch (type) {
    case 'sqlite':
      return new SQLiteAdapter(config);
    case 'd1':
      return new D1Adapter(config);
    case 'libsql':
      // TODO: Implement LibSQL adapter
      throw new Error('LibSQL adapter not yet implemented');
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}

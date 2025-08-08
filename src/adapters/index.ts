export type { DatabaseAdapter, AdapterConfig, TransactionContext, DatabaseStats } from './base';
export { BaseAdapter } from './base';
export { SQLiteAdapter } from './sqlite';
export { D1Adapter } from './d1';

import type { DatabaseAdapter, AdapterConfig } from './base';
import { SQLiteAdapter } from './sqlite';
import { D1Adapter } from './d1';

// Factory function to create appropriate adapter
export async function createAdapter(type: 'sqlite' | 'd1' | 'libsql', config?: AdapterConfig): Promise<DatabaseAdapter> {
  switch (type) {
    case 'sqlite':
      // For now, always use better-sqlite3 adapter
      // Bun support will be added in a future release
      return new SQLiteAdapter(config);
    case 'd1':
      return new D1Adapter(config || {});
    case 'libsql':
      // TODO: Implement LibSQL adapter
      throw new Error('LibSQL adapter not yet implemented');
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}

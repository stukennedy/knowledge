export type { DatabaseAdapter, AdapterConfig, TransactionContext, DatabaseStats } from './base';
export { BaseAdapter } from './base';
export { SQLiteAdapter } from './sqlite';
export { D1Adapter } from './d1';

import type { DatabaseAdapter } from './base';
import { SQLiteAdapter } from './sqlite';
import { D1Adapter } from './d1';

// Check if we're running in Bun
const isBun = typeof Bun !== 'undefined';

// Factory function to create appropriate adapter
export function createAdapter(type: 'sqlite' | 'd1' | 'libsql', config?: any): DatabaseAdapter {
  switch (type) {
    case 'sqlite':
      // Use Bun's SQLite adapter if running in Bun, otherwise use better-sqlite3
      if (isBun) {
        // Dynamically import to avoid issues when not in Bun
        const { BunSQLiteAdapter } = require('./bun-sqlite');
        return new BunSQLiteAdapter(config);
      }
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

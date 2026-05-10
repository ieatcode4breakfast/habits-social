import './setup';
import { describe, it, expect, vi } from 'vitest';

describe('Database Connection Hardening (Singleton)', () => {
  it('should implement a singleton pattern to prevent pool exhaustion (Red Phase)', async () => {
    // 0. Import the ACTUAL implementation, bypassing the global test mock
    const { useDB } = await vi.importActual<any>('../utils/db');

    // 1. Invoke useDB multiple times
    const db1 = useDB();
    const db2 = useDB();

    // 2. LOGIC: If it's NOT a singleton, these will be two different objects in memory.
    // In TDD, we expect this to FAIL initially.
    expect(db1).toBe(db2);
  });

  it('should handle concurrent calls without creating multiple pools', async () => {
    const { useDB } = await vi.importActual<any>('../utils/db');
    // Simulate 50 concurrent requests
    const requests = Array.from({ length: 50 }, () => useDB());
    
    // Check all instances against the first one
    const first = requests[0];
    requests.forEach(db => {
      expect(db).toBe(first);
    });
  });
});

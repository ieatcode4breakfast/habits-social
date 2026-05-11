import './setup';
import { describe, it, expect, vi } from 'vitest';

describe('Database Connection Hardening (Scoped Singleton)', () => {
  it('should implement a fallback singleton pattern for background/test contexts (Red Phase)', async () => {
    // 0. Import the ACTUAL implementation, bypassing the global test mock
    const { useDB } = await vi.importActual<any>('../utils/db');

    // 1. Invoke useDB multiple times without an event
    const db1 = useDB();
    const db2 = useDB();

    // 2. LOGIC: Without an event, it should still behave as a global singleton
    expect(db1).toBe(db2);
  });

  it('should handle concurrent calls in fallback mode without creating multiple pools', async () => {
    const { useDB } = await vi.importActual<any>('../utils/db');
    // Simulate 50 concurrent calls without an event
    const requests = Array.from({ length: 50 }, () => useDB());
    
    // Check all instances against the first one
    const first = requests[0];
    requests.forEach(db => {
      expect(db).toBe(first);
    });
  });
});

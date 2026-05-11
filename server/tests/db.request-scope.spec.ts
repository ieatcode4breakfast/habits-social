import { describe, it, expect } from 'vitest';
import { useDB } from '../utils/db';

describe('Database Request Scoping', () => {
  it('should return different DB instances for different event contexts', () => {
    const event1 = { context: {} } as any;
    const event2 = { context: {} } as any;

    const db1 = useDB(event1);
    const db2 = useDB(event2);

    expect(db1).not.toBe(db2);
    expect(event1.context._db).toBe(db1);
    expect(event2.context._db).toBe(db2);
  });

  it('should return the same instance when called with the same event', () => {
    const event = { context: {} } as any;

    const db1 = useDB(event);
    const db2 = useDB(event);

    expect(db1).toBe(db2);
  });

  it('should fallback to global singleton when no event is provided', () => {
    const db1 = useDB();
    const db2 = useDB();

    expect(db1).toBe(db2);
  });

  it('should prioritize event context over global singleton', () => {
    const globalDb = useDB();
    const event = { context: {} } as any;
    const requestDb = useDB(event);

    expect(requestDb).not.toBe(globalDb);
    expect(event.context._db).toBe(requestDb);
  });
});

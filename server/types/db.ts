import * as schema from '~~/server/db/schema';
import type { NeonQueryResultHKT, NeonDatabase } from 'drizzle-orm/neon-serverless';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';

export type DBConnection = 
  | NeonDatabase<typeof schema>
  | PgTransaction<NeonQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? "";

const pool = new Pool({
  connectionString,
});

// WARNING: Direct pool usage is forbidden!
// Use procedures from db-procedures.ts instead
// This pool export is for internal use only by db-procedures.ts
export { pool };

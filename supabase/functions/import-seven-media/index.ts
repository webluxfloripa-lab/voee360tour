// Completed one-time migration. Original routine is retained in migration.ts.
Deno.serve(() => Response.json({ message: 'Migration completed. Source images are independently stored.' }, { status: 410 }));

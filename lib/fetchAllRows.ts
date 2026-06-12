/**
 * lib/fetchAllRows.ts
 *
 * Supabase silently caps every query at 1,000 rows — a query written as
 * "fetch everything" quietly returns partial data with no error. This
 * helper pages through results so callers actually get every row.
 *
 * Usage:
 *   const rows = await fetchAllRows<{ id: string }>((from, to) =>
 *     db.from("matches").select("id").range(from, to)
 *   );
 */

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`fetchAllRows failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

export type StoredRecord = { kind: string; id: string; value: unknown };
type Writer = {
  runAsync: (query: string, ...params: string[]) => Promise<unknown>;
};
type Database = {
  withExclusiveTransactionAsync: (
    task: (tx: Writer) => Promise<void>,
  ) => Promise<void>;
};

export async function writeRecords(database: Database, rows: StoredRecord[]) {
  // Encode before opening the transaction: malformed data cannot partially import.
  const encoded = rows.map((row) => [
    row.kind,
    row.id,
    JSON.stringify(row.value),
  ]);
  if (encoded.some((row) => row[2] === undefined))
    throw new Error("Invalid setup record.");
  await database.withExclusiveTransactionAsync(async (tx) => {
    for (let start = 0; start < encoded.length; start += 100) {
      const part = encoded.slice(start, start + 100);
      await tx.runAsync(
        "INSERT INTO records(kind,id,value) VALUES " +
          part.map(() => "(?,?,?)").join(",") +
          " ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value",
        ...(part.flat() as string[]),
      );
    }
  });
}

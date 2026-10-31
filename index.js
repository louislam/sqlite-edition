import { DatabaseSync } from "node:sqlite";

export function createDatabase2026(path, options = {}) {

    if (typeof options.timeout !== "number") {
        options.timeout = 5000;
    }

    const db = new DatabaseSync(path, options);

    try {
        db.exec("PRAGMA foreign_keys = ON");

        // No way to use prepared statements with PRAGMA.
        // But it should be guarded by the number check above, so it should be safe.
        db.exec(`PRAGMA busy_timeout = ${options.timeout}`);

        if (!options.readOnly) {
            db.exec("PRAGMA journal_mode = WAL");
            db.exec("PRAGMA synchronous = NORMAL");
        }
    } catch (error) {
        try {
            db.close();
        } catch {}
        throw error;
    }
    return db;
}

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import { createDatabase2026 } from "sqlite-edition";

function fixture(t) {
    const dir = mkdtempSync(path.join(tmpdir(), "sqlite-edition-"));
    const databases = [];

    t.after(() => {
        for (const db of databases.reverse()) {
            try {
                db.close();
            } catch {
                // already closed by the test
            }
        }
        rmSync(dir, { recursive: true, force: true });
    });

    return {
        file: (name = "app.db") => path.join(dir, name),
        track: (db) => (databases.push(db), db),
    };
}

function pragma(db, name) {
    const row = db.prepare(`PRAGMA ${name}`).get();
    return row === undefined ? undefined : Object.values(row)[0];
}

test("applies the 2026 pragmas to a file database", (t) => {
    const f = fixture(t);
    const db = f.track(createDatabase2026(f.file()));

    assert.equal(pragma(db, "foreign_keys"), 1);
    assert.equal(pragma(db, "busy_timeout"), 5000);
    assert.equal(pragma(db, "journal_mode"), "wal");
    assert.equal(pragma(db, "synchronous"), 1);
});

test("enforces foreign keys out of the box", (t) => {
    const f = fixture(t);
    const db = f.track(createDatabase2026(f.file()));

    db.exec(`
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL) STRICT;
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            body TEXT NOT NULL
        ) STRICT;
    `);

    assert.throws(
        () => db.exec("INSERT INTO posts (user_id, body) VALUES (42, 'orphan')"),
        /FOREIGN KEY constraint failed/,
    );
});

test("honours a custom busy timeout", (t) => {
    const f = fixture(t);
    const db = f.track(createDatabase2026(f.file(), { timeout: 250 }));

    assert.equal(pragma(db, "busy_timeout"), 250);
});

test("keeps in-memory databases working", (t) => {
    const f = fixture(t);
    const db = f.track(createDatabase2026(":memory:"));

    assert.equal(pragma(db, "journal_mode"), "memory");
    assert.equal(pragma(db, "busy_timeout"), 5000);
    assert.equal(pragma(db, "foreign_keys"), 1);

    db.exec("CREATE TABLE t (a INTEGER) STRICT; INSERT INTO t VALUES (1)");
    assert.deepEqual({ ...db.prepare("SELECT a FROM t").get() }, { a: 1 });
});

test("WAL mode sticks for later connections", (t) => {
    const f = fixture(t);
    const file = f.file();
    f.track(createDatabase2026(file)).close();

    const plain = f.track(new DatabaseSync(file));
    assert.equal(pragma(plain, "journal_mode"), "wal");
});

test("read-only opens skip WAL instead of failing", (t) => {
    const f = fixture(t);
    const file = f.file();
    f.track(new DatabaseSync(file)).close();

    const db = f.track(createDatabase2026(file, { readOnly: true }));

    assert.equal(pragma(db, "journal_mode"), "delete");
    assert.equal(pragma(db, "foreign_keys"), 1);
    assert.equal(pragma(db, "busy_timeout"), 5000);
});

test("leaves strict tables to the schema", (t) => {
    const f = fixture(t);
    const db = f.track(createDatabase2026(f.file()));

    db.exec("CREATE TABLE loose (duration INTEGER)");
    db.exec("INSERT INTO loose (duration) VALUES ('way too long')");

    // SQLite has no pragma for strict-by-default, so the edition cannot turn this on.
    assert.equal(db.prepare("SELECT duration FROM loose").get()?.duration, "way too long");
});

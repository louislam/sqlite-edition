# sqlite-edition

SQLite 2026 edition on top of `node:sqlite`.

Idea from https://mort.coffee/home/sqlite-editions/.


```ts
import { createDatabase2026 } from "sqlite-edition";

const db = createDatabase2026("app.db");
```


## What it applies

| Pragma                | Value   | Why                                             |
| --------------------- | ------- | ----------------------------------------------- |
| `foreign_keys`        | `ON`    | No dangling rows, no ROWID reuse surprises       |
| `busy_timeout`        | `5000`  | Wait for the write lock instead of `SQLITE_BUSY` |
| `journal_mode`        | `WAL`   | Faster writes, readers never block the writer    |
| `synchronous`         | `NORMAL`| Safe with WAL, far fewer fsyncs                  |

## API

Identical to `node:sqlite` (https://nodejs.org/api/sqlite.html), `createDatabase2026()` is basically `new DatabaseSync()`.


# Remote Filesystem Agent

## Setup

- Requires [Bun](https://bun.sh/) (no dependencies)

## Start backend

```sh
bun run backend/server.ts
```

## Start agent (in your project root)

```sh
bun run cli/index.ts
```

## Open frontend

Just open `frontend/index.html` in your browser.

## Example commands

```json
{ "type": "write", "path": "file.txt", "content": "Hello" }
{ "type": "read", "path": "file.txt" }
{ "type": "delete", "path": "file.txt" }
{ "type": "list", "path": "./" }
{ "type": "create-slice", "name": "hero_banner" }
```
# ps-was

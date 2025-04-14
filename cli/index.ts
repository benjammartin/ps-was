#!/usr/bin/env node

import { WebSocket } from "ws";
import { promises as fs } from "fs";
import path from "path";

const WS_URL = "wss://ps-ws-backend.fly.dev";
const ROOT = process.cwd();

// Get session ID from command line arguments
const sessionArg = process.argv.find((arg) => arg.startsWith("session="));
if (!sessionArg) {
  console.error(
    "Please provide a session ID: npx ps-ws session=YOUR_SESSION_ID"
  );
  process.exit(1);
}
const sessionId = sessionArg.split("=")[1];

function toPascalCase(str: string) {
  return str
    .replace(/[_-]+/g, " ")
    .replace(/\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .replace(/\s+/g, "");
}

async function commands(cmd: any) {
  try {
    switch (cmd.type) {
      case "write":
        await fs.writeFile(path.join(ROOT, cmd.path), cmd.content ?? "");
        return { status: "ok", sessionId };

      case "read":
        try {
          const content = await fs.readFile(path.join(ROOT, cmd.path), "utf8");
          return { status: "ok", content, sessionId };
        } catch {
          return { status: "error", message: "File not found", sessionId };
        }

      case "delete":
        try {
          await fs.unlink(path.join(ROOT, cmd.path));
          return { status: "ok", sessionId };
        } catch {
          return { status: "error", message: "File not found", sessionId };
        }

      case "list":
        try {
          const files = await fs.readdir(path.join(ROOT, cmd.path));
          return { status: "ok", files, sessionId };
        } catch {
          return { status: "error", message: "Directory not found", sessionId };
        }

      case "create-slice":
        return { ...(await createSlice(cmd.name)), sessionId };

      case "delete-slice":
        return { ...(await deleteSlice(cmd.name)), sessionId };

      case "list-slices":
        return { ...(await listSlices()), sessionId };

      case "update-slice":
        return { ...(await updateSlice(cmd.name, cmd.model)), sessionId };

      default:
        return { status: "error", message: "Unknown command", sessionId };
    }
  } catch (e) {
    return { status: "error", message: String(e), sessionId };
  }
}

async function createSlice(name: string) {
  const pascal = toPascalCase(name);
  const dir = path.join(ROOT, "slices", pascal);

  try {
    await fs.mkdir(dir, { recursive: false });
  } catch {
    return { status: "error", message: "Slice already exists" };
  }

  await fs.writeFile(path.join(dir, "index.ts"), "export {};\n");

  const model = {
    id: name,
    type: "SharedSlice",
    name: pascal,
    description: "A new Slice",
    variations: [
      {
        id: "default",
        name: "Default",
        docURL: "...",
        version: "sktwi1xtmkfgx8626",
        description: "Default variation",
        primary: {},
        items: [],
      },
    ],
  };

  await fs.writeFile(
    path.join(dir, "model.json"),
    JSON.stringify(model, null, 2) + "\n"
  );

  return { status: "created", name: pascal };
}

async function deleteSlice(name: string) {
  const pascal = toPascalCase(name);
  const dir = path.join(ROOT, "slices", pascal);

  try {
    await fs.rm(dir, { recursive: true });
    return { status: "ok", message: `Slice ${pascal} deleted successfully` };
  } catch {
    return { status: "error", message: "Slice not found" };
  }
}

async function listSlices() {
  try {
    const slices = await fs.readdir(path.join(ROOT, "slices"));
    const sliceDetails = await Promise.all(
      slices.map(async (slice) => {
        try {
          const modelPath = path.join(ROOT, "slices", slice, "model.json");
          const modelContent = await fs.readFile(modelPath, "utf8");
          return { name: slice, model: JSON.parse(modelContent) };
        } catch {
          return { name: slice, model: null };
        }
      })
    );
    return { status: "ok", slices: sliceDetails };
  } catch {
    return { status: "error", message: "Could not list slices" };
  }
}

async function updateSlice(name: string, model: any) {
  const pascal = toPascalCase(name);
  const dir = path.join(ROOT, "slices", pascal);
  const modelPath = path.join(dir, "model.json");

  try {
    await fs.access(dir);
  } catch {
    return { status: "error", message: "Slice not found" };
  }

  try {
    await fs.writeFile(modelPath, JSON.stringify(model, null, 2) + "\n");
    return { status: "ok", message: `Slice ${pascal} updated successfully` };
  } catch {
    return { status: "error", message: "Failed to update slice" };
  }
}

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("Connected to backend");
  // Register as agent with session ID
  ws.send(JSON.stringify({ type: "register", role: "agent", sessionId }));
});

ws.on("message", async (data) => {
  let cmd;
  try {
    cmd = JSON.parse(data.toString());
  } catch {
    ws.send(
      JSON.stringify({ status: "error", message: "Invalid JSON", sessionId })
    );
    return;
  }

  const result = await commands(cmd);
  ws.send(JSON.stringify(result));
});

// Keep the process alive
process.on("SIGINT", () => {
  console.log("\nDisconnecting...");
  ws.close();
  process.exit(0);
});

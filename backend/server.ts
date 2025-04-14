import { serve } from "bun";
import type { ServerWebSocket } from "bun";

interface Session {
  agent: ServerWebSocket<unknown> | null;
  clients: Set<ServerWebSocket<unknown>>;
}

const sessions = new Map<string, Session>();

serve({
  port: 3001,
  fetch(req, server) {
    if (server.upgrade(req)) return undefined;
    return new Response("WebSocket only", { status: 400 });
  },
  websocket: {
    open(ws) {
      // Wait for register message
    },
    message(ws, msg) {
      try {
        const data = JSON.parse(msg.toString());
        const sessionId = data.sessionId;

        if (data.type === "register") {
          if (data.role === "client") {
            // Create session if it doesn't exist
            if (!sessions.has(sessionId)) {
              sessions.set(sessionId, {
                agent: null,
                clients: new Set(),
              });
            }
            const session = sessions.get(sessionId)!;
            session.clients.add(ws);
            ws.send(
              JSON.stringify({ status: "connected", role: "client", sessionId })
            );
          } else if (data.role === "agent") {
            // Create or get session
            if (!sessions.has(sessionId)) {
              sessions.set(sessionId, {
                agent: null,
                clients: new Set(),
              });
            }
            const session = sessions.get(sessionId)!;
            if (!session.agent) {
              session.agent = ws;
              ws.send(
                JSON.stringify({
                  status: "connected",
                  role: "agent",
                  sessionId,
                })
              );
              // Notify all clients in this session
              for (const client of session.clients) {
                client.send(
                  JSON.stringify({
                    status: "connected",
                    role: "agent",
                    sessionId,
                  })
                );
              }
            } else {
              ws.send(
                JSON.stringify({
                  status: "error",
                  message: "Session already has an agent",
                })
              );
              ws.close();
            }
          }
        } else {
          // Handle regular commands
          const session = sessions.get(sessionId);
          if (!session) {
            ws.send(
              JSON.stringify({ status: "error", message: "Invalid session" })
            );
            return;
          }

          if (ws === session.agent) {
            // Agent sends result, forward to all clients in the session
            for (const client of session.clients) {
              client.send(msg);
            }
          } else if (session.clients.has(ws) && session.agent) {
            // Client sends command, forward to agent
            session.agent.send(msg);
          } else {
            ws.send(
              JSON.stringify({ status: "error", message: "Not authorized" })
            );
          }
        }
      } catch (e) {
        ws.send(
          JSON.stringify({ status: "error", message: "Invalid message format" })
        );
      }
    },
    close(ws) {
      // Remove from all sessions
      for (const [sessionId, session] of sessions.entries()) {
        if (ws === session.agent) {
          session.agent = null;
          // Notify all clients
          for (const client of session.clients) {
            client.send(
              JSON.stringify({
                status: "disconnected",
                role: "agent",
                sessionId,
              })
            );
          }
        }
        session.clients.delete(ws);

        // Clean up empty sessions
        if (!session.agent && session.clients.size === 0) {
          sessions.delete(sessionId);
        }
      }
    },
  },
});

console.log("WebSocket backend running on ws://localhost:3001");

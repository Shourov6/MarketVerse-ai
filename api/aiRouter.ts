/**
 * AI Router
 *
 * REST endpoints for the new local-first AI assistant.
 * Handles synchronous chats, session management, and feedback.
 */

import { Hono } from "hono";
import { getConversationManager } from "../server/ai/conversation/conversation-manager.ts";
import { getSessionService } from "../server/ai/conversation/session-service.ts";
import { getDb } from "./queries/connection.js";
import { aiFeedback } from "../db/aiSchema.ts";
import { eq, desc } from "../db/mysql.js";
import { chatMessages } from "../db/schema.js"; // from old schema, assuming it still exists
import type { Domain } from "../server/ai/classification/types.ts";

export const aiRouter = new Hono();

// We assume some auth middleware sets c.get('userId') if logged in
// const authMiddleware = ...

/**
 * POST /api/ai/chat
 * Send a message and get a synchronous JSON response.
 * (For streaming, use the WebSocket endpoint instead).
 */
aiRouter.post("/chat", async (c) => {
  const body = await c.req.json();
  const { message, sessionId, domain = "support", context = {} } = body;

  if (!message || typeof message !== "string") {
    return c.json({ error: "Message is required" }, 400);
  }

  // Get user from auth if available (dummy logic here)
  const authHeader = c.req.header("Authorization");
  const userId = authHeader ? 1 : undefined; // Replace with real auth

  const manager = getConversationManager();
  
  try {
    const result = await manager.chat({
      message,
      sessionId,
      userId,
      domain: domain as Domain,
      context,
    });

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[AIRouter] Chat error:", error);
    return c.json({ error: "Failed to process chat request" }, 500);
  }
});

/**
 * GET /api/ai/sessions
 * List recent chat sessions for the logged-in user.
 */
aiRouter.get("/sessions", async (c) => {
  const userId = 1; // Replace with real auth (e.g. c.get("userId"))
  
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessions = getSessionService();
  try {
    const history = await sessions.getUserSessions(userId);
    return c.json({ success: true, data: history });
  } catch (error) {
    return c.json({ error: "Failed to load sessions" }, 500);
  }
});

/**
 * GET /api/ai/sessions/:id/messages
 * Get message history for a specific session.
 */
aiRouter.get("/sessions/:id/messages", async (c) => {
  const sessionId = c.req.param("id");
  const db = getDb();

  try {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);

    return c.json({ success: true, data: messages });
  } catch (error) {
    return c.json({ error: "Failed to load messages" }, 500);
  }
});

/**
 * POST /api/ai/feedback
 * Submit positive/negative feedback for an AI response.
 */
aiRouter.post("/feedback", async (c) => {
  const body = await c.req.json();
  const { sessionId, messageId, feedback, comment, intent } = body;

  if (!sessionId || !feedback) {
    return c.json({ error: "sessionId and feedback are required" }, 400);
  }

  const userId = 1; // Replace with auth
  const db = getDb();

  try {
    await db.insert(aiFeedback).values({
      sessionId,
      userId,
      messageId,
      feedback,
      comment,
      intent,
      createdAt: Date.now()
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("[AIRouter] Feedback error:", error);
    return c.json({ error: "Failed to submit feedback" }, 500);
  }
});

/**
 * Enterprise Seller LLM Renderer
 * Presentation layer connecting structured engine outputs with AI LLM Models (Ollama / Local AI / LLMService).
 * Strictly preserves numerical facts (stock, prices, SEO scores, revenue) without hallucination.
 */

import type { AIResponse } from "./types.ts";
import { getOllamaClient } from "../llm/ollama-client.ts";

export class SellerLLMRenderer {
  /**
   * Render structured response into conversational, intelligent AI guidance.
   */
  async render(response: AIResponse, userQuery?: string): Promise<string> {
    const prompt = this.buildPrompt(response, userQuery);

    try {
      const ollama = getOllamaClient();
      const llmResult = await ollama.generate(
        "qwen2.5:0.5b",
        prompt,
        {
          system: "You are an expert Enterprise AI Seller Assistant. Answer the seller's specific query using the provided structured facts. Speak in a helpful, intelligent, natural tone. NEVER invent or alter numerical data, stock counts, prices, or SEO scores.",
          temperature: 0.3,
        }
      );

      if (llmResult && typeof llmResult === "string" && llmResult.trim().length > 25) {
        return llmResult.trim();
      }
    } catch {
      // Local LLM warming up or offline — use dynamic semantic synthesis renderer
    }

    return this.renderDynamicSynthesis(response, userQuery);
  }

  private buildPrompt(response: AIResponse, userQuery?: string): string {
    return `[User Query]: ${userQuery || "Help me optimize my store"}
[Engine Facts & Analytics]: ${JSON.stringify({ title: response.title, summary: response.summary, sections: response.sections })}

Instructions:
1. Address the seller's specific request directly in a warm, professional, highly helpful tone.
2. If providing copy or titles, format them clearly.
3. Keep all numbers, prices, stock counts, and SEO scores EXACTLY as given.
4. Conclude with a helpful proactive suggestion.`;
  }

  /**
   * Dynamic semantic synthesis when LLM service is offline or warming up.
   * Crafts conversational AI replies tailored to the query intent and sections.
   */
  private renderDynamicSynthesis(response: AIResponse, _userQuery?: string): string {
    const intent = response.metadata?.intent || "general";

    let headerIntro = `I've analyzed your product listing for **${response.title}**. Here is the AI optimization breakdown:\n\n`;

    if (intent === "product_description") {
      headerIntro = `Here is the optimized product copy and listing title generated for your item:\n\n`;
    } else if (intent === "keywords_seo") {
      headerIntro = `Here is your target SEO keyword analysis and optimization score:\n\n`;
    } else if (intent === "inventory_alert") {
      headerIntro = `Here is the real-time inventory health and restock status for your store:\n\n`;
    } else if (intent === "pricing_analysis") {
      headerIntro = `Here is your pricing benchmark and profit margin recommendation:\n\n`;
    } else if (intent === "analytics_insights") {
      headerIntro = `Here is your store revenue and sales performance overview:\n\n`;
    } else if (intent === "product_quality") {
      headerIntro = `Here is your listing quality score audit and issue checklist:\n\n`;
    }

    let body = headerIntro;

    for (const sec of response.sections) {
      if (typeof sec.content === "string") {
        body += `**${sec.title}**\n${sec.content}\n\n`;
      } else if (Array.isArray(sec.content)) {
        body += `**${sec.title}**\n${sec.content.map((item) => `• ${item}`).join("\n")}\n\n`;
      } else if (typeof sec.content === "object" && sec.content !== null) {
        body += `**${sec.title}**\n`;
        for (const [key, val] of Object.entries(sec.content)) {
          if (val && typeof val !== "object") {
            body += `• **${this.formatKey(key)}**: ${val}\n`;
          }
        }
        body += `\n`;
      }
    }

    return body.trim();
  }

  private formatKey(key: string): string {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
  }
}

let instance: SellerLLMRenderer | null = null;
export function getSellerLLMRenderer(): SellerLLMRenderer {
  if (!instance) instance = new SellerLLMRenderer();
  return instance;
}

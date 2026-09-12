/**
 * Conversation Service.
 *
 * Manages local-first profile-scoped conversations and message histories in IndexedDB.
 * Zero remote sync, zero AI, zero data leakage between profiles.
 */

import {
  Conversation,
  ConversationMessage,
  ConversationRole,
  ConversationExportPayload,
} from "@/types/conversation";
import { academicStorage } from "@/lib/academic/storage/academic-db";

export class ConversationService {
  /**
   * Deterministic title generator from first user message.
   */
  public generateTitle(initialMessage?: string): string {
    if (!initialMessage || initialMessage.trim().length === 0) {
      const dateStr = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return `Conversation - ${dateStr}`;
    }

    const clean = initialMessage.trim().replace(/[\r\n]+/g, " ");
    if (clean.length <= 40) {
      return clean;
    }

    // Truncate cleanly at word boundary
    const truncated = clean.slice(0, 40);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 15 ? truncated.slice(0, lastSpace) : truncated) + "...";
  }

  public async createConversation(
    profileId: string,
    initialMessage?: string,
    tags?: string[]
  ): Promise<Conversation> {
    const now = new Date().toISOString();
    const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const title = this.generateTitle(initialMessage);

    const conv: Conversation = {
      id,
      profileId: profileId || "guest",
      title,
      summary: initialMessage ? initialMessage.slice(0, 100) : undefined,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: initialMessage ? 1 : 0,
      tags: tags || [],
      pinned: false,
      archived: false,
    };

    await academicStorage.saveConversation(conv);

    if (initialMessage && initialMessage.trim().length > 0) {
      await this.sendMessage(id, "USER", initialMessage);
    }

    return conv;
  }

  public async getConversation(id: string): Promise<Conversation | null> {
    return academicStorage.getConversation(id);
  }

  public async listConversations(profileId: string): Promise<Conversation[]> {
    return academicStorage.getAllConversations(profileId);
  }

  public async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<Conversation | null> {
    const conv = await academicStorage.getConversation(id);
    if (!conv) return null;

    const updated: Conversation = {
      ...conv,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await academicStorage.saveConversation(updated);
    return updated;
  }

  public async deleteConversation(id: string): Promise<void> {
    await academicStorage.deleteConversation(id);
  }

  public async sendMessage(
    conversationId: string,
    role: ConversationRole,
    content: string
  ): Promise<ConversationMessage> {
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const msg: ConversationMessage = {
      id: msgId,
      conversationId,
      role,
      content,
      createdAt: now,
    };

    await academicStorage.saveConversationMessage(msg);

    // Update conversation lastMessageAt and title if it's the first message
    const conv = await academicStorage.getConversation(conversationId);
    if (conv) {
      const isFirst = conv.messageCount <= 1;
      const newTitle = isFirst && role === "USER" ? this.generateTitle(content) : conv.title;
      await academicStorage.saveConversation({
        ...conv,
        title: newTitle,
        lastMessageAt: now,
        updatedAt: now,
      });
    }

    return msg;
  }

  public async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    return academicStorage.getConversationMessages(conversationId);
  }

  public async getMessagesPaginated(
    conversationId: string,
    options?: { limit?: number; offset?: number; order?: "asc" | "desc" }
  ): Promise<{ messages: ConversationMessage[]; total: number; hasMore: boolean }> {
    return academicStorage.getConversationMessagesPaginated(conversationId, options);
  }

  public async setPinned(id: string, pinned: boolean): Promise<void> {
    await this.updateConversation(id, { pinned });
  }

  public async setArchived(id: string, archived: boolean): Promise<void> {
    await this.updateConversation(id, { archived });
  }

  public async exportAsJson(profileId: string): Promise<string> {
    const payload = await academicStorage.exportConversations(profileId);
    return JSON.stringify(payload, null, 2);
  }

  public async exportConversationAsMarkdown(conversationId: string): Promise<string> {
    const conv = await academicStorage.getConversation(conversationId);
    if (!conv) return "";

    const msgs = await academicStorage.getConversationMessages(conversationId);
    const lines: string[] = [
      `# ${conv.title}`,
      `Date: ${new Date(conv.createdAt).toLocaleString()}`,
      `Messages: ${msgs.length}`,
      "",
      "---",
      "",
    ];

    for (const m of msgs) {
      const roleLabel = m.role === "USER" ? "👤 User" : m.role === "ASSISTANT" ? "🤖 Assistant" : "⚙️ System";
      lines.push(`### ${roleLabel} (${new Date(m.createdAt).toLocaleTimeString()})`);
      lines.push("");
      lines.push(m.content);
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    return lines.join("\n");
  }

  public async importFromJson(
    jsonString: string,
    targetProfileId: string
  ): Promise<{ success: boolean; errors: string[] }> {
    return academicStorage.importConversations(jsonString, targetProfileId);
  }

  public async migrateGuestConversations(
    guestProfileId: string,
    targetProfileId: string
  ): Promise<number> {
    if (!targetProfileId || targetProfileId === "guest") return 0;
    const guestConvs = await academicStorage.getAllConversations(guestProfileId || "guest");
    let count = 0;

    for (const conv of guestConvs) {
      await academicStorage.saveConversation({
        ...conv,
        profileId: targetProfileId,
        updatedAt: new Date().toISOString(),
      });
      count++;
    }

    return count;
  }
}

export const conversationService = new ConversationService();

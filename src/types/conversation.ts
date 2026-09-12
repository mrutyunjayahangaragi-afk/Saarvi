export type ConversationRole = "USER" | "ASSISTANT" | "SYSTEM";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationRole;
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  profileId: string;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messageCount: number;
  tags?: string[];
  archived?: boolean;
  pinned?: boolean;
}

export interface ConversationWithMessages extends Conversation {
  messages: ConversationMessage[];
}

export interface ConversationExportPayload {
  schemaVersion: "1.0";
  exportedAt: string;
  profileId: string;
  conversations: Conversation[];
  messages: ConversationMessage[];
}

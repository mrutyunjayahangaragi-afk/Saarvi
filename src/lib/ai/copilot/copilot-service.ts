import {
  CopilotAction,
  CopilotContextCategory,
  CopilotIntentCategory,
  CopilotResponse,
  MockInterviewTurn,
} from "@/types/copilot";
import {
  routeIntent,
  getRequiredContextCategories,
  isDirectDeterministicQuery,
} from "./intent-router";
import { buildCopilotContext } from "./context-builder";
import { executeAction } from "./action-planner";
import { conversationService } from "@/lib/services/conversationService";

export interface ExecuteCopilotOptions {
  query: string;
  enabledCategories?: CopilotContextCategory[];
  profileId?: string;
  documentText?: string;
  documentFilename?: string;
  conversationId?: string;
}

export const copilotService = {
  /**
   * Executes a user query against the Copilot engine.
   * Leverages deterministic fast-path when applicable, otherwise invokes AI provider with minimized context.
   */
  async executeQuery(options: ExecuteCopilotOptions): Promise<CopilotResponse> {
    const {
      query,
      enabledCategories = ["academic", "productivity", "career", "documents", "conversation"],
      profileId = "guest",
      documentText,
      documentFilename,
      conversationId,
    } = options;

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return {
        message: "Please enter a question or request for Copilot.",
        intent: "GENERAL",
        isDeterministic: true,
        contextUsed: [],
      };
    }

    const intent = routeIntent(trimmedQuery);

    // =========================================================================
    // DETERMINISTIC FAST-PATHS (Zero Remote AI Calls, Zero Latency)
    // =========================================================================
    if (isDirectDeterministicQuery(intent) && enabledCategories.includes("academic")) {
      try {
        const context = await buildCopilotContext(["academic"], profileId);
        const acad = context.academic;

        if (acad && (acad.currentSgpa !== undefined || acad.cgpa !== undefined)) {
          const lines: string[] = [];
          if (acad.currentSgpa !== undefined) {
            lines.push(
              `Your verified **SGPA** for Semester ${acad.semesterNumber || 1} is **${acad.currentSgpa.toFixed(2)}**.`
            );
          }
          if (acad.cgpa !== undefined) {
            lines.push(
              `Your cumulative **CGPA** across recorded semesters is **${acad.cgpa.toFixed(2)}**.`
            );
          }
          lines.push(
            "\n*Calculated authoritatively by Saarvi's verified VTU formulas based on your local workspace records.*"
          );

          const response: CopilotResponse = {
            message: lines.join("\n"),
            intent: "ACADEMIC_RESULT",
            isDeterministic: true,
            sourceNotice: "Calculated by Saarvi (Deterministic Engine)",
            contextUsed: ["academic"],
            citations: ["VTU Academic Engine", "Local Academic DB"],
          };

          if (conversationId) {
            await this.recordConversationTurn(conversationId, trimmedQuery, response.message);
          }
          return response;
        }
      } catch {
        // Fall back cleanly to AI path
      }
    }

    // Attendance Deterministic Fast-Path
    if (
      intent === "ATTENDANCE" &&
      enabledCategories.includes("academic") &&
      /(what is my|show my|check|current)\s*attendance/i.test(trimmedQuery)
    ) {
      try {
        const context = await buildCopilotContext(["academic"], profileId);
        const list = context.academic?.attendanceSummary;

        if (list && list.length > 0) {
          const lines = ["Here is your current verified attendance status:\n"];
          for (const item of list) {
            const statusNotice = item.needsRecovery
              ? ` ⚠️ Below 75% (${item.classesNeededFor75} classes needed for 75%)`
              : " ✅ Safe";
            lines.push(
              `- **${item.subject}**: ${item.percentage}% (${item.attended}/${item.total} classes attended)${statusNotice}`
            );
          }
          lines.push(
            "\n*Calculated directly by Saarvi Attendance Recovery Engine without AI intervention.*"
          );

          const response: CopilotResponse = {
            message: lines.join("\n"),
            intent: "ATTENDANCE",
            isDeterministic: true,
            sourceNotice: "Calculated by Saarvi (Deterministic Engine)",
            contextUsed: ["academic"],
            citations: ["Attendance DB", "Attendance Recovery Calculator"],
          };

          if (conversationId) {
            await this.recordConversationTurn(conversationId, trimmedQuery, response.message);
          }
          return response;
        }
      } catch {
        // Fall through
      }
    }

    // =========================================================================
    // AI ORCHESTRATION PATH (Bounded Minimization & Privacy)
    // =========================================================================
    // Determine minimal categories needed for this specific intent
    const requiredCategories = getRequiredContextCategories(intent);
    const activeCategories = requiredCategories.filter((c) => enabledCategories.includes(c));

    // Build strictly minimized context
    const context = await buildCopilotContext(
      activeCategories,
      profileId,
      documentText,
      documentFilename
    );

    // Retrieve recent conversation messages if enabled
    if (conversationId && enabledCategories.includes("conversation")) {
      try {
        const messages = await conversationService.getMessages(conversationId);
        context.recentMessages = messages.slice(-5).map((m) => ({
          role: m.role.toLowerCase() === "user" ? "user" : "assistant",
          content: m.content,
        }));
      } catch {
        // Continue cleanly without history
      }
    }

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedQuery,
          context,
          intent,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 503 || res.status === 429) {
          return {
            message:
              errJson.error ||
              "AI assistance is currently unavailable. Your local workspace data remains safe and accessible deterministically.",
            intent,
            isDeterministic: true,
            sourceNotice: "Saarvi Local Fallback",
            contextUsed: activeCategories,
          };
        }
        throw new Error(errJson.error || "Failed to reach Copilot service.");
      }

      const data = await res.json();
      const response: CopilotResponse = data.result;

      if (conversationId) {
        await this.recordConversationTurn(conversationId, trimmedQuery, response.message);
      }

      return response;
    } catch (err: any) {
      return {
        message: `I encountered an issue connecting to the AI provider: ${err?.message || "Unknown error"}. Your workspace records remain safe locally.`,
        intent,
        isDeterministic: true,
        sourceNotice: "Local Error State",
        contextUsed: activeCategories,
      };
    }
  },

  /**
   * Helper to persist a turn to local IndexedDB conversation memory.
   */
  async recordConversationTurn(
    conversationId: string,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    try {
      await conversationService.sendMessage(conversationId, "USER", userMessage);
      await conversationService.sendMessage(conversationId, "ASSISTANT", assistantMessage);
    } catch {
      // Storage failure should never crash the conversation turn
    }
  },

  /**
   * Confirms and executes an action explicitly approved by the user.
   */
  async confirmAndExecuteAction(
    action: CopilotAction,
    profileId: string = "guest"
  ): Promise<{ success: boolean; message: string; data?: any }> {
    action.status = "confirmed";
    return executeAction(action, profileId);
  },

  /**
   * Requests a mock interview turn from the Mock Interview Coach.
   */
  async requestMockInterviewTurn(
    role: string,
    questionNumber: number,
    candidateSkills?: string[],
    lastQuestion?: string,
    lastAnswer?: string
  ): Promise<MockInterviewTurn> {
    const res = await fetch("/api/copilot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "mock_interview",
        role,
        questionNumber,
        candidateSkills,
        lastQuestion,
        lastAnswer,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to contact Mock Interview Coach.");
    }

    const data = await res.json();
    return {
      questionIndex: questionNumber,
      question: data.result.question,
      role,
      answer: lastAnswer,
      feedback: data.result.feedback,
    };
  },
};

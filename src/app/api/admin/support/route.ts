import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/security/admin-auth";
import {
  enforceRateLimit,
  createRateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

import { supportTicketStore, type SupportTicket } from "@/lib/support/support-store";
export type { SupportTicket };

export async function GET(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "VIEW");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(request, "adminReads", authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const tickets = supportTicketStore.getAll();
    const counts = {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "OPEN").length,
      inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
      resolved: tickets.filter((t) => t.status === "RESOLVED").length,
    };

    const response = NextResponse.json({
      success: true,
      tickets,
      counts,
      inboxEmail: "saarvinotifications@gmail.com",
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error("[Admin Support GET] Error:", error);
    return NextResponse.json({ error: "Failed to load support tickets" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await getAuthenticatedAdmin(request, "MANAGE");
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const rateLimit = enforceRateLimit(request, "adminMutations", authResult.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const { id, status, assignedTo, internalNotes } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });
    }

    const updated = supportTicketStore.updateTicket(
      id,
      { status, assignedTo, internalNotes },
      authResult.user.email || "Administrator"
    );

    if (!updated) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const response = NextResponse.json({
      success: true,
      ticket: updated,
      message: "Ticket updated successfully",
    });

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: any) {
    console.error("[Admin Support PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update support ticket" }, { status: 500 });
  }
}

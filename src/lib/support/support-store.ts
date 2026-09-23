export interface SupportTicket {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  category: "General" | "Career" | "Academics" | "Technical" | "Billing" | "Feedback";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  assignedTo?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

// In-memory support store with realistic support messages for saarvinotifications@gmail.com
class SupportTicketStore {
  private tickets: Map<string, SupportTicket> = new Map();

  constructor() {
    this.seedDefaultTickets();
  }

  private seedDefaultTickets() {
    const defaultTickets: SupportTicket[] = [
      {
        id: "tick_001",
        senderName: "Rohan Patil",
        senderEmail: "rohan.patil.cse@gmail.com",
        subject: "Inquiry regarding VTU 2022 Scheme question papers",
        message: "Hello Saarvi team, I am preparing for 5th sem Computer Networks and noticed some 2022 scheme module 3 question banks need answers. Could you please look into it? Thanks!",
        category: "Academics",
        status: "OPEN",
        priority: "NORMAL",
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      },
      {
        id: "tick_002",
        senderName: "Pooja Hegde",
        senderEmail: "pooja.hegde.work@gmail.com",
        subject: "Application tracking sync with calendar",
        message: "Is it possible to sync application deadlines with my Google Calendar directly? The timetable export works great, wondering if jobs have something similar.",
        category: "Career",
        status: "IN_PROGRESS",
        priority: "LOW",
        assignedTo: "Support Admin",
        internalNotes: "User suggested Google Calendar iCal sync for tracked job deadlines.",
        createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: "tick_003",
        senderName: "Deepak Sharma",
        senderEmail: "deepak.sharma.tech@gmail.com",
        subject: "UPI Pro subscription confirmation (AXL)",
        message: "Submitted reference 9036745164-3@axl for Pro subscription this morning. Can you please confirm activation?",
        category: "Billing",
        status: "RESOLVED",
        priority: "HIGH",
        assignedTo: "Finance Team",
        internalNotes: "Verified UPI transaction reference, Pro activated on student profile.",
        createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      },
    ];

    defaultTickets.forEach((t) => this.tickets.set(t.id, t));
  }

  public getAll(): SupportTicket[] {
    return Array.from(this.tickets.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public updateTicket(
    id: string,
    patch: Partial<SupportTicket>,
    adminName: string
  ): SupportTicket | null {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;

    const updated: SupportTicket = {
      ...ticket,
      ...patch,
      updatedAt: new Date().toISOString(),
      resolvedAt: patch.status === "RESOLVED" ? new Date().toISOString() : ticket.resolvedAt,
    };

    this.tickets.set(id, updated);
    return updated;
  }
}

export const supportTicketStore = new SupportTicketStore();

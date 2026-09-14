"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Code,
  Layers,
  Database,
  Cpu,
  Globe,
  Users,
  Briefcase,
  CheckCircle2,
  BookOpen,
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface PracticeQuestion {
  id: string;
  category: "DSA" | "OOP" | "DBMS" | "OS" | "Networks" | "WebDev" | "HR" | "Projects";
  question: string;
  keyPoints: string[];
  sampleFollowUp: string;
}

const PRACTICE_TOPICS: PracticeQuestion[] = [
  // DSA
  {
    id: "dsa-1",
    category: "DSA",
    question: "How do you detect a cycle in a linked list in O(1) auxiliary space?",
    keyPoints: [
      "Floyd's Cycle-Finding Algorithm (Tortoise and Hare pointer approach).",
      "Slow pointer moves 1 step; fast pointer moves 2 steps.",
      "If slow === fast, a cycle exists. If fast reaches null, no cycle exists.",
      "Time complexity O(N), Space complexity O(1)."
    ],
    sampleFollowUp: "How do you find the exact node where the cycle begins?",
  },
  {
    id: "dsa-2",
    category: "DSA",
    question: "Explain the difference between Dijkstra's algorithm and the Bellman-Ford algorithm.",
    keyPoints: [
      "Dijkstra uses a greedy approach with a priority queue; does not work with negative edge weights.",
      "Bellman-Ford uses dynamic programming and relaxes all edges (V - 1) times; detects negative weight cycles.",
      "Dijkstra runs in O((V + E) log V); Bellman-Ford runs in O(V × E)."
    ],
    sampleFollowUp: "Why does Bellman-Ford relax edges exactly (V - 1) times?",
  },
  // OOP
  {
    id: "oop-1",
    category: "OOP",
    question: "What is the difference between Abstraction and Encapsulation?",
    keyPoints: [
      "Encapsulation binds data and code together into a single unit (hiding internal state via private/protected access modifiers).",
      "Abstraction hides implementation complexity and exposes only essential interfaces (using abstract classes and interfaces).",
      "Encapsulation is information hiding; Abstraction is implementation hiding."
    ],
    sampleFollowUp: "How do interfaces in modern languages differ from abstract classes?",
  },
  // DBMS
  {
    id: "dbms-1",
    category: "DBMS",
    question: "Explain the ACID properties in database management systems.",
    keyPoints: [
      "Atomicity: All operations within a transaction succeed or none do (rollback).",
      "Consistency: Database transitions from one valid state to another satisfying all constraints.",
      "Isolation: Concurrent transactions execute independently without interference.",
      "Durability: Committed data is written persistently to non-volatile storage."
    ],
    sampleFollowUp: "What are the four SQL transaction isolation levels?",
  },
  // OS
  {
    id: "os-1",
    category: "OS",
    question: "What is the difference between a Process and a Thread?",
    keyPoints: [
      "A process is an executing program instance with its own isolated address space, heap, and file descriptors.",
      "A thread is a lightweight unit of execution within a process sharing the same address space and heap.",
      "Context switching between processes is heavier due to memory mapping and page table changes.",
      "Threads communicate via shared memory; processes require IPC (pipes, sockets, message queues)."
    ],
    sampleFollowUp: "What causes race conditions when multiple threads share memory?",
  },
  // Networks
  {
    id: "net-1",
    category: "Networks",
    question: "Explain the TCP 3-way handshake process.",
    keyPoints: [
      "Client sends SYN packet with initial sequence number X.",
      "Server responds with SYN-ACK packet with sequence number Y and ACK number X + 1.",
      "Client replies with ACK packet with sequence number X + 1 and ACK number Y + 1.",
      "Connection transitions to ESTABLISHED state for reliable bidirectional streaming."
    ],
    sampleFollowUp: "What is a SYN flood attack and how do SYN cookies mitigate it?",
  },
  // Web Dev
  {
    id: "web-1",
    category: "WebDev",
    question: "Explain the difference between Client-Side Rendering (CSR) and Server-Side Rendering (SSR).",
    keyPoints: [
      "CSR renders UI in the browser using JavaScript after downloading a minimal HTML shell.",
      "SSR renders the initial HTML markup on the server per request, providing faster Time-to-First-Byte (TTFB) and improved SEO.",
      "Modern frameworks combine SSR/SSG with client hydration for optimal performance."
    ],
    sampleFollowUp: "What is incremental static regeneration (ISR)?",
  },
  // HR & Leadership
  {
    id: "hr-1",
    category: "HR",
    question: "Tell me about a challenging technical bug you encountered and how you solved it.",
    keyPoints: [
      "Use the STAR method: Situation, Task, Action, Result.",
      "Highlight systematic debugging (reproducing, isolating, logging, hypothesis testing).",
      "Mention root-cause analysis and automated test regression added to prevent recurrence."
    ],
    sampleFollowUp: "What did you learn from that experience that influenced your coding habits?",
  },
  // Projects
  {
    id: "proj-1",
    category: "Projects",
    question: "How do you explain the architecture and key technical trade-offs of your primary project?",
    keyPoints: [
      "High-level architecture (client tier, application tier, database/storage tier).",
      "Why specific technologies were chosen over alternatives.",
      "Scalability, privacy, and security considerations.",
      "Measurable performance outcomes (load time, latency, memory limits)."
    ],
    sampleFollowUp: "If you had 3 more months, what would you re-architect?",
  },
];

const CATEGORY_NAMES: Record<string, string> = {
  all: "All Categories",
  DSA: "Data Structures & Algorithms",
  OOP: "Object-Oriented Programming",
  DBMS: "Database Management",
  OS: "Operating Systems",
  Networks: "Computer Networks",
  WebDev: "Web Development",
  HR: "Behavioral & HR",
  Projects: "Project Discussion",
};

export default function InterviewPrepHubPage() {
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>("dsa-1");
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const filtered = PRACTICE_TOPICS.filter((t) => {
    const matchesCat = selectedCat === "all" || t.category === selectedCat;
    const matchesSearch =
      !search ||
      t.question.toLowerCase().includes(search.toLowerCase()) ||
      t.keyPoints.some((p) => p.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const toggleReviewed = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReviewedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10">
        {/* Banner */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link href="/career/resume-builder" className="hover:text-blue-600 transition-colors">
              Career Workspace
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Interview Preparation</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Briefcase className="w-7 h-7 text-blue-600" />
                Technical & Behavioral Interview Hub
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
                Structured, concept-grounded practice topics covering computer science fundamentals, design patterns, and engineering behavioral scenarios.
              </p>
            </div>

            <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200 font-semibold flex items-center gap-1.5 self-start">
              <Sparkles className="w-3.5 h-3.5" /> Practice Ground
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-xs space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search interview topics, algorithms, ACID, threads, HTTP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(CATEGORY_NAMES).map(([catKey, catLabel]) => (
              <button
                key={catKey}
                onClick={() => setSelectedCat(catKey)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedCat === catKey
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {catLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">No questions found</p>
              <p className="text-xs text-slate-500">Try adjusting your category or search keyword.</p>
            </div>
          ) : (
            filtered.map((item) => {
              const isExpanded = expandedId === item.id;
              const isReviewed = reviewedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border transition-all ${
                    isExpanded ? "border-blue-300 shadow-sm" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => toggleReviewed(item.id, e)}
                        title={isReviewed ? "Mark as unreviewed" : "Mark as mastered"}
                        className={`mt-0.5 p-1 rounded-full border transition-colors ${
                          isReviewed
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-300 text-transparent hover:border-slate-400"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {item.category}
                          </span>
                          {isReviewed && (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Mastered
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          {item.question}
                        </h3>
                      </div>
                    </div>

                    <div className="text-slate-400 pt-1">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-blue-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/50 rounded-b-xl space-y-3 text-xs">
                      <div>
                        <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                          Core Concepts & Key Points:
                        </h4>
                        <ul className="space-y-1.5 list-disc pl-4 text-slate-700 leading-relaxed">
                          {item.keyPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900">
                        <strong className="block font-semibold mb-0.5">Common Follow-Up / Deep-Dive:</strong>
                        <span>{item.sampleFollowUp}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

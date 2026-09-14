/**
 * Saarvi AI Assistant 2.0 Grounded Knowledge & Workflow Engine
 *
 * Provides:
 * 1. Comprehensive, instant, deterministic knowledge for:
 *    - VTU SGPA & CGPA concepts, formulas, grading rules, credit mechanics
 *    - Core Computer Science fundamentals (Recursion, OOP, APIs, Databases, Threads, System Calls)
 *    - Career & placement preparation (Interview prep, resume rules, learning roadmaps)
 *    - Saarvi feature workflows (PDF to Word, Resume Builder, Pro payment & UTR verification, Study Planner)
 * 2. Grounded tool discovery fallback with zero hallucinations
 * 3. Local-first privacy: 100% deterministic, zero user document content inspection
 */

import { CANONICAL_TOOL_REGISTRY } from '../tools/tool-registry';
import type { CanonicalTool } from '../tools/tool-registry';
import { DiscoveredToolItem, ToolDiscoveryResult } from './tool-discovery-engine';

export interface AssistantResponse {
  reply: string;
  tools?: DiscoveredToolItem[];
  categoryRoute?: string;
  categoryName?: string;
  suggestedAction?: {
    label: string;
    route: string;
  };
  intent: string;
}

/**
 * Maps a CanonicalTool into a DiscoveredToolItem.
 */
function toToolItem(tool: CanonicalTool): DiscoveredToolItem {
  const categoryNames: Record<string, string> = {
    pdf: 'PDF Tools',
    image: 'Image Tools',
    student: 'Student Tools',
    academic: 'Academic Tools',
    career: 'Career Tools',
    ai: 'AI Tools',
  };

  return {
    key: tool.key,
    name: tool.name,
    category: tool.category,
    categoryName: categoryNames[tool.category] || tool.category,
    description: tool.description,
    route: tool.route,
    icon: tool.icon,
    badge: tool.badge,
    requiresPro: tool.defaultAccess === 'SUBSCRIPTION',
    isDisabled: tool.status === 'coming_soon',
  };
}

/**
 * Returns a canonical tool item by key if available in the registry.
 */
export function getRegisteredToolItem(key: string): DiscoveredToolItem | undefined {
  const tool = CANONICAL_TOOL_REGISTRY.find((t) => t.key === key);
  return tool ? toToolItem(tool) : undefined;
}

/**
 * Natural conversational greetings.
 */
const GREETING_RESPONSES = [
  "Hi! I'm Saarvi AI. I can help you find tools, understand Saarvi features, plan your studies, prepare for your career, and answer general questions. What would you like to work on?",
  "Hello! I'm Saarvi AI, your platform assistant for academic tools, document processing, and career preparation. How can I help you today?",
  "Hey there! I'm Saarvi AI. Whether you need to convert documents, calculate your SGPA, build a resume, or prepare for technical interviews, I'm here to assist.",
];

/**
 * Evaluates whether a query matches grounded built-in knowledge.
 */
export function evaluateGroundedKnowledge(
  query: string,
  options?: { isAdmin?: boolean }
): AssistantResponse | null {
  const q = query.toLowerCase().trim();
  const cleaned = q.replace(/[?!.,;:'"()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

  // -------------------------------------------------------------------------
  // 1. GREETINGS
  // -------------------------------------------------------------------------
  const greetings = ['hi', 'hello', 'hey', 'hey there', 'good morning', 'good afternoon', 'good evening', 'greetings', 'sup', 'yo'];
  if (greetings.includes(cleaned)) {
    const reply = GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)];
    return {
      reply,
      intent: 'GREETING',
    };
  }

  // -------------------------------------------------------------------------
  // 2. CAPABILITIES ("What can you do?", "Who are you?", "Help")
  // -------------------------------------------------------------------------
  if (
    cleaned === 'what can you do' ||
    cleaned === 'what can saarvi do' ||
    cleaned === 'what is saarvi' ||
    cleaned === 'who are you' ||
    cleaned === 'help' ||
    cleaned === 'what do you do'
  ) {
    return {
      reply:
        "I'm Saarvi AI, your integrated assistant for:\n\n" +
        "• **Tool Discovery**: Find and launch any PDF, image, academic, student, or career utility.\n" +
        "• **Academic Guidance**: Understand VTU SGPA & CGPA formulas, CIE/SEE weightage, and study planning.\n" +
        "• **Career Preparation**: Get ATS resume tips, cover letter structures, interview preparation, and skill-gap guidance.\n" +
        "• **Computer Science Concepts**: Ask for simple explanations and examples for programming, DSA, OS, DBMS, and APIs.\n" +
        "• **Platform & Plans**: Learn how to use Saarvi features or upgrade to Pro via UPI QR payment.",
      intent: 'CAPABILITIES',
    };
  }

  // -------------------------------------------------------------------------
  // 3. VTU SGPA & CGPA EXPLANATIONS
  // -------------------------------------------------------------------------
  if (
    cleaned.includes('difference between sgpa and cgpa') ||
    cleaned.includes('sgpa vs cgpa') ||
    cleaned.includes('diff between sgpa and cgpa')
  ) {
    const sgpaTool = getRegisteredToolItem('sgpa-calculator');
    const cgpaTool = getRegisteredToolItem('cgpa-calculator');
    const tools = [sgpaTool, cgpaTool].filter(Boolean) as DiscoveredToolItem[];

    return {
      reply:
        "**SGPA vs CGPA Explained:**\n\n" +
        "• **SGPA (Semester Grade Point Average)**: Measures your academic performance for a *single semester*.\n" +
        "  Formula: `SGPA = Σ(Credit × Grade Point) / Σ(Credit)` for that semester.\n\n" +
        "• **CGPA (Cumulative Grade Point Average)**: Measures your overall academic performance across *all completed semesters*.\n" +
        "  Formula: `CGPA = Σ(Semester SGPA × Semester Credits) / Σ(Total Credits)`.\n\n" +
        "> *Note: For official numeric results, always use Saarvi's deterministic calculators below.*",
      tools,
      intent: 'ACADEMIC_EXPLANATION',
    };
  }

  if (
    cleaned === 'what is sgpa' ||
    cleaned === 'explain sgpa' ||
    cleaned === 'how is sgpa calculated' ||
    cleaned === 'how do i calculate sgpa' ||
    cleaned === 'how to calculate sgpa'
  ) {
    const sgpaTool = getRegisteredToolItem('sgpa-calculator');
    return {
      reply:
        "**SGPA (Semester Grade Point Average)** is the weighted average of the grade points obtained in all courses in a semester.\n\n" +
        "• **Formula**: `SGPA = Σ(Course Credits × Grade Points) / Total Semester Credits`\n" +
        "• **Grading Scale (VTU 2022/2018)**: O = 10, A+ = 9, A = 8, B+ = 7, B = 6, C = 5, P = 4, F = 0.\n" +
        "• **Credits Rule**: If you receive an F grade, the credits are still included in the total denominator credits until cleared.\n\n" +
        "To calculate your exact verified SGPA, enter your subject marks or grades in our deterministic calculator:",
      tools: sgpaTool ? [sgpaTool] : [],
      intent: 'ACADEMIC_EXPLANATION',
    };
  }

  if (
    cleaned === 'what is cgpa' ||
    cleaned === 'explain cgpa' ||
    cleaned === 'how is cgpa calculated' ||
    cleaned === 'how do i calculate cgpa'
  ) {
    const cgpaTool = getRegisteredToolItem('cgpa-calculator');
    return {
      reply:
        "**CGPA (Cumulative Grade Point Average)** is the cumulative weighted measure of your academic performance up to the current semester.\n\n" +
        "• **Formula**: `CGPA = Σ(Semester SGPA × Semester Total Credits) / Total Degree Credits`\n" +
        "• **VTU Percentage Conversion**: `Percentage = (CGPA - 0.75) × 10`\n\n" +
        "You can calculate your multi-semester CGPA and percentage using our dedicated tool:",
      tools: cgpaTool ? [cgpaTool] : [],
      intent: 'ACADEMIC_EXPLANATION',
    };
  }

  // -------------------------------------------------------------------------
  // 4. SAARVI FEATURE WORKFLOWS
  // -------------------------------------------------------------------------
  if (
    cleaned.includes('how do i convert pdf to word') ||
    cleaned.includes('how to convert pdf to word') ||
    cleaned.includes('convert pdf to word workflow')
  ) {
    const tool = getRegisteredToolItem('pdf-to-word');
    return {
      reply:
        "**How to convert PDF to Word in Saarvi:**\n\n" +
        "1. Open the **PDF to Word** tool.\n" +
        "2. Upload or drag & drop your PDF file (processed securely directly in your browser or local worker).\n" +
        "3. Click **Convert to Word**.\n" +
        "4. Download your formatted `.docx` file immediately.\n\n" +
        "Your original document formatting and text hierarchy are preserved.",
      tools: tool ? [tool] : [],
      intent: 'FEATURE_WORKFLOW',
    };
  }

  if (
    cleaned.includes('how do i use resume builder') ||
    cleaned.includes('how to use resume builder') ||
    cleaned.includes('help me create a resume') ||
    cleaned.includes('how to make a resume') ||
    cleaned.includes('create a resume')
  ) {
    const tool = getRegisteredToolItem('resume-builder');
    return {
      reply:
        "**How to build a resume in Saarvi:**\n\n" +
        "1. Open **Resume Builder** under Career Tools.\n" +
        "2. Fill in your Personal Info, Education, Experience, Projects, and Skills.\n" +
        "3. Inspect the live preview in real time as you type.\n" +
        "4. Your resume is saved automatically in your local browser workspace.\n" +
        "5. Click **Download PDF** to export a clean, ATS-friendly document.",
      tools: tool ? [tool] : [],
      intent: 'FEATURE_WORKFLOW',
    };
  }

  if (
    cleaned.includes('how do i create a study plan') ||
    cleaned.includes('how to create a study plan') ||
    cleaned.includes('study planning')
  ) {
    const tool = getRegisteredToolItem('study-planner');
    return {
      reply:
        "**Creating a Study Plan in Saarvi:**\n\n" +
        "1. Open the **Study Planner** tool under Student Tools.\n" +
        "2. Add your subjects and set targeted weekly study hours.\n" +
        "3. Break down study sessions into 25 or 50-minute focused intervals (Pomodoro technique).\n" +
        "4. Track your daily completion and review schedules locally on your device.",
      tools: tool ? [tool] : [],
      intent: 'FEATURE_WORKFLOW',
    };
  }

  if (
    cleaned.includes('how do i pay for pro') ||
    cleaned.includes('how to pay for pro') ||
    cleaned.includes('upgrade to pro') ||
    cleaned.includes('pro plan') ||
    cleaned.includes('pay for pro')
  ) {
    return {
      reply:
        "**How to upgrade to Saarvi Pro:**\n\n" +
        "1. Visit the **Plans** page (`/pricing`).\n" +
        "2. Select either the **Monthly** (₹49/mo) or **Yearly** (₹399/yr) plan.\n" +
        "3. Scan the official Saarvi UPI QR code using any UPI app (Google Pay, PhonePe, Paytm).\n" +
        "4. Submit your **12-digit UPI UTR / Reference Number** on the confirmation page.\n" +
        "5. Our admin team verifies the transaction and activates your Pro subscription within 2–4 hours.",
      suggestedAction: {
        label: 'View Plans & Pricing',
        route: '/pricing',
      },
      intent: 'PAYMENT_HELP',
    };
  }

  if (
    cleaned.includes('where is my payment') ||
    cleaned.includes('payment status') ||
    cleaned.includes('check my payment')
  ) {
    return {
      reply:
        "To check your subscription or payment verification status:\n\n" +
        "• Go to your **Account Settings** (`/dashboard/settings`).\n" +
        "• Manual UPI QR payments with UTR submissions are typically reviewed by administrators within a few hours.\n" +
        "• Once confirmed by server-authoritative review, your account badge changes to **PRO** automatically.",
      suggestedAction: {
        label: 'Go to Settings',
        route: '/dashboard/settings',
      },
      intent: 'PAYMENT_HELP',
    };
  }

  // -------------------------------------------------------------------------
  // 5. COMPUTER SCIENCE & PROGRAMMING FUNDAMENTALS
  // -------------------------------------------------------------------------
  if (cleaned.includes('explain recursion') || cleaned.includes('what is recursion')) {
    return {
      reply:
        "**Recursion Explained Simply:**\n\n" +
        "Recursion is a technique where a function calls itself to break down a large problem into smaller, identical subproblems.\n\n" +
        "**Two Essential Rules:**\n" +
        "1. **Base Case**: The stopping condition that prevents infinite loops.\n" +
        "2. **Recursive Step**: The function calling itself with an updated argument moving closer to the base case.\n\n" +
        "**Real-World Example (Factorial of n):**\n" +
        "```python\n" +
        "def factorial(n):\n" +
        "    if n <= 1:        # Base case\n" +
        "        return 1\n" +
        "    return n * factorial(n - 1)  # Recursive step\n" +
        "```\n" +
        "To calculate `factorial(3)`: `3 * factorial(2)` → `3 * (2 * factorial(1))` → `3 * 2 * 1 = 6`.",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is oop') || cleaned.includes('explain oop') || cleaned.includes('object oriented programming')) {
    return {
      reply:
        "**Object-Oriented Programming (OOP)** organizes code around real-world objects and data rather than pure functions.\n\n" +
        "**The 4 Pillars of OOP:**\n" +
        "1. **Encapsulation**: Bundling data and methods together inside a class and restricting direct access (private fields).\n" +
        "2. **Abstraction**: Hiding internal implementation complexity and exposing only essential interfaces.\n" +
        "3. **Inheritance**: Allowing a child class to inherit properties and methods from a parent class (code reusability).\n" +
        "4. **Polymorphism**: The ability of different objects to respond to the same method call in their own specific way.",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is an api') || cleaned.includes('what is api') || cleaned.includes('explain api')) {
    return {
      reply:
        "**What is an API (Application Programming Interface)?**\n\n" +
        "An API is a software messenger that allows two different applications to communicate and share data securely.\n\n" +
        "**Restaurant Analogy:**\n" +
        "• **You (Client)**: You look at the menu and decide what food you want.\n" +
        "• **Waiter (API)**: Takes your order to the kitchen and brings the food back to your table.\n" +
        "• **Kitchen (Server/Database)**: Prepares the food based on your request.\n\n" +
        "In web development, a REST API accepts HTTP requests (`GET`, `POST`, `PUT`, `DELETE`) and returns data (typically JSON).",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is a database') || cleaned.includes('explain database') || cleaned.includes('what is database')) {
    return {
      reply:
        "**What is a Database?**\n\n" +
        "A database is an organized collection of structured data stored electronically and managed by a Database Management System (DBMS).\n\n" +
        "**Two Major Types:**\n" +
        "• **Relational (SQL)**: Stores data in structured tables with rows and columns (e.g., PostgreSQL, MySQL). Uses ACID properties and relational foreign keys.\n" +
        "• **Non-Relational (NoSQL)**: Stores data as documents, key-value pairs, or graphs (e.g., MongoDB, Redis). Optimized for flexible schemas and horizontal scaling.",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is a thread in os') || cleaned.includes('thread in os') || cleaned.includes('what is a thread')) {
    return {
      reply:
        "**What is a Thread in Operating Systems?**\n\n" +
        "A thread is the smallest unit of execution that the OS CPU scheduler can manage, often called a *lightweight process*.\n\n" +
        "**Key Characteristics:**\n" +
        "• A process can have multiple threads executing concurrently.\n" +
        "• Threads within the same process share code, data, and OS resources (like open files).\n" +
        "• Each thread maintains its own Program Counter (PC), CPU registers, and call stack.\n" +
        "• **Benefit**: Faster context switching and shared memory compared to multi-process architectures.",
      intent: 'CS_EDUCATION',
    };
  }

  if (cleaned.includes('what is a system call') || cleaned.includes('system call in os') || cleaned.includes('system call')) {
    return {
      reply:
        "**What is a System Call?**\n\n" +
        "A system call is the programmatic interface through which a user program requests a service from the operating system's kernel.\n\n" +
        "**How it Works:**\n" +
        "1. User programs run in restricted **User Mode**.\n" +
        "2. When the program needs hardware access (reading a file, creating a process, network I/O), it triggers a software interrupt (`trap`).\n" +
        "3. The CPU switches to privileged **Kernel Mode**, executes the requested service, and returns control to User Mode.\n\n" +
        "**Common Examples (Linux/POSIX)**: `fork()`, `read()`, `write()`, `open()`, `exit()`.",
      intent: 'CS_EDUCATION',
    };
  }

  // -------------------------------------------------------------------------
  // 6. CAREER & PLACEMENT ASSISTANCE
  // -------------------------------------------------------------------------
  if (
    cleaned.includes('prepare for placements') ||
    cleaned.includes('how to prepare for interviews') ||
    cleaned.includes('help me prepare for interviews') ||
    cleaned.includes('placement preparation')
  ) {
    const interviewTool = getRegisteredToolItem('interview-prep');
    const resumeTool = getRegisteredToolItem('resume-builder');
    const tools = [interviewTool, resumeTool].filter(Boolean) as DiscoveredToolItem[];

    return {
      reply:
        "**4-Stage Campus Placement Preparation Roadmap:**\n\n" +
        "1. **Core DSA Foundations**: Practice Arrays, Strings, Hashing, Two Pointers, Linked Lists, Trees, and Dynamic Programming.\n" +
        "2. **CS Core Subjects**: Thoroughly review Operating Systems, DBMS, Computer Networks, and OOP concepts.\n" +
        "3. **Projects & Resume**: Highlight 2 solid projects with measurable impact. Ensure your resume passes automated ATS scanners.\n" +
        "4. **Mock Interviews & HR**: Practice articulating your thought process aloud and formulate STAR responses (Situation, Task, Action, Result) for behavioral questions.",
      tools,
      intent: 'CAREER_GUIDANCE',
    };
  }

  if (cleaned.includes('what should i learn after java') || cleaned.includes('learn after java')) {
    return {
      reply:
        "**Recommended Learning Paths After Java:**\n\n" +
        "• **Backend / Enterprise Engineering**: Master **Spring Boot**, REST APIs, Hibernate/JPA, and PostgreSQL/MySQL.\n" +
        "• **Cloud & DevOps**: Learn Docker, Kubernetes, microservices architecture, and AWS deployment.\n" +
        "• **Full-Stack Expansion**: Learn **TypeScript** and **React** or Next.js to pair with your Java backend.\n" +
        "• **Systems & Competitive Programming**: Deepen your DSA skills on platforms like LeetCode and learn design patterns.",
      intent: 'CAREER_GUIDANCE',
    };
  }

  if (cleaned.includes('how can i improve my resume') || cleaned.includes('improve resume') || cleaned.includes('resume tips')) {
    const tool = getRegisteredToolItem('resume-builder');
    return {
      reply:
        "**Actionable Tips to Improve Your Resume:**\n\n" +
        "1. **Use Impact Metrics**: Instead of *'Built an e-commerce site'*, write *'Developed responsive e-commerce app reducing checkout latency by 35%'*.\n" +
        "2. **Standard ATS Single-Column Layout**: Avoid multi-column graphics or non-standard tables that confuse parsing software.\n" +
        "3. **Strong Action Verbs**: Start every bullet with verbs like *Engineered, Optimized, Architected, Designed*.\n" +
        "4. **Tailor Keywords**: Match your technical skills section directly to role requirements (languages, frameworks, tools).",
      tools: tool ? [tool] : [],
      intent: 'CAREER_GUIDANCE',
    };
  }

  // -------------------------------------------------------------------------
  // 7. ADMIN ASSISTANCE (Server-Authoritative Check)
  // -------------------------------------------------------------------------
  if (cleaned.includes('admin') || cleaned.includes('control center') || cleaned.includes('navigation management')) {
    if (options?.isAdmin) {
      return {
        reply:
          "**Admin Portal Capabilities:**\n\n" +
          "As an authorized administrator, you have access to the **Admin Portal** (`/admin`):\n" +
          "• **Navigation & Tools** (`/admin/navigation`): Add, remove, and reorder Navbar and Mega Menu tools, and edit categories.\n" +
          "• **Feature Flags** (`/admin/features`): Toggle tools between ENABLED, DISABLED, and MAINTENANCE modes.\n" +
          "• **Platform Analytics** (`/admin/analytics`): Review genuine user traffic, tool adoption, and operational metrics.",
        suggestedAction: {
          label: 'Open Admin Portal',
          route: '/admin',
        },
        intent: 'ADMIN_GUIDANCE',
      };
    } else {
      return {
        reply:
          "Administrative controls and portal routes are strictly restricted to verified platform administrators. If you believe you should have admin access, please contact the administrator.",
        intent: 'ADMIN_ACCESS_RESTRICTED',
      };
    }
  }

  return null;
}

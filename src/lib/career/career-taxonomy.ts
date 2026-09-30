/**
 * Saarvi Canonical Career Taxonomy & Configuration
 * Study. Work. Grow.
 *
 * Centralized, authoritative directory of:
 * 1. Job Roles (categorized, searchable, popular flags)
 * 2. Academic Branches & Disciplines
 * 3. Industry Domains
 * 4. Geographic Locations (Metro, Tier-2, Regional, Remote)
 * 5. Experience Levels mapped to canonical ranges
 * 6. Work Modes & Employment Types
 */

export interface TaxonomyItem {
  id: string;
  name: string;
  category?: string;
  popular?: boolean;
  aliases?: string[];
}

export const CANONICAL_JOB_ROLES: TaxonomyItem[] = [
  // Software Development
  { id: "software-developer", name: "Software Developer", category: "Software Development", popular: true, aliases: ["SDE", "Programmer"] },
  { id: "frontend-developer", name: "Frontend Developer", category: "Software Development", popular: true, aliases: ["Frontend Engineer", "React Developer", "UI Developer"] },
  { id: "backend-developer", name: "Backend Developer", category: "Software Development", popular: true, aliases: ["Backend Engineer", "API Engineer", "Node Developer"] },
  { id: "full-stack-developer", name: "Full Stack Developer", category: "Software Development", popular: true, aliases: ["Full Stack Engineer", "MERN Developer"] },
  { id: "mobile-developer", name: "Mobile App Developer", category: "Software Development", aliases: ["Android Developer", "iOS Developer", "Flutter Developer"] },
  { id: "qa-engineer", name: "QA / Test Automation Engineer", category: "Software Development", aliases: ["SDET", "Automation Tester", "QA Analyst"] },

  // AI, Data & Analytics
  { id: "ai-engineer", name: "AI Engineer", category: "AI & Data", popular: true, aliases: ["Artificial Intelligence Engineer", "GenAI Engineer"] },
  { id: "ml-engineer", name: "Machine Learning Engineer", category: "AI & Data", popular: true, aliases: ["ML Engineer", "Deep Learning Engineer"] },
  { id: "data-scientist", name: "Data Scientist", category: "AI & Data", popular: true, aliases: ["Applied Scientist"] },
  { id: "data-analyst", name: "Data Analyst", category: "AI & Data", popular: true, aliases: ["BI Analyst", "Business Intelligence Analyst"] },

  // Cloud, DevOps & Security
  { id: "cloud-engineer", name: "Cloud Engineer", category: "Cloud & Infrastructure", aliases: ["AWS Engineer", "Azure Cloud Architect"] },
  { id: "devops-engineer", name: "DevOps Engineer", category: "Cloud & Infrastructure", popular: true, aliases: ["Site Reliability Engineer", "SRE", "Platform Engineer"] },
  { id: "cybersecurity-analyst", name: "Cybersecurity Analyst", category: "Cloud & Infrastructure", aliases: ["Security Engineer", "SOC Analyst", "Penetration Tester"] },

  // Core Engineering
  { id: "embedded-systems-engineer", name: "Embedded Systems Engineer", category: "Core Engineering", aliases: ["Firmware Engineer", "IoT Engineer"] },
  { id: "vlsi-design-engineer", name: "VLSI Design Engineer", category: "Core Engineering", aliases: ["Silicon Engineer", "Hardware Design Engineer"] },
  { id: "mechanical-design-engineer", name: "Mechanical Design Engineer", category: "Core Engineering", aliases: ["CAD Engineer", "SolidWorks Designer"] },
  { id: "civil-structural-engineer", name: "Structural Engineer", category: "Core Engineering", aliases: ["Civil Engineer", "Site Engineer"] },
  { id: "electrical-engineer", name: "Electrical Power Engineer", category: "Core Engineering", aliases: ["Power Systems Engineer"] },

  // Design, Product & Business
  { id: "ui-ux-designer", name: "UI/UX Designer", category: "Design & Product", popular: true, aliases: ["Product Designer", "User Experience Designer"] },
  { id: "product-manager", name: "Associate Product Manager", category: "Design & Product", aliases: ["APM", "Product Analyst"] },
  { id: "business-analyst", name: "Business Analyst", category: "Business & Management", popular: true, aliases: ["Operations Analyst", "Strategy Associate"] },
  { id: "financial-analyst", name: "Financial Analyst", category: "Business & Management", aliases: ["Finance Associate", "Investment Analyst"] },
];

export const CANONICAL_BRANCHES: TaxonomyItem[] = [
  // Engineering & Tech
  { id: "cse", name: "Computer Science & Engineering (CSE)", category: "Engineering", popular: true },
  { id: "ise", name: "Information Science & Engineering (ISE)", category: "Engineering", popular: true },
  { id: "aiml", name: "AI & Machine Learning (AIML)", category: "Engineering", popular: true },
  { id: "aids", name: "AI & Data Science (AI & DS)", category: "Engineering", popular: true },
  { id: "ece", name: "Electronics & Communication (ECE)", category: "Engineering", popular: true },
  { id: "eee", name: "Electrical & Electronics (EEE)", category: "Engineering" },
  { id: "mech", name: "Mechanical Engineering", category: "Engineering" },
  { id: "civil", name: "Civil Engineering", category: "Engineering" },
  { id: "chemical", name: "Chemical Engineering", category: "Engineering" },
  { id: "biotech", name: "Biotechnology Engineering", category: "Engineering" },

  // Commerce, Science & Management
  { id: "commerce", name: "Commerce & Accounting (B.Com / M.Com)", category: "Commerce" },
  { id: "management", name: "Management (BBA / MBA)", category: "Management" },
  { id: "bca-mca", name: "Computer Applications (BCA / MCA)", category: "Science & Tech", popular: true },
  { id: "bsc-msc", name: "Science (B.Sc / M.Sc)", category: "Science" },
  { id: "design", name: "Design & Creative Arts (B.Des)", category: "Design" },
  { id: "other", name: "Other / Interdisciplinary Discipline", category: "General" },
];

export const CANONICAL_DOMAINS: TaxonomyItem[] = [
  { id: "software-saas", name: "Software & SaaS", category: "Tech", popular: true },
  { id: "ai-ml", name: "AI & Machine Learning", category: "Tech", popular: true },
  { id: "data-science", name: "Data Science & Analytics", category: "Tech", popular: true },
  { id: "cybersecurity", name: "Cybersecurity", category: "Tech" },
  { id: "cloud-devops", name: "Cloud & DevOps", category: "Tech", popular: true },
  { id: "web-mobile", name: "Web & Mobile Development", category: "Tech", popular: true },
  { id: "fintech", name: "Fintech & Banking", category: "Business", popular: true },
  { id: "healthcare", name: "Healthcare & MedTech", category: "Science" },
  { id: "automotive-ev", name: "Automotive & Electric Vehicles", category: "Core" },
  { id: "manufacturing-robotics", name: "Manufacturing & Robotics", category: "Core" },
  { id: "infrastructure", name: "Construction & Infrastructure", category: "Core" },
  { id: "cleantech", name: "Renewable Energy & CleanTech", category: "Core" },
  { id: "edtech", name: "Education & EdTech", category: "Services" },
  { id: "design-media", name: "Design & Creative Media", category: "Design" },
];

export const CANONICAL_LOCATIONS: TaxonomyItem[] = [
  { id: "any-location", name: "Any location", popular: true },
  { id: "bengaluru", name: "Bengaluru", category: "Metro Tech Hub", popular: true, aliases: ["Bangalore"] },
  { id: "hyderabad", name: "Hyderabad", category: "Metro Tech Hub", popular: true },
  { id: "pune", name: "Pune", category: "Major Tech Hub", popular: true },
  { id: "mumbai", name: "Mumbai", category: "Financial Capital", popular: true },
  { id: "delhi-ncr", name: "Delhi / NCR", category: "National Capital", popular: true, aliases: ["Noida", "Gurugram", "Gurgaon"] },
  { id: "chennai", name: "Chennai", category: "Industrial & IT Hub", popular: true },
  { id: "kolkata", name: "Kolkata", category: "East Zone Hub" },
  { id: "bagalkot", name: "Bagalkot", category: "Karnataka Regional" },
  { id: "belagavi", name: "Belagavi", category: "Karnataka Regional", aliases: ["Belgaum"] },
  { id: "hubballi-dharwad", name: "Hubballi-Dharwad", category: "Karnataka Regional" },
  { id: "mysuru", name: "Mysuru", category: "Karnataka Regional", aliases: ["Mysore"] },
  { id: "kochi", name: "Kochi", category: "Kerala Tech Hub" },
  { id: "remote", name: "Remote (Work From Anywhere)", category: "Flexible", popular: true, aliases: ["WFH"] },
  { id: "india", name: "All India", category: "National" },
];

export const CANONICAL_EXPERIENCE_LEVELS = [
  { id: "all", label: "Any experience", minYears: 0, maxYears: 99 },
  { id: "fresher", label: "Fresher (0 yrs)", minYears: 0, maxYears: 0, popular: true },
  { id: "entry-level", label: "Entry-level (0–2 yrs)", minYears: 0, maxYears: 2, popular: true },
  { id: "mid-level", label: "Mid-level (2–5 yrs)", minYears: 2, maxYears: 5 },
  { id: "senior", label: "Senior (5+ yrs)", minYears: 5, maxYears: 99 },
];

export const CANONICAL_WORK_MODES = [
  { id: "all", label: "Any work mode" },
  { id: "remote", label: "Remote only", popular: true },
  { id: "hybrid", label: "Hybrid" },
  { id: "onsite", label: "On-site" },
];

export const CANONICAL_OPPORTUNITY_TYPES = [
  { id: "any", label: "Any opportunity", popular: true },
  { id: "job", label: "Job", popular: true },
  { id: "internship", label: "Internship", popular: true },
  { id: "training", label: "Training & Bootcamp", popular: true },
];

export const CANONICAL_SKILLS = [
  "React",
  "Node.js",
  "Python",
  "Java",
  "TypeScript",
  "JavaScript",
  "Next.js",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "AWS",
  "Docker",
  "Kubernetes",
  "Machine Learning",
  "Data Structures (DSA)",
  "C++",
  "Figma",
  "Tailwind CSS",
  "Git & GitHub",
  "Linux",
  "Power BI",
  "Excel",
  "Spring Boot",
  "FastAPI",
];

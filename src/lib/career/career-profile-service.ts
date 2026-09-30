/**
 * Saarvi Intelligent Career Profile & Guided Search Service 7.0
 * Study. Work. Grow.
 */

export interface CareerProfilePreferences {
  branch: string;
  roles: string[];
  domains: string[];
  opportunityTypes: ('jobs' | 'internships' | 'training' | 'apprenticeships')[];
  workMode: 'all' | 'remote' | 'hybrid' | 'onsite';
  location: string;
  experience: 'fresher' | '0-2' | '2-5' | '5+';
  graduationYear?: number;
  skills: string[];
  duration?: string;
  trainingMode?: 'all' | 'online' | 'offline' | 'hybrid';
  updatedAt?: string;
}

export const BRANCH_TAXONOMY = [
  'Computer Science & Engineering',
  'Information Science & Technology',
  'AI / Machine Learning & Data Science',
  'Electronics & Communication (ECE)',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical & Electronics (EEE)',
  'Chemical Engineering',
  'Commerce & Accounting',
  'Management & Business Administration',
  'Design & Architecture',
  'Arts & Humanities',
  'Other / Interdisciplinary',
];

export const ROLE_TAXONOMY: Record<string, string[]> = {
  'Computer Science & Engineering': [
    'Software Developer',
    'Frontend Developer',
    'Frontend Engineer',
    'Backend Engineer',
    'Full Stack Engineer',
    'Cloud / DevOps Engineer',
    'QA / Automation Engineer',
    'Mobile App Developer',
  ],
  'AI / Machine Learning & Data Science': [
    'Data Analyst',
    'Data Scientist',
    'Machine Learning Engineer',
    'AI Research Assistant',
    'Business Intelligence Analyst',
  ],
  'Electronics & Communication (ECE)': [
    'Embedded Systems Engineer',
    'VLSI Design Engineer',
    'IoT Solutions Engineer',
    'Hardware Design Engineer',
    'Telecom Systems Engineer',
  ],
  'Mechanical Engineering': [
    'Mechanical Design Engineer',
    'CAD / CAM Engineer',
    'Thermal Systems Engineer',
    'Manufacturing & Operations',
    'Automotive Design Engineer',
  ],
  'Civil Engineering': [
    'Structural Engineer',
    'Site Planning Engineer',
    'Geotechnical Engineer',
    'AutoCAD Civil Designer',
    'Project Estimator',
  ],
  'Electrical & Electronics (EEE)': [
    'Power Systems Engineer',
    'Control Systems Engineer',
    'Renewable Energy Analyst',
    'Electrical Maintenance Engineer',
  ],
  'Management & Business Administration': [
    'Product Management Intern',
    'Business Development Associate',
    'Operations Coordinator',
    'HR Generalist / Recruiter',
    'Marketing Specialist',
  ],
  'Commerce & Accounting': [
    'Financial Analyst',
    'Accountant / Auditor',
    'Tax Associate',
    'Investment Banking Analyst',
  ],
};

export const DOMAIN_TAXONOMY = [
  'AI & Machine Learning',
  'Software & SaaS',
  'Cybersecurity',
  'Cloud & Distributed Systems',
  'Automotive & EV',
  'Manufacturing & Robotics',
  'Construction & Infrastructure',
  'Fintech & Banking',
  'Healthcare & Medtech',
  'Renewable Energy & CleanTech',
  'Design & Creative Media',
  'Digital Marketing & Sales',
  'Education & EdTech',
];

export const SKILL_TAXONOMY = [
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Next.js',
  'Java',
  'C++',
  'SQL',
  'PostgreSQL',
  'AWS',
  'Docker',
  'AutoCAD',
  'SolidWorks',
  'MATLAB',
  'Embedded C',
  'Machine Learning',
  'Power BI',
  'Excel / Financial Modeling',
  'Figma',
  'Git / GitHub',
];

export const RELATED_ROLES_MAP: Record<string, string[]> = {
  'Software Developer': ['Frontend Engineer', 'Backend Engineer', 'Full Stack Engineer'],
  'Frontend Engineer': ['Software Developer', 'React Developer', 'Web Developer'],
  'Backend Engineer': ['Software Developer', 'API Engineer', 'Cloud Developer'],
  'Data Analyst': ['Business Intelligence Analyst', 'Data Scientist', 'SQL Specialist'],
  'Machine Learning Engineer': ['Data Scientist', 'AI Engineer', 'Python Developer'],
  'Mechanical Design Engineer': ['CAD / CAM Engineer', 'Mechanical Engineer', 'Automotive Design Engineer'],
  'Structural Engineer': ['Civil Engineer', 'Site Planning Engineer', 'AutoCAD Civil Designer'],
  'Embedded Systems Engineer': ['IoT Solutions Engineer', 'Firmware Engineer', 'Hardware Design Engineer'],
};

export class CareerProfileService {
  /**
   * Generates a normalized keyword search query from structured career preferences.
   */
  public static buildSearchQuery(prefs: Partial<CareerProfilePreferences> & {
    targetRole?: string;
    preferredLocation?: string;
  }): {
    q: string;
    location: string;
    remote: string;
    experience: string;
    employmentType: string;
    toString(): string;
    includes(str: string): boolean;
  } {
    const terms: string[] = [];

    const role = prefs.targetRole || (prefs.roles && prefs.roles[0]);
    if (role) {
      terms.push(role);
    } else if (prefs.branch) {
      terms.push(prefs.branch);
    }

    if (prefs.skills && prefs.skills.length > 0) {
      terms.push(prefs.skills.slice(0, 2).join(' '));
    }

    let remote = 'all';
    const mode = (prefs.workMode || '').toLowerCase();
    if (mode === 'remote') remote = 'remote';
    else if (mode === 'hybrid') remote = 'hybrid';
    else if (mode === 'onsite') remote = 'onsite';

    let exp = 'all';
    if (prefs.experience === 'fresher') exp = 'fresher';
    else if (prefs.experience === '0-2') exp = 'entry-level';

    let empType = 'all';
    if (prefs.opportunityTypes?.includes('internships') && !prefs.opportunityTypes?.includes('jobs')) {
      empType = 'internship';
    }

    const loc = prefs.preferredLocation || prefs.location || '';
    const locClean = loc !== 'Any Location' ? loc : '';

    return {
      q: terms.join(' ').trim(),
      location: locClean,
      remote,
      experience: exp,
      employmentType: empType,
      toString() {
        return `${this.q} ${this.location} ${this.remote}`.trim();
      },
      includes(searchStr: string) {
        return this.toString().toLowerCase().includes(searchStr.toLowerCase());
      },
    };
  }

  /**
   * Suggests deterministic related roles if the current role returned 0 results.
   */
  public static getRelatedRoles(roleOrBranch: string): string[] {
    if (!roleOrBranch) return [];
    const directMatch = RELATED_ROLES_MAP[roleOrBranch];
    if (directMatch) return directMatch;

    const term = roleOrBranch.toLowerCase();
    for (const [key, related] of Object.entries(RELATED_ROLES_MAP)) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes(term) || term.includes(keyLower)) {
        return related;
      }
    }

    // Match by word tokens (e.g. "mechanical")
    const words = term.split(/\s+/).filter((w) => w.length > 3);
    for (const [key, related] of Object.entries(RELATED_ROLES_MAP)) {
      const keyLower = key.toLowerCase();
      if (words.some((w) => keyLower.includes(w))) {
        return related;
      }
    }

    // Match by branch taxonomy
    for (const [branch, roles] of Object.entries(ROLE_TAXONOMY)) {
      const branchLower = branch.toLowerCase();
      if (branchLower.includes(term) || term.includes(branchLower) || words.some((w) => branchLower.includes(w))) {
        return roles;
      }
    }

    return [];
  }

  /**
   * Returns authoritative branches with their mapped engineering roles.
   */
  public static getEngineeringBranches(): { id: string; name: string; roles: string[] }[] {
    return BRANCH_TAXONOMY.map((b) => ({
      id: b.includes('Computer Science')
        ? 'CSE'
        : b.includes('Electronics')
        ? 'ECE'
        : b.includes('Mechanical')
        ? 'MECH'
        : b.includes('Civil')
        ? 'CIVIL'
        : b.includes('AI')
        ? 'AIML'
        : b.slice(0, 4).toUpperCase().trim(),
      name: b,
      roles: ROLE_TAXONOMY[b] || [],
    }));
  }
}

import { UniversityAcademicConfig } from "../types";
import { VTU_ACADEMIC_CONFIG } from "./vtu";

/**
 * Extensible University Academic Registry
 *
 * Implements O(1) university lookup and clean isolation between
 * institution-specific regulations and the core calculation engine.
 */
class UniversityRegistry {
  private universities: Map<string, UniversityAcademicConfig> = new Map();

  constructor() {
    this.register(VTU_ACADEMIC_CONFIG);
  }

  public register(config: UniversityAcademicConfig): void {
    if (!config || !config.id) {
      throw new Error("Cannot register invalid university configuration.");
    }
    this.universities.set(config.id.toUpperCase(), config);
  }

  public getUniversity(id: string): UniversityAcademicConfig | undefined {
    return this.universities.get(id.toUpperCase().trim());
  }

  public getAll(): UniversityAcademicConfig[] {
    return Array.from(this.universities.values());
  }

  public isSupported(id: string): boolean {
    return this.universities.has(id.toUpperCase().trim());
  }
}

export const universityRegistry = new UniversityRegistry();

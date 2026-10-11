/**
 * Career & Opportunity Discovery Workflow Adapter
 * Bridges conversational intent to the canonical Saarvi Career Search pipeline.
 *
 * Invariants:
 * 1. Supports full-time jobs, internships, training, or any opportunity.
 * 2. Text query is optional: structured requirements alone can execute search.
 * 3. Transparent match explanations per result without fabricating match percentages.
 * 4. Strictly prohibits automatic application submission: read-only discovery only without explicit confirmation.
 */

import {
  CareerSearchOrchestrator,
  type CareerSearchExecutionResult,
} from '../../career/career-search-orchestrator.ts';
import {
  type RawSearchInput,
  type OpportunityTypeEnum,
} from '../../career/career-search-intent.ts';

export interface CareerMatchExplanation {
  roleMatch: boolean;
  typeMatch: boolean;
  locationMatch: boolean;
  workModeMatch: boolean;
  skillsMatched: string[];
  explanationSummary: string;
}

export interface OpportunityRecommendation {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode?: string;
  opportunityType: string;
  url?: string;
  source: string;
  explanation: CareerMatchExplanation;
}

export class CareerSearchWorkflow {
  /**
   * Executes a safe, read-only career search using existing orchestrator.
   */
  public static async executeSearch(params: {
    query?: string;
    role?: string;
    location?: string;
    opportunityType?: 'JOB' | 'INTERNSHIP' | 'TRAINING' | 'any';
    workMode?: 'remote' | 'hybrid' | 'onsite';
    skills?: string[];
  }): Promise<{
    opportunities: OpportunityRecommendation[];
    total: number;
    sourcesSearched: string[];
    partialFailureMessage?: string;
    explanationText: string;
  }> {
    const rawInput: RawSearchInput = {
      q: params.query || null,
      role: params.role || null,
      location: params.location || null,
      opportunityType:
        params.opportunityType && params.opportunityType !== 'any'
          ? params.opportunityType
          : null,
      workMode: params.workMode || null,
      skills: params.skills || null,
    };

    const result: CareerSearchExecutionResult = await CareerSearchOrchestrator.search(rawInput, {
      limit: 5,
    });

    const recommendations: OpportunityRecommendation[] = (result.items || []).map((item) => {
      const skillsMatched: string[] = [];
      const itemTitle = (item.title || '').toLowerCase();
      const itemDesc = (item.description || '').toLowerCase();

      if (params.skills) {
        for (const skill of params.skills) {
          const sLower = skill.toLowerCase();
          if (itemTitle.includes(sLower) || itemDesc.includes(sLower)) {
            skillsMatched.push(skill);
          }
        }
      }

      const roleMatch = Boolean(
        !params.role ||
          itemTitle.includes(params.role.toLowerCase()) ||
          (item.domain && item.domain.toLowerCase().includes(params.role.toLowerCase()))
      );

      const locationMatch = Boolean(
        !params.location ||
          (item.location && item.location.toLowerCase().includes(params.location.toLowerCase())) ||
          item.remote
      );

      const workModeMatch = Boolean(
        !params.workMode ||
          (params.workMode === 'remote' && item.remote) ||
          (params.workMode === 'onsite' && !item.remote)
      );

      const reasons: string[] = [];
      if (roleMatch && params.role) reasons.push(`Matches target role: ${params.role}`);
      if (params.location && locationMatch) reasons.push(`Located in ${params.location}`);
      if (item.remote) reasons.push('Remote friendly');
      if (skillsMatched.length > 0) reasons.push(`Matching skills: ${skillsMatched.join(', ')}`);

      return {
        id: item.id,
        title: item.title,
        company: item.company,
        location: item.location || (item.remote ? 'Remote' : 'Various'),
        workMode: item.remote ? 'remote' : 'onsite',
        opportunityType: item.opportunityType || 'JOB',
        url: item.applyUrl,
        source: item.sourceAttribution || 'Saarvi Direct',
        explanation: {
          roleMatch,
          typeMatch: true,
          locationMatch,
          workModeMatch,
          skillsMatched,
          explanationSummary:
            reasons.length > 0
              ? reasons.join(' • ')
              : `Active verified ${item.opportunityType || 'opportunity'} matching your search criteria.`,
        },
      };
    });

    let explanationText = `Found ${result.total} real opportunities across Saarvi career sources.`;
    if (result.partialFailureMessage) {
      explanationText += ` Note: ${result.partialFailureMessage}`;
    }

    return {
      opportunities: recommendations,
      total: result.total,
      sourcesSearched: result.sourcesSearched,
      partialFailureMessage: result.partialFailureMessage,
      explanationText,
    };
  }

  /**
   * Generates next-step conversational follow-ups for discovered opportunities.
   */
  public static getOpportunityFollowUpChips(hasResults: boolean): string[] {
    if (!hasResults) {
      return [
        'Search Remote Roles',
        'Broaden to Any Opportunity',
        'Change Location',
      ];
    }

    return [
      'Tailor my resume for this role',
      'Analyze skill gaps',
      'Filter for remote only',
    ];
  }
}

/**
 * DocEase Phase 27: Centralized Analytics Event Taxonomy.
 * Strict Privacy Invariant:
 * Zero document contents, binary file buffers, full AI prompts, private marks,
 * passwords, or personal identifying credentials are ever permitted.
 */

import { ErrorCategory } from '@/lib/observability/errors';

export type RouteCategory = 'public' | 'tool' | 'student' | 'auth' | 'dashboard' | 'admin';

export type FileCountBucket = '1' | '2-5' | '6+';
export type FileSizeBucket = '<1MB' | '1-5MB' | '5-20MB' | '>20MB';
export type DurationBucket = '<500ms' | '500ms-2s' | '2s-10s' | '>10s';
export type ResultCountBucket = '0' | '1-5' | '6+';

export interface BaseAnalyticsEvent {
  timestamp?: string;
  sessionId?: string;
  category?: RouteCategory;
}

export interface RouteLoadedEvent extends BaseAnalyticsEvent {
  name: 'route_loaded';
  route: string;
  routeCategory: RouteCategory;
  durationMs?: number;
}

export interface ToolStartedEvent extends BaseAnalyticsEvent {
  name: 'tool_started';
  toolId: string;
  toolCategory: string;
  fileCountBucket?: FileCountBucket;
  fileSizeBucket?: FileSizeBucket;
}

export interface ToolCompletedEvent extends BaseAnalyticsEvent {
  name: 'tool_completed';
  toolId: string;
  durationMs: number;
  durationBucket: DurationBucket;
  inputType?: string;
  outputType?: string;
}

export interface ToolFailedEvent extends BaseAnalyticsEvent {
  name: 'tool_failed';
  toolId: string;
  durationMs: number;
  errorCategory: ErrorCategory;
  sanitizedMessage: string;
}

export interface DownloadStartedEvent extends BaseAnalyticsEvent {
  name: 'download_started';
  toolId: string;
  format: string;
}

export interface DownloadCompletedEvent extends BaseAnalyticsEvent {
  name: 'download_completed';
  toolId: string;
  durationMs: number;
}

export interface SearchOpenedEvent extends BaseAnalyticsEvent {
  name: 'search_opened';
  trigger: 'shortcut' | 'button' | 'navbar';
}

export interface SearchUsedEvent extends BaseAnalyticsEvent {
  name: 'search_used';
  searchCategory: string;
  resultCountBucket: ResultCountBucket;
  durationMs: number;
  selectedResultType?: string;
  // NOTE: Zero raw search query text is collected to maintain local search privacy
}

export interface AIRequestStartedEvent extends BaseAnalyticsEvent {
  name: 'ai_request_started';
  feature: string;
  provider: string;
  model?: string;
}

export interface AIRequestCompletedEvent extends BaseAnalyticsEvent {
  name: 'ai_request_completed';
  feature: string;
  provider: string;
  model?: string;
  durationMs: number;
  tokenBucket?: string;
}

export interface AIRequestFailedEvent extends BaseAnalyticsEvent {
  name: 'ai_request_failed';
  feature: string;
  provider: string;
  durationMs: number;
  errorCategory: ErrorCategory;
}

export interface NotificationScheduledEvent extends BaseAnalyticsEvent {
  name: 'notification_scheduled';
  channel: string;
  timingType: string;
}

export interface NotificationSentEvent extends BaseAnalyticsEvent {
  name: 'notification_sent';
  channel: string;
  latencyMs: number;
}

export interface NotificationFailedEvent extends BaseAnalyticsEvent {
  name: 'notification_failed';
  channel: string;
  errorCategory: ErrorCategory;
}

export interface RateLimitedEvent extends BaseAnalyticsEvent {
  name: 'rate_limited';
  endpoint: string;
  clientCategory: string;
}

export interface AuthMethodSelectedEvent extends BaseAnalyticsEvent {
  name: 'auth_method_selected';
  method: 'google' | 'password';
}

export interface AuthSuccessEvent extends BaseAnalyticsEvent {
  name: 'auth_success';
  method: 'google' | 'password';
}

export type AnalyticsEvent =
  | RouteLoadedEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | ToolFailedEvent
  | DownloadStartedEvent
  | DownloadCompletedEvent
  | SearchOpenedEvent
  | SearchUsedEvent
  | AIRequestStartedEvent
  | AIRequestCompletedEvent
  | AIRequestFailedEvent
  | NotificationScheduledEvent
  | NotificationSentEvent
  | NotificationFailedEvent
  | RateLimitedEvent
  | AuthMethodSelectedEvent
  | AuthSuccessEvent;

export const VALID_EVENT_NAMES = new Set<string>([
  'route_loaded',
  'tool_started',
  'tool_completed',
  'tool_failed',
  'download_started',
  'download_completed',
  'search_opened',
  'search_used',
  'ai_request_started',
  'ai_request_completed',
  'ai_request_failed',
  'notification_scheduled',
  'notification_sent',
  'notification_failed',
  'rate_limited',
  'auth_method_selected',
  'auth_success',
]);

export const PROHIBITED_KEYS = new Set<string>([
  'password',
  'secret',
  'token',
  'auth',
  'bearer',
  'apikey',
  'api_key',
  'credit_card',
  'cvv',
  'cvc',
  'filebytes',
  'pdfbytes',
  'documentbytes',
  'buffer',
  'blob',
  'rawprompt',
  'prompt',
  'response',
  'rawresponse',
  'marks',
  'studentmarks',
  'sgpa',
  'cgpa',
  'email',
  'phonenumber',
  'phone',
  'query', // Raw search queries are strictly prohibited from analytics
]);

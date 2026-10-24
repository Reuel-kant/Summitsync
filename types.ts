
export type UserRole = 'Lead' | 'Manager' | 'Scanner' | 'Exhibitor';

export interface User {
  id: string;
  email: string;
  organization: string;
  password?: string;
  isAdmin?: boolean;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface EventSession {
  id: string;
  event_id: string;
  title: string;
  speaker: string;
  location: string;
  starts_at: string;
}

export interface EventTenant {
  id: string;
  owner_id: string;
  name: string;
  client_name: string; 
  slug: string;
  brand_config: BrandConfig;
  created_at: string;
  isCloudSynced?: boolean;
  activeRole?: UserRole;
}

export type ParticipantStatus = string;

export interface ParticipantProfile {
  id?: string;
  event_id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  category: string;
  location: string;
  status?: ParticipantStatus;
  linkedin_url?: string;
  bio?: string;
  is_high_priority?: boolean;
  assets_collected?: string[]; 
  networking_dna?: {
    icebreaker: string;
    target_industries: string[];
    summary: string;
  };
  customData?: Record<string, string>;
}

export interface AttendanceRecord {
  id?: string;
  event_id: string;
  participant_id: string;
  session_id?: string;
  name: string;
  email?: string;
  company?: string;
  category?: string;
  gender?: string;      // from participants.gender
  location?: string;    // from participants.location (registered city/country)
  timestamp: string;
  date?: string;
  geo: string;          // GPS coordinates captured at scan time
  terminal_id: string;
  synced: boolean;
  aiWelcome?: string;
}

export type BadgeTemplateId = 'modern' | 'executive' | 'minimal' | 'industrial' | 'generative' | 'custom';

export interface AIGenerativeStyle {
  layoutType: 'split' | 'centered' | 'sidebar' | 'banner';
  fontPairing: 'modern' | 'luxury' | 'technical' | 'bold';
  backgroundPattern: 'mesh' | 'dots' | 'geometric' | 'none';
  borderRadius: string;
  borderWeight: string;
  shadowIntensity: 'soft' | 'hard' | 'none';
  accentPosition: 'top' | 'bottom' | 'left' | 'none';
}

export interface BrandConfig {
  eventName?: string;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor?: string;
  quaternaryColor?: string;
  customBackgroundUrl?: string;
  customFontBase64?: string;
  customFontFamily?: string;
  logoUrls: string[];
  slogan?: string;
  templateId: BadgeTemplateId;
  activeCustomFields: string[]; 
  qrFields: string[];
  generativeStyle?: AIGenerativeStyle;
}

export interface AppConfig {
  brand: BrandConfig;
  features: {
    voiceGreeting: boolean;
    captureLocation: boolean;
    requireSelfie: boolean;
    cloudSync: boolean;
  };
  terminalName: string;
}

export type BadgeSize = 'standard-id' | 'conference-large';

// ── Registration Form Types ─────────────────────────────────────────────────

export type FormFieldType =
  | 'text' | 'email' | 'phone' | 'textarea'
  | 'select' | 'radio' | 'checkbox_group';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];          // for select / radio / checkbox_group
  // Which participants column this maps to (undefined = goes into custom_data)
  mapsTo?: 'name' | 'email' | 'phone' | 'company' | 'location' | 'gender' | 'category' | 'bio';
}

export interface FormSettings {
  title: string;
  description: string;
  successMessage: string;
  closeDate?: string;          // ISO date string, optional
  requireGender: boolean;
}

export interface RegistrationForm {
  id: string;
  event_id: string;
  fields: FormField[];
  settings: FormSettings;
  is_active: boolean;
  created_at: string;
}

// ── Communication Types ─────────────────────────────────────────────────────

export type RecipientFilter =
  | { type: 'all' }
  | { type: 'category'; value: string }
  | { type: 'session'; sessionId: string };

export interface Communication {
  id: string;
  event_id: string;
  subject: string;
  body_template: string;
  recipient_filter: RecipientFilter;
  sent_count: number;
  failed_count: number;
  status: 'draft' | 'sending' | 'sent' | 'partial';
  created_at: string;
}

export interface GoogleSheetConfig {
  apiKey: string;
  spreadsheetId: string;
  range: string;
}

export interface FieldMapping {
  name: string;
  email: string;
  phone: string;
  gender: string;
  location: string;
}

export interface IntegrationRecord {
  id: string;
  data: Record<string, any>;
}

export const DEFAULT_BRAND: BrandConfig = {
  eventName: "New Event",
  primaryColor: "#10b981",
  secondaryColor: "#0f172a",
  tertiaryColor: "#3b82f6",
  quaternaryColor: "#f59e0b",
  slogan: "Innovate. Connect. Lead.",
  templateId: 'modern',
  activeCustomFields: [],
  logoUrls: [],
  qrFields: ['name', 'company', 'category'],
  generativeStyle: {
    layoutType: 'centered',
    fontPairing: 'modern',
    backgroundPattern: 'mesh',
    borderRadius: '2rem',
    borderWeight: '0px',
    shadowIntensity: 'soft',
    accentPosition: 'top'
  }
};

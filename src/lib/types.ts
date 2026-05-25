
import { z } from 'zod';
// Diagnostic Check


// AI Ad Copy Generator Schemas
export const AdCopyInputSchema = z.object({
  campaignType: z.enum(['search', 'pmax']).describe('The type of campaign to generate assets for.'),
  productDescription: z.string().describe('A detailed description of the product or service being advertised.'),
  targetAudience: z.string().describe('A description of the ideal customer or target a-udience.'),
  tone: z.string().describe('The desired tone for the ad copy (e.g., Professional, Witty, Urgent, Playful).'),
  businessName: z.string().optional().describe('The name of the business (required for PMax).'),
  language: z.enum(['english', 'dutch']).describe('The language for the ad copy.'),
  callToAction: z.string().describe('The call to action to be included in the ad copy.'),
});
export type AdCopyInput = z.infer<typeof AdCopyInputSchema>;

export const SearchAdCopyOutputSchema = z.object({
  keywords: z.array(z.string()).describe('A list of 15-20 highly relevant keywords.'),
  adCopy: z.object({
    headlines: z.array(z.string()).describe('A list of 15 compelling headlines, each 30 characters or less.'),
    descriptions: z.array(z.string()).describe('A list of 4 detailed descriptions, each 90 characters or less.'),
  }).describe('A structured set of ad copy elements.'),
});
export type SearchAdCopyOutput = z.infer<typeof SearchAdCopyOutputSchema>;


export const PMaxAdCopyOutputSchema = z.object({
  keywords: z.array(z.string()).describe('A list of 10-15 broad match keywords to use as search themes.'),
  adCopy: z.object({
    headlines: z.array(z.string()).describe('A list of 15 compelling headlines, each 30 characters or less.'),
    longHeadlines: z.array(z.string()).describe('A list of 5 compelling long headlines, each 90 characters or less.'),
    descriptions: z.array(z.string()).describe('A list of 5 detailed descriptions, each 90 characters or less.'),
  }).describe('A structured set of ad copy elements for Performance Max.'),
  imagePrompts: z.array(z.string()).describe('A list of 3-5 creative prompts for generating images for the campaign.'),
  callToAction: z.string().describe('A suggested call to action from a standard list (e.g., "Shop Now", "Learn More").'),
});
export type PMaxAdCopyOutput = z.infer<typeof PMaxAdCopyOutputSchema>;


export type Task = {
  id: string;
  description: string;
  completed?: boolean;
};

export type Checklist = {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  schedule: 'daily' | 'weekly' | 'monthly';
};

export type ChecklistTemplate = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  tasks: { id: string; description: string }[];
}


export type Service = {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  baseHours?: number;
  deliverables?: string[];
  onboardingFee?: number;
};

export type ServicePackage = {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  services: {
    serviceId: string;
    serviceName: string;
    hours: number;
  }[];
  packageDiscount?: number;
};

export type Client = {
  id: string;
  name: string;
  company: string;
  status: 'active' | 'inactive';
  checklistId: string | null;
};

export type AppUser = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'employee' | 'pending';
  managerId?: string;
};

export type ParentClient = {
  id:string;
  ownerId: string;
  clientType: 'agency' | 'freelancer';
  clientName: string;
  clientContactPerson: string;
  clientContactEmail: string;
  clientUserEmail: string;
  clientWebsite?: string;
  logoUrl?: string;
  brandColors?: {
    primary?: string;
    secondary?: string;
  };
  internalNotes?: string;
  hourlyRate?: number;
};

export type ConnectedChecklist = {
  checklistId: string;
  startDate: string; // ISO string
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-off';
  lastRunAt?: string; // ISO string for when the last run was completed
  skipCount?: number;
};

export type ConnectedService = {
  serviceId: string;
  serviceName: string;
  hours: number;
};

export type ConnectedPackage = {
  packageId: string;
  packageName: string;
};

export type ChildAccount = {
  id: string;
  ownerId: string;
  parentClientId: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  nickname: string;
  googleAdsClientId: string;
  googleAdsAccountName: string;
  fixedHours?: number;
  monthlyClickBudget?: number;
  primaryGoal: 'lead_generation' | 'ecommerce_sales' | 'brand_awareness' | 'app_installs' | 'other';
  kpisToTrack: string[];
  customKpis?: string[];
  targetKpiValues?: { kpi: string; target: number }[];
  connectedChecklists?: ConnectedChecklist[];
  connectedServices?: ConnectedService[];
  connectedPackages?: ConnectedPackage[];
  checklistStatus?: 'due' | 'in_progress' | 'complete';
  pendingTodoIds?: string[];
  kpiDataIds?: string[];
  checklistRunIds?: string[];
  todoRunIds?: string[];
  reportIds?: string[];
  isPaused?: boolean;
  accountGoal?: { id: string; value: string };
  currency?: { id: string; symbol: string };
  timeZone?: { id: string; offset: string };
  
  // -- Multi-Platform Advertising Setup Fields --
  totalMonthlyBudget?: number;
  
  // Google Ads Specifics
  googleAdsBudget?: number;
  googleAdsKpis?: string[];
  googleAdsContext?: string;
  
  // Meta Ads Specifics
  metaAdsAccountId?: string;
  metaAdsAccountName?: string;
  metaBusinessManagerId?: string;
  metaPixelId?: string;
  metaAdsBudget?: number;
  metaAdsKpis?: string[];
  metaAdsContext?: string;
};

export type ChecklistRunTask = {
  taskId: string;
  description: string;
  completed: boolean;
  notes: string;
}

export type ChecklistRun = {
  id: string;
  ownerId: string;
  childAccountId: string;
  parentClientId: string;
  checklistId: string;
  status: 'in_progress' | 'complete' | 'skipped';
  runAt: any; // Can be Date or Timestamp
  completedAt?: any; // Can be Date or Timestamp
  durationSeconds?: number;
  completedByName?: string;
  tasks: ChecklistRunTask[];
}

export type KpiData = {
    id: string;
    ownerId: string;
    childAccountId: string;
    periodType: 'monthly';
    startDate: string; // ISO string
    kpiValues: Record<string, number>;
}

export type Todo = {
  id: string;
  userId: string;
  parentClientId: string;
  parentClientName: string;
  childAccountId: string;
  childAccountNickname: string;
  content: string;
  completed: boolean;
  createdAt: string; // ISO string
  dueDate?: string; // ISO string
  completedAt?: string; // ISO string - for completed todos from runs
};

export type TodoRun = {
  id: string;
  ownerId: string;
  parentClientId: string;
  childAccountId: string;
  todoId: string;
  content: string;
  completedAt: Date;
};

export type KeyInsight = {
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    category: string;
}

export type MonthlyReport = {
    id: string;
    ownerId: string;
    childAccountId: string;
    parentClientId: string;
    period: string; // e.g., '2024-07'
    status: 'draft' | 'finalized' | 'sent' | 'confirmed' | 'skipped';
    generatedAt: string; // ISO string
    kpiDataSnapshotId: string;
    completedTodoRunIds: string[];
    completedChecklistRunIds: string[];
    campaignDataSnapshot?: AccountCampaignData;
    aiSummary: string;
    keyInsights: KeyInsight[];
    privateNotes?: string;
    nextSteps?: string[];
    lastEmailedAt?: string;
}

export type ProjectMilestone = {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
};

export type Project = {
  id: string;
  ownerId: string;
  parentClientId: string;
  childAccountId?: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold';
  startDate: string;
  endDate?: string;
  milestones: ProjectMilestone[];
  budget?: number;
};

export type TimeEntry = {
  id: string;
  ownerId: string;
  parentClientId: string;
  childAccountId?: string; // Optional specific child account
  date: string; // ISO string
  durationMinutes: number;
  description: string;
  hourlyRateAtTime: number;
};

export type CampaignPerformance = {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  cost: number;
  conversions: number;
  costPerConversion: number;
  conversionsValue: number;
  ctr: number;
  roas: number;
  searchImpressionShare?: number;
};

export type AccountCampaignData = {
  id?: string;
  childAccountId: string;
  period: string;
  lastSyncedAt: string;
  campaigns: CampaignPerformance[];
  totals: Omit<CampaignPerformance, 'id' | 'name' | 'status'>;
};

// --- Campaign Briefing Generator Types ---

export const KeywordIdeaSchema = z.object({
  text: z.string(),
  avgMonthlySearches: z.number().optional(),
  competition: z.string().optional(),
  competitionIndex: z.number().optional(),
  lowCpc: z.number().optional(),
  highCpc: z.number().optional(),
});
export type KeywordIdea = z.infer<typeof KeywordIdeaSchema>;

export const CategorizedThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  keywords: z.array(z.string()),
});
export type CategorizedTheme = z.infer<typeof CategorizedThemeSchema>;

export const BriefingContextSchema = z.object({
  parentClientId: z.string().optional(),
  childAccountId: z.string().optional(),
  clientName: z.string(),
  clientEmail: z.string().email().optional(),
  website: z.string(),
  industry: z.string(),
  primaryGoals: z.string(),
  targetAudience: z.string(),
  tone: z.string().optional(),
  language: z.enum(['english', 'dutch']),
  rawNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
  // Strategic Inputs
  monthlyBudget: z.string().optional(),
  campaignTypes: z.array(z.string()).optional(),
  desiredCampaignCount: z.number().optional(),
  budgetDistributionPreference: z.string().optional(),
  bidStrategyPreference: z.string().optional(),
  focusProducts: z.string().optional(),
  competitors: z.string().optional(),
  // New Fields
  targetLocations: z.string().optional(),
  targetLanguages: z.string().optional(),
  usps: z.string().optional(),
  offer: z.string().optional(),
  marketingHook: z.string().optional(),
  primaryConversion: z.string().optional(),
  primaryCta: z.string().optional(),
  negativeKeywordsBase: z.string().optional(),
  negativeKeywords: z.array(z.string()).optional(),
  conversionValue: z.string().optional(),
  budgetSplitSearch: z.number().optional(),
  budgetSplitPmax: z.number().optional(),
  biddingStrategySearch: z.string().optional(),
  biddingStrategyPmax: z.string().optional(),
  selectedKeywords: z.array(KeywordIdeaSchema).optional(),
  fetchedKeywordIdeas: z.array(KeywordIdeaSchema).optional(),
  keywordThemes: z.array(CategorizedThemeSchema).optional(),
});
export type BriefingContext = z.infer<typeof BriefingContextSchema>;

export const CampaignStructureOutputSchema = z.object({
  campaigns: z.array(z.object({
    id: z.string(), // Client-side temp ID
    name: z.string(),
    type: z.enum(['search', 'pmax']),
    objective: z.string(),
    suggestedBudget: z.string(),
    rationale: z.string(),
    adGroupSuggestions: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })).optional(),
  })),
  budgetAllocation: z.object({
    searchBudget: z.string(),
    pmaxBudget: z.string(),
    totalBudget: z.string(),
    rationale: z.string(),
  }).optional(),
  bidStrategy: z.object({
    phases: z.array(z.object({
      name: z.string(),
      description: z.string(),
    })),
    note: z.string().optional(),
  }).optional(),
  kpis: z.array(z.object({
    name: z.string(),
    value: z.string(),
    note: z.string().optional(),
  })).optional(),
  tracking: z.array(z.object({
    goal: z.string(),
    method: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })).optional(),
  timeline: z.array(z.object({
    dateRange: z.string(),
    milestone: z.string(),
    tasks: z.array(z.string()),
  })).optional(),
});
export type CampaignStructureOutput = z.infer<typeof CampaignStructureOutputSchema>;

export const AdGroupOutputSchema = z.object({
  adGroups: z.array(z.object({
    id: z.string(), // Client-side temp ID
    name: z.string(),
    keywords: z.array(z.string()).optional(), // For Search
    headlines: z.array(z.string()),
    longHeadlines: z.array(z.string()).optional(), // For PMax
    descriptions: z.array(z.string()),
    imagePrompts: z.array(z.string()).optional(), // For PMax
    callToAction: z.string().optional(),
    negativeKeywords: z.array(z.string()).optional(),
    extensions: z.object({
      sitelinks: z.array(z.object({ title: z.string(), description: z.string() })),
      callouts: z.array(z.string()),
      leadForm: z.object({ title: z.string(), fields: z.array(z.string()) }).optional(),
    }).optional(),
    audienceSignals: z.object({
      customIntent: z.array(z.string()),
      inMarket: z.array(z.string()),
      customerMatch: z.array(z.string()),
      demographics: z.string(),
    }).optional(),
  })),
});
export type AdGroupOutput = z.infer<typeof AdGroupOutputSchema>;

export const GenerateAdGroupsInputSchema = z.object({
  context: BriefingContextSchema,
  campaign: z.object({
    name: z.string(),
    type: z.enum(['search', 'pmax']),
    objective: z.string(),
  }),
  existingAdGroups: z.array(z.string()).optional(),
});

export type GenerateAdGroupsInput = z.infer<typeof GenerateAdGroupsInputSchema>;
export const AdGroupSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })),
});
export type AdGroupSuggestion = z.infer<typeof AdGroupSuggestionSchema>;

export const GenerateSingleAdGroupInputSchema = z.object({
  context: BriefingContextSchema,
  campaign: z.object({
    name: z.string(),
    type: z.enum(['search', 'pmax']),
    objective: z.string(),
  }),
  adGroupTitle: z.string(),
  adGroupDescription: z.string(),
  providedKeywords: z.array(z.string()).optional(),
});
export type GenerateSingleAdGroupInput = z.infer<typeof GenerateSingleAdGroupInputSchema>;


export type AdGroupBriefing = {
  id: string;
  name: string;
  keywords?: string[];
  metrics?: {
    searchVolume: number;
    avgCpc: number;
  };
  headlines: string[];
  longHeadlines?: string[];
  descriptions: string[];
  imagePrompts?: string[];
  callToAction?: string;
  negativeKeywords?: string[];
  extensions?: {
    sitelinks: { title: string; description: string }[];
    callouts: string[];
    leadForm?: { title: string; fields: string[] };
  };
  audienceSignals?: {
    customIntent: string[];
    inMarket: string[];
    customerMatch: string[];
    demographics: string;
  };
};

export type BudgetAllocation = {
  searchBudget: string;
  pmaxBudget: string;
  totalBudget: string;
  rationale: string;
};

export type BidStrategyPhase = {
  name: string;
  description: string;
};

export type KPI = {
  name: string;
  value: string;
  note?: string;
};

export type TrackingGoal = {
  goal: string;
  method: string;
  priority: 'high' | 'medium' | 'low';
};

export type TimelineStep = {
  dateRange: string;
  milestone: string;
  tasks: string[];
};

export type CampaignBriefing = {
  id: string;
  name: string;
  type: 'search' | 'pmax';
  objective: string;
  suggestedBudget: string;
  rationale: string;
  adGroups: AdGroupBriefing[];
  negativeKeywords?: string[]; // Campaign-level negatives
  adGroupSuggestions?: { title: string; description: string }[];
};

export type Briefing = {
  id: string;
  ownerId: string;
  childAccountId?: string; // Optional link to existing account
  title: string;
  context: BriefingContext;
  campaigns: CampaignBriefing[];
  budgetAllocation?: BudgetAllocation;
  bidStrategy?: {
    phases: BidStrategyPhase[];
    note?: string;
  };
  kpis?: KPI[];
  tracking?: TrackingGoal[];
  timeline?: TimelineStep[];
  status: 'draft' | 'approved';
  shareToken: string;
  createdAt: string;
  updatedAt: string;
};

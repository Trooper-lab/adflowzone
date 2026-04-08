
import { z } from 'zod';

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
};

export type ConnectedChecklist = {
  checklistId: string;
  startDate: string; // ISO string
  frequency: 'daily' | 'weekly' | 'monthly' | 'one-off';
  lastRunAt?: string; // ISO string for when the last run was completed
  skipCount?: number;
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
  managementFee?: {
    amount: number;
    frequency: 'monthly';
  };
  monthlyClickBudget?: number;
  primaryGoal: 'lead_generation' | 'ecommerce_sales' | 'brand_awareness' | 'app_installs' | 'other';
  kpisToTrack: string[];
  customKpis?: string[];
  targetKpiValues?: { kpi: string; target: number }[];
  connectedChecklists?: ConnectedChecklist[];
  checklistStatus?: 'due' | 'in_progress' | 'complete';
  pendingTodoIds?: string[];
  kpiDataIds?: string[];
  checklistRunIds?: string[];
  todoRunIds?: string[];
  reportIds?: string[];
  isPaused?: boolean;
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

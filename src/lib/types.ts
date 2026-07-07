export interface NewsletterItem {
  title: string;
  summary: string;
  tag: string;
  url: string;
  imageUrl: string;
  imageAlt: string;
}

export interface NewsletterSection {
  title: string;
  items: NewsletterItem[];
}

export interface InternalNewsMeme {
  enabled: boolean;
  imageUrl?: string;
  imageAlt?: string;
  prompt?: string;
  imageBase64?: string;
  error?: string;
}

export interface NewsletterDraft {
  month: string;
  subject: string;
  draftSubject: string;
  preheader: string;
  intro: string;
  clarificationNeeded: boolean;
  clarificationQuestion: string;
  sections: NewsletterSection[];
  internalNewsMeme?: InternalNewsMeme;
}

export interface GenerationStep {
  name: string;
  status: "pending" | "running" | "done" | "error";
  message?: string;
}

export interface JobState {
  id: string;
  status: "pending" | "running" | "done" | "error";
  steps: GenerationStep[];
  previewKey?: string;
  error?: string;
}

export interface PreviewState {
  key: string;
  html: string;
  text: string;
  subject: string;
  preheader: string;
  structured: NewsletterDraft;
  approvalVersion: number;
  createdAt: Date;
  updatedAt: Date;
  status: "reviewing" | "sent";
  sentAt?: Date;
  brevoCampaignId?: number;
  testEmailSentAt?: Date;
  testEmailTo?: string;
}

export interface PipelineInput {
  jobId: string;
  sourceText: string;
  pdfFiles: Array<{ buffer: Buffer; name: string }>;
  openAiApiKey: string;
  lumaExternalKey: string;
  lumaInternalKey: string;
  brevoApiKey: string;
  nutrientApiKey?: string;
}

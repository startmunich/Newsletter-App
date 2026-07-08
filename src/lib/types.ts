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

export interface GeneratedImage {
  prompt: string;
  imageBase64?: string;
  type: "meme" | "normal";
}

export interface CoverImage {
  prompt: string;
  imageBase64: string;
  index: number; // 0, 1, or 2
}

export interface InternalNewsMeme {
  enabled: boolean;
  images?: GeneratedImage[];
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
  coverImages?: CoverImage[]; // 3 generated cover images for user selection
  selectedCoverImageIndex?: number; // 0, 1, or 2 - which image is selected
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
  sentTo?: string[]; // Array of email addresses sent to
  sentRecipientCount?: number; // Number of recipients
  monthGenerated?: string; // Month this newsletter is for
}

export interface PipelineInput {
  jobId: string;
  sourceText: string;
  meetingTranscript: string;
  pdfFiles: Array<{ buffer: Buffer; name: string }>;
  openAiApiKey: string;
  lumaExternalKey: string;
  lumaInternalKey: string;
  brevoApiKey: string;
  nutrientApiKey?: string;
}

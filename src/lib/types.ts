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

/**
 * Full, editable news state per section. Stores every extracted news item
 * (including deselected ones) together with the user's ordering and
 * inclusion choice. The rendered newsletter is derived from this by keeping
 * only `included` items, in array order, back into `sections[].items`.
 */
export interface NewsSelectionItem extends NewsletterItem {
  included: boolean;
}

export interface NewsSelectionSection {
  title: string;
  items: NewsSelectionItem[];
}

export interface GeneratedImage {
  prompt: string;
  imageBase64?: string;
  type: "meme" | "normal";
}

export interface CoverImage {
  prompt: string;
  imageBase64: string;
  imageUrl?: string;
  index: number; // position of the news item this image represents
  label?: string; // short title of the news story this image represents
}

export interface CoverImageJob {
  id: string;
  previewKey: string;
  status: "pending" | "running" | "done" | "error";
  prompt: string;
  images: CoverImage[];
  error?: string;
}

export interface InternalNewsMeme {
  enabled: boolean;
  images?: GeneratedImage[];
  error?: string;
}

export interface AlphaNotice {
  enabled: boolean;
  text: string;
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
  alphaNotice?: AlphaNotice;
  internalNewsMeme?: InternalNewsMeme;
  coverImages?: CoverImage[]; // one generated cover image per news item, for user selection
  selectedCoverImageIndex?: number; // which generated image is selected as the cover
  showCoverImageTitle?: boolean; // show the selected cover image's title below it in the newsletter (default true)
  /**
   * Complete news state (all items, their order, and inclusion flags) as
   * managed in the overview "News" panel. The rendered `sections` are derived
   * from this. Absent for older drafts, in which case it is initialized from
   * `sections` (everything included, existing order).
   */
  newsSelection?: NewsSelectionSection[];
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
  name?: string; // custom display name (editable by user)
  sentAt?: Date;
  brevoCampaignId?: number;
  testEmailSentAt?: Date;
  testEmailTo?: string;
  sentTo?: string[];
  sentRecipientCount?: number;
  sentBatches?: string[]; // member batches the newsletter was sent to
  monthGenerated?: string;
  coverImageJobId?: string; // background job ID for initial auto-generation
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

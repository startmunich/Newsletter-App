import { JobState, GenerationStep, PreviewState, CoverImageJob, CoverImage } from "./types";
import { nocoGetAll, nocoCreate, nocoUpdate, nocoDelete, nocoUploadAttachment, NocoAttachment } from "./nocodb";

class Store {
  private jobs: Map<string, JobState> = new Map();
  private coverImageJobs: Map<string, CoverImageJob> = new Map();

  // In-memory cache: key -> { data: PreviewState; rowId?: number }
  private previewCache: Map<string, { data: PreviewState; rowId?: number }> = new Map();
  private cacheInitPromise: Promise<void> | null = null;

  private ensureCache(): Promise<void> {
    if (!this.cacheInitPromise) {
      this.cacheInitPromise = this.loadCache();
    }
    return this.cacheInitPromise;
  }

  private async loadCache(): Promise<void> {
    try {
      const records = await nocoGetAll();
      for (const { rowId, preview } of records) {
        this.previewCache.set(preview.key, { data: preview, rowId });
      }
    } catch (err) {
      console.error("Store: Failed to load from NocoDB, using empty cache:", err);
    }
  }

  createJob(id: string): JobState {
    const job: JobState = {
      id,
      status: "pending",
      steps: [],
    };
    this.jobs.set(id, job);
    return job;
  }

  getJob(id: string): JobState | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: string, update: Partial<JobState>): void {
    const job = this.jobs.get(id);
    if (job) {
      Object.assign(job, update);
    }
  }

  updateStep(id: string, stepName: string, update: Partial<GenerationStep>): void {
    const job = this.jobs.get(id);
    if (!job) return;

    const step = job.steps.find((s) => s.name === stepName);
    if (step) {
      Object.assign(step, update);
    } else {
      job.steps.push({ name: stepName, status: "pending", ...update });
    }
  }

  async storePreview(key: string, state: PreviewState): Promise<void> {
    await this.ensureCache();
    const existing = this.previewCache.get(key);

    // Update memory immediately
    this.previewCache.set(key, { data: state, rowId: existing?.rowId });

    // Upload cover images that have base64 but no imageUrl yet
    let attachments: (NocoAttachment | null)[] | undefined;
    const coverImages = state.structured?.coverImages;
    if (coverImages && coverImages.some((img) => img.imageBase64 && !img.imageUrl)) {
      try {
        const uploadResults = await Promise.all(
          coverImages.map(async (img, i) => {
            if (img.imageBase64 && !img.imageUrl) {
              try {
                return await nocoUploadAttachment(img.imageBase64, `cover-${key}-${i}.png`);
              } catch (err) {
                console.error(`Store: Failed to upload cover image ${i}:`, err);
                return null;
              }
            }
            return undefined;
          })
        );
        // Only set attachments if at least one upload succeeded
        if (uploadResults.some((r) => r !== undefined)) {
          attachments = uploadResults as (NocoAttachment | null)[];
          // Update in-memory imageUrl for successfully uploaded images
          for (let i = 0; i < uploadResults.length; i++) {
            const att = uploadResults[i];
            if (att && coverImages[i]) {
              const url = att.signedPath || att.url || "";
              coverImages[i].imageUrl = url.startsWith("http") ? url : `https://ndb.startmunich.de${url.startsWith("/") ? "" : "/"}${url}`;
            }
          }
        }
      } catch (err) {
        console.error("Store: Cover image upload error:", err);
      }
    }

    // Persist to NocoDB asynchronously
    if (existing?.rowId) {
      nocoUpdate(existing.rowId, state, attachments).catch((err) =>
        console.error("Store: NocoDB update error:", err)
      );
    } else {
      nocoCreate(key, state, attachments)
        .then((rowId) => {
          const entry = this.previewCache.get(key);
          if (entry) entry.rowId = rowId;
        })
        .catch((err) => console.error("Store: NocoDB create error:", err));
    }
  }

  async getPreview(key: string): Promise<PreviewState | undefined> {
    await this.ensureCache();
    return this.previewCache.get(key)?.data;
  }

  async updatePreview(key: string, update: Partial<PreviewState>): Promise<void> {
    await this.ensureCache();
    const entry = this.previewCache.get(key);
    if (entry) {
      Object.assign(entry.data, update, { updatedAt: new Date() });
      await this.storePreview(key, entry.data);
    }
  }

  async getAllPreviews(): Promise<PreviewState[]> {
    await this.ensureCache();
    return Array.from(this.previewCache.values())
      .map((v) => v.data)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }

  async deletePreview(key: string): Promise<void> {
    await this.ensureCache();
    const entry = this.previewCache.get(key);
    if (!entry) return;

    this.previewCache.delete(key);

    if (entry.rowId) {
      nocoDelete(entry.rowId).catch((err) =>
        console.error("Store: NocoDB delete error:", err)
      );
    }
  }

  getAllJobs(): JobState[] {
    return Array.from(this.jobs.values()).reverse();
  }

  getActiveJobs(): JobState[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === "pending" || job.status === "running")
      .reverse();
  }

  // ---- Cover image background jobs ----

  createCoverImageJob(id: string, previewKey: string, prompt: string): CoverImageJob {
    const job: CoverImageJob = {
      id,
      previewKey,
      status: "pending",
      prompt,
      images: [],
    };
    this.coverImageJobs.set(id, job);
    return job;
  }

  getCoverImageJob(id: string): CoverImageJob | undefined {
    return this.coverImageJobs.get(id);
  }

  updateCoverImageJob(id: string, update: Partial<CoverImageJob>): void {
    const job = this.coverImageJobs.get(id);
    if (job) {
      Object.assign(job, update);
    }
  }

  addCoverImageToJob(id: string, image: CoverImage): void {
    const job = this.coverImageJobs.get(id);
    if (job) {
      job.images.push(image);
    }
  }

  getActiveCoverImageJobs(): CoverImageJob[] {
    return Array.from(this.coverImageJobs.values())
      .filter((job) => job.status === "pending" || job.status === "running");
  }
}

const STORE_VERSION = 3;
const globalWithStore = global as typeof globalThis & {
  __store?: Store;
  __storeVersion?: number;
};

if (!globalWithStore.__store || globalWithStore.__storeVersion !== STORE_VERSION) {
  globalWithStore.__store = new Store();
  globalWithStore.__storeVersion = STORE_VERSION;
}

export const store = globalWithStore.__store;

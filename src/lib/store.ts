import { JobState, GenerationStep, PreviewState, CoverImageJob, CoverImage } from "./types";
import { isNocoConfigured, nocoGetAll, nocoCreate, nocoUpdate, nocoDelete } from "./nocodb";

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
      if (!isNocoConfigured()) {
        console.log("Store: NocoDB not configured, using in-memory previews");
        return;
      }

      const records = await nocoGetAll();
      for (const { rowId, preview } of records) {
        this.previewCache.set(preview.key, { data: preview, rowId });
      }
      console.log(`Store: Loaded ${records.length} previews from NocoDB`);
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
      console.log(`Store: Updated step "${stepName}" to status "${update.status}" - ${update.message || ""}`);
    } else {
      job.steps.push({ name: stepName, status: "pending", ...update });
      console.log(`Store: Created step "${stepName}" with status "${update.status || "pending"}" - ${update.message || ""}`);
    }
  }

  async storePreview(key: string, state: PreviewState): Promise<void> {
    await this.ensureCache();
    const existing = this.previewCache.get(key);

    // Update memory immediately
    this.previewCache.set(key, { data: state, rowId: existing?.rowId });

    // Persist to NocoDB asynchronously
    if (existing?.rowId) {
      nocoUpdate(existing.rowId, state).catch((err) =>
        console.error("Store: NocoDB update error:", err)
      );
    } else {
      nocoCreate(key, state)
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
    return Array.from(this.jobs.values()).sort((a, b) => {
      const aId = parseInt(a.id.split("_")[1] || "0");
      const bId = parseInt(b.id.split("_")[1] || "0");
      return bId - aId;
    });
  }

  getActiveJobs(): JobState[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === "pending" || job.status === "running")
      .sort((a, b) => {
        const aId = parseInt(a.id.split("_")[1] || "0");
        const bId = parseInt(b.id.split("_")[1] || "0");
        return bId - aId;
      });
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

  private cleanOldPreviews(): void {
    // No-op: NocoDB is the source of truth. Old previews are not pruned.
  }
}

const globalWithStore = global as typeof globalThis & { __store?: Store };
// Recreate the store if it's missing or was created before newer methods were added
// (prevents stale singletons during dev hot-reloads).
if (
  !globalWithStore.__store ||
  typeof globalWithStore.__store.createCoverImageJob !== "function" ||
  typeof globalWithStore.__store.deletePreview !== "function"
) {
  globalWithStore.__store = new Store();
}

export const store = globalWithStore.__store;

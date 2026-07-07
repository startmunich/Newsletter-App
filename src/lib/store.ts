import { JobState, GenerationStep, PreviewState } from "./types";

class Store {
  private jobs: Map<string, JobState> = new Map();
  private previews: Map<string, PreviewState> = new Map();

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

  storePreview(key: string, state: PreviewState): void {
    this.previews.set(key, state);
    this.cleanOldPreviews();
  }

  getPreview(key: string): PreviewState | undefined {
    return this.previews.get(key);
  }

  updatePreview(key: string, update: Partial<PreviewState>): void {
    const preview = this.previews.get(key);
    if (preview) {
      Object.assign(preview, update, { updatedAt: new Date() });
    }
  }

  private cleanOldPreviews(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 45);

    for (const [key, preview] of this.previews.entries()) {
      if (preview.createdAt < cutoff) {
        this.previews.delete(key);
      }
    }
  }
}

const globalWithStore = global as typeof globalThis & { __store?: Store };
if (!globalWithStore.__store) {
  globalWithStore.__store = new Store();
}

export const store = globalWithStore.__store;

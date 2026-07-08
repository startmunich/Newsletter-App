import { store } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const jobs = store.getActiveJobs();
    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Failed to get active jobs:", error);
    return NextResponse.json({ error: "Failed to fetch active jobs" }, { status: 500 });
  }
}

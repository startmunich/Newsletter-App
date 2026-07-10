import { NextRequest, NextResponse } from "next/server";
import {
  fetchAvailableBatches,
  fetchMembersByBatches,
  deriveStartEmail,
} from "@/lib/membersPlatform";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.MEMPLAT_API;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Members platform API key not configured" },
        { status: 500 }
      );
    }

    const batchesParam = request.nextUrl.searchParams.get("batches");

    // No batches => return the selectable batch list for the modal.
    if (!batchesParam) {
      const batches = await fetchAvailableBatches(apiKey);
      return NextResponse.json({ batches });
    }

    const batches = batchesParam
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);

    if (batches.length === 0) {
      return NextResponse.json({ members: [], skipped: [], count: 0 });
    }

    const rawMembers = await fetchMembersByBatches(batches, apiKey);

    const members: { id: string; name: string; email: string; batch: string | null }[] = [];
    const skipped: { id: string; name: string; batch: string | null }[] = [];

    for (const member of rawMembers) {
      const email = deriveStartEmail(member.name);
      if (email) {
        members.push({ id: member.id, name: member.name, email, batch: member.batch });
      } else {
        skipped.push({ id: member.id, name: member.name, batch: member.batch });
      }
    }

    return NextResponse.json({ members, skipped, count: members.length });
  } catch (error) {
    console.error("Members fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch members" },
      { status: 500 }
    );
  }
}

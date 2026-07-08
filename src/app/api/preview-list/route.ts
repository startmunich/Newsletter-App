import { store } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const previews = await store.getAllPreviews();
    return NextResponse.json(previews);
  } catch (error) {
    console.error("Failed to get preview list:", error);
    return NextResponse.json({ error: "Failed to fetch previews" }, { status: 500 });
  }
}

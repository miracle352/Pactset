import { NextResponse, type NextRequest } from "next/server";
import { locationPreferences } from "@/lib/location-data";

export async function GET(request: NextRequest) {
  const preferences = locationPreferences(request.nextUrl.searchParams.get("country") ?? "");
  if (!preferences) return NextResponse.json({ error: "Choose a valid country." }, { status: 400, headers: { "Cache-Control": "public, max-age=3600" } });
  return NextResponse.json(preferences, { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
}

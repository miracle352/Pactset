import { type NextRequest, NextResponse } from "next/server";
import { getAccount, type AccountRole } from "@/lib/account";

function safeDestination(value: string | null, role: AccountRole) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return `/workspace/${role}`;
  return value;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  const { role: rawRole } = await params;
  const role = rawRole as AccountRole;
  const account = await getAccount();
  if (!account) return NextResponse.redirect(new URL(`/auth/sign-in?next=${encodeURIComponent(`/workspace/${role}`)}`, request.url));
  if (!account.roles.includes(role)) return NextResponse.redirect(new URL("/workspace?error=role-required", request.url));
  const response = NextResponse.redirect(new URL(safeDestination(request.nextUrl.searchParams.get("next"), role), request.url));
  response.cookies.set("pactset-role-v1", role, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 180, path: "/" });
  return response;
}

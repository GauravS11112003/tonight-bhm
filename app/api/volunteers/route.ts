import { NextResponse } from "next/server";
import { Action, apply } from "@/lib/volunteers/store";
import { readStore, writeStore } from "@/lib/volunteers/store.server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(readStore());
}

export async function POST(req: Request) {
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const next = apply(readStore(), parsed.data);
  writeStore(next);
  return NextResponse.json(next);
}

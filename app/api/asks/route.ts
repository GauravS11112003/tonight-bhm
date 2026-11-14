import { NextResponse } from "next/server";
import { z } from "zod";
import { apply } from "@/lib/volunteers/store";
import { readStore, writeStore } from "@/lib/volunteers/store.server";

export const dynamic = "force-dynamic";

// The public needs board talks to this route only. It can read each ask's status and
// pledge an open ask. Staff notes, volunteer names and everything else stay behind.
const statuses = () => Object.fromEntries(Object.entries(readStore().asks ?? {}).map(([id, a]) => [id, a.status]));

export function GET() {
  return NextResponse.json(statuses());
}

export async function POST(req: Request) {
  const parsed = z.object({ id: z.string().max(120) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const store = readStore();
  const current = store.asks?.[parsed.data.id]?.status ?? "open";
  if (current === "open") writeStore(apply(store, { action: "askStatus", id: parsed.data.id, status: "pledged" }));
  return NextResponse.json(statuses());
}

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ExtractionSchema, keywordNeeds, NEEDS, scrubNote } from "@/lib/intake/schema";

// AI's only job in this app: turn a volunteer's free-text note into need chips.
// It never sees a name, never picks a shelter, never decides eligibility.
const Body = z.object({ note: z.string().min(1).max(2000) });

const SYSTEM = `You read short intake notes written by volunteers at a homeless shelter front door in Birmingham, Alabama.
Return only the needs the note states or clearly implies. Allowed values:
shelter_tonight (needs a place to sleep tonight), warmth (cold, needs blankets or a warm place), food, medical (sick, injured, needs medication or care), showers, housing_longterm (wants an apartment or permanent housing).
If unsure, leave it out. The volunteer will confirm every item.`;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "note required" }, { status: 400 });
  const note = scrubNote(parsed.data.note);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ needs: keywordNeeds(note), source: "keywords" });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { needs: { type: "array", items: { type: "string", enum: [...NEEDS] } } },
            required: ["needs"],
            additionalProperties: false,
          },
        },
      },
      system: SYSTEM,
      messages: [{ role: "user", content: note }],
    });
    if (response.stop_reason === "refusal") throw new Error("refusal");
    const text = response.content.find((b) => b.type === "text");
    const result = ExtractionSchema.safeParse(JSON.parse(text && text.type === "text" ? text.text : "{}"));
    if (!result.success) throw new Error("invalid shape");
    return NextResponse.json({ needs: [...new Set(result.data.needs)], source: "claude" });
  } catch (err) {
    // Any failure falls back to keywords; the UI still shows manual checkboxes.
    return NextResponse.json({ needs: keywordNeeds(note), source: "keywords", error: (err as Error).message });
  }
}

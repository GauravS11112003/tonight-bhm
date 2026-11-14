import { z } from "zod";

export const NEEDS = ["shelter_tonight", "warmth", "food", "medical", "showers", "housing_longterm"] as const;

// The only shape we accept back from the model. Anything else → manual checkboxes.
export const ExtractionSchema = z.object({
  needs: z.array(z.enum(NEEDS)).max(6),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

// Belt and braces: strip things that look like names or numbers before the note
// leaves the building. The form never asks for a name, but people type them anyway.
export function scrubNote(note: string): string {
  return note
    .replace(/\b(my name is|i am|i'm|name:)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/gi, "$1 [name]")
    .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, "[number]")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "[date]")
    .slice(0, 1000);
}

// Offline fallback so the demo still suggests chips with no API key.
// Simple keyword match; the volunteer still confirms every chip.
const KEYWORDS: Record<(typeof NEEDS)[number], RegExp> = {
  shelter_tonight: /\b(sleep|bed|tonight|nowhere|place to stay|shelter|outside|street|in (?:my|a|the) car)/i,
  warmth: /\b(cold|freez|warm|blanket|coat|jacket|wet)/i,
  food: /\b(hungry|food|eat|meal|starv)/i,
  medical: /\b(sick|hurt|pain|injur|medic|doctor|insulin|meds|bleed|fever|cough)/i,
  showers: /\b(shower|wash|clean|bath|hygiene)/i,
  housing_longterm: /\b(apartment|housing|lease|evict|rent|permanent|place of my own)/i,
};
export function keywordNeeds(note: string): Extraction["needs"] {
  return NEEDS.filter((n) => KEYWORDS[n].test(note));
}

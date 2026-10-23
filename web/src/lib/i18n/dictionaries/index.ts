import type { Locale } from "../config";
import en, { type Dictionary } from "./en";
import ar from "./ar";

const dictionaries: Record<Locale, Dictionary> = { en, ar };
export const getDictionary = (lang: Locale): Dictionary => dictionaries[lang] ?? en;
export type { Dictionary };

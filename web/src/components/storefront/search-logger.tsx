"use client";
import * as React from "react";
import { track } from "@/lib/track";

/** Records a search once per query / filter combination, with its number of results (so searches that find nothing can be reviewed). */
export function SearchLogger({ query, results, lang }: { query: string; results: number; lang: string }) {
  React.useEffect(() => { track("search", { query, results, lang }); }, [query, results, lang]);
  return null;
}

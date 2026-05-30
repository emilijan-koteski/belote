import { createContext, useContext } from "react";

import type { RulesContent } from "./content/types";

// Localized, render-ready rules content threaded to every rules sub-component
// (chapters, card ladders, declarations grid) so language swaps in one place.
const RulesContext = createContext<RulesContent | null>(null);

export const RulesProvider = RulesContext.Provider;

export function useRules(): RulesContent {
  const ctx = useContext(RulesContext);
  if (!ctx) throw new Error("useRules must be used within <RulesProvider>");
  return ctx;
}

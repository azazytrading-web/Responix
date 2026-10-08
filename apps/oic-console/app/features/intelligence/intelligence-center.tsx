"use client";

import type { Locale, Messages, View } from "../../i18n";
import type { Row, Snapshot } from "../../types";
import { MemoryKnowledgeStudio } from "./memory-knowledge-studio";

type Props = {
  view: View; locale: Locale; t: Messages; data: Snapshot | null;
  profiles: Row[]; memories: Row[]; knowledge: Row[]; executions: Row[];
  recordStates: Record<"memory" | "knowledge", "loading" | "available" | "failed">;
  selectedMemory: Row | null; selectedKnowledge: Row | null; selectedTrace: Row | null; workbenchResult: Row | null;
  load: (resource: "memory" | "knowledge" | "traces", filters?: { q?: string; tenantId?: string; lifecycle?: string; kind?: string }) => Promise<Row[] | null>;
  inspectMemory: (id: string) => Promise<Row | null>; inspectKnowledge: (id: string) => Promise<Row | null>; inspectTrace: (id: string) => void;
  navigate: (destination: View, entityId?: string) => void;
  perform: (action: string, values?: Row) => Promise<Row | null>;
};

export function IntelligenceCenter(props: Props) {
  const { view, locale, data, memories, knowledge, executions, recordStates, selectedMemory, selectedKnowledge, profiles, load, inspectMemory, inspectKnowledge, perform, navigate } = props;
  if (view === "memory" || view === "knowledge") {
    return <MemoryKnowledgeStudio
      view={view} locale={locale} data={data} memories={memories} knowledge={knowledge} executions={executions}
      selectedMemory={selectedMemory} selectedKnowledge={selectedKnowledge} profiles={profiles}
      load={load} loadState={recordStates[view]} inspectMemory={inspectMemory} inspectKnowledge={inspectKnowledge} perform={perform}
      navigate={navigate}
    />;
  }
  return null;
}

"use client";

import type { ReactNode } from "react";
import type { Locale, Messages, View } from "../../i18n";
import type { Row, Snapshot } from "../../types";
import { FactoryEngineeringWorkspaces } from "./factory-workspaces";

type Props = {
  view: View;
  data: Snapshot;
  locale: Locale;
  t: Messages;
  literal: (value: string) => string;
  filter: string;
  setFilter: (value: string) => void;
  filtered: (rows: Row[] | undefined) => Row[];
  table: (headers: string[], rows: ReactNode[][], empty?: string) => ReactNode;
  badge: (value: unknown) => ReactNode;
  mono: (value: unknown, clipped?: boolean) => ReactNode;
  appLabel: (id: unknown) => string;
  tenantLabel: (id: unknown) => string;
  actionButton: (label: string, action: string, values: Row, className?: string) => ReactNode;
  perform: (action: string, values?: Row) => Promise<Row | null>;
  navigate?: (destination: View, entityId?: string) => void;
  profileRevisions?: Row[];
};

export function ModelFabricViews(props: Props) {
  return <FactoryEngineeringWorkspaces {...props} />;
}

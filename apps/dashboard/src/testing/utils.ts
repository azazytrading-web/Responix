/**
 * Testing Utilities
 *
 * Render helpers, mock providers, and test utilities for the Dashboard.
 */

import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

export * from "@testing-library/react";
export { userEvent } from "@testing-library/user-event";

export interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  wrapper?: (props: { children: ReactNode }) => ReactElement;
}

export function render(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): ReturnType<typeof rtlRender> {
  return rtlRender(ui, {
    ...options,
  });
}

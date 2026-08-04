"use client";

import { useMemo } from "react";
import { usePlatformBootstrap } from "../platform";
import { getAuthorizedPlugins } from "../plugins";

export function usePlugins() {
  const { permissions, features } = usePlatformBootstrap();

  const authorizedPlugins = useMemo(
    () => getAuthorizedPlugins(permissions, features),
    [permissions, features]
  );

  return {
    plugins: authorizedPlugins,
    isLoading: false,
  };
}

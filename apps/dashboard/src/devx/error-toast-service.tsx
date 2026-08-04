"use client";

import { useEffect } from "react";

interface ErrorToastServiceProps {
  error: string | null;
}

export function ErrorToastService({ error }: ErrorToastServiceProps) {
  useEffect(() => {
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[ErrorToast]", error);
      }
    }
  }, [error]);

  return null;
}

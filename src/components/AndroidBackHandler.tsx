"use client";

import { useEffect } from "react";

/**
 * Android / Capacitor back: walk browser history first; exit only at root.
 * In-app CreateWizard steps also push history, so back moves through the flow.
 */
export function AndroidBackHandler() {
  useEffect(() => {
    let remove: (() => void) | undefined;

    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) {
            window.history.back();
            return;
          }
          void App.exitApp();
        });
        remove = () => {
          void handle.remove();
        };
      } catch {
        // Browser / non-Capacitor — no native back listener.
      }
    })();

    return () => {
      remove?.();
    };
  }, []);

  return null;
}

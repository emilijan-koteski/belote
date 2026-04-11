import "@/shared/i18n/i18n";
import "@/index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

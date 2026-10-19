import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
});

// Prevent unhandled WebSocket/Realtime malformed packet exceptions from crashing the app
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event?.message && (event.message.includes('JSON Parse error') || event.message.includes('SyntaxError: Unexpected token'))) {
      console.warn('Recovered from transient realtime frame parse anomaly:', event.message);
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>应用发生错误，请刷新页面重试</p>}>
    <AppWrapper>
      <App />
    </AppWrapper>
  </Sentry.ErrorBoundary>
);

import { SpeedInsights } from "@vercel/speed-insights/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { startBuildVersionPoll } from "./lib/build-version-poll";
import { runSchemaVersionHandshake } from "./lib/schema-version-handshake";
import { unregisterAllServiceWorkers } from "./lib/sw-kill-switch";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

runSchemaVersionHandshake();
startBuildVersionPoll();
void unregisterAllServiceWorkers();

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <SpeedInsights />
  </>,
);

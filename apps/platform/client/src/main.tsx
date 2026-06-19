import { SpeedInsights } from "@vercel/speed-insights/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { runSchemaVersionHandshake } from "./lib/schema-version-handshake";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

runSchemaVersionHandshake();

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <SpeedInsights />
  </>,
);

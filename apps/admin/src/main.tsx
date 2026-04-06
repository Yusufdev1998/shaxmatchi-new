import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ShaxTooltipProvider } from "@shaxmatchi/ui";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { queryClient } from "./queryClient";
import { setPwaUpdateReady } from "./pwaUpdate";
import "./index.css";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    setPwaUpdateReady(() => updateSW(true));
  },
  onRegisteredSW(_url, registration) {
    if (registration) {
      setInterval(() => { registration.update(); }, 60 * 1000);
    }
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ShaxTooltipProvider>
        <App />
      </ShaxTooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);


import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ShaxTooltipProvider } from "@shaxmatchi/ui";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { queryClient } from "./queryClient";
import "./index.css";

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ShaxTooltipProvider>
        <App />
      </ShaxTooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);


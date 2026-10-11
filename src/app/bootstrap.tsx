import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { buildVariant } from "../data/airframe/index.ts";
import { QUANTITIES, assertDataPack } from "../data/provenance/index.ts";
import { App } from "./App.tsx";
import { initStore } from "./store.ts";

function showFailure(message: string): void {
  const root = document.getElementById("root");
  if (!root) return;
  root.textContent = message;
  console.error(message);
}

export function bootstrap(): void {
  try {
    assertDataPack();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Data pack failed";
    showFailure(message);
    return;
  }
  if (import.meta.env.DEV) {
    console.info("data pack ok", QUANTITIES.length);
  }
  const a900 = buildVariant("a350-900");
  const a1000 = buildVariant("a350-1000");
  initStore(a900, a1000);
  const root = document.getElementById("root");
  if (!root) return;
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

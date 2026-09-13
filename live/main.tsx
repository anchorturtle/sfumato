import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "@/components/studio/Studio";
import "@/styles.css";

const el = document.getElementById("app");
if (!el) throw new Error("Sfumato root missing");
createRoot(el).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
);

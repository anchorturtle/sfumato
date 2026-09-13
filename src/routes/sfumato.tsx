import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio/Studio";

export const Route = createFileRoute("/sfumato")({ component: SfumatoPage });

function SfumatoPage() {
  return <Studio />;
}

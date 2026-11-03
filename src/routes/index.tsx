import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Mise keeps all data in the browser, so the app renders on the client only.
const MiseApp = lazy(() => import("@/mise/App"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mise — Inteligência de margem para gastronomia" },
      {
        name: "description",
        content: "CMV, fichas técnicas, estoque FEFO, NF-e e fluxo de caixa para restaurantes, calculados centavo a centavo.",
      },
      { property: "og:title", content: "Mise — Inteligência de margem para gastronomia" },
      {
        property: "og:description",
        content: "Saiba onde sua cozinha ganha e perde dinheiro. CMV, estoque e caixa em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
        <span className="h-2 w-2 rounded-full bg-ember" />
        Mise
      </div>
    </div>
  );
}

function Index() {
  return (
    <ClientOnly fallback={<Splash />}>
      <Suspense fallback={<Splash />}>
        <MiseApp />
      </Suspense>
    </ClientOnly>
  );
}

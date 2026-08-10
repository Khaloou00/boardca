import { createFileRoute } from "@tanstack/react-router";
import { MobileAdminApp } from "@/components/mobile/admin-app";

export const Route = createFileRoute("/mobile")({
  ssr: false,
  component: MobilePage,
});

function MobilePage() {
  return (
    <div className="min-h-screen w-full bg-background overflow-hidden flex flex-col">
      <MobileAdminApp />
    </div>
  );
}

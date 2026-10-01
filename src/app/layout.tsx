import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Publish Tracker",
  description: "Play Store and App Store submission tracking for client apps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster theme="light" position="bottom-right" />
      </body>
    </html>
  );
}

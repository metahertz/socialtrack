import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { DbGuard } from "@/components/DbGuard";

export const metadata: Metadata = {
  title: "SocialTrack - Social Media Performance",
  description: "Track follower growth and impressions across LinkedIn, Twitter, and YouTube",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-chart-dark">
        <DbGuard>
          <AuthProvider>{children}</AuthProvider>
        </DbGuard>
      </body>
    </html>
  );
}

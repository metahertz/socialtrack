import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}

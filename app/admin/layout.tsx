import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin — DisparaZapp",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

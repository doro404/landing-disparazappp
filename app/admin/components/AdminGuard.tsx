"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/adminAuth";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/admin/login");
    }
  }, [router]);

  if (typeof window !== "undefined" && !isAuthenticated()) return null;

  return <>{children}</>;
}

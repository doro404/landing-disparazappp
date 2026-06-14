"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Key, Package, Settings, LogOut, Zap, FlaskConical, ArrowUpCircle, Mail } from "lucide-react";
import { clearAuth } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/admin/licenses",   label: "Licenças",     icon: Key },
  { href: "/admin/trials",     label: "Trials",       icon: FlaskConical },
  { href: "/admin/updates",    label: "Atualizações", icon: ArrowUpCircle },
  { href: "/admin/emails",     label: "E-mails",      icon: Mail },
  { href: "/admin/products",   label: "Produtos",     icon: Package },
  { href: "/admin/settings",   label: "Configurações",icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const handleLogout = () => {
    clearAuth();
    router.push("/admin/login");
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 flex flex-col border-r border-white/5 bg-[#080808] z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-[#25D366] flex items-center justify-center">
          <Zap className="w-4 h-4 text-black" fill="black" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">DisparaZapp</p>
          <p className="text-[10px] text-white/30 mt-0.5">Admin Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[#25D366]/15 text-[#25D366]"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/30 hover:text-red-400 hover:bg-red-400/5 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}

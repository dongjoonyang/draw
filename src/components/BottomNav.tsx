"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function TabItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
        active ? "text-[#3478FF]" : "text-[#9CA3AF]"
      }`}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </Link>
  );
}

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E5E7EB] flex items-center justify-around px-2 py-1">
      <TabItem href="/gallery" label="갤러리" icon="🖼" />
      <TabItem href="/community" label="커뮤니티" icon="💬" />
      <TabItem href="/figure-drawing" label="인체도형화" icon="✏️" />
      <TabItem href="/auth/login" label="로그인" icon="👤" />
    </nav>
  );
}

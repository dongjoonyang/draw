"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? "bg-[#EBF2FF] text-[#3478FF]"
          : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#141415]"
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const u = data.user ?? null;
      setUser(u);
      if (u) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", u.id)
          .single() as { data: { username?: string } | null; error: unknown };
        setUsername((profile as { username?: string } | null)?.username ?? u.email?.split("@")[0] ?? null);
      }
    }
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", u.id)
          .single() as { data: { username?: string } | null; error: unknown };
        setUsername((profile as { username?: string } | null)?.username ?? u.email?.split("@")[0] ?? null);
      } else {
        setUsername(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-white border-r border-[#E5E7EB] fixed top-0 left-0 bottom-0 z-40">
      {/* 로고 */}
      <div className="px-4 py-5 border-b border-[#E5E7EB]">
        <Link href="/" className="text-[#3478FF] font-bold text-xl">
          Dream
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItem href="/gallery" label="갤러리" icon="🖼" />
        <NavItem href="/community" label="커뮤니티" icon="💬" />
        <NavItem href="/figure-drawing" label="인체도형화" icon="✏️" />
      </nav>

      {/* 유저 섹션 */}
      <div className="px-3 py-4 border-t border-[#E5E7EB]">
        {user ? (
          <div className="space-y-1">
            <Link
              href={`/profile/${username}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#141415] transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-[#EBF2FF] text-[#3478FF] flex items-center justify-center text-xs font-bold">
                {(username ?? "?")[0].toUpperCase()}
              </span>
              <span className="font-medium truncate">{username}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#141415] transition-colors"
            >
              <span className="text-base">↩</span>
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center justify-center w-full py-2.5 rounded-xl bg-[#3478FF] hover:bg-[#1A5FD4] text-white text-sm font-medium transition-colors"
          >
            로그인
          </Link>
        )}
      </div>
    </aside>
  );
}

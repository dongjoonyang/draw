"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

// 수정 2: NavLink를 Navbar 외부의 proper component로 정의
function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={`text-sm transition-colors ${
        pathname === href || pathname.startsWith(href + "/")
          ? "text-white font-medium"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null); // 수정 3
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // 수정 1: createClient를 useMemo로 안정화
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // 수정 3: profiles 테이블에서 username 조회
    supabase.auth.getUser().then(async ({ data }) => {
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
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_, session) => {
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
      }
    );
    return () => subscription.unsubscribe();
  }, [supabase]);

  // 수정 4: 외부 클릭 + Escape 키 지원
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-6 h-14 flex items-center gap-6">
      <Link href="/" className="text-indigo-400 font-bold text-base mr-2">
        Dream
      </Link>
      {/* 수정 2: NavLink 컴포넌트 사용 */}
      <NavLink href="/figure-drawing" label="인체도형화" />
      <NavLink href="/gallery" label="갤러리" />
      <NavLink href="/community" label="커뮤니티" />

      <div className="ml-auto relative" ref={menuRef}>
        {user ? (
          <>
            {/* 수정 4: ARIA 속성 추가 */}
            <button
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="text-sm text-gray-300 hover:text-white flex items-center gap-1"
            >
              {/* 수정 3: username 표시 */}
              {username ?? user.email?.split("@")[0]}
              {/* 수정 4: caret에 aria-hidden 추가 */}
              <span aria-hidden="true" className="text-xs text-gray-500">▾</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 bg-gray-900 border border-gray-700 rounded-lg py-1 w-44 shadow-xl">
                {/* 수정 3: username 기반 프로필 링크 */}
                <Link
                  href={`/profile/${username ?? user.email?.split("@")[0]}`}
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  내 프로필
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800"
                >
                  대시보드
                </Link>
                <hr className="border-gray-700 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  로그아웃
                </button>
              </div>
            )}
          </>
        ) : (
          <Link
            href="/auth/login"
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            로그인
          </Link>
        )}
      </div>
    </nav>
  );
}

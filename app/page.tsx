import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

// 보호된 홈(서버 컴포넌트).
// - 미들웨어가 이미 미인증 접근을 막지만, 방어적으로 여기서도 클레임을 재확인한다.
// - getSession 대신 getClaims 사용: 서명 검증된 클레임을 쓰는 공식 보안 권고.
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  // 클레임 payload 에서 이메일을 안전하게 추출.
  const email =
    typeof data.claims.email === "string" ? data.claims.email : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-4xl font-bold tracking-tight">FitArchive</h1>
      <p className="text-muted-foreground text-sm">
        {email ? `${email} 님으로 로그인됨` : "로그인됨"}
      </p>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        다음 단계에서 옷 기록(실측 · 착용느낌 · 사진)을 여기에 추가합니다.
      </p>
      {/* 로그아웃은 Server Action 을 form action 으로 연결 — 클라이언트 JS 없이 동작 */}
      <form action={signOut}>
        <Button type="submit" variant="outline">
          로그아웃
        </Button>
      </form>
    </main>
  );
}

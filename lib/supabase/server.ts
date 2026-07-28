import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버(서버 컴포넌트 · Server Action · Route Handler)용 Supabase 클라이언트.
 *
 * - 요청에 담긴 쿠키에서 로그인 세션을 읽어 "그 사용자"로 DB에 접근한다.
 *   → RLS 가 본인 데이터만 걸러서 보여준다. (service_role 불필요)
 * - Next.js 16 의 cookies() 는 비동기이므로 await 가 필요하다.
 * - 요청마다 새로 만들어야 한다(세션이 요청별로 다름) — 전역 재사용 금지.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서는 응답 쿠키를 쓸 수 없어 여기서 예외가 날 수 있다.
            // 세션 토큰 갱신은 미들웨어(Phase 1에서 추가)가 담당하므로 무시해도 안전하다.
          }
        },
      },
    },
  );
}

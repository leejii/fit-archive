import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 미들웨어용 세션 갱신 + 라우트 보호.
 *
 * - 매 요청마다 만료된 액세스 토큰을 자동 갱신한다(getClaims 호출이 트리거).
 *   서버 컴포넌트는 응답 쿠키를 쓸 수 없으므로, 갱신된 세션 쿠키를 심는 일은
 *   반드시 미들웨어가 담당해야 한다.
 * - 미인증 사용자가 보호 라우트에 접근하면 /login 으로 리다이렉트한다.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims 호출로 만료 토큰이 자동 갱신된다 — 반드시 유지.
  // (getSession 대신 getClaims 사용: 서명 검증된 클레임을 쓰는 공식 보안 권고)
  const { data } = await supabase.auth.getClaims();
  const isAuthed = !!data?.claims;

  const p = request.nextUrl.pathname;
  // 로그인 화면과 인증 콜백은 미인증 상태로도 접근 가능해야 한다.
  const isPublic = p.startsWith("/login") || p.startsWith("/auth");

  if (!isAuthed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // 세션 토큰 갱신 + 미인증 보호 라우트 차단은 updateSession 이 전담한다.
  return await updateSession(request);
}

export const config = {
  // 정적 자원/이미지 요청은 미들웨어를 건너뛴다(성능).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

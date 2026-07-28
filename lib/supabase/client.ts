import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트.
 *
 * - 공개 가능한 anon(publishable) 키만 사용한다. 브라우저에 노출돼도 안전하며,
 *   실제 접근 제어는 DB의 RLS(행 수준 보안)가 담당한다.
 * - createBrowserClient 는 내부적으로 싱글턴이라 여러 번 호출해도 커넥션이 늘지 않는다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

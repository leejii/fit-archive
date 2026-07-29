---
id: impl-v1
title: V1 구현계획서 — 수동 입력 코어
type: impl
version: 0.4.0
status: draft
scope: FitArchive V1(수동 입력 코어)의 구현 순서·태스크·수용 기준
related: [adr-0001-platform, adr-0002-data-storage, adr-0003-v1-scope]
updated: 2026-07-29
---

# V1 구현계획서 — 수동 입력 코어

> **v0.4.0 변경**: Phase 1(인증) 완료 — 실제 로그인 e2e 검증 통과. 인증 방식은 당초 Email OTP로 시작했으나, **Supabase 무료 기본 이메일은 커스텀 SMTP 없이 템플릿 편집이 잠겨 6자리 코드({{ .Token }}) 표시가 불가** → **Magic Link로 전환**(기본 템플릿 무설정 동작). 인증 로직을 `lib/auth`로 추상화해둔 덕에 전환은 상수 flip + UI 소폭 수정으로 끝남. OTP 복귀는 커스텀 SMTP 설정 시 가능.
> **v0.3.0 변경**: Phase 0(선행조건·Scaffold) 전 태스크 완료. Supabase 연결 스모크 검증 통과. **V1은 service_role 키를 쓰지 않기로 확정**(로그인 세션 + RLS만으로 충분 → 관리 권한 비밀키 관리 표면 제거).
> **v0.2.0 변경**: 인증(매직링크 + RLS)을 **auth-early**로 확정. 데이터가 생기는 첫 슬라이스부터 로그인·RLS를 켜, 매 Phase가 secure-by-default가 되고 보안 소급 재작업을 없앤다. (이전 초안의 'Phase 4 일괄 적용' 제거)

## 목표

의류 구매 이력을 수동으로 기록하고, 다음 구매 때 사이즈·이력을 참조할 수 있는 '돌아가는 웹앱'을 완성한다. 각 Phase는 독립적으로 동작하는 얇은 수직 슬라이스이며, 최우선 슬라이스는 **'옷 한 벌 입력 → 목록 확인'**이다.

## 범위 요약

| 구분 | 포함(V1) | 제외(V2/backlog) |
|------|----------|-------------------|
| 입력 | 수동 CRUD | AI 링크/사진 자동 추출 |
| 조회 | 목록·상세·검색·필터 | 통계·대시보드 |
| 사진 | Storage 업로드/표시 | 편집·크롭·다중 정렬 |
| 데이터 | Export(JSON/CSV) | Import, 백업 스케줄 |
| 인증 | 매직링크 단일 사용자 | 팀·공유·권한 등급 |

## 원칙 (구현 규율)

- **얇은 수직 슬라이스**: 매 Phase 끝에서 배포 가능하고 사용 가능한 상태 유지.
- **타입 안정성**: DB 스키마 → TS 타입 생성으로 단일 소스. `any` 금지.
- **처음부터 RLS (auth-early)**: 데이터 테이블은 생성 시점부터 RLS를 켜고, 모든 행을 로그인 사용자(`auth.uid()`)에 귀속시킨다. 보안 소급 적용/재작업을 만들지 않는다.
- **데이터 이식성**: Export를 후순위 장식이 아닌 명시적 Phase로 둔다.

---

## Phase 0 — 선행조건 · Scaffold (돌아가는 빈 앱)

> 사용자 수동 작업과 코드 scaffold를 분리한다.

### T0.1 [사용자 수동] Supabase 프로젝트 준비 ✅
- 설명: Supabase 무료 계정·프로젝트 생성, DB 비밀번호 설정, Storage 버킷 생성 예정 확인.
- 산출: `Project URL`, `anon(publishable) key` 확보. (service_role 키는 V1 미사용 → 확보 불필요)
- 수용 기준:
  - [x] Supabase 프로젝트가 생성되어 대시보드 접근 가능
  - [x] Project URL / anon(publishable) key를 안전한 곳에 확보

### T0.2 [사용자 수동] 환경 변수 발급·기입 ✅
- 설명: `.env.local`에 키 기입, `.env.example` 커밋용 템플릿 유지.
- 대상: `.env.local`(gitignore), `.env.example`
- 수용 기준:
  - [x] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정
  - [x] `SUPABASE_SERVICE_ROLE_KEY`는 V1 미사용(비워둠) — 필요 시 서버 전용으로 분리
  - [x] `.env.local`이 `.gitignore`에 포함

### T0.3 [코드] Next.js + TS + Tailwind + shadcn 초기화 ✅
- 설명: `create-next-app`(App Router, TS, Tailwind), `shadcn init`, 기본 레이아웃.
- 대상: `app/`, `components/ui/`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`
- 실제: Next 16.2.11 / React 19.2.4 / Tailwind v4 / shadcn(base-nova·neutral).
- 수용 기준:
  - [x] `npm run build` 성공
  - [x] shadcn 컴포넌트 1개(Button) 렌더 확인
  - [x] 루트 페이지가 로컬에서 렌더

### T0.4 [코드] Supabase 클라이언트 연결 ✅
- 설명: 브라우저용/서버용 클라이언트 유틸 분리(`@supabase/ssr` 기준).
- 대상: `lib/supabase/client.ts`, `lib/supabase/server.ts`
- 실제: `@supabase/ssr` 0.12.3 · `supabase-js` 2.110.9. server 클라이언트는 Next16 `await cookies()` + getAll/setAll 패턴.
- 수용 기준:
  - [x] 연결 스모크 통과 — `auth/v1/health` 200, `supabase-js` 쿼리 PGRST205("table 없음" = 키·연결 정상). 서버 컴포넌트 실사용은 Phase 1에서 검증.
  - [x] service_role 키 미사용(V1) — 클라이언트에 노출될 비밀키 자체가 없음.

**검증 방법**: `npm run build` + 로컬에서 루트 페이지 및 Supabase 연결 스모크 확인.

---

## Phase 1 — 인증 기반 (매직링크 + 보호 라우트) ✅

> 데이터를 만들기 전에 로그인 골격을 세운다. 이후 모든 슬라이스가 secure-by-default가 된다.
> 실제: 인증 로직을 `lib/auth/`로 추상화(`EMAIL_AUTH_METHOD` 상수로 OTP↔MagicLink 전환), 현재 **Magic Link**. 인증 확인은 `getClaims()`(공식 보안 권고).

### T1.1 [코드] 매직링크 인증 + 세션 ✅
- 설명: 이메일 매직링크 로그인/로그아웃, 세션 관리(`@supabase/ssr`), 콜백 처리.
- 대상: `app/(auth)/login/page.tsx`, `app/auth/callback/route.ts`, `lib/auth/{config,actions}.ts`
- 수용 기준:
  - [x] 매직링크로 로그인 동작(e2e: 링크 클릭→콜백→세션→홈 이메일 표시). 로그아웃 form action 구현.
  - [x] 세션은 미들웨어 `getClaims()`가 갱신 유지, 콜백 실패 시 `/login?error=auth` 처리
  - [x] 로그인 후 보호 홈(`/`) 렌더 = 돌아가는 앱

### T1.2 [코드] 보호 라우트 / 미들웨어 ✅
- 설명: 미로그인 접근 차단, 로그인으로 리다이렉트.
- 대상: `middleware.ts`, `lib/supabase/middleware.ts`
- 수용 기준:
  - [x] 미로그인으로 보호 경로 접근 시 `/login` 리다이렉트 (검증: `GET /` → 307 → `/login`)
  - [ ] (선택) 로그인 상태에서 `/login` 접근 시 홈으로 리다이렉트 — 미구현, Phase 2 착수 시 옵션 처리
- 참고: 사용은 같은 브라우저에서 링크 클릭 필요(PKCE code_verifier 쿠키). Redirect URLs 허용목록에 `http://localhost:3000/**` 등록 필요.

**검증 방법**: 빌드 + 수동 확인(로그인→세션 유지→로그아웃, 미로그인 리다이렉트).

---

## Phase 2 — 첫 슬라이스: 옷 한 벌 입력 → 목록 (RLS 포함, 최우선)

> 사진·필터 없이 텍스트 핵심 필드만으로 Create/Read를 관통시킨다. `user_id`는 세션에서 채우고, 테이블은 처음부터 RLS로 본인 데이터만.

### T2.1 [코드] items 테이블 + RLS
- 설명: `items` 테이블 생성(SQL 마이그레이션) + RLS 활성화. 필드: id, user_id(NOT NULL, `auth.uid()`), product_name, brand, category, color, size_label, fit(딱맞음/작음/큼 enum), purchased_at, store, url, price, memo, created_at, updated_at.
- 대상: `supabase/migrations/0001_items.sql`
- 수용 기준:
  - [ ] 마이그레이션 적용 성공, 테이블 존재
  - [ ] **RLS 활성화** — select/insert/update/delete 모두 `user_id = auth.uid()`
  - [ ] fit은 제약(enum 또는 check)으로 3값만 허용
  - [ ] price는 정수(원 단위) 또는 numeric로 통화 표현 명확
  - [ ] created_at/updated_at 기본값 설정

### T2.2 [코드] DB 타입 생성 + 도메인 타입
- 설명: `supabase gen types`로 TS 타입 생성, 도메인 타입/상수(카테고리, fit) 정의.
- 대상: `lib/types/database.ts`, `lib/types/item.ts`
- 수용 기준:
  - [ ] 생성 타입이 빌드에 포함되고 타입체크 통과
  - [ ] fit·category가 유니온 타입/상수로 정의

### T2.3 [코드] 아이템 생성 폼 + 저장
- 설명: 입력 폼 + 저장 로직. `user_id`는 서버 세션에서 주입(클라이언트 값 신뢰 금지). 폼 처리 방식은 열린 질문 — 우선 Server Action 최소 구현, 확정 시 교체.
- 대상: `app/items/new/page.tsx`, `app/items/actions.ts`
- 수용 기준:
  - [ ] 필수값(product_name) 미입력 시 저장 차단 + 사용자 피드백
  - [ ] url 형식·price 숫자 등 기본 유효성 검사
  - [ ] 저장 성공 시 목록으로 이동
  - [ ] 저장 실패(네트워크/DB 오류) 시 폼 값 보존 + 오류 메시지

### T2.4 [코드] 아이템 목록 조회 (본인 것만)
- 설명: 로그인 사용자의 아이템을 최신순 목록으로 표시(제품명·브랜드·카테고리·사이즈·fit 요약).
- 대상: `app/items/page.tsx`, `components/item-card.tsx`
- 수용 기준:
  - [ ] 방금 입력한 아이템이 목록에 표시
  - [ ] 데이터 0건일 때 빈 상태(empty state) UI 표시
  - [ ] 로딩·에러 상태 처리
  - [ ] 다른 계정의 데이터가 조회되지 않음(RLS 검증)

**검증 방법**: `npm run build` + 타입체크 통과 + 수동 확인(폼 입력 → 목록 반영, 2계정 데이터 격리, 빈 상태·필수값 검증).

---

## Phase 3 — 상세 · 수정 · 삭제 (CRUD 완성)

> 모든 조회/변경은 RLS로 본인 것만 대상.

### T3.1 [코드] 아이템 상세 페이지
- 대상: `app/items/[id]/page.tsx`
- 수용 기준:
  - [ ] 존재하지 않거나 본인 소유가 아닌 id 접근 시 404/안내 처리
  - [ ] 모든 필드가 읽기 좋게 표시(빈 필드는 '—' 등)

### T3.2 [코드] 수정
- 대상: `app/items/[id]/edit/page.tsx`, `app/items/actions.ts`
- 수용 기준:
  - [ ] 프리필된 값으로 폼 로드, updated_at 갱신
  - [ ] 유효성 검사 재사용(생성과 동일 규칙)
  - [ ] 저장 후 상세로 이동, 변경 반영

### T3.3 [코드] 삭제
- 대상: `components/delete-item-dialog.tsx`, `app/items/actions.ts`
- 수용 기준:
  - [ ] 삭제 전 확인 절차
  - [ ] 삭제 후 목록에서 사라짐
  - [ ] (사진 존재 시) 관련 사진 정리 정책 명시 — Phase 4 완료 후 연동

**검증 방법**: 빌드 + 타입체크 + 수동 확인(생성→상세→수정→삭제 전 흐름).

---

## Phase 4 — 사진 첨부 (Storage + 소유자 스코프)

### T4.1 [코드] photos 테이블 + Storage 버킷 (소유자 정책)
- 설명: `photos`(id, item_id FK, storage_path, created_at) 테이블 + Storage 버킷/정책. 접근은 소유자 기준.
- 대상: `supabase/migrations/0002_photos.sql`, 버킷 설정
- 수용 기준:
  - [ ] item과 photos 1:N 관계, item 삭제 시 정리 규칙(FK on delete)
  - [ ] photos에 RLS(본인 item의 사진만), Storage 객체 접근도 소유자 기준(서명 URL 등)

### T4.2 [코드] 사진 업로드 + 표시
- 대상: `components/photo-uploader.tsx`, 상세/목록 연동
- 수용 기준:
  - [ ] 이미지 업로드 성공 시 상세에 표시
  - [ ] 허용 형식(jpg/png/webp) 및 용량 상한 검증
  - [ ] 업로드 실패(네트워크/형식/용량 초과) 시 명확한 오류 + 롤백(고아 레코드 방지)
  - [ ] 대용량 파일 업로드 중 진행/대기 표시
  - [ ] 폰 카메라 촬영 첨부 경로 동작(웹 표준 input capture)

**검증 방법**: 빌드 + 타입체크 + 수동 확인(정상 업로드, 형식·용량 초과 거부, 업로드 중 네트워크 차단 시 오류 처리).

---

## Phase 5 — 검색 · 필터

### T5.1 [코드] 검색/필터 UI + 쿼리
- 설명: 브랜드·카테고리·fit·키워드(제품명) 필터, 서버 쿼리 반영.
- 대상: `app/items/page.tsx`, `components/item-filters.tsx`
- 수용 기준:
  - [ ] 카테고리·fit·브랜드 필터 적용 시 목록 반영
  - [ ] 키워드 검색(제품명 부분 일치) 동작
  - [ ] 조건 무결과 시 빈 상태 표시
  - [ ] 필터 상태가 URL 쿼리에 반영(공유·새로고침 유지)

**검증 방법**: 빌드 + 타입체크 + 수동 확인(단일/복합 필터, 무결과 상태).

---

## Phase 6 — 데이터 내보내기 (이식성)

### T6.1 [코드] JSON/CSV Export
- 설명: 본인 전체 데이터(measurements·사진 경로 포함)를 JSON/CSV로 다운로드.
- 대상: `app/export/route.ts`(또는 서버 액션), 다운로드 UI
- 수용 기준:
  - [ ] JSON 내보내기가 전체 필드 포함, 재적재 가능한 구조
  - [ ] CSV 내보내기가 스프레드시트에서 열림(인코딩·구분자 명확)
  - [ ] 사진은 Storage 경로/서명 URL 포함(바이너리 포함 여부는 열린 질문)
  - [ ] 본인 데이터만 내보내짐(RLS 준수)
  - [ ] 데이터 0건일 때도 오류 없이 빈 파일 생성

**검증 방법**: 빌드 + 타입체크 + 수동 확인(내보낸 JSON/CSV 열어 데이터 일치 확인).

---

## Phase 7 — measurements (실측 치수)

> measurements 저장 방식은 **미확정**(열린 질문). 스키마 확정 전까지 UI를 Phase 7로 분리해 코어 완성 이후 착수한다.

### T7.1 [코드] measurements 저장 + 입력 UI
- 설명: 카테고리별 유연한 실측 치수(어깨/가슴/총장 등) 입력·표시.
- 트레이드오프(확정 금지):
  - JSONB 단일 컬럼: 카테고리별 가변 필드에 유연, 마이그레이션 부담 낮음 / 쿼리·집계·검증이 약함.
  - 별도 정규화 테이블: 쿼리·제약·확장에 강함 / 초기 스키마·조인 복잡도 증가.
- 대상: (결정 후) `supabase/migrations/000x_measurements.sql`, 상세/폼 연동
- 수용 기준:
  - [ ] 카테고리에 맞는 치수 항목 입력·저장·표시
  - [ ] 빈 값 허용(선택 입력), 숫자 유효성 검사
  - [ ] Export에 measurements 포함
  - [ ] RLS 적용(본인만)

**검증 방법**: 빌드 + 타입체크 + 수동 확인(치수 입력→상세 표시→Export 포함).

---

## 비기능 요구 (전 Phase 공통)

| 항목 | 요구 | 검증 시점 |
|------|------|-----------|
| RLS 보안 | 모든 사용자 데이터 테이블·Storage에 행 수준 보안 | Phase 2(첫 데이터)부터 상시 |
| 타입 안정성 | DB→TS 타입 단일 소스, `any` 금지, 타입체크 CI | 매 Phase |
| 데이터 이식성 | JSON/CSV Export 상시 동작 | Phase 6 이후 |
| 시크릿 관리 | service_role 키 서버 전용, 클라이언트 미노출 | Phase 0·상시 |
| 반응형/PWA | 폰·PC 브라우저 동작(PWA 설치는 후순위 장식) | Phase 2 이후 |

## 엣지 · 실패 경로 체크리스트 (누락 금지)

- [ ] 빈 입력·필수값 누락 → 저장 차단 + 피드백
- [ ] 잘못된 형식(url, price, 이미지 형식/용량) → 검증 거부
- [ ] 미로그인 접근 → 로그인 리다이렉트(Phase 1)
- [ ] 사진 업로드 실패(네트워크/용량/형식) → 오류 + 고아 레코드 롤백
- [ ] 네트워크/DB 오류 → 사용자 메시지 + 입력값 보존
- [ ] 존재하지 않거나 비소유 id 접근 → 404/안내
- [ ] 무결과 검색·빈 목록 → 빈 상태 UI
- [ ] 다른 사용자 데이터 격리 → RLS 검증

## 예상 영향 범위(초안)

- 신규 파일: scaffold + 페이지/컴포넌트/마이그레이션 다수(Phase별 증분)
- 수정 파일: 각 Phase에서 이전 산출물에 점진 추가
- 삭제 파일: 없음(증분 확장)

---

## V2 / Backlog (V1 범위 밖 — 분리 보관)

- AI 보조 입력: 링크 파싱, 사진→사이즈 추출(초안 제시, 사람 확정)
- 통계·대시보드(브랜드별 사이즈 경향 등)
- 데이터 Import(내보낸 파일 재적재)
- 다국어, 복잡한 권한/공유, 태그 체계 고도화
- 사진 편집·크롭·다중 정렬

---

## 결정됨 (이력)

- **인증 시점 = auth-early** (2026-07-22): 데이터가 생기는 Phase 2부터 RLS를 켠다. 이전 초안의 'Phase 4 일괄 적용'을 대체.

## 열린 질문 (사용자 결정 필요 — 확정 금지)

1. **폼 처리 방식**: Next.js Server Action 단독 vs React Hook Form + Zod. (현재 계획은 Server Action 최소 구현으로 시작, 복잡도 증가 시 RHF+Zod 도입 — 확정 필요)
2. **measurements 저장**: JSONB 유연형 vs 별도 정규화 테이블. (트레이드오프는 Phase 7에 기재, 결정 대기)
3. **카테고리 초기 세트**: 상의/하의/아우터/신발/기타 — 이 5종으로 시작할지, 액세서리/이너웨어 등 추가할지.
4. **fit 값 범위**: 딱맞음/작음/큼 3값으로 충분한지, '약간 작음/약간 큼' 5단계로 세분할지.
5. **price 표현**: 통화 단일(원) 가정 vs 통화 필드 포함.
6. **Export 사진 포함 방식**: 경로/서명 URL만 vs 바이너리 동봉(zip).
7. **PWA 설치·오프라인**: V1에서 어디까지(설치 매니페스트만 vs 오프라인 캐시).

---

참고 근거: `ref-docs/specs/design/adr-0001-platform.md`, `adr-0002-data-storage.md`, `adr-0003-v1-scope.md`, `CLAUDE.md`(PROJECT 섹션).

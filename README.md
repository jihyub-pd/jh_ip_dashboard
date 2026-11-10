# jh_ip_dashboard

## 기획개발: ChatGPT 결과 보관

기획개발은 ChatGPT에서 진행하고, 연결된 Supabase 도구로 완성본을 등록한다. 대시보드의 소유자 전용 기획개발 탭에서 원작별 기획안·프리비주얼·PDF·수정 버전을 확인한다. 수정 의견은 요청 문구를 복사해 기존 ChatGPT 대화에 전달한다. 이 화면은 AI 실행 버튼이나 별도 API 키를 요구하지 않는다.

`CHATGPT_PUBLISHING.md`에 등록 규약과 준비 스크립트 사용법이 있다. 서버 전용 등록 함수가 중복 업로드를 방지하며, 파일과 검토 기록을 검증한 뒤 완료 처리한다. 브라우저에는 읽기 권한만 있고, 소유자 이외에는 기획안·첨부 파일을 볼 수 없다. 기존 버전은 보존한다.

DB 설정: 기존 `install-development.sql`, `development-immediate.sql`에 이어 `development-chatgpt-import.sql` 적용. 이전 API runner와 scheduler 코드는 보존했지만 배포/예약 실행하지 않는다. 활성 화면에서 호출하지 않는다.

검증: `node --experimental-strip-types --test tests/*test.*`, `python3 -m unittest discover -s tests -p 'test_*.py'`. SQL 등록·권한·버전 테스트는 트랜잭션 롤백으로 수행한다. 실제 기획안 제작과 파일 생성 품질 검증은 각 결과물을 등록할 때 별도로 수행한다.

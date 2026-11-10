# ChatGPT에서 기획안 등록

사용자는 이 대화에서 완성한 기획안을 IP 대시보드에 등록하도록 승인했다. 연결된 Supabase 도구로 현재 대화에서 등록한다. 별도 OpenAI API, 공개 업로드 엔드포인트, 상시 채팅 감시를 사용하지 않는다. 새 대화에서는 이 문서와 사용자 요청을 확인하고 연결 권한이 있는지 확인한다.

## 제작 및 검토

`DEVELOPMENT_ALGORITHM.md`를 따른다. 독립 검토는 실제 별도 AI 실행으로 수행하고 run ID 및 검토 기록을 보존한다. 자기검토를 독립 검토로 표시하거나 가짜 run ID를 만들지 않는다. 원문 접근이 안 된 부분과 추론/각색을 구분한다. 실제 PDF와 인물/공간 PNG를 생성하고 렌더링 검증한다.

## 등록 절차

대상 프로젝트: `ozhdfewlboheqpcvbqgz`. `ip_dashboard_private.owners`에서 실제 소유자를 확인한다(현재 한 명). 여러 소유자면 사용자 확인 없이 임의 선택하지 않는다. `kdrama_ips`의 실제 ID로 원작을 연결한다. 수정본은 기존 `ip_development_jobs.id`를 `parent_id`에 넣는다. 공개 IP 테이블에 비공개 기획안을 넣지 않는다.

로컬 bundle JSON:
- `owner_id`: 실제 소유자 UUID
- `import_key`: 이번 버전의 새 UUID. 네트워크 재시도 시 반드시 같은 값 사용
- `metadata`: `environment` (production/test), `mode` (ip/idea), `source_id`, `title`, 선택 `parent_id`, `source_text`, `request_text`
- `review`: `independent: true`, 실제 `author_run_id`, `reviewer_run_id`, `findings`, `recheck`
- `report`: 문자열 `logline`, `key_points`, `characters`, `synopsis`, `changes`, `verification`, `scope`
- `files`: `report.pdf`, `characters.png`, `spaces.png`를 키로 하는 로컬 파일 경로(bundle 기준 상대 경로 또는 절대 경로)
- `verdict`: completed 또는 needs_revision. 검증 미충족을 completed로 숨기지 않는다.

`python3 scripts/prepare-development-import.py bundle.json output-dir`로 SQL 배치를 준비한다. 이 스크립트는 네트워크 접근을 하지 않는다. 생성된 SQL 내용을 파일 순서대로 Supabase execute_sql의 query에 전달한다. 쉘 문자열에 본문을 삽입하지 않는다. 이미지와 파일은 base64 조각으로 등록되며 완성 전에는 사용자에게 노출되지 않는다. 최종 RPC는 필수 본문·독립 검토·파일 크기·형식을 검사한 후 원자적으로 완료 상태로 바꾼다. 대용량 파일은 전송 비용을 줄이도록 읽기 품질을 유지하며 압축한다.

완료 후 해당 ID의 상태, 버전, 원작 ID, 파일 개수를 조회하고 사용자 로그인 상태에서 화면을 확인할 수 있으면 확인한다. 실물 결과 없이 테스트용 기획안을 운영 목록에 게시하지 않는다. 완료된 버전은 수정하지 않고 새 버전으로 등록한다. 중단된 등록은 같은 import_key로 begin부터 재시도 가능하며 완료된 키는 중복 버전을 생성하지 않는다. 실패 원인을 해결할 수 없으면 서비스 전용 ip_dev_fail을 사용해 중단 표시하고 사용자에게 알린다.

업로드 대상 결과물이 대화에 없으면 이미 등록했다고 말하지 않는다. 사용자에게 자료를 다시 첨부하도록 안내한다. 기능 테스트용 데이터는 트랜잭션 롤백한다. bundle/SQL 배치에는 비공개 자료가 있으므로 Git에 커밋하지 않는다.

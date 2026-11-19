-- 랭킹에 표시할 사용자가 직접 정한 이름. 첫 로그인 때 입력받는다 (null = 아직 미입력).
alter table users add column if not exists display_name text;

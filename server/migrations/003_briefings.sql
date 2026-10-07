CREATE TABLE daily_briefings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),local_date TEXT NOT NULL,generated_at TEXT NOT NULL,briefing_json TEXT NOT NULL,UNIQUE(user_id,local_date));
CREATE TABLE job_state(user_id TEXT NOT NULL REFERENCES users(id),job TEXT NOT NULL,last_attempt TEXT,last_success TEXT,error TEXT,PRIMARY KEY(user_id,job));

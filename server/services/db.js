import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../self-mirror.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Multi-user: every account gets its own sessions, twin profile, and
// predictions, scoped by user_id. The "twin_profile" table used to be a
// hard singleton (id = 1) from this app's original single-user design; the
// migration below rebuilds it to allow one row per user instead.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE,
    password_hash TEXT,
    is_guest      INTEGER DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER,
    context       TEXT    NOT NULL,
    video_path    TEXT,
    photo_paths   TEXT,
    audio_path    TEXT,
    transcript    TEXT,
    consent_at    DATETIME NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    INTEGER NOT NULL,
    result        TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS twin_profile (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER UNIQUE,
    personality       TEXT,
    voice_id          TEXT,
    session_count     INTEGER DEFAULT 0,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    heygen_avatar_group_id TEXT,
    heygen_avatar_id TEXT,
    heygen_consent_status TEXT,
    heygen_consent_url TEXT
  );

  CREATE TABLE IF NOT EXISTS variants (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    INTEGER NOT NULL,
    style         TEXT    NOT NULL,
    text          TEXT    NOT NULL,
    video_status  TEXT,
    video_path    TEXT,
    heygen_video_id TEXT,
    dub_video_path TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scenario_predictions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER,
    scenario      TEXT    NOT NULL,
    prediction    TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS life_paths (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER,
    result        TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Older databases predate the users table and won't have user_id columns
// yet; add them if missing rather than requiring a fresh database.
for (const [table, cols] of Object.entries({
  sessions: ['user_id INTEGER'],
  scenario_predictions: ['user_id INTEGER'],
  life_paths: ['user_id INTEGER'],
})) {
  for (const col of cols) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch { /* already exists */ }
  }
}

// users.email/password_hash used to be NOT NULL, before guest accounts
// (which have neither) existed — same rebuild-the-table approach as
// twin_profile below, since SQLite can't ALTER a column's NOT NULL-ness.
const usersHasIsGuest = db.prepare("PRAGMA table_info(users)").all().some((c) => c.name === 'is_guest');
if (!usersHasIsGuest) {
  db.exec(`
    CREATE TABLE users_new (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    UNIQUE,
      password_hash TEXT,
      is_guest      INTEGER DEFAULT 0,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO users_new (id, email, password_hash, created_at)
      SELECT id, email, password_hash, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
  `);
}

// twin_profile's old CHECK (id = 1) constraint can't be dropped with ALTER
// TABLE in SQLite — only ever rebuilding it via a fresh table swap removes
// it, so this only runs once, the first time a pre-account database is seen.
const twinProfileHasUserId = db.prepare("PRAGMA table_info(twin_profile)").all().some((c) => c.name === 'user_id');
if (!twinProfileHasUserId) {
  db.exec(`
    CREATE TABLE twin_profile_new (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER UNIQUE,
      personality       TEXT,
      voice_id          TEXT,
      session_count     INTEGER DEFAULT 0,
      updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      heygen_avatar_group_id TEXT,
      heygen_avatar_id TEXT,
      heygen_consent_status TEXT,
      heygen_consent_url TEXT
    );
    INSERT INTO twin_profile_new (id, personality, voice_id, session_count, updated_at, heygen_avatar_group_id, heygen_avatar_id, heygen_consent_status, heygen_consent_url)
      SELECT id, personality, voice_id, session_count, updated_at, heygen_avatar_group_id, heygen_avatar_id, heygen_consent_status, heygen_consent_url FROM twin_profile;
    DROP TABLE twin_profile;
    ALTER TABLE twin_profile_new RENAME TO twin_profile;
  `);
}

// The very first account ever created on a database that predates accounts
// inherits whatever single-user data already exists (recordings, twin
// profile, etc.) instead of orphaning it — see routes/auth.js signup.
export function claimOrphanedDataForFirstUser(userId) {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount !== 1) return;
  for (const table of ['sessions', 'twin_profile', 'scenario_predictions', 'life_paths']) {
    db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(userId);
  }
}

// Guest accounts are anonymous and unrecoverable once their session cookie
// is gone (see routes/auth.js POST /guest) — deleting them after a day
// keeps demo/guest usage from accumulating forever on disk. This only
// removes the database rows; it returns the associated uploaded filenames
// so the caller (which knows UPLOADS_DIR) can delete the files themselves.
export function deleteOldGuests(maxAgeMs) {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString().replace('T', ' ').slice(0, 19);
  const oldGuests = db.prepare('SELECT id FROM users WHERE is_guest = 1 AND created_at < ?').all(cutoff);

  const files = [];
  for (const { id } of oldGuests) {
    const sessions = db.prepare('SELECT video_path, audio_path, photo_paths FROM sessions WHERE user_id = ?').all(id);
    const variants = db.prepare(`
      SELECT v.video_path, v.dub_video_path FROM variants v
      JOIN sessions s ON v.session_id = s.id
      WHERE s.user_id = ?
    `).all(id);
    files.push(
      ...sessions.flatMap((s) => [s.video_path, s.audio_path, ...JSON.parse(s.photo_paths || '[]')]),
      ...variants.flatMap((v) => [v.video_path, v.dub_video_path])
    );

    db.prepare('DELETE FROM scenario_predictions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM life_paths WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id); // cascades variants/analyses
    db.prepare('DELETE FROM twin_profile WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  return { deletedUserCount: oldGuests.length, files: files.filter(Boolean) };
}

// SQLite's CURRENT_TIMESTAMP returns UTC time as "YYYY-MM-DD HH:MM:SS" with
// no timezone marker. Without an explicit "Z", clients can misparse it as
// local time instead of UTC, throwing display off by the local UTC offset.
export function toISO(sqliteTimestamp) {
  return sqliteTimestamp ? sqliteTimestamp.replace(' ', 'T') + 'Z' : sqliteTimestamp;
}

export function getTwinProfile(userId) {
  return db.prepare('SELECT * FROM twin_profile WHERE user_id = ?').get(userId);
}

export function upsertTwinProfile(userId, { personality, voiceId, sessionCount, heygenAvatarGroupId, heygenAvatarId, heygenConsentStatus, heygenConsentUrl }) {
  const existing = getTwinProfile(userId);
  if (existing) {
    db.prepare(`
      UPDATE twin_profile
      SET personality = COALESCE(?, personality),
          voice_id = COALESCE(?, voice_id),
          session_count = COALESCE(?, session_count),
          heygen_avatar_group_id = COALESCE(?, heygen_avatar_group_id),
          heygen_avatar_id = COALESCE(?, heygen_avatar_id),
          heygen_consent_status = COALESCE(?, heygen_consent_status),
          heygen_consent_url = COALESCE(?, heygen_consent_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      personality ?? null, voiceId ?? null, sessionCount ?? null,
      heygenAvatarGroupId ?? null, heygenAvatarId ?? null, heygenConsentStatus ?? null, heygenConsentUrl ?? null,
      userId
    );
  } else {
    db.prepare(`
      INSERT INTO twin_profile (user_id, personality, voice_id, session_count, heygen_avatar_group_id, heygen_avatar_id, heygen_consent_status, heygen_consent_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, personality ?? null, voiceId ?? null, sessionCount ?? 0,
      heygenAvatarGroupId ?? null, heygenAvatarId ?? null, heygenConsentStatus ?? null, heygenConsentUrl ?? null
    );
  }
  return getTwinProfile(userId);
}

export default db;

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import * as schema from "./schema";
import { categories, categoryRules } from "./schema";

const DB_VERSION = 5; // Bump this to force a DB reset + re-seed

// Rule definition with optional matchMode (defaults to "contains")
interface RuleDef {
  pattern: string;
  matchMode?: "exact" | "contains" | "regex";
}

// Default category seed data
const DEFAULT_CATEGORIES: Array<{
  name: string;
  color: string;
  priority: number;
  rules: {
    apps: (string | RuleDef)[];
    domains: (string | RuleDef)[];
    keywords: (string | RuleDef)[];
    domainKeywords?: (string | RuleDef)[];
    filePaths?: (string | RuleDef)[];
  };
}> = [
  {
    name: "development",
    color: "#6366F1",
    priority: 10,
    rules: {
      apps: [
        "Code", "Visual Studio Code", "VS Code", "WebStorm", "IntelliJ",
        "PyCharm", "Cursor", "Zed", "Xcode", "Android Studio",
        "Terminal", "WezTerm", "iTerm", "Warp", "Hyper", "Alacritty", "kitty",
      ],
      domains: [
        "github.com", "gitlab.com", "bitbucket.org",
        "stackoverflow.com", "stackexchange.com",
        "npmjs.com", "pypi.org", "crates.io",
        "localhost", "127.0.0.1",
        "developer.mozilla.org", "react.dev",
        "typescriptlang.org", "vitejs.dev",
        "docs.docker.com",
      ],
      keywords: [
        { pattern: "\\bta\\b", matchMode: "regex" },
        { pattern: "\\btat\\b", matchMode: "regex" },
        "nvim", "vim", "vscode",
        "git", "npm", "yarn",
        "react", "typescript", "javascript", "python",
        "nextjs", "node.js", "webpack", "tailwind",
        "api", "frontend", "backend", "fullstack",
        "algorithm", "data structure",
      ],
      domainKeywords: [
        "claude.ai|typescript", "claude.ai|react", "claude.ai|bug",
        "claude.ai|error", "claude.ai|code", "claude.ai|fix",
        "claude.ai|debug", "claude.ai|implement",
        "chat.openai.com|typescript", "chat.openai.com|react",
        "chat.openai.com|error", "chat.openai.com|fix",
        "chat.openai.com|debug", "chat.openai.com|code",
        "youtube.com|coding", "youtube.com|programming",
        "youtube.com|vscode", "youtube.com|typescript tutorial",
      ],
      filePaths: [
        { pattern: "\\.(ts|tsx|js|jsx|py|go|java|rs|c|cpp|vue|svelte)$", matchMode: "regex" },
        { pattern: "(package\\.json|tsconfig\\.json|cargo\\.toml|go\\.mod|requirements\\.txt)", matchMode: "regex" },
        { pattern: "/src/", matchMode: "contains" },
        { pattern: "/lib/", matchMode: "contains" },
      ],
    },
  },
  {
    name: "system_admin",
    color: "#10B981",
    priority: 9,
    rules: {
      apps: [],
      domains: [
        "nginx.org", "nginx.com",
        "docker.com", "hub.docker.com",
      ],
      keywords: [
        "nginx", "docker", "kubernetes", "k8s",
        "ssh", "systemctl", "journalctl",
        "firewall", "ufw", "iptables",
        "compose", "dockerfile",
      ],
      domainKeywords: [
        "youtube.com|nginx", "youtube.com|docker",
        "youtube.com|kubernetes", "youtube.com|devops",
        "github.com|nginx", "github.com|docker-compose",
      ],
      filePaths: [
        { pattern: "(nginx\\.conf|docker-compose\\.yml|dockerfile|\\.env|\\.sh)$", matchMode: "regex" },
      ],
    },
  },
  {
    name: "communication",
    color: "#22C55E",
    priority: 10,
    rules: {
      apps: [
        "Slack", "Discord", "Microsoft Teams",
        "Zoom", "Google Meet", "Skype",
        "Telegram", "WhatsApp", "Messages",
      ],
      domains: [
        "slack.com", "discord.com",
        "teams.microsoft.com", "zoom.us",
        "meet.google.com",
      ],
      keywords: ["meeting", "call"],
    },
  },
  {
    name: "social",
    color: "#EAB308",
    priority: 4,
    rules: {
      apps: ["Twitter", "Facebook", "TweetDeck"],
      domains: [
        "twitter.com", "x.com",
        "facebook.com", "instagram.com",
        "reddit.com", "linkedin.com",
        "tiktok.com",
      ],
      keywords: [],
    },
  },
  {
    name: "entertainment",
    color: "#EF4444",
    priority: 4,
    rules: {
      apps: [
        "Spotify", "Apple Music",
        "Netflix", "VLC", "IINA", "Plex",
      ],
      domains: [
        "youtube.com", "youtu.be",
        "spotify.com", "music.apple.com",
        "netflix.com", "twitch.tv",
        "hulu.com", "disneyplus.com", "primevideo.com",
      ],
      keywords: ["music video", "official video", "trailer"],
      domainKeywords: [
        "youtube.com|music video",
        "youtube.com|official video",
        "youtube.com|trailer",
        "youtube.com|clip",
      ],
    },
  },
  {
    name: "research",
    color: "#0EA5E9",
    priority: 6,
    rules: {
      apps: [],
      domains: [
        "wikipedia.org", "arxiv.org", "scholar.google.com",
        "coursera.org", "udemy.com", "educative.io",
        "egghead.io", "frontendmasters.com", "pluralsight.com",
        "claude.ai", "chat.openai.com", "chatgpt.com",
        "gemini.google.com", "perplexity.ai",
        "medium.com", "dev.to", "hashnode.dev",
        "substack.com", "hackernews.com",
        "news.ycombinator.com",
        "freecodecamp.org", "w3schools.com",
        "geeksforgeeks.org", "baeldung.com",
        "smashingmagazine.com", "css-tricks.com",
      ],
      keywords: [
        "article", "tutorial", "guide", "documentation",
        "how to", "explained", "introduction to",
      ],
      domainKeywords: [
        "youtube.com|tutorial", "youtube.com|course",
        "youtube.com|lecture", "youtube.com|explained",
        "youtube.com|documentation", "youtube.com|guide",
        "youtube.com|learn", "youtube.com|how to",
      ],
      filePaths: [
        { pattern: "\\.(pdf|epub)$", matchMode: "regex" },
      ],
    },
  },
  {
    name: "content_creation",
    color: "#F59E0B",
    priority: 8,
    rules: {
      apps: [
        "Premiere Pro", "Final Cut", "DaVinci Resolve",
        "OBS", "OBS Studio",
      ],
      domains: [
        "studio.youtube.com",
      ],
      keywords: [
        "recording", "editing",
        "thumbnail", "upload", "render",
      ],
    },
  },
  {
    name: "knowledge_work",
    color: "#A855F7",
    priority: 9,
    rules: {
      apps: ["Obsidian", "Notion", "Logseq", "Roam"],
      domains: ["notion.so", "obsidian.md"],
      keywords: [],
      filePaths: [
        { pattern: "\\.(md|txt)$", matchMode: "regex" },
      ],
    },
  },
  {
    name: "documentation",
    color: "#8B5CF6",
    priority: 8,
    rules: {
      apps: [
        "Microsoft Word", "Pages", "Google Docs",
        "Excel", "Numbers", "Keynote", "PowerPoint",
      ],
      domains: [
        "docs.google.com", "sheets.google.com",
        "slides.google.com",
      ],
      keywords: [],
    },
  },
  {
    name: "email",
    color: "#EC4899",
    priority: 10,
    rules: {
      apps: ["Mail", "Outlook", "Thunderbird", "Spark", "Airmail"],
      domains: [
        "gmail.com", "outlook.com", "mail.google.com", "mail.yahoo.com",
      ],
      keywords: ["inbox", "compose"],
    },
  },
  {
    name: "design",
    color: "#F97316",
    priority: 10,
    rules: {
      apps: [
        "Figma", "Sketch", "Adobe Photoshop", "Adobe Illustrator",
        "Adobe XD", "Canva", "Affinity",
      ],
      domains: ["figma.com", "canva.com", "dribbble.com", "behance.net"],
      keywords: ["mockup", "prototype"],
    },
  },
  {
    name: "uncategorized",
    color: "#64748B",
    priority: 0,
    rules: { apps: [], domains: [], keywords: [] },
  },
];

function createDatabase() {
  const dbPath = path.join(app.getPath("userData"), "activity-tracker.db");
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better performance
  sqlite.pragma("journal_mode = WAL");
  // Enable foreign keys
  sqlite.pragma("foreign_keys = ON");

  // Check version and reset if needed
  const currentVersion = sqlite.pragma("user_version", { simple: true }) as number;

  if (currentVersion < DB_VERSION) {
    // Drop all tables and recreate
    sqlite.exec("DROP TABLE IF EXISTS category_rules");
    sqlite.exec("DROP TABLE IF EXISTS activities");
    sqlite.exec("DROP TABLE IF EXISTS sessions");
    sqlite.exec("DROP TABLE IF EXISTS categories");

    // Set new version
    sqlite.pragma(`user_version = ${DB_VERSION}`);
  }

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      pattern TEXT NOT NULL,
      match_mode TEXT NOT NULL DEFAULT 'contains'
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      total_duration INTEGER NOT NULL DEFAULT 0,
      activity_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      app_name TEXT NOT NULL,
      window_title TEXT,
      url TEXT,
      category_id INTEGER REFERENCES categories(id),
      project_name TEXT,
      file_name TEXT,
      file_type TEXT,
      language TEXT,
      domain TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      context_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_app_name ON activities(app_name)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_category_id ON activities(category_id)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_project ON activities(project_name)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_start_time ON activities(start_time)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_session_id ON activities(session_id)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_time)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_category_rules_cat ON category_rules(category_id)");

  const db = drizzle(sqlite, { schema });

  // Seed if categories table is empty
  seedDatabase(db);

  return db;
}

function seedDatabase(db: ReturnType<typeof drizzle>) {
  // Check if categories already exist
  const existing = db.select().from(categories).all();
  if (existing.length > 0) return;

  for (const cat of DEFAULT_CATEGORIES) {
    const result = db
      .insert(categories)
      .values({
        name: cat.name,
        color: cat.color,
        isDefault: 1,
        priority: cat.priority,
      })
      .returning({ id: categories.id })
      .get();

    const categoryId = result.id;

    const ruleRows: Array<{ categoryId: number; type: string; pattern: string; matchMode: string }> = [];

    for (const item of cat.rules.apps) {
      if (typeof item === "string") {
        ruleRows.push({ categoryId, type: "app", pattern: item, matchMode: "contains" });
      } else {
        ruleRows.push({ categoryId, type: "app", pattern: item.pattern, matchMode: item.matchMode ?? "contains" });
      }
    }
    for (const item of cat.rules.domains) {
      if (typeof item === "string") {
        ruleRows.push({ categoryId, type: "domain", pattern: item, matchMode: "contains" });
      } else {
        ruleRows.push({ categoryId, type: "domain", pattern: item.pattern, matchMode: item.matchMode ?? "contains" });
      }
    }
    for (const item of cat.rules.keywords) {
      if (typeof item === "string") {
        ruleRows.push({ categoryId, type: "keyword", pattern: item, matchMode: "contains" });
      } else {
        ruleRows.push({ categoryId, type: "keyword", pattern: item.pattern, matchMode: item.matchMode ?? "contains" });
      }
    }
    for (const item of cat.rules.domainKeywords ?? []) {
      if (typeof item === "string") {
        ruleRows.push({ categoryId, type: "domain_keyword", pattern: item, matchMode: "contains" });
      } else {
        ruleRows.push({ categoryId, type: "domain_keyword", pattern: item.pattern, matchMode: item.matchMode ?? "contains" });
      }
    }
    for (const item of cat.rules.filePaths ?? []) {
      if (typeof item === "string") {
        ruleRows.push({ categoryId, type: "file_path", pattern: item, matchMode: "contains" });
      } else {
        ruleRows.push({ categoryId, type: "file_path", pattern: item.pattern, matchMode: item.matchMode ?? "contains" });
      }
    }

    if (ruleRows.length > 0) {
      db.insert(categoryRules).values(ruleRows).run();
    }
  }
}

// Export database instance (lazy initialization)
let _db: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDatabase();
  }
  return _db;
}

// Export schema for use in queries
export * from "./schema";

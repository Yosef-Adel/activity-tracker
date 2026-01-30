import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../db/schema";
import { categories, categoryRules, activities } from "../../db/schema";

// Create an in-memory DB for testing
function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  sqlite.exec(`
    CREATE TABLE category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      pattern TEXT NOT NULL,
      match_mode TEXT NOT NULL DEFAULT 'contains'
    )
  `);
  sqlite.exec(`
    CREATE TABLE sessions (
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
    CREATE TABLE activities (
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

  return drizzle(sqlite, { schema });
}

let testDb: ReturnType<typeof createTestDb>;

// Mock getDb to return our in-memory DB
vi.mock("../../db", async () => {
  const actual = await vi.importActual<typeof import("../../db/schema")>("../../db/schema");
  return {
    ...actual,
    getDb: () => testDb,
  };
});

// Import categorizer after mock is set up
import ActivityCategorizer from "../categorizer";

// Seed helper: insert a category and its rules
function seedCategory(
  name: string,
  color: string,
  rules: {
    apps?: (string | { pattern: string; matchMode: string })[];
    domains?: (string | { pattern: string; matchMode: string })[];
    keywords?: (string | { pattern: string; matchMode: string })[];
    domainKeywords?: (string | { pattern: string; matchMode: string })[];
  },
  priority = 0,
): number {
  const result = testDb
    .insert(categories)
    .values({ name, color, isDefault: 1, priority })
    .returning({ id: categories.id })
    .get();
  const id = result.id;

  const rows: Array<{ categoryId: number; type: string; pattern: string; matchMode: string }> = [];
  for (const item of rules.apps ?? []) {
    if (typeof item === "string") {
      rows.push({ categoryId: id, type: "app", pattern: item, matchMode: "contains" });
    } else {
      rows.push({ categoryId: id, type: "app", pattern: item.pattern, matchMode: item.matchMode });
    }
  }
  for (const item of rules.domains ?? []) {
    if (typeof item === "string") {
      rows.push({ categoryId: id, type: "domain", pattern: item, matchMode: "contains" });
    } else {
      rows.push({ categoryId: id, type: "domain", pattern: item.pattern, matchMode: item.matchMode });
    }
  }
  for (const item of rules.keywords ?? []) {
    if (typeof item === "string") {
      rows.push({ categoryId: id, type: "keyword", pattern: item, matchMode: "contains" });
    } else {
      rows.push({ categoryId: id, type: "keyword", pattern: item.pattern, matchMode: item.matchMode });
    }
  }
  for (const item of rules.domainKeywords ?? []) {
    if (typeof item === "string") {
      rows.push({ categoryId: id, type: "domain_keyword", pattern: item, matchMode: "contains" });
    } else {
      rows.push({ categoryId: id, type: "domain_keyword", pattern: item.pattern, matchMode: item.matchMode });
    }
  }

  if (rows.length > 0) {
    testDb.insert(categoryRules).values(rows).run();
  }
  return id;
}

function seedDefaults() {
  const devId = seedCategory("development", "#6366F1", {
    apps: ["Code", "Visual Studio Code", "VS Code", "WebStorm", "Terminal", "iTerm"],
    domains: ["github.com", "gitlab.com", "stackoverflow.com", "localhost"],
    keywords: [
      "debug", "coding", "terminal", "git", "npm",
      { pattern: "\\bta\\b", matchMode: "regex" },
    ],
  }, 10);
  const commId = seedCategory("communication", "#22C55E", {
    apps: ["Slack", "Discord", "Microsoft Teams", "Zoom"],
    domains: ["slack.com", "discord.com", "teams.microsoft.com", "zoom.us"],
    keywords: ["chat", "meeting", "call"],
  }, 10);
  const socialId = seedCategory("social", "#EAB308", {
    apps: ["Twitter", "Facebook"],
    domains: ["twitter.com", "x.com", "facebook.com", "instagram.com", "reddit.com"],
    keywords: ["social", "feed", "timeline"],
  }, 4);
  const entertainId = seedCategory("entertainment", "#EF4444", {
    apps: ["Spotify", "Netflix", "VLC"],
    domains: ["youtube.com", "netflix.com", "spotify.com", "twitch.tv"],
    keywords: ["music", "stream", "watch", "play"],
  }, 4);
  const productivityId = seedCategory("productivity", "#A855F7", {
    apps: ["Notion", "Obsidian", "Microsoft Word"],
    domains: ["notion.so", "docs.google.com", "trello.com"],
    keywords: ["document", "notes", "spreadsheet", "task"],
  }, 8);
  const researchId = seedCategory("research", "#0EA5E9", {
    apps: [],
    domains: ["wikipedia.org", "medium.com", "dev.to", "arxiv.org"],
    keywords: ["search", "research", "article", "tutorial", "learn", "wiki"],
    domainKeywords: [
      "youtube.com|tutorial", "youtube.com|learn", "youtube.com|course",
      "youtube.com|how to", "youtube.com|lecture",
    ],
  }, 6);
  const emailId = seedCategory("email", "#EC4899", {
    apps: ["Mail", "Outlook", "Thunderbird"],
    domains: ["gmail.com", "outlook.com", "mail.google.com"],
    keywords: ["email", "inbox", "compose"],
  }, 10);
  const designId = seedCategory("design", "#F97316", {
    apps: ["Figma", "Sketch", "Adobe Photoshop"],
    domains: ["figma.com", "canva.com", "dribbble.com"],
    keywords: ["design", "prototype", "mockup"],
  }, 10);
  const uncatId = seedCategory("uncategorized", "#64748B", {}, 0);

  return { devId, commId, socialId, entertainId, productivityId, researchId, emailId, designId, uncatId };
}

describe("ActivityCategorizer", () => {
  let categorizer: ActivityCategorizer;
  let ids: ReturnType<typeof seedDefaults>;

  beforeEach(() => {
    testDb = createTestDb();
    ids = seedDefaults();
    categorizer = new ActivityCategorizer();
  });

  // ──────────────────────────────────────────────
  // categorize() — Priority 1: App name matching
  // ──────────────────────────────────────────────

  describe("categorize() — app name matching (priority 1)", () => {
    it("matches VS Code to development", () => {
      const result = categorizer.categorize({ appName: "Code", title: "main.ts" });
      expect(result).toBe(ids.devId);
    });

    it("matches case-insensitively", () => {
      const result = categorizer.categorize({ appName: "slack", title: "general" });
      expect(result).toBe(ids.commId);
    });

    it("matches substring of app name", () => {
      const result = categorizer.categorize({ appName: "Visual Studio Code", title: "file.ts" });
      expect(result).toBe(ids.devId);
    });

    it("matches Slack to communication", () => {
      const result = categorizer.categorize({ appName: "Slack", title: "#general" });
      expect(result).toBe(ids.commId);
    });

    it("matches Discord to communication", () => {
      const result = categorizer.categorize({ appName: "Discord", title: "Server" });
      expect(result).toBe(ids.commId);
    });

    it("matches Twitter to social", () => {
      const result = categorizer.categorize({ appName: "Twitter", title: "Home" });
      expect(result).toBe(ids.socialId);
    });

    it("matches Spotify to entertainment", () => {
      const result = categorizer.categorize({ appName: "Spotify", title: "Song" });
      expect(result).toBe(ids.entertainId);
    });

    it("matches Notion to productivity", () => {
      const result = categorizer.categorize({ appName: "Notion", title: "Workspace" });
      expect(result).toBe(ids.productivityId);
    });

    it("matches Mail to email", () => {
      const result = categorizer.categorize({ appName: "Mail", title: "Inbox" });
      expect(result).toBe(ids.emailId);
    });

    it("matches Figma to design", () => {
      const result = categorizer.categorize({ appName: "Figma", title: "Project" });
      expect(result).toBe(ids.designId);
    });

    it("matches Terminal to development", () => {
      const result = categorizer.categorize({ appName: "Terminal", title: "zsh" });
      expect(result).toBe(ids.devId);
    });

    it("matches iTerm to development", () => {
      const result = categorizer.categorize({ appName: "iTerm", title: "bash" });
      expect(result).toBe(ids.devId);
    });
  });

  // ──────────────────────────────────────────────
  // categorize() — Priority 2: Domain+keyword compound rules
  // ──────────────────────────────────────────────

  describe("categorize() — domain+keyword compound matching (priority 2)", () => {
    it("matches youtube.com with 'tutorial' in title to research", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "React tutorial for beginners",
        url: "https://www.youtube.com/watch?v=123",
      });
      expect(result).toBe(ids.researchId);
    });

    it("matches youtube.com with 'learn' in title to research", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Learn TypeScript in 1 Hour",
        url: "https://youtube.com/watch?v=abc",
      });
      expect(result).toBe(ids.researchId);
    });

    it("matches youtube.com with 'course' in title to research", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Full course on Node.js",
        url: "https://www.youtube.com/watch?v=xyz",
      });
      expect(result).toBe(ids.researchId);
    });

    it("matches youtube.com with 'how to' in title to research", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "How to build a REST API",
        url: "https://www.youtube.com/watch?v=def",
      });
      expect(result).toBe(ids.researchId);
    });

    it("falls back to entertainment for youtube.com without research keywords", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Funny cats compilation",
        url: "https://www.youtube.com/watch?v=cats",
      });
      expect(result).toBe(ids.entertainId);
    });

    it("does not match compound rule when domain does not match", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "React tutorial for beginners",
        url: "https://www.vimeo.com/watch?v=123",
      });
      // No domain match for vimeo, but keyword "tutorial" matches research
      expect(result).toBe(ids.researchId); // via keyword match
    });
  });

  // ──────────────────────────────────────────────
  // categorize() — Priority 3: Domain matching
  // ──────────────────────────────────────────────

  describe("categorize() — domain matching (priority 3)", () => {
    it("matches github.com to development", () => {
      const result = categorizer.categorize({
        appName: "Google Chrome",
        title: "Pull Request",
        url: "https://github.com/user/repo",
      });
      expect(result).toBe(ids.devId);
    });

    it("matches stackoverflow.com to development", () => {
      const result = categorizer.categorize({
        appName: "Safari",
        title: "How to...",
        url: "https://stackoverflow.com/questions/123",
      });
      expect(result).toBe(ids.devId);
    });

    it("matches slack.com to communication", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Slack",
        url: "https://app.slack.com/client",
      });
      expect(result).toBe(ids.commId);
    });

    it("matches twitter.com to social", () => {
      const result = categorizer.categorize({
        appName: "Firefox",
        title: "Home / X",
        url: "https://twitter.com/home",
      });
      expect(result).toBe(ids.socialId);
    });

    it("matches youtube.com (no research keyword) to entertainment", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "YouTube",
        url: "https://youtube.com/watch?v=123",
      });
      expect(result).toBe(ids.entertainId);
    });

    it("matches notion.so to productivity", () => {
      const result = categorizer.categorize({
        appName: "Arc",
        title: "My Notes",
        url: "https://www.notion.so/page",
      });
      expect(result).toBe(ids.productivityId);
    });

    it("matches wikipedia.org to research", () => {
      const result = categorizer.categorize({
        appName: "Safari",
        title: "Article",
        url: "https://en.wikipedia.org/wiki/Test",
      });
      expect(result).toBe(ids.researchId);
    });

    it("matches gmail.com to email", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Inbox",
        url: "https://mail.google.com/mail",
      });
      expect(result).toBe(ids.emailId);
    });

    it("matches figma.com to design", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Design File",
        url: "https://www.figma.com/file/abc",
      });
      expect(result).toBe(ids.designId);
    });

    it("matches localhost to development", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Dev Server",
        url: "http://localhost:3000",
      });
      expect(result).toBe(ids.devId);
    });

    it("matches reddit.com to social", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "r/programming",
        url: "https://www.reddit.com/r/programming",
      });
      expect(result).toBe(ids.socialId);
    });

    it("does NOT match fakehub.com to development (hostname parsing)", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Some Page",
        url: "https://fakehub.com/page",
      });
      expect(result).not.toBe(ids.devId);
    });

    it("matches subdomain of a domain rule (e.g., app.slack.com matches slack.com)", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Workspace",
        url: "https://app.slack.com/workspace",
      });
      expect(result).toBe(ids.commId);
    });
  });

  // ──────────────────────────────────────────────
  // categorize() — Priority 4: Keyword matching
  // ──────────────────────────────────────────────

  describe("categorize() — keyword matching (priority 4)", () => {
    it("matches 'debug' keyword to development", () => {
      const result = categorizer.categorize({
        appName: "Unknown App",
        title: "Debug session running",
      });
      expect(result).toBe(ids.devId);
    });

    it("matches 'meeting' keyword to communication", () => {
      const result = categorizer.categorize({
        appName: "Some App",
        title: "Daily meeting standup",
      });
      expect(result).toBe(ids.commId);
    });

    it("matches 'feed' keyword to social", () => {
      const result = categorizer.categorize({
        appName: "Browser",
        title: "News feed updates",
      });
      expect(result).toBe(ids.socialId);
    });

    it("matches 'stream' keyword to entertainment", () => {
      const result = categorizer.categorize({
        appName: "App",
        title: "Live stream starting",
      });
      expect(result).toBe(ids.entertainId);
    });

    it("matches 'document' keyword to productivity", () => {
      const result = categorizer.categorize({
        appName: "App",
        title: "Editing document",
      });
      expect(result).toBe(ids.productivityId);
    });

    it("matches 'tutorial' keyword to research", () => {
      const result = categorizer.categorize({
        appName: "Browser",
        title: "React tutorial for beginners",
      });
      expect(result).toBe(ids.researchId);
    });

    it("matches 'inbox' keyword to email", () => {
      const result = categorizer.categorize({
        appName: "App",
        title: "inbox (3 unread)",
      });
      expect(result).toBe(ids.emailId);
    });

    it("matches 'prototype' keyword to design", () => {
      const result = categorizer.categorize({
        appName: "App",
        title: "Creating a prototype",
      });
      expect(result).toBe(ids.designId);
    });

    it("matches keyword in URL, not just title", () => {
      const result = categorizer.categorize({
        appName: "Browser",
        title: "Page",
        url: "https://example.com/tutorial/react",
      });
      expect(result).toBe(ids.researchId);
    });

    it("matches regex keyword with word boundary (\\bta\\b)", () => {
      const result = categorizer.categorize({
        appName: "Unknown",
        title: "Running ta command",
      });
      expect(result).toBe(ids.devId);
    });

    it("does NOT match regex \\bta\\b inside a longer word like 'table'", () => {
      const result = categorizer.categorize({
        appName: "Unknown",
        title: "Looking at a table",
      });
      expect(result).not.toBe(ids.devId);
    });
  });

  // ──────────────────────────────────────────────
  // categorize() — Priority cascade
  // ──────────────────────────────────────────────

  describe("categorize() — priority cascade", () => {
    it("app name takes priority over domain", () => {
      const result = categorizer.categorize({
        appName: "Slack",
        title: "GitHub link",
        url: "https://github.com/org/repo",
      });
      expect(result).toBe(ids.commId);
    });

    it("app name takes priority over keyword", () => {
      const result = categorizer.categorize({
        appName: "Code",
        title: "meeting-notes.md",
      });
      expect(result).toBe(ids.devId);
    });

    it("domain takes priority over keyword", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "music-player repo",
        url: "https://github.com/user/music-player",
      });
      expect(result).toBe(ids.devId);
    });

    it("compound domain+keyword takes priority over plain domain", () => {
      // youtube.com + "tutorial" → research (compound), not entertainment (plain domain)
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "JavaScript tutorial",
        url: "https://www.youtube.com/watch?v=123",
      });
      expect(result).toBe(ids.researchId);
    });
  });

  // ──────────────────────────────────────────────
  // categorize() — Fallback to uncategorized
  // ──────────────────────────────────────────────

  describe("categorize() — uncategorized fallback", () => {
    it("returns uncategorized for unknown app with no matching domain or keywords", () => {
      const result = categorizer.categorize({
        appName: "Random App",
        title: "Something unrelated",
      });
      expect(result).toBe(ids.uncatId);
    });

    it("returns uncategorized for empty title and no url", () => {
      const result = categorizer.categorize({
        appName: "Unknown",
        title: "",
      });
      expect(result).toBe(ids.uncatId);
    });

    it("returns uncategorized when url is null", () => {
      const result = categorizer.categorize({
        appName: "SomeApp",
        title: "Window",
        url: null,
      });
      expect(result).toBe(ids.uncatId);
    });

    it("returns uncategorized when url is undefined", () => {
      const result = categorizer.categorize({
        appName: "SomeApp",
        title: "Window",
      });
      expect(result).toBe(ids.uncatId);
    });
  });

  // ──────────────────────────────────────────────
  // getCategoryColor / getCategoryName
  // ──────────────────────────────────────────────

  describe("getCategoryColor()", () => {
    it("returns the correct color for a known category", () => {
      expect(categorizer.getCategoryColor(ids.devId)).toBe("#6366F1");
      expect(categorizer.getCategoryColor(ids.commId)).toBe("#22C55E");
      expect(categorizer.getCategoryColor(ids.designId)).toBe("#F97316");
    });

    it("returns fallback color for unknown category ID", () => {
      expect(categorizer.getCategoryColor(9999)).toBe("#64748B");
    });
  });

  describe("getCategoryName()", () => {
    it("returns the correct name for a known category", () => {
      expect(categorizer.getCategoryName(ids.devId)).toBe("development");
      expect(categorizer.getCategoryName(ids.emailId)).toBe("email");
    });

    it("returns 'uncategorized' for unknown category ID", () => {
      expect(categorizer.getCategoryName(9999)).toBe("uncategorized");
    });
  });

  // ──────────────────────────────────────────────
  // getUncategorizedId / getAllCategories
  // ──────────────────────────────────────────────

  describe("getUncategorizedId()", () => {
    it("returns the ID of the uncategorized category", () => {
      expect(categorizer.getUncategorizedId()).toBe(ids.uncatId);
    });
  });

  describe("getAllCategories()", () => {
    it("returns all 9 seeded categories", () => {
      const all = categorizer.getAllCategories();
      expect(all).toHaveLength(9);
    });

    it("each category has id, name, color, isDefault, priority", () => {
      const all = categorizer.getAllCategories();
      for (const cat of all) {
        expect(cat).toHaveProperty("id");
        expect(cat).toHaveProperty("name");
        expect(cat).toHaveProperty("color");
        expect(cat).toHaveProperty("isDefault");
        expect(cat).toHaveProperty("priority");
      }
    });

    it("includes all expected category names", () => {
      const names = categorizer.getAllCategories().map((c) => c.name);
      expect(names).toContain("development");
      expect(names).toContain("communication");
      expect(names).toContain("social");
      expect(names).toContain("entertainment");
      expect(names).toContain("productivity");
      expect(names).toContain("research");
      expect(names).toContain("email");
      expect(names).toContain("design");
      expect(names).toContain("uncategorized");
    });

    it("returns categories sorted by priority descending", () => {
      const all = categorizer.getAllCategories();
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].priority).toBeGreaterThanOrEqual(all[i].priority);
      }
    });
  });

  // ──────────────────────────────────────────────
  // CRUD: createCategory / updateCategory / deleteCategory
  // ──────────────────────────────────────────────

  describe("createCategory()", () => {
    it("creates a new category and returns its ID", () => {
      const newId = categorizer.createCategory("gaming", "#00FF00");
      expect(newId).toBeGreaterThan(0);
      expect(categorizer.getCategoryName(newId)).toBe("gaming");
      expect(categorizer.getCategoryColor(newId)).toBe("#00FF00");
    });

    it("new category appears in getAllCategories", () => {
      categorizer.createCategory("gaming", "#00FF00");
      const names = categorizer.getAllCategories().map((c) => c.name);
      expect(names).toContain("gaming");
      expect(categorizer.getAllCategories()).toHaveLength(10);
    });

    it("new category is not marked as default", () => {
      const newId = categorizer.createCategory("gaming", "#00FF00");
      const cat = categorizer.getAllCategories().find((c) => c.id === newId);
      expect(cat?.isDefault).toBe(false);
    });

    it("creates a category with custom priority", () => {
      const newId = categorizer.createCategory("gaming", "#00FF00", 7);
      const cat = categorizer.getAllCategories().find((c) => c.id === newId);
      expect(cat?.priority).toBe(7);
    });
  });

  describe("updateCategory()", () => {
    it("updates category name", () => {
      categorizer.updateCategory(ids.devId, { name: "coding" });
      expect(categorizer.getCategoryName(ids.devId)).toBe("coding");
    });

    it("updates category color", () => {
      categorizer.updateCategory(ids.devId, { color: "#FF0000" });
      expect(categorizer.getCategoryColor(ids.devId)).toBe("#FF0000");
    });

    it("updates both name and color", () => {
      categorizer.updateCategory(ids.devId, { name: "coding", color: "#FF0000" });
      expect(categorizer.getCategoryName(ids.devId)).toBe("coding");
      expect(categorizer.getCategoryColor(ids.devId)).toBe("#FF0000");
    });

    it("updates priority", () => {
      categorizer.updateCategory(ids.socialId, { priority: 20 });
      const cat = categorizer.getAllCategories().find((c) => c.id === ids.socialId);
      expect(cat?.priority).toBe(20);
    });

    it("does nothing when no updates provided", () => {
      const colorBefore = categorizer.getCategoryColor(ids.devId);
      categorizer.updateCategory(ids.devId, {});
      expect(categorizer.getCategoryColor(ids.devId)).toBe(colorBefore);
    });
  });

  describe("deleteCategory()", () => {
    it("removes the category from getAllCategories", () => {
      categorizer.deleteCategory(ids.socialId);
      const names = categorizer.getAllCategories().map((c) => c.name);
      expect(names).not.toContain("social");
      expect(categorizer.getAllCategories()).toHaveLength(8);
    });

    it("falls back to uncategorized for deleted category's ID", () => {
      categorizer.deleteCategory(ids.socialId);
      expect(categorizer.getCategoryName(ids.socialId)).toBe("uncategorized");
    });

    it("reassigns activities to uncategorized before deleting", () => {
      const now = Date.now();
      testDb.insert(activities).values({
        appName: "Twitter",
        windowTitle: "Home",
        categoryId: ids.socialId,
        startTime: now,
        endTime: now + 1000,
        duration: 1000,
      }).run();

      categorizer.deleteCategory(ids.socialId);

      const rows = testDb
        .select({ categoryId: activities.categoryId })
        .from(activities)
        .all();
      expect(rows[0].categoryId).toBe(ids.uncatId);
    });
  });

  // ──────────────────────────────────────────────
  // CRUD: addRule / removeRule / getCategoryRules
  // ──────────────────────────────────────────────

  describe("addRule()", () => {
    it("adds a new app rule and it affects categorization", () => {
      let result = categorizer.categorize({ appName: "MyCustomApp", title: "Window" });
      expect(result).toBe(ids.uncatId);

      categorizer.addRule(ids.devId, "app", "MyCustomApp");

      result = categorizer.categorize({ appName: "MyCustomApp", title: "Window" });
      expect(result).toBe(ids.devId);
    });

    it("adds a new domain rule", () => {
      let result = categorizer.categorize({
        appName: "Chrome",
        title: "Page",
        url: "https://mysite.dev/page",
      });
      expect(result).toBe(ids.uncatId);

      categorizer.addRule(ids.devId, "domain", "mysite.dev");

      result = categorizer.categorize({
        appName: "Chrome",
        title: "Page",
        url: "https://mysite.dev/page",
      });
      expect(result).toBe(ids.devId);
    });

    it("adds a new keyword rule", () => {
      let result = categorizer.categorize({ appName: "App", title: "foobar baz" });
      expect(result).toBe(ids.uncatId);

      categorizer.addRule(ids.devId, "keyword", "foobar");

      result = categorizer.categorize({ appName: "App", title: "foobar baz" });
      expect(result).toBe(ids.devId);
    });

    it("adds a rule with explicit matchMode", () => {
      // Exact match: "MyApp" should NOT match "MyAppExtended"
      categorizer.addRule(ids.devId, "app", "myapp", "exact");

      const result1 = categorizer.categorize({ appName: "MyApp", title: "x" });
      expect(result1).toBe(ids.devId);

      const result2 = categorizer.categorize({ appName: "MyAppExtended", title: "x" });
      expect(result2).not.toBe(ids.devId);
    });

    it("adds a domain_keyword compound rule", () => {
      categorizer.addRule(ids.productivityId, "domain_keyword", "example.com|planning");

      const result1 = categorizer.categorize({
        appName: "Chrome",
        title: "Sprint planning session",
        url: "https://example.com/board",
      });
      expect(result1).toBe(ids.productivityId);

      // Without the keyword, example.com should not match productivity
      const result2 = categorizer.categorize({
        appName: "Chrome",
        title: "Random page",
        url: "https://example.com/page",
      });
      expect(result2).not.toBe(ids.productivityId);
    });

    it("returns the new rule ID", () => {
      const ruleId = categorizer.addRule(ids.devId, "app", "NewApp");
      expect(ruleId).toBeGreaterThan(0);
    });
  });

  describe("removeRule()", () => {
    it("removes a rule so it no longer matches", () => {
      const ruleId = categorizer.addRule(ids.devId, "app", "TempApp");
      let result = categorizer.categorize({ appName: "TempApp", title: "x" });
      expect(result).toBe(ids.devId);

      categorizer.removeRule(ruleId);
      result = categorizer.categorize({ appName: "TempApp", title: "x" });
      expect(result).toBe(ids.uncatId);
    });
  });

  describe("getCategoryRules()", () => {
    it("returns rules for a category", () => {
      const rules = categorizer.getCategoryRules(ids.devId);
      expect(rules.length).toBeGreaterThan(0);
      const appRules = rules.filter((r) => r.type === "app");
      expect(appRules.some((r) => r.pattern === "Code")).toBe(true);
    });

    it("returns empty array for category with no rules", () => {
      const rules = categorizer.getCategoryRules(ids.uncatId);
      expect(rules).toHaveLength(0);
    });

    it("each rule has id, type, pattern, and matchMode", () => {
      const rules = categorizer.getCategoryRules(ids.devId);
      for (const rule of rules) {
        expect(rule).toHaveProperty("id");
        expect(rule).toHaveProperty("type");
        expect(rule).toHaveProperty("pattern");
        expect(rule).toHaveProperty("matchMode");
        expect(["app", "domain", "keyword", "domain_keyword"]).toContain(rule.type);
      }
    });

    it("returns domain_keyword rules for research category", () => {
      const rules = categorizer.getCategoryRules(ids.researchId);
      const dkRules = rules.filter((r) => r.type === "domain_keyword");
      expect(dkRules.length).toBeGreaterThan(0);
      expect(dkRules.some((r) => r.pattern === "youtube.com|tutorial")).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // reloadRules()
  // ──────────────────────────────────────────────

  describe("reloadRules()", () => {
    it("picks up changes made directly to DB after reload", () => {
      testDb.insert(categoryRules).values({
        categoryId: ids.entertainId,
        type: "app",
        pattern: "DirectInsertApp",
        matchMode: "contains",
      }).run();

      let result = categorizer.categorize({ appName: "DirectInsertApp", title: "x" });
      expect(result).toBe(ids.uncatId);

      categorizer.reloadRules();
      result = categorizer.categorize({ appName: "DirectInsertApp", title: "x" });
      expect(result).toBe(ids.entertainId);
    });
  });

  // ──────────────────────────────────────────────
  // Priority ordering
  // ──────────────────────────────────────────────

  describe("priority ordering", () => {
    it("higher priority category wins when both have matching keywords", () => {
      // Create two custom categories with overlapping keywords but different priorities
      testDb = createTestDb();
      seedCategory("low-priority", "#111111", {
        keywords: ["overlap"],
      }, 1);
      const highId = seedCategory("high-priority", "#222222", {
        keywords: ["overlap"],
      }, 10);
      seedCategory("uncategorized", "#64748B", {}, 0);
      const cat = new ActivityCategorizer();

      const result = cat.categorize({ appName: "Unknown", title: "overlap term" });
      expect(result).toBe(highId);
    });

    it("priority changes take effect after update + reload", () => {
      // social (priority 4) and entertainment (priority 4) both have domain rules
      // Bump social to priority 20 — it should now be checked first
      categorizer.updateCategory(ids.socialId, { priority: 20 });

      // Add same domain to both
      categorizer.addRule(ids.socialId, "domain", "ambiguous.test");
      categorizer.addRule(ids.entertainId, "domain", "ambiguous.test");

      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Test",
        url: "https://ambiguous.test/page",
      });
      expect(result).toBe(ids.socialId);
    });
  });

  // ──────────────────────────────────────────────
  // Match modes
  // ──────────────────────────────────────────────

  describe("match modes", () => {
    it("exact mode: app pattern does not match substring", () => {
      testDb = createTestDb();
      const catId = seedCategory("test-cat", "#000", {
        apps: [{ pattern: "code", matchMode: "exact" }],
      }, 10);
      seedCategory("uncategorized", "#64748B", {}, 0);
      const cat = new ActivityCategorizer();

      // "code" exact should match "code" but NOT "vs code"
      expect(cat.categorize({ appName: "code", title: "x" })).toBe(catId);
      expect(cat.categorize({ appName: "vs code", title: "x" })).not.toBe(catId);
    });

    it("contains mode: app pattern matches substring", () => {
      testDb = createTestDb();
      const catId = seedCategory("test-cat", "#000", {
        apps: [{ pattern: "code", matchMode: "contains" }],
      }, 10);
      seedCategory("uncategorized", "#64748B", {}, 0);
      const cat = new ActivityCategorizer();

      expect(cat.categorize({ appName: "vs code", title: "x" })).toBe(catId);
      expect(cat.categorize({ appName: "code", title: "x" })).toBe(catId);
    });

    it("regex mode: pattern is evaluated as regex", () => {
      testDb = createTestDb();
      const catId = seedCategory("test-cat", "#000", {
        keywords: [{ pattern: "^start", matchMode: "regex" }],
      }, 10);
      seedCategory("uncategorized", "#64748B", {}, 0);
      const cat = new ActivityCategorizer();

      expect(cat.categorize({ appName: "App", title: "start of something" })).toBe(catId);
      expect(cat.categorize({ appName: "App", title: "not at start" })).not.toBe(catId);
    });

    it("invalid regex falls back to contains", () => {
      testDb = createTestDb();
      const catId = seedCategory("test-cat", "#000", {
        keywords: [{ pattern: "[invalid", matchMode: "regex" }],
      }, 10);
      seedCategory("uncategorized", "#64748B", {}, 0);
      const cat = new ActivityCategorizer();

      // "[invalid" as a contains search — title contains "[invalid"
      expect(cat.categorize({ appName: "App", title: "has [invalid pattern" })).toBe(catId);
    });
  });

  // ──────────────────────────────────────────────
  // Domain hostname parsing
  // ──────────────────────────────────────────────

  describe("domain hostname parsing", () => {
    it("does not match domain that is a suffix of another domain", () => {
      // "github.com" should NOT match "fakehub.com"
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Page",
        url: "https://fakehub.com/repo",
      });
      expect(result).not.toBe(ids.devId);
    });

    it("matches exact hostname", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Page",
        url: "https://github.com/repo",
      });
      expect(result).toBe(ids.devId);
    });

    it("matches subdomain (www.github.com matches github.com)", () => {
      // The matchesDomain checks hostname.endsWith(".github.com")
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Page",
        url: "https://www.github.com/repo",
      });
      expect(result).toBe(ids.devId);
    });

    it("handles malformed URL gracefully", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Page",
        url: "not-a-valid-url",
      });
      // Should not crash, just fall through
      expect(result).toBe(ids.uncatId);
    });

    it("domain match is case-insensitive", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Page",
        url: "https://GITHUB.COM/user/repo",
      });
      expect(result).toBe(ids.devId);
    });
  });

  // ──────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty appName", () => {
      const result = categorizer.categorize({ appName: "", title: "" });
      expect(result).toBe(ids.uncatId);
    });

    it("handles very long title without crashing", () => {
      const longTitle = "a".repeat(10000);
      const result = categorizer.categorize({ appName: "Unknown", title: longTitle });
      expect(result).toBe(ids.uncatId);
    });

    it("handles special characters in title", () => {
      const result = categorizer.categorize({
        appName: "App",
        title: "file (copy) [2] {test} <tag>",
      });
      expect(result).toBe(ids.uncatId);
    });

    it("handles URL with query params", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Page",
        url: "https://github.com/user/repo?tab=issues&q=bug",
      });
      expect(result).toBe(ids.devId);
    });

    it("handles URL with fragments", () => {
      const result = categorizer.categorize({
        appName: "Chrome",
        title: "Page",
        url: "https://stackoverflow.com/questions/123#answer-456",
      });
      expect(result).toBe(ids.devId);
    });
  });
});

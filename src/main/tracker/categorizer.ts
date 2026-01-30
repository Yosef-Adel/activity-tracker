import { eq } from "drizzle-orm";
import { getDb, categories, categoryRules, activities, sessions } from "../db";

export interface ActivityInput {
  appName: string;
  title: string;
  url?: string | null;
}

export interface CategoryInfo {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  priority: number;
}

type MatchMode = "exact" | "contains" | "regex";

interface CachedRule {
  pattern: string;
  matchMode: MatchMode;
  compiled?: RegExp; // pre-compiled for regex mode
}

interface CachedCategory {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  priority: number;
  apps: CachedRule[];
  domains: CachedRule[];
  keywords: CachedRule[];
  domainKeywords: CachedRule[]; // compound domain+keyword rules (pattern: "domain|keyword")
}

class ActivityCategorizer {
  private categoryCache: CachedCategory[] = [];
  private uncategorizedId = 0;

  constructor() {
    this.loadFromDb();
  }

  loadFromDb(): void {
    const db = getDb();

    const allCategories = db.select().from(categories).all();
    const allRules = db.select().from(categoryRules).all();

    // Group rules by category ID
    const rulesByCategory = new Map<
      number,
      {
        apps: CachedRule[];
        domains: CachedRule[];
        keywords: CachedRule[];
        domainKeywords: CachedRule[];
      }
    >();
    for (const rule of allRules) {
      if (!rulesByCategory.has(rule.categoryId)) {
        rulesByCategory.set(rule.categoryId, {
          apps: [],
          domains: [],
          keywords: [],
          domainKeywords: [],
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const bucket = rulesByCategory.get(rule.categoryId)!;
      const matchMode = (rule.matchMode as MatchMode) || "contains";
      const cachedRule: CachedRule = { pattern: rule.pattern, matchMode };

      // Pre-compile regex patterns
      if (matchMode === "regex") {
        try {
          cachedRule.compiled = new RegExp(rule.pattern, "i");
        } catch {
          // Invalid regex — fall back to contains
          cachedRule.matchMode = "contains";
        }
      }

      if (rule.type === "app") bucket.apps.push(cachedRule);
      else if (rule.type === "domain") bucket.domains.push(cachedRule);
      else if (rule.type === "keyword") bucket.keywords.push(cachedRule);
      else if (rule.type === "domain_keyword")
        bucket.domainKeywords.push(cachedRule);
    }

    this.categoryCache = allCategories.map((cat) => {
      const rules = rulesByCategory.get(cat.id) || {
        apps: [],
        domains: [],
        keywords: [],
        domainKeywords: [],
      };
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        isDefault: cat.isDefault === 1,
        priority: cat.priority,
        apps: rules.apps,
        domains: rules.domains,
        keywords: rules.keywords,
        domainKeywords: rules.domainKeywords,
      };
    });

    // Sort by priority descending so higher-priority categories are checked first
    this.categoryCache.sort((a, b) => b.priority - a.priority);

    // Find uncategorized ID
    const uncategorized = this.categoryCache.find(
      (c) => c.name === "uncategorized",
    );
    this.uncategorizedId = uncategorized?.id ?? 0;
  }

  reloadRules(): void {
    this.loadFromDb();
  }

  categorize(activity: ActivityInput): number {
    const appName = activity.appName.toLowerCase();
    const title = activity.title?.toLowerCase() || "";
    const url = activity.url?.toLowerCase() || "";

    // Parse hostname from URL for domain matching
    let hostname = "";
    if (url) {
      try {
        hostname = new URL(url).hostname;
      } catch {
        // Malformed URL — leave hostname empty
      }
    }

    // Priority 1: Check app names first (most reliable)
    for (const cat of this.categoryCache) {
      if (cat.name === "uncategorized") continue;
      if (cat.apps.length > 0 && this.matchesAnyRule(appName, cat.apps)) {
        return cat.id;
      }
    }

    // Priority 2: Check compound domain+keyword rules
    for (const cat of this.categoryCache) {
      if (cat.name === "uncategorized") continue;
      if (cat.domainKeywords.length > 0 && hostname) {
        for (const rule of cat.domainKeywords) {
          const pipeIdx = rule.pattern.indexOf("|");
          if (pipeIdx === -1) continue;
          const domainPart = rule.pattern.substring(0, pipeIdx).toLowerCase();
          const keywordPart = rule.pattern.substring(pipeIdx + 1).toLowerCase();
          if (this.matchesDomain(hostname, domainPart, "contains")) {
            const combinedText = `${title} ${url}`;
            if (combinedText.includes(keywordPart)) {
              return cat.id;
            }
          }
        }
      }
    }

    // Priority 3: Check plain domains
    for (const cat of this.categoryCache) {
      if (cat.name === "uncategorized") continue;
      if (cat.domains.length > 0 && hostname) {
        for (const rule of cat.domains) {
          if (
            this.matchesDomain(
              hostname,
              rule.pattern.toLowerCase(),
              rule.matchMode,
            )
          ) {
            return cat.id;
          }
        }
      }
    }

    // Priority 4: Check keywords in title/url (least reliable)
    for (const cat of this.categoryCache) {
      if (cat.name === "uncategorized") continue;
      if (cat.keywords.length > 0) {
        const combinedText = `${title} ${url}`;
        if (this.matchesAnyRule(combinedText, cat.keywords)) {
          return cat.id;
        }
      }
    }

    return this.uncategorizedId;
  }

  private matchesAnyRule(text: string, rules: CachedRule[]): boolean {
    return rules.some((rule) => {
      switch (rule.matchMode) {
        case "exact":
          return text === rule.pattern.toLowerCase();
        case "regex":
          if (rule.compiled) {
            return rule.compiled.test(text);
          }
          return text.includes(rule.pattern.toLowerCase());
        case "contains":
        default:
          return text.includes(rule.pattern.toLowerCase());
      }
    });
  }

  private matchesDomain(
    hostname: string,
    pattern: string,
    matchMode: MatchMode,
  ): boolean {
    switch (matchMode) {
      case "exact":
        return hostname === pattern || hostname.endsWith("." + pattern);
      case "regex":
        try {
          return new RegExp(pattern, "i").test(hostname);
        } catch {
          return false;
        }
      case "contains":
      default:
        // Match hostname or any parent domain
        return hostname === pattern || hostname.endsWith("." + pattern);
    }
  }

  getCategoryColor(categoryId: number): string {
    const cat = this.categoryCache.find((c) => c.id === categoryId);
    return cat?.color ?? "#64748B";
  }

  getCategoryName(categoryId: number): string {
    const cat = this.categoryCache.find((c) => c.id === categoryId);
    return cat?.name ?? "uncategorized";
  }

  getUncategorizedId(): number {
    return this.uncategorizedId;
  }

  getAllCategories(): CategoryInfo[] {
    return this.categoryCache.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isDefault: c.isDefault,
      priority: c.priority,
    }));
  }

  // CRUD operations

  createCategory(name: string, color: string, priority = 0): number {
    const db = getDb();
    const result = db
      .insert(categories)
      .values({ name, color, isDefault: 0, priority })
      .returning({ id: categories.id })
      .get();
    this.loadFromDb();
    return result.id;
  }

  updateCategory(
    id: number,
    updates: { name?: string; color?: string; priority?: number },
  ): void {
    const db = getDb();
    const setValues: Record<string, string | number> = {};
    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.color !== undefined) setValues.color = updates.color;
    if (updates.priority !== undefined) setValues.priority = updates.priority;
    if (Object.keys(setValues).length === 0) return;

    db.update(categories).set(setValues).where(eq(categories.id, id)).run();
    this.loadFromDb();
  }

  deleteCategory(id: number): void {
    const db = getDb();
    // Reassign activities and sessions to uncategorized before deleting
    db.update(activities)
      .set({ categoryId: this.uncategorizedId })
      .where(eq(activities.categoryId, id))
      .run();
    db.update(sessions)
      .set({ categoryId: this.uncategorizedId })
      .where(eq(sessions.categoryId, id))
      .run();
    // Rules are cascade-deleted
    db.delete(categories).where(eq(categories.id, id)).run();
    this.loadFromDb();
  }

  addRule(
    categoryId: number,
    type: string,
    pattern: string,
    matchMode = "contains",
  ): number {
    const db = getDb();
    const result = db
      .insert(categoryRules)
      .values({ categoryId, type, pattern, matchMode })
      .returning({ id: categoryRules.id })
      .get();
    this.loadFromDb();
    return result.id;
  }

  removeRule(ruleId: number): void {
    const db = getDb();
    db.delete(categoryRules).where(eq(categoryRules.id, ruleId)).run();
    this.loadFromDb();
  }

  getCategoryRules(
    categoryId: number,
  ): Array<{ id: number; type: string; pattern: string; matchMode: string }> {
    const db = getDb();
    return db
      .select({
        id: categoryRules.id,
        type: categoryRules.type,
        pattern: categoryRules.pattern,
        matchMode: categoryRules.matchMode,
      })
      .from(categoryRules)
      .where(eq(categoryRules.categoryId, categoryId))
      .all();
  }
}

export default ActivityCategorizer;

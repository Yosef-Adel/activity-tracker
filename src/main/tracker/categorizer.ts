import { eq } from "drizzle-orm";
import { getDb, categories, categoryRules, activities, sessions } from "../db";

export interface ActivityInput {
  appName: string;
  title: string;
  url?: string | null;
  filePath?: string | null;
  recentCategoryIds?: number[];
}

export interface CategorizationResult {
  categoryId: number;
  confidence: number;
  matchedRules: string[];
}

export interface CategoryInfo {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  priority: number;
  isPassive: boolean;
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
  isPassive: boolean;
  apps: CachedRule[];
  domains: CachedRule[];
  keywords: CachedRule[];
  domainKeywords: CachedRule[];
  filePaths: CachedRule[];
}

const WEIGHTS = {
  APP_MATCH: 5,
  FILE_PATH: 4,
  DOMAIN_KEYWORD: 4,
  DOMAIN_ONLY: 2,
  KEYWORD: 2,
  FLOW_BOOST: 1.3,
};

const CONFIDENCE_THRESHOLD = 2;

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
        filePaths: CachedRule[];
      }
    >();
    for (const rule of allRules) {
      if (!rulesByCategory.has(rule.categoryId)) {
        rulesByCategory.set(rule.categoryId, {
          apps: [],
          domains: [],
          keywords: [],
          domainKeywords: [],
          filePaths: [],
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
      else if (rule.type === "file_path") bucket.filePaths.push(cachedRule);
    }

    this.categoryCache = allCategories.map((cat) => {
      const rules = rulesByCategory.get(cat.id) || {
        apps: [],
        domains: [],
        keywords: [],
        domainKeywords: [],
        filePaths: [],
      };
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        isDefault: cat.isDefault === 1,
        priority: cat.priority,
        isPassive: cat.isPassive === 1,
        apps: rules.apps,
        domains: rules.domains,
        keywords: rules.keywords,
        domainKeywords: rules.domainKeywords,
        filePaths: rules.filePaths,
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

  categorize(activity: ActivityInput): CategorizationResult {
    const appName = activity.appName.toLowerCase();
    const title = activity.title?.toLowerCase() || "";
    const url = activity.url?.toLowerCase() || "";
    const filePath = activity.filePath?.toLowerCase() || "";

    // Parse hostname from URL for domain matching
    let hostname = "";
    if (url) {
      try {
        hostname = new URL(url).hostname;
      } catch {
        // Malformed URL — leave hostname empty
      }
    }

    // Score map: category ID → accumulated score
    const scores = new Map<number, number>();
    const matchedRules = new Map<number, string[]>();

    // Initialize all categories with 0
    for (const cat of this.categoryCache) {
      if (cat.name === "uncategorized") continue;
      scores.set(cat.id, 0);
      matchedRules.set(cat.id, []);
    }

    // === LAYER 1: App Name (most reliable) ===
    for (const cat of this.categoryCache) {
      if (cat.name === "uncategorized") continue;
      if (cat.apps.length > 0 && this.matchesAnyRule(appName, cat.apps)) {
        scores.set(cat.id, (scores.get(cat.id) || 0) + WEIGHTS.APP_MATCH);
        matchedRules.get(cat.id)?.push(`app:${appName}`);
      }
    }

    // === LAYER 2: File Path (DB-driven rules) ===
    if (filePath) {
      for (const cat of this.categoryCache) {
        if (cat.name === "uncategorized") continue;
        if (cat.filePaths.length > 0 && this.matchesAnyRule(filePath, cat.filePaths)) {
          scores.set(cat.id, (scores.get(cat.id) || 0) + WEIGHTS.FILE_PATH);
          matchedRules.get(cat.id)?.push(`file:${filePath.split("/").pop() || filePath}`);
        }
      }
    }

    // === LAYER 3: Domain + Keyword Compound (capped: one match per category) ===
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
              scores.set(cat.id, (scores.get(cat.id) || 0) + WEIGHTS.DOMAIN_KEYWORD);
              matchedRules.get(cat.id)?.push(`domain_keyword:${domainPart}|${keywordPart}`);
              break; // Cap: one domain_keyword match per category
            }
          }
        }
      }
    }

    // === LAYER 4: Domain Only ===
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
            scores.set(cat.id, (scores.get(cat.id) || 0) + WEIGHTS.DOMAIN_ONLY);
            matchedRules.get(cat.id)?.push(`domain:${hostname}`);
            break; // Only count domain match once per category
          }
        }
      }
    }

    // === LAYER 5: Keywords ===
    for (const cat of this.categoryCache) {
      if (cat.name === "uncategorized") continue;
      if (cat.keywords.length > 0) {
        const combinedText = `${title} ${url}`;
        if (this.matchesAnyRule(combinedText, cat.keywords)) {
          scores.set(cat.id, (scores.get(cat.id) || 0) + WEIGHTS.KEYWORD);
          matchedRules.get(cat.id)?.push(`keyword`);
        }
      }
    }

    // === LAYER 6: Priority Weighting ===
    // priority=10 → 2x, priority=5 → 1.5x, priority=0 → no boost
    for (const [catId, score] of scores) {
      if (score === 0) continue;
      const cat = this.categoryCache.find((c) => c.id === catId);
      if (cat && cat.priority > 0) {
        const multiplier = 1 + cat.priority / 10;
        scores.set(catId, score * multiplier);
      }
    }

    // === LAYER 7: Flow State Detection (majority-based: 3+ of last 5) ===
    if (activity.recentCategoryIds && activity.recentCategoryIds.length >= 3) {
      const recent = activity.recentCategoryIds.slice(-5);
      // Count occurrences of each category
      const counts = new Map<number, number>();
      for (const id of recent) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
      // Find the dominant category (3+ out of last 5)
      for (const [catId, count] of counts) {
        if (count >= 3) {
          const currentScore = scores.get(catId) || 0;
          if (currentScore > 0) {
            scores.set(catId, currentScore * WEIGHTS.FLOW_BOOST);
            matchedRules.get(catId)?.push("flow_state");
          }
          break;
        }
      }
    }

    // === Find Winner ===
    let maxScore = 0;
    let winnerId = this.uncategorizedId;
    let winnerRules: string[] = [];

    for (const [catId, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        winnerId = catId;
        winnerRules = matchedRules.get(catId) || [];
      }
    }

    // === Confidence Threshold ===
    if (maxScore < CONFIDENCE_THRESHOLD) {
      return {
        categoryId: this.uncategorizedId,
        confidence: maxScore,
        matchedRules: ["low_confidence"],
      };
    }

    return {
      categoryId: winnerId,
      confidence: maxScore,
      matchedRules: winnerRules,
    };
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

  isCategoryPassive(categoryId: number): boolean {
    const cat = this.categoryCache.find((c) => c.id === categoryId);
    return cat?.isPassive ?? false;
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
      isPassive: c.isPassive,
    }));
  }

  // CRUD operations

  createCategory(name: string, color: string, priority = 0, isPassive = false): number {
    const db = getDb();
    const result = db
      .insert(categories)
      .values({ name, color, isDefault: 0, priority, isPassive: isPassive ? 1 : 0 })
      .returning({ id: categories.id })
      .get();
    this.loadFromDb();
    return result.id;
  }

  updateCategory(
    id: number,
    updates: { name?: string; color?: string; priority?: number; isPassive?: boolean },
  ): void {
    const db = getDb();
    const setValues: Record<string, string | number> = {};
    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.color !== undefined) setValues.color = updates.color;
    if (updates.priority !== undefined) setValues.priority = updates.priority;
    if (updates.isPassive !== undefined) setValues.isPassive = updates.isPassive ? 1 : 0;
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

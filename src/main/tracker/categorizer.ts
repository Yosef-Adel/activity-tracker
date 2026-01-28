export interface ActivityInput {
  appName: string;
  title: string;
  url?: string | null;
}

export type Category =
  | "development"
  | "communication"
  | "social"
  | "entertainment"
  | "productivity"
  | "research"
  | "email"
  | "design"
  | "uncategorized";

interface CategoryRules {
  apps?: string[];
  domains?: string[];
  keywords?: string[];
}

class ActivityCategorizer {
  private categories: Record<Category, CategoryRules>;

  constructor() {
    this.categories = {
      development: {
        apps: [
          "Code",
          "Visual Studio Code",
          "VS Code",
          "WebStorm",
          "IntelliJ",
          "PyCharm",
          "Xcode",
          "Android Studio",
          "Terminal",
          "WezTerm",
          "iTerm",
          "Warp",
          "Hyper",
          "Alacritty",
          "kitty",
          "Electron",
        ],
        domains: [
          "github.com",
          "gitlab.com",
          "bitbucket.org",
          "stackoverflow.com",
          "npmjs.com",
          "localhost",
        ],
        keywords: [
          "debug",
          "coding",
          "terminal",
          "git",
          "npm",
          "yarn",
          "build",
          "compile",
          "deploy",
          "\\bta\\b",    // tmux attach (word boundary)
          "\\btat\\b",   // tmux alias (word boundary)
          "nvim",
          "vim",
        ],
      },
      communication: {
        apps: [
          "Slack",
          "Discord",
          "Microsoft Teams",
          "Zoom",
          "Skype",
          "Telegram",
          "WhatsApp",
          "Messages",
        ],
        domains: [
          "slack.com",
          "discord.com",
          "teams.microsoft.com",
          "zoom.us",
          "meet.google.com",
        ],
        keywords: ["chat", "meeting", "call", "video"],
      },
      social: {
        apps: ["Twitter", "Facebook", "TweetDeck"],
        domains: [
          "twitter.com",
          "x.com",
          "facebook.com",
          "instagram.com",
          "reddit.com",
          "linkedin.com",
          "tiktok.com",
        ],
        keywords: ["social", "feed", "timeline"],
      },
      entertainment: {
        apps: ["Spotify", "Apple Music", "Netflix", "VLC", "IINA", "Plex"],
        domains: [
          "youtube.com",
          "netflix.com",
          "spotify.com",
          "twitch.tv",
          "hulu.com",
          "disneyplus.com",
          "primevideo.com",
        ],
        keywords: ["video", "music", "stream", "watch", "play"],
      },
      productivity: {
        apps: [
          "Notion",
          "Obsidian",
          "Evernote",
          "Microsoft Word",
          "Excel",
          "Numbers",
          "Pages",
          "Keynote",
          "PowerPoint",
        ],
        domains: [
          "notion.so",
          "docs.google.com",
          "sheets.google.com",
          "slides.google.com",
          "trello.com",
          "asana.com",
          "monday.com",
        ],
        keywords: ["document", "notes", "spreadsheet", "presentation", "task"],
      },
      research: {
        domains: [
          "google.com/search",
          "wikipedia.org",
          "medium.com",
          "dev.to",
          "arxiv.org",
          "scholar.google.com",
        ],
        keywords: [
          "search",
          "research",
          "article",
          "tutorial",
          "learn",
          "wiki",
        ],
      },
      email: {
        apps: ["Mail", "Outlook", "Thunderbird", "Spark", "Airmail"],
        domains: [
          "gmail.com",
          "outlook.com",
          "mail.google.com",
          "mail.yahoo.com",
        ],
        keywords: ["email", "inbox", "compose"],
      },
      design: {
        apps: [
          "Figma",
          "Sketch",
          "Adobe Photoshop",
          "Adobe Illustrator",
          "Adobe XD",
          "Canva",
          "Affinity",
        ],
        domains: ["figma.com", "canva.com", "dribbble.com", "behance.net"],
        keywords: ["design", "prototype", "mockup", "ui", "ux"],
      },
      uncategorized: {},
    };
  }

  categorize(activity: ActivityInput): Category {
    const appName = activity.appName.toLowerCase();
    const title = activity.title?.toLowerCase() || "";
    const url = activity.url?.toLowerCase() || "";

    // Priority 1: Check app names first (most reliable)
    for (const [category, rules] of Object.entries(this.categories)) {
      if (category === "uncategorized") continue;
      if (
        rules.apps &&
        rules.apps.some((app) => appName.includes(app.toLowerCase()))
      ) {
        return category as Category;
      }
    }

    // Priority 2: Check domains
    for (const [category, rules] of Object.entries(this.categories)) {
      if (category === "uncategorized") continue;
      if (
        rules.domains &&
        url &&
        rules.domains.some((domain) => url.includes(domain))
      ) {
        return category as Category;
      }
    }

    // Priority 3: Check keywords in title/url (least reliable)
    for (const [category, rules] of Object.entries(this.categories)) {
      if (category === "uncategorized") continue;
      if (rules.keywords) {
        const combinedText = `${title} ${url}`;
        const matched = rules.keywords.some((keyword) => {
          // If keyword contains \b, treat as regex (word boundary matching)
          if (keyword.includes("\\b")) {
            const regex = new RegExp(keyword, "i");
            return regex.test(combinedText);
          }
          // Otherwise simple substring match
          return combinedText.includes(keyword);
        });
        if (matched) {
          return category as Category;
        }
      }
    }

    return "uncategorized";
  }

  getCategoryColor(category: Category): string {
    const colors: Record<Category, string> = {
      development: "#6366F1", // primary
      communication: "#22C55E", // success
      social: "#EAB308", // warning
      entertainment: "#EF4444", // error
      productivity: "#A855F7", // purple
      research: "#0EA5E9", // info
      email: "#EC4899", // pink
      design: "#F97316", // orange
      uncategorized: "#64748B", // grey
    };
    return colors[category];
  }

  getAllCategories(): Category[] {
    return Object.keys(this.categories) as Category[];
  }
}

export default ActivityCategorizer;

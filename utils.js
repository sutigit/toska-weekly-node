const getThisWeekMondayISO = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust if Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
};

export const fetchGithubActivity = async (username) => {
  const mondayISO = getThisWeekMondayISO();

  const res = await fetch(
    `https://api.github.com/users/${username}/events/public`
  );
  if (!res.ok) {
    throw new Error(`GitHub error: ${res.status}`);
  }

  const events = await res.json();

  // Filter events:
  const filtered = events.filter((event) => {
    const createdAt = new Date(event.created_at);
    return (
      createdAt >= new Date(mondayISO) &&
      event.repo?.name?.includes("UniversityOfHelsinkiCS")
    );
  });

  return filtered;
};

export const getActivityType = (payload) => {
  if (!payload) return "undefined";

  const keys = Object.keys(payload);

  if (keys.includes("commits")) {
    return "commits";
  }

  if (keys.includes("release")) {
    return `release-${payload.action}`;
  }

  if (keys.includes("issue")) {
    return `issue-${payload.action}`;
  }

  return "misc";
};

// ...existing code...

// ...existing code...

export const formatGithubActivity = (activities) => {
  const grouped = {};

  for (const item of activities) {
    const { repo, activity } = item;
    const repoName = repo;

    if (!grouped[repoName]) grouped[repoName] = {};

    const type = activity.type;

    if (!grouped[repoName][type]) grouped[repoName][type] = [];

    switch (type) {
      case "release-published":
        grouped[repoName][type].push(activity.release);
        break;
      case "issue-opened":
      case "issue-closed":
        grouped[repoName][type].push(activity.issue);
        break;
      case "commits":
        grouped[repoName][type].push(...activity.commits);
        break;
      case "misc":
        grouped[repoName][type].push("miscellaneous activity");
        break;
      default:
        grouped[repoName][type].push("unknown activity");
    }
  }

  // Order for activity types
  const typeOrder = [
    "release-published",
    "issue-closed",
    "issue-opened",
    "commits",
    "misc",
  ];

  // Create blocks for better formatting
  const blocks = [];

  for (const [repo, types] of Object.entries(grouped)) {
    blocks.push({
      type: "divider",
    });

    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: repo,
      },
    });

    // Create rich text elements for activity details
    const richTextElements = [];

    // Process types in the specified order
    for (const type of typeOrder) {
      if (types[type]) {
        // Only process if this type exists for this repo
        const entries = types[type];

        // Bold bullet for action type
        richTextElements.push({
          type: "rich_text_section",
          elements: [
            {
              type: "text",
              text: "• ",
              style: { bold: true },
            },
            {
              type: "text",
              text: type,
              style: { bold: true },
            },
          ],
        });

        // Nested entries
        for (const entry of entries) {
          richTextElements.push({
            type: "rich_text_section",
            elements: [
              {
                type: "text",
                text: `  ◦ ${entry}`,
              },
            ],
          });
        }

        // Add spacing between types
        richTextElements.push({
          type: "rich_text_section",
          elements: [
            {
              type: "text",
              text: " ",
            },
          ],
        });
      }
    }

    blocks.push({
      type: "rich_text",
      elements: richTextElements,
    });
  }

  return blocks;
};

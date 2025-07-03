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

const formatItem = (item) => ({
  type: "section",
  text: {
    type: "mrkdwn",
    text: `*${item.repo}*: ${item.activity.type} - ${
      item.activity.commits?.join(", ") ||
      item.activity.release ||
      item.activity.issue ||
      "No details"
    }`,
  },
});

export const formatGithubActivity = (githubActivityLog) => {
  console.log(JSON.stringify(githubActivityLog, null, 2));

  return githubActivityLog.length > 0
    ? githubActivityLog.map((item) => formatItem(item))
    : [];
};

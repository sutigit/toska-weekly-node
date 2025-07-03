import fetch from "node-fetch";
import pkg from "@slack/bolt";
const { App } = pkg;
import dotenv from "dotenv";
dotenv.config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const attendees = new Set();
const homeTabUsers = new Set(); // Track users who have opened the home tab
let githubInfos = {};

const githubUserInfo = (userId) => {
  return [
    {
      type: "divider",
    },
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "My weeks activity",
      },
    },
    {
      type: "input",
      block_id: "github_user_block",
      element: {
        type: "plain_text_input",
        action_id: "github_user_input",
        placeholder: {
          type: "plain_text",
          text: "Enter GitHub username",
        },
      },
      label: {
        type: "plain_text",
        text: "GitHub Username",
      },
    },
    {
      type: "actions",
      block_id: "github_get_block",
      elements: [
        {
          type: "button",
          action_id: "get_users_github_data",
          text: {
            type: "plain_text",
            text: "Get",
          },
          value: userId,
        },
        {
          type: "button",
          action_id: "clear_users_github_data",
          text: {
            type: "plain_text",
            text: "Clear",
          },
          value: userId,
        },
      ],
    },
  ];
};

const controlsInit = [
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "I'm In",
    },
    action_id: "home_im_in_button",
  },
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "I'm Out",
    },
    action_id: "home_im_out_button",
  },
];

const controlsStart = [
  ...controlsInit,
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "Start turn roulette 🎲",
    },
    style: "primary",
    action_id: "home_start_turn_roulette",
  },
];

const controlsNext = [
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "Next 🎲",
    },
    style: "primary",
    action_id: "home_start_turn_roulette",
  },
];

const controlsDone = [
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "Done 🚩",
    },
    style: "primary",
    action_id: "home_end_turn_roulette",
  },
];

// Helper function to update all home tabs
const updateAllHomeTabs = async (client, extraBlocks) => {
  const attendeeNames =
    [...attendees].map((id) => `<@${id}>`).join("\n") || "_No attendees yet_";

  const homeView = {
    type: "home",
    callback_id: "home_view",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Check-in for turn roulette",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Current attendees:*\n${attendeeNames}`,
        },
      },
      ...extraBlocks,
      ...githubUserInfo(),
    ],
  };

  // Update home tab for all users who have opened it
  const updatePromises = [...homeTabUsers].map(async (userId) => {
    try {
      await client.views.publish({
        user_id: userId,
        view: homeView,
      });
    } catch (error) {
      console.error(`Error updating home tab for user ${userId}:`, error);
    }
  });

  await Promise.all(updatePromises);
};

// Publish the Home tab view whenever a user opens the app home
app.event("app_home_opened", async ({ event, client }) => {
  try {
    const userId = event.user;

    // Track this user as having opened the home tab
    homeTabUsers.add(userId);

    // Prepare attendee display list
    const attendeeNames =
      [...attendees].map((id) => `<@${id}>`).join("\n") || "_No attendees yet_";

    await client.views.publish({
      user_id: userId,
      view: {
        type: "home",
        callback_id: "home_view",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "Check-in for turn roulette",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Current attendees:*\n${attendeeNames}`,
            },
          },
          {
            type: "actions",
            elements: controlsInit,
          },
          ...githubUserInfo(),
        ],
      },
    });
  } catch (error) {
    console.error("Error publishing home tab:", error);
  }
});

// Handle "I'm In" button in Home tab
app.action("home_im_in_button", async ({ ack, body, client }) => {
  await ack();

  attendees.add(body.user.id);

  // Update all home tabs with updated attendee list
  const extraBlocks = [
    {
      type: "actions",
      elements: attendees.size === 0 ? controlsInit : controlsStart,
    },
  ];

  await updateAllHomeTabs(client, extraBlocks);
});

// Handle "I'm Out" button in Home tab
app.action("home_im_out_button", async ({ ack, body, client }) => {
  await ack();

  attendees.delete(body.user.id);

  // Update all home tabs with updated attendee list
  const extraBlocks = [
    {
      type: "actions",
      elements: attendees.size === 0 ? controlsInit : controlsStart,
    },
  ];

  await updateAllHomeTabs(client, extraBlocks);
});

// Handle "Start turn roulette" button in Home tab
app.action("home_start_turn_roulette", async ({ ack, body, client }) => {
  await ack();

  const userWhoStarted = `<@${body.user.id}>`;

  const extraBlocks = [
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${userWhoStarted} started turn roulette 🎲*`,
      },
    },
    {
      type: "image",
      block_id: "cat_cooking",
      image_url: "https://c.tenor.com/oiiF1L5rIdYAAAAC/tenor.gif",
      alt_text: "chef_cat_cooking",
    },
  ];

  await updateAllHomeTabs(client, extraBlocks);

  setTimeout(async () => {
    const rouletteAttendees = [...attendees];

    if (rouletteAttendees.length === 1) {
      const lastAttendee = rouletteAttendees[0];

      const lastResultBlock = [
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${userWhoStarted} started turn roulette 🎲*`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🎯 *Selected <@${lastAttendee}> 🎤*`,
          },
        },
        {
          type: "actions",
          elements: controlsDone,
        },
      ];

      await updateAllHomeTabs(client, lastResultBlock);
      return;
    }

    // Pick a random attendee
    const randomIndex = Math.floor(Math.random() * rouletteAttendees.length);
    const randomAttendee = rouletteAttendees[randomIndex];

    // Remove the selected attendee from the Set so they can't be selected again
    attendees.delete(randomAttendee);

    const resultBlocks = [
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${userWhoStarted} started turn roulette 🎲*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎯 *Selected <@${randomAttendee}> 🎤*`,
        },
      },
      {
        type: "actions",
        elements: controlsNext,
      },
    ];

    await updateAllHomeTabs(client, resultBlocks);
  }, 1200);
});

app.action("home_end_turn_roulette", async ({ ack, body, client }) => {
  await ack();

  attendees.clear();
  githubInfos = {};

  const extraBlocks = [
    {
      type: "actions",
      elements: controlsInit,
    },
  ];

  await updateAllHomeTabs(client, extraBlocks);
});

const getThisWeekMondayISO = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust if Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
};

const fetchGithubActivity = async (username) => {
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

const getActivityType = (payload) => {
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

app.action("get_users_github_data", async ({ ack, body, client }) => {
  await ack();

  const userId = body.user.id;
  const githubUsername =
    body.view.state.values.github_user_block.github_user_input.value;

  if (!githubUsername) {
    // Handle case where no username was entered
    console.error("No GitHub username provided");
    return;
  }

  console.log(`GitHub username for user ${userId}: ${githubUsername}`);

  const fetchedGithubInfo = await fetchGithubActivity(githubUsername);
  const formattedContent = fetchedGithubInfo.map((content) => ({
    repo: content?.repo?.name?.split("/")[1], // return name of the repo_name from "UniversityOfHelsinkiCS/repo_name"
    activity: {
      type: getActivityType(content?.payload),
      action: content?.payload?.action,
      commits:
        content?.payload?.commits?.length === 0
          ? undefined
          : content.payload.commits?.map((commit) => commit.message),
      release: content?.payload?.release?.name,
      issue: content?.payload?.issue?.title,
    },
  }));
  const result = formattedContent;

  githubInfos[userId] = result;
});

app.action("clear_users_github_data", async ({ ack, body, client }) => {
  const userId = body.user.id;

  if (userId in githubInfos) {
    githubInfos[userId] = [];
  }
});

(async () => {
  await app.start(process.env.PORT || 3000);
  app.logger.info("⚡️ Toska Weekly node server is running!");
})();

import pkg from "@slack/bolt";
import { getActivityType, fetchGithubActivity } from "./utils.js";
import dotenv from "dotenv";

const { App } = pkg;
dotenv.config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const attendees = new Set();
const homeTabUsers = new Set(); // Track users who have opened the home tab
let githubInfos = {};

const rouletteInitElems = [
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "I'm In",
    },
    action_id: "add_user_to_turn_roulette",
  },
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "I'm Out",
    },
    action_id: "remove_user_from_turn_roulette",
  },
];

const rouletteStartElems = [
  ...rouletteInitElems,
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "Start turn roulette 🎲",
    },
    style: "primary",
    action_id: "start_turn_roulette",
  },
];

const rouletteNextElems = [
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "Next 🎲",
    },
    style: "primary",
    action_id: "start_turn_roulette",
  },
];

const rouletteDoneElems = [
  {
    type: "button",
    text: {
      type: "plain_text",
      text: "Done 🚩",
    },
    style: "primary",
    action_id: "end_turn_roulette",
  },
];

const githubUsernameInputBlocks = [
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
      },
      {
        type: "button",
        action_id: "clear_users_github_data",
        text: {
          type: "plain_text",
          text: "Clear",
        },
      },
    ],
  },
];

/* HOME AND UPDATE HANDLERS --------------------------------------------------------------- */
// Helper function to update view in home tab
const updateView = async (client, dynamicRouletteControlBlocks = []) => {
  const attendeeNames =
    [...attendees].map((id) => `<@${id}>`).join("\n") || "_No attendees yet_";

  // Update home tab for all users who have opened it
  const updatePromises = [...homeTabUsers].map(async (userId) => {
    try {
      const userGithubInfo = githubInfos[userId] || [];
      const githubActivitiesBlocks =
        userGithubInfo.length > 0
          ? userGithubInfo.map((item) => ({
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
            }))
          : [];

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
          ...dynamicRouletteControlBlocks,
          ...githubUsernameInputBlocks,
          ...githubActivitiesBlocks,
        ],
      };

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
            elements: rouletteInitElems,
          },
          ...githubUsernameInputBlocks,
        ],
      },
    });
  } catch (error) {
    console.error("Error publishing home tab:", error);
  }
});

/* TURN ROULETTE HANDLERS ----------------------------------------------------------------- */
// Handle "I'm In" button
app.action("add_user_to_turn_roulette", async ({ ack, body, client }) => {
  await ack();

  const userId = body.user.id;
  attendees.add(userId);

  // Update all home tabs with updated attendee list
  const extraBlocks = [
    {
      type: "actions",
      elements: attendees.size === 0 ? rouletteInitElems : rouletteStartElems,
    },
  ];

  await updateView(client, extraBlocks);
});

// Handle "I'm Out" button
app.action("remove_user_from_turn_roulette", async ({ ack, body, client }) => {
  await ack();

  const userId = body.user.id;
  attendees.delete(userId);

  // Update all home tabs with updated attendee list
  const extraBlocks = [
    {
      type: "actions",
      elements: attendees.size === 0 ? rouletteInitElems : rouletteStartElems,
    },
  ];

  await updateView(client, extraBlocks);
});

// Handle "Start turn roulette" button
app.action("start_turn_roulette", async ({ ack, body, client }) => {
  await ack();

  const userId = body.user.id;
  const userWhoStarted = `<@${userId}>`;

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

  await updateView(client, extraBlocks);

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
          elements: rouletteDoneElems,
        },
      ];

      await updateView(client, lastResultBlock);
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
        elements: rouletteNextElems,
      },
    ];

    await updateView(client, resultBlocks);
  }, 1200);
});

// Handle "Done" button
app.action("end_turn_roulette", async ({ ack, body, client }) => {
  await ack();

  attendees.clear();
  githubInfos = {};

  const extraBlocks = [
    {
      type: "actions",
      elements: rouletteInitElems,
    },
  ];

  await updateView(client, extraBlocks);
});

/* GITHUB INFO HANDLERS ------------------------------------------------------------------- */
// Handle "Get" button
app.action("get_users_github_data", async ({ ack, body, client }) => {
  await ack();

  const userId = body.user.id;
  const githubUsername =
    body.view.state.values.github_user_block.github_user_input.value;

  if (!githubUsername) {
    console.error("No GitHub username provided");
    return;
  }

  try {
    const fetchedGithubInfo = await fetchGithubActivity(githubUsername);
    const formattedContent = fetchedGithubInfo.map((content) => ({
      repo: content?.repo?.name?.split("/")[1],
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

    githubInfos[userId] = formattedContent;

    // Update only this user's home tab with their GitHub info
    await updateView(client, [
      {
        type: "actions",
        elements: attendees.size === 0 ? rouletteInitElems : rouletteStartElems,
      },
    ]);
  } catch (error) {
    console.error("Error fetching GitHub activity:", error);
  }
});

// Handle "Clear" button
app.action("clear_users_github_data", async ({ ack, body, client }) => {
  await ack();

  const userId = body.user.id;
  githubInfos[userId] = [];

  // Update only this user's home tab to clear their GitHub info
  await updateView(client, [
    {
      type: "actions",
      elements: attendees.size === 0 ? rouletteInitElems : rouletteStartElems,
    },
  ]);
});

/* SERVER --------------------------------------------------------------------------------- */
(async () => {
  await app.start(process.env.PORT || 3000);
  app.logger.info("⚡️ Toska Weekly node server is running!");
})();

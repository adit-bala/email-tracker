console.log("Service worker is active!");

const logger = {
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
};
let authToken = null;
const DOMAIN = "stealthbyte.deno.dev";
const LOCALHOST = "localhost:8080";
const isDev = false;
const serverUrl = isDev ? `http://${LOCALHOST}` : `https://${DOMAIN}`;
// Function to get OAuth2 token
function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, function (token) {
      if (chrome.runtime.lastError || !token) {
        logger.error("Error getting auth token:", chrome.runtime.lastError.message);
        reject(new Error("Failed to get auth token"));
      } else {
        resolve(token);
      }
    });
  });
}

// Function to ensure authentication
async function ensureAuthenticated() {
  try {
    // First, try to get the token non-interactively
    try {
      authToken = await getAuthToken(false);
    } catch (error) {
      logger.info("Non-interactive auth failed, trying interactive...");
      authToken = await getAuthToken(true);
    }
    if (!authToken) {
      throw new Error("Failed to obtain auth token");
    }

    return authToken;
  } catch (error) {
    logger.error("Authentication failed:", error.message);
    authToken = null; // Reset the token if authentication fails
    throw error;
  }
}

const MAX_RETRIES = 5;
const DELAY_MS = 500; // .5 second
const STORAGE_KEY_PREFIX = "email_sleep_"; // Prefix for storage keys

// store sleep data
function storeEmailSleepData(id, data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY_PREFIX + id]: data }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError));
      } else {
        resolve();
      }
    });
  });
}

// get sleep data
function getEmailSleepData(id) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEY_PREFIX + id], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError));
      } else {
        resolve(result[STORAGE_KEY_PREFIX + id]);
      }
    });
  });
}

// remove sleep data
function removeEmailSleepData(id) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([STORAGE_KEY_PREFIX + id], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError));
      } else {
        resolve();
      }
    });
  });
}

function isGmailPage(url) {
  return url && url.startsWith("https://mail.google.com/");
}

function isGmailCompose(url) {
  return url && url.includes("compose");
}

function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, { message });
}

function attemptAuthentication() {
  ensureAuthenticated().catch(error => {
    logger.error("Authentication failed:", error.message);
    authToken = null;
  });
}

function checkAndSendState(tabId, tabUrl) {
  if (isGmailCompose(tabUrl)) {
    logger.info("Compose window detected.");
    sendMessageToTab(tabId, "search_for_send");
  } else {
    logger.info("Reply/Forward window check triggered.");
    sendMessageToTab(tabId, "search_for_reply_or_forward");
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isGmailPage(tab.url)) {
    logger.info("Tab update detected for Gmail.");
    attemptAuthentication();
    checkAndSendState(tabId, tab.url);
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "process_email") {
    logger.info("Processing email data:", request.data.subject);
    processEmail(request.data, sender); // Pass sender to processEmail
  }
});

// Function to process email data and initiate retry mechanism
async function processEmail(emailData, sender) {
  try {
    const token = await ensureAuthenticated();

    // Get the user index from sender.tab.url
    let userIndex = 0;
    if (sender && sender.tab && sender.tab.url) {
      const url = sender.tab.url;
      const userIndexMatch = url.match(/mail\/u\/(\d+)\//);
      userIndex = userIndexMatch ? parseInt(userIndexMatch[1], 10) : 0;
      logger.info(`User index extracted: ${userIndex}`);
    }

    // Include the userIndex in emailData
    emailData.userIndex = userIndex.toString();

    // Generate a unique ID for this email processing task
    const sleepId = emailData.uniqueId;

    // Initialize sleep data
    const sleepData = {
      emailData: emailData,
      token: token,
      attempt: 0,
    };

    // Store the sleep data
    await storeEmailSleepData(sleepId, sleepData);

    // Create an alarm to trigger the first attempt after DELAY_MS
    chrome.alarms.create(sleepId, { delayInMinutes: DELAY_MS / 60000 });

    logger.info(
      `Scheduled sleep alarm "${sleepId}" for email with subject: "${emailData.subject}"`,
    );
  } catch (error) {
    logger.error("Error initiating email processing:", error);
  }
}

// Listener for alarm events to handle retries
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const sleepId = alarm.name;
  logger.info(`Alarm "${sleepId}" triggered.`);

  try {
    // Retrieve the sleep data
    const sleepData = await getEmailSleepData(sleepId);

    if (!sleepData) {
      logger.error(`No sleep data found for alarm "${sleepId}".`);
      return;
    }

    const { emailData, token, attempt } = sleepData;
    const currentAttempt = attempt + 1;

    // Modify the query to include the date range
    const query = `in:sent subject:"${emailData.subject}"`;

    // Search for the email
    const searchResponse = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${
        encodeURIComponent(query)
      }&maxResults=10`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!searchResponse.ok) {
      throw new Error(`Gmail API error: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();
    let emailFound = false;

    if (searchData.messages && searchData.messages.length > 0) {
      const messageId = searchData.messages[0].id;
      // Fetch the message content
      const messageResponse = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!messageResponse.ok) {
        throw new Error(
          `Failed to fetch email message: ${messageResponse.statusText}`,
        );
      }

      const messageData = await messageResponse.json();
      // Extract all headers
      const headers = {};
      messageData.payload.headers.forEach((header) => {
        headers[header.name.toLowerCase()] = header.value;
      });
      const emailDateMs = headers.date
        ? new Date(headers.date).getTime()
        : null;

      const dateAtTimeOfSendMs = new Date(Number(emailData.dateAtTimeOfSend))
        .getTime();

      const baseThresholdSeconds = 10;
      const thresholdSecondsMs = baseThresholdSeconds * Math.pow(2, attempt) * 1000;
      const lowerBound = dateAtTimeOfSendMs - thresholdSecondsMs;
      const upperBound = Date.now(); 

      logger.info(`Attempt ${currentAttempt}: Searching for emails between ${new Date(lowerBound).toISOString()} and ${new Date(upperBound).toISOString()}`);

      if (
        emailDateMs && dateAtTimeOfSendMs && emailDateMs >= lowerBound &&
        emailDateMs <= upperBound
      ) {
        logger.info("Found matching recent email:", messageData.snippet);
        emailFound = true;
        // Process the email content here
        const uniqueId = emailData.uniqueId;
        const emailPayload = {
          subject: headers.subject || "",
          email_id: messageId,
          sender: headers.from || "",
          recipient: headers.to || "",
          dateAtTimeOfSend: emailDateMs.toString(),
          userIndex: emailData.userIndex || "",
        };
        // Send a notification to the server
        try {
          const serverResponse = await fetch(
            `${serverUrl}/${uniqueId}/pixel.png`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(emailPayload),
            },
          );

          if (!serverResponse.ok) {
            throw new Error(
              `Server responded with status: ${serverResponse.status}`,
            );
          }
          logger.info("Notification sent to server successfully");
        } catch (error) {
          logger.error("Failed to send notification to server:", error);
        }
      }
    }

    if (!emailFound) {
      if (currentAttempt < MAX_RETRIES) {
        const backoffDelay = Math.pow(2, currentAttempt) * (DELAY_MS / 60000);
        logger.info(
          `Email not found on attempt ${currentAttempt}. Scheduling next retry in ${backoffDelay} minutes.`
        );
        // Update the sleep data with the incremented attempt count
        sleepData.attempt = currentAttempt;
        await storeEmailSleepData(sleepId, sleepData);

        // Reschedule the alarm for the next attempt with exponential backoff
        chrome.alarms.create(sleepId, { delayInMinutes: backoffDelay });
      } else {
        logger.error(
          `No matching sent email found after ${MAX_RETRIES} attempts for alarm "${sleepId}".`,
        );

        await removeEmailSleepData(sleepId);
        chrome.alarms.clear(sleepId);
      }
    } else {
      await removeEmailSleepData(sleepId);
      chrome.alarms.clear(sleepId);
    }
  } catch (error) {
    logger.error(`Error handling alarm "${sleepId}":`, error.message);
  }
});

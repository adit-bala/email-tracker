console.log("Service worker is active!");

let authToken = null;

// Function to get OAuth2 token
function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, function (token) {
      if (chrome.runtime.lastError || !token) {
        console.error("Error getting auth token:", chrome.runtime.lastError);
        reject(new Error('Failed to get auth token'));
      } else {
        resolve(token);
      }
    });
  });
}

// Function to ensure authentication
async function ensureAuthenticated() {
  if (authToken) {
    return authToken;
  }
  try {
    authToken = await getAuthToken(false);
    if (!authToken) {
      authToken = await getAuthToken(true);
    }
    return authToken;
  } catch (error) {
    console.error("Authentication failed:", error);
    throw error;
  }
}

const MAX_RETRIES = 5;
const DELAY_MS = 20000; // 20 seconds
const STORAGE_KEY_PREFIX = 'email_sleep_'; // Prefix for storage keys


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
function removeEmailRetryData(id) {
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

// Listen for tab updates to detect Gmail loading and compose window
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("https://mail.google.com/")) {
    console.log("Gmail loaded :p Checking auth status.");
    ensureAuthenticated();
  }

  if (tab.url && tab.url.startsWith("https://mail.google.com/mail/") && tab.url.includes('compose')) {
    if (changeInfo.status === 'complete') {
      chrome.tabs.sendMessage(tabId, { message: "compose_button_exists" });
    }
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "process_email") {
    console.log("Processing email data:", request.data.subject);
    processEmail(request.data);
  }
});

// Function to process email data and initiate retry mechanism
async function processEmail(emailData) {
  try {
    const token = await ensureAuthenticated();

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

    console.log(`Scheduled sleep alarm "${sleepId}" for email with subject: "${emailData.subject}"`);

  } catch (error) {
    console.error("Error initiating email processing:", error);
  }
}

// Listener for alarm events to handle retries
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const sleepId = alarm.name;
  console.log(`Alarm "${sleepId}" triggered.`);

  try {
    // Retrieve the sleep data
    const sleepData = await getEmailSleepData(sleepId);

    if (!sleepData) {
      console.warn(`No sleep data found for alarm "${sleepId}".`);
      return;
    }

    const { emailData, token, attempt } = sleepData;
    const currentAttempt = attempt + 1;

    // Modify the query to include the date range
    const query = `in:sent subject:"${emailData.subject}"`;

    // Search for the email
    const searchResponse = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Gmail API error: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();
    let emailFound = false;

    if (searchData.messages && searchData.messages.length > 0) {
      const messageId = searchData.messages[0].id;
      // Fetch the message content
      const messageResponse = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!messageResponse.ok) {
        throw new Error(`Failed to fetch email message: ${messageResponse.statusText}`);
      }

      const messageData = await messageResponse.json();
      const emailDateMs = messageData.payload.headers
        .find(h => h.name.toLowerCase() === 'date')?.value
        ? new Date(messageData.payload.headers.find(h => h.name.toLowerCase() === 'date').value).getTime()
        : null;
      
      console.log("Email Date from header:", emailDateMs, emailDateMs );
      
      const dateAtTimeOfSendMs = new Date(Number(emailData.dateAtTimeOfSend)).getTime();
      console.log("date at time of send:", emailData.dateAtTimeOfSend, dateAtTimeOfSendMs);

      const thresholdSecondsMs = 10 * 1000; // check if we are within 10 seconds
      const lowerBound = dateAtTimeOfSendMs - thresholdSecondsMs;
      const upperBound = dateAtTimeOfSendMs + thresholdSecondsMs;

      if (emailDateMs >= lowerBound && emailDateMs <= upperBound) {
        console.log("Found matching recent email:", messageData.snippet);
        emailFound = true;
        // Process the email content here
      }
    }

    if (!emailFound) {
      if (currentAttempt < MAX_RETRIES) {
        console.log(`Email not found on attempt ${currentAttempt}. Scheduling next retry in ${DELAY_MS / 60000} seconds.`);
        // Update the sleep data with the incremented attempt count
        sleepData.attempt = currentAttempt;
        await storeEmailSleepData(sleepId, sleepData);

        // Reschedule the alarm for the next attempt
        chrome.alarms.create(sleepId, { delayInMinutes: DELAY_MS / 60000 });
      } else {
        console.error(`No matching sent email found after ${MAX_RETRIES} attempts for alarm "${sleepId}".`);

        await removeEmailRetryData(sleepId);
        chrome.alarms.clear(sleepId);
      }
    } else {
      await removeEmailRetryData(sleepId);
      chrome.alarms.clear(sleepId);
    }

  } catch (error) {
    console.error(`Error handling alarm "${sleepId}":`, error.message);
  }
});

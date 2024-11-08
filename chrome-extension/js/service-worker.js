// Import the CONFIG object
importScripts('config.js');

console.log("Service worker is active!");

let authToken = null;
const DOMAIN = CONFIG.SERVER_DOMAIN;

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
      // Extract all headers
      const headers = {};
      messageData.payload.headers.forEach(header => {
        headers[header.name.toLowerCase()] = header.value;
      });

      console.log("All email headers:", JSON.stringify(headers, null, 6));


      const emailDateMs = headers.date ? new Date(headers.date).getTime() : null;

      const dateAtTimeOfSendMs = new Date(Number(emailData.dateAtTimeOfSend)).getTime();

      const thresholdSecondsMs = 10 * 1000; // check if we are within 10 seconds
      const lowerBound = dateAtTimeOfSendMs - thresholdSecondsMs;
      const upperBound = dateAtTimeOfSendMs + thresholdSecondsMs;

      if (emailDateMs && dateAtTimeOfSendMs && emailDateMs >= lowerBound && emailDateMs <= upperBound) {
        console.log("Found matching recent email:", messageData.snippet);
        emailFound = true;
        // Process the email content here
        const uniqueId = emailData.uniqueId;
        const emailPayload = {
          subject: headers.subject || '',
          email_id: messageId,
          sender: headers.from || '',
          recipient: headers.to || '',
          dateAtTimeOfSend: emailDateMs.toString()
        };
        // Send a notification to the server
        try {
          const serverResponse = await fetch(`${DOMAIN}/${uniqueId}/pixel.png`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Extension-Auth': CONFIG.CORS_KEY
            },
            body: JSON.stringify(emailPayload),
          });

          if (!serverResponse.ok) {
            throw new Error(`Server responded with status: ${serverResponse.status}`);
          }
          console.log('Notification sent to server successfully');
        } catch (error) {
          console.error('Failed to send notification to server:', error);
        }
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

        await removeEmailSleepData(sleepId);
        chrome.alarms.clear(sleepId);
      }
    } else {
      await removeEmailSleepData(sleepId);
      chrome.alarms.clear(sleepId);
    }

  } catch (error) {
    console.error(`Error handling alarm "${sleepId}":`, error.message);
  }
});

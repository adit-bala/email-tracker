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

async function fetchGmailMessages(token) {
  try {
    const response = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();


  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("https://mail.google.com/")) {
    console.log("Gmail loaded. Checking authentication status.");
    ensureAuthenticated();
  }
  
  if (tab.url && tab.url.startsWith("https://mail.google.com/mail/") && tab.url.includes('compose')) {
    if (changeInfo.status === 'complete') {
      chrome.tabs.sendMessage(tabId, { message: "compose_button_exists" });
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "process_email") {
    console.log("Processing email data:", request.data.subject);
    processEmail(request.data);
  }
});

async function processEmail(emailData) {
  try {
    const token = await ensureAuthenticated();

    // TODO: FIX SEARCH QUERY
    const query = `in:sent subject:"${emailData.subject}" `;

    // Search for the email
    const searchResponse = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Gmail API error: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();

    if (searchData.messages && searchData.messages.length > 0) {
      const emailId = searchData.messages[0].id;
      console.log("Found email with ID:", emailId);

      const uniqueId = emailData.uniqueId;

      // Store the emailId and uniqueId
      //await storeEmailId(emailId, uniqueId);

      console.log("Email processed successfully.");
    } else {
      console.error('No matching sent email found.');
    }
  } catch (error) {
    console.error("Error processing email:", error);
  }
}
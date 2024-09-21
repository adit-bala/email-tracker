console.log("Service worker is active!");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "process_email") {
    console.log("Processing email data:", request.data.subject);
  }
});

// Wait to see if the url indicates that the `compose` window is open
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.startsWith("https://mail.google.com/mail/") && tab.url.includes('compose')) {
    // Only send message to inject script once it has been loaded
    if (changeInfo.status === 'complete') {
      chrome.tabs.sendMessage(tab.id, { message: "compose_button_exists" });
    }
  }
});


console.log("Service worker is active!");
// todo: make this works with multiple tabs open
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.startsWith("https://mail.google.com/mail/")) {
    if (tab.url.includes('compose') && changeInfo.status === 'complete') {
      console.log("Compose Button Exists -> Sending to inject script");
      chrome.tabs.sendMessage(tab.id, { message: "compose_button_exists" });
      //window.injectedButton = true;
    } else {
      //window.injectedButton = false;
    }
  }
});


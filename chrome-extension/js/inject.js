console.debug("email-tracker: init");

// Message listener for when the compose button is detected
chrome.runtime.onMessage.addListener((request) => {
    if (request.message === "compose_button_exists") {
        overrideSend();
    }
});

// Function to override the Send button functionality
const overrideSend = () => {
    const sendButton = document.querySelector('div[role="button"][aria-label^="Send"]');
    if (sendButton) {
        // Attach the custom event listener
        sendButton.addEventListener('click', handleSendButtonClick);
      }
}

// Custom handler to run before sending the email
function handleSendButtonClick() {
    // Your custom code
    alert("injecting pixel :D");
}
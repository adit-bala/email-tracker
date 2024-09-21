console.debug("email-tracker: init");

// Message listener for when the compose button is detected
chrome.runtime.onMessage.addListener((request) => {
    if (request.message === "compose_button_exists") {
        overrideSend();
    }
});

const overrideSend = () => {
    // Hook onto the send button
    const sendButton = document.querySelector('div[role="button"][aria-label^="Send"]');
    if (sendButton) {
        // Attach the custom event listener
        sendButton.addEventListener('click', handleSendButtonClick);
      }
}

// Custom handler to run before sending the email
function handleSendButtonClick() {
    // todo: inject pixel logic
    alert("injecting pixel :D");
    const emailData = {
        subject: document.querySelector('input[aria-label^="Subject"]').value,
    };
    chrome.runtime.sendMessage({ 
        message: "process_email", 
        data: emailData 
    });
}
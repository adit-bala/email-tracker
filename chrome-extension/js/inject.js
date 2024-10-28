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
    const emailBodyElement = document.querySelector('div[aria-label^="Message Body"]');
    const uniqueId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    if (emailBodyElement) {
        const trackingPixel = `{uniqueId}`;
        // Append the tracking pixel
        emailBodyElement.innerHTML += trackingPixel;
        console.log("Tracking pixel injected with UID:", uniqueId);
    }
    const subjectElement = document.querySelector('input[aria-label^="Subject"]');
    const subject = subjectElement ? subjectElement.value : "";
    const emailData = {
        subject: subject,
        uniqueId: uniqueId
    };
    alert("injecting pixel :D");
    chrome.runtime.sendMessage({
        message: "process_email",
        data: emailData
    });
}
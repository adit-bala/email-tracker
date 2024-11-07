console.log("email-tracker: init");

const DOMAIN = "email-track.deno.dev"
const baseTrackingPixelUrl = `https://${DOMAIN}`;
let uniqueId;
let emailBodyElement;

const generateUniqueId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Message listener for when the compose button is detected
chrome.runtime.onMessage.addListener((request) => {
    if (request.message === "compose_button_exists") {
        overrideSend();
    }
});

const insertTrackingPixel = (uniqueId) => {
    emailBodyElement = document.querySelector('div[aria-label^="Message Body"]');
    if (emailBodyElement) {
        uniqueId = generateUniqueId();
        const trackingPixelUrl = `${baseTrackingPixelUrl}/${uniqueId}/pixel.png`;
        // Check if a tracking pixel from your server already exists
        if (!emailBodyElement.querySelector(`img[src^="${baseTrackingPixelUrl}"]`)) {
            // Create the tracking pixel element
            const trackingPixelElement = document.createElement('img');
            trackingPixelElement.src = trackingPixelUrl;
            trackingPixelElement.width = 1;
            trackingPixelElement.height = 1;
            trackingPixelElement.style.opacity = '0.01';

            // Insert the tracking pixel at the end of the email body
            const range = document.createRange();
            range.selectNodeContents(emailBodyElement);
            range.collapse(false);
            range.insertNode(trackingPixelElement);

            console.log("Tracking pixel injected with UID:", uniqueId);
        } else {
            console.log("Tracking pixel from server already exists in email body");
        }
    } else {
        console.error("email body element not found");
    }
    
}

const overrideSend = () => {
    // Hook onto the send button
    const sendButton = document.querySelector('div[role="button"][aria-label^="Send"]');
    if (sendButton) {
        uniqueId = generateUniqueId();
        insertTrackingPixel(uniqueId);
        sendButton.addEventListener('click', handleSendButtonClick);
    }
}

const handleSendButtonClick = () => {
    // Extract the email subject
    const subjectElement = document.querySelector('input[aria-label^="Subject"]');
    const subject = subjectElement ? subjectElement.value : "";

    const emailData = {
        uniqueId: uniqueId,
        subject: subject,
        dateAtTimeOfSend: Date.now().toString()
    };
    chrome.runtime.sendMessage({
        message: "process_email",
        data: emailData
    });
}

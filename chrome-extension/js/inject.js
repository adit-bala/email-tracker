const observeURLChanges = () => {
    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            handleURLChange(currentUrl);
        }
    });

    observer.observe(document, { subtree: true, childList: true });
    console.log("init")

    const handleURLChange = (url) => {
        if (url.includes("compose=")) {
            console.log("Compose window detected:", url);
            const sendButton = document.querySelector('div[role="button"][aria-label^="Send"]');
            console.log("send", sendButton);
            // Remove any existing event listeners to avoid duplication
            sendButton.removeEventListener('click', handleSendButtonClick);
            // Attach our custom event listener
            sendButton.addEventListener('click', handleSendButtonClick);
        } else {
            console.log("Not a compose window. Script will not run.");
        }
    };

    // Initial check on page load
    handleURLChange(location.href);
};

function handleSendButtonClick(event) {
    // Prevent the default send action temporarily
    event.preventDefault();

    console.log('Custom code is running before sending the email.');

    // Example of custom code: Inject a tracking pixel (assuming email body is accessible)
    console.log("injecting pixel :D");

    // Trigger Gmail's native send functionality after your code executes
    setTimeout(() => {
        // Trigger the click event again to allow the email to be sent
        event.target.click();
    }, 500);  // Delay to ensure custom code execution
}


// Start observing when the script loads
observeURLChanges();
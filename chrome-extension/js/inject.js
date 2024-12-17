// Configuration and Logger
const isDev = false;
const DOMAIN = "stealthbyte.deno.dev";
const LOCALHOST = "localhost:8080";
const baseTrackingPixelUrl = isDev ? `http://${LOCALHOST}` : `https://${DOMAIN}`;

const logger = {
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
};

logger.info("email-tracker: init");

// DOM Utilities
const findButtonByText = (text) => {
  return Array.from(document.querySelectorAll('span[role="link"]'))
    .find(el => el.textContent.trim() === text);
};

const findButtonByRole = (role, label) => {
  return document.querySelector(`div[role="${role}"][aria-label^="${label}"]`);
};

const addClickListener = (button, clickHandler) => {
  if (button) {
    button.addEventListener("click", clickHandler);
  }
};

// Retry Utility
const retryOperation = async (
  operation,
  findElement,
  operationName,
  maxRetries = 5,
  delayMs = 1000
) => {
  const attempt = async (attemptsLeft) => {
    const element = findElement();
    if (element) {
      logger.info(`${operationName} found`);
      await operation(element);
      return true;
    }

    if (attemptsLeft > 0) {
      logger.info(`${operationName} not found, retrying... (${attemptsLeft} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return attempt(attemptsLeft - 1);
    }

    logger.warn(`Failed to find ${operationName} after ${maxRetries} attempts`);
    return false;
  };

  return attempt(maxRetries);
};

// Pixel Insertion
let uniqueId;

const generateUniqueId = () => {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
};

const insertTrackingPixel = () => {
  const emailBodyElement = document.querySelector('div[aria-label^="Message Body"]');
  if (!emailBodyElement) {
    logger.warn("email body element not found");
    return;
  }

  if (!emailBodyElement.querySelector(`img[src^="${baseTrackingPixelUrl}"]`)) {
    uniqueId = generateUniqueId();
    const trackingPixelUrl = `${baseTrackingPixelUrl}/${uniqueId}/pixel.png`;
    const trackingPixelElement = document.createElement("img");
    trackingPixelElement.src = trackingPixelUrl;
    trackingPixelElement.width = 1;
    trackingPixelElement.height = 1;
    trackingPixelElement.style.opacity = "0.01";

    const range = document.createRange();
    range.selectNodeContents(emailBodyElement);
    range.collapse(false);
    range.insertNode(trackingPixelElement);
    logger.info("Tracking pixel injected with UID:", uniqueId);
  } else {
    logger.info("Tracking pixel already exists in email body");
  }
};

// Send Handler
const handleSendButtonClick = () => {
  const subjectElement = document.querySelector('input[aria-label^="Subject"]');
  const subject = subjectElement ? subjectElement.value : "";

  const emailData = {
    uniqueId: uniqueId,
    subject: subject,
    dateAtTimeOfSend: Date.now().toString(),
  };

  chrome.runtime.sendMessage({
    message: "process_email",
    data: emailData,
  });
};

const handleSendButton = async (button) => {
  insertTrackingPixel();
  addClickListener(button, handleSendButtonClick);
};

const overrideSend = async (retries = 5) => {
  const findSendButton = () => findButtonByRole("button", "Send");
  return retryOperation(handleSendButton, findSendButton, "Send button", retries);
};

// Reply/Forward Handler
const findReplyAndForwardButtons = () => {
  const buttons = {
    reply: findButtonByText("Reply"),
    forward: findButtonByText("Forward"),
  };
  return (buttons.reply || buttons.forward) ? buttons : null;
};

const handleReplyOrForwardButtonClick = (event) => {
  const buttonType = event.target.textContent.trim();
  logger.info(`${buttonType} button clicked`);
  Promise.all([
    overrideSend(),
    overrideDiscard()
  ]).then(([sendSuccess, discardSuccess]) => {
    if (!sendSuccess) {
      logger.warn("Failed to override send button after all retries");
    }
    if (!discardSuccess) {
      logger.warn("Failed to override discard button after all retries");
    }
    if (sendSuccess && discardSuccess) {
      logger.info("Successfully set up all button handlers");
    }
  });
};

const handleReplyForwardButtons = async (buttons) => {
  if (buttons.reply) {
    logger.info("Reply button found, adding listener");
    addClickListener(buttons.reply, handleReplyOrForwardButtonClick);
  }

  if (buttons.forward) {
    logger.info("Forward button found, adding listener");
    addClickListener(buttons.forward, handleReplyOrForwardButtonClick);
  }
};

const overrideReplyOrForward = async (retries = 3) => {
  return retryOperation(
    handleReplyForwardButtons,
    findReplyAndForwardButtons,
    "Reply/Forward buttons",
    retries
  );
};

// Discard Handler
const handleDiscardButtonClick = () => {
  logger.info("Discard button clicked");
  setTimeout(() => {
    overrideReplyOrForward().then(success => {
      if (!success) {
        logger.warn("Failed to override reply/forward buttons after discard");
      } else {
        logger.info("Successfully reattached reply/forward handlers after discard");
      }
    });
  }, 300);
};

const handleDiscardButton = async (button) => {
  if (button) {
    button.addEventListener("click", handleDiscardButtonClick);
    logger.info("Discard button handler attached");
  }
};

const overrideDiscard = async (retries = 3) => {
  const findDiscardButton = () => findButtonByRole("button", "Discard draft");
  return retryOperation(
    handleDiscardButton,
    findDiscardButton,
    "Discard button",
    retries
  );
};

// Message Listeners
chrome.runtime.onMessage.addListener((request) => {
  if (request.message === "search_for_send") {
    logger.info("SEND BUTTON SEARCHING");
    overrideSend().then(success => {
      if (!success) {
        logger.warn("Failed to override send button after all retries");
      }
    });
  } else if (request.message === "search_for_reply_or_forward") {
    logger.info("REPLY/FORWARD BUTTONS SEARCHING");
    overrideReplyOrForward().then(success => {
      if (!success) {
        logger.warn("Failed to override reply/forward buttons after all retries");
      } else {
        logger.info("Successfully set up reply/forward button handlers");
      }
    });
  }
});

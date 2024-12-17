console.log("email-tracker: init");

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
const DOMAIN = "stealthbyte.deno.dev";
const LOCALHOST = "localhost:8080";
const isDev = true;
const baseTrackingPixelUrl = isDev ? `http://${LOCALHOST}` : `https://${DOMAIN}`;
let uniqueId;
let emailBodyElement;

const generateUniqueId = () => {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
};

const findButtonByText = (text) => {
  return Array.from(document.querySelectorAll('span[role="link"]')).find(
    (el) => el.textContent.trim() === text
  );
};

const findButtonByRole = (role, label) => {
  return document.querySelector(`div[role="${role}"][aria-label^="${label}"]`);
};

const addClickListener = (button, clickHandler) => {
  if (button) {
    button.addEventListener("click", clickHandler);
  }
};

const retryOperation = async (operation, findElement, operationName, maxRetries = 5, delayMs = 1000) => {
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

const insertTrackingPixel = () => {
  emailBodyElement = document.querySelector('div[aria-label^="Message Body"]');
  if (emailBodyElement) {
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
      logger.info("Tracking pixel from server already exists in email body");
    }
  } else {
    logger.warn("email body element not found");
  }
};

const overrideSend = async (retries = 5) => {
  const findSendButton = () => findButtonByRole("button", "Send");
  
  const handleSendButton = async (button) => {
    insertTrackingPixel();
    addClickListener(button, handleSendButtonClick);
  };

  return retryOperation(
    handleSendButton,
    findSendButton,
    "Send button",
    retries
  );
};

const findReplyAndForwardButtons = () => {
  const buttons = {
    reply: findButtonByText("Reply"),
    forward: findButtonByText("Forward")
  };
  
  // Return null if neither button is found
  return (buttons.reply || buttons.forward) ? buttons : null;
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

const handleReplyOrForwardButtonClick = (event) => {
  const buttonType = event.target.textContent.trim();
  logger.info(`${buttonType} button clicked`);
  overrideSend().then(success => {
    if (!success) {
      logger.warn("Failed to override send button after all retries");
    }
  });
};

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

# Email Tracker Chrome Extension

Track whether recipients have opened your email

## Installation Guide (Developer Mode)

Follow these steps to install and use the Chrome extension in developer mode:

### Prerequisites

- **Google Chrome** browser installed.
- A local copy of the `chrome-extension` folder.

### Steps

1. **Download the Extension**

   - **Option 1: Clone the Repository**

     ```bash
     git clone https://github.com/adit-bala/email-tracker.git
     ```

     - Navigate to the `chrome-extension` directory:

       ```bash
       cd email-tracker/chrome-extension
       ```

   - **Option 2: Download the Latest Release**

     - Go to the [Releases](https://github.com/adit-bala/email-tracker/releases) page.
     - Download the `chrome-extension.zip` file from the latest release.
     - Extract the ZIP file to a convenient location.

2. **Open Chrome and Access the Extensions Page**

   - Open Google Chrome.
   - In the address bar, navigate to `chrome://extensions/`.

3. **Enable Developer Mode**

   - On the top right corner of the Extensions page, toggle the **Developer mode** switch to the **On** position.

4. **Load the Unpacked Extension**

   - Click on the **Load unpacked** button.

5. **Select the Extension Folder**

   - In the file dialog that appears, navigate to the location of the `chrome-extension` folder you downloaded or cloned.
   - Select the `chrome-extension` folder and click **Open**.

6. **Verify the Extension is Installed**

   - The extension should now appear in the list of installed extensions.
   - Ensure there are no errors indicated.

7. **Configure the Extension (If Necessary)**

   - If the extension requires any setup, such as logging in or granting permissions, follow the on-screen prompts.

### Usage

- **Sending Emails:**
  - Compose and send emails as you normally would.
  - The extension will automatically add tracking pixels to your emails.

- **Tracking Emails:**
  - When a recipient opens your email, you'll receive a notification.

### Troubleshooting

- **Extension Not Appearing:**
  - Ensure you've selected the correct folder containing the `manifest.json` file.
  - Check that all files are present in the folder.

- **Errors Displayed:**
  - If you see errors, click on the "Errors" link in the extension card to view details.
  - Common issues might be missing files or incorrect permissions.

- **Reloading the Extension:**
  - If you make changes to the extension code, you'll need to reload it:
    - Go back to `chrome://extensions/`.
    - Click the **Reload** icon on the extension's card.

### Notes

- **Developer Mode Warning:**
  - Chrome may display a warning about running extensions in developer mode. This is normal for development purposes.

- **Permissions:**
  - The extension may request certain permissions to function correctly. Review these permissions and ensure you're comfortable granting them.

### Additional Resources

- [Chrome Extension Developer Guide](https://developer.chrome.com/docs/extensions/mv3/getstarted/)
- [Debugging Chrome Extensions](https://developer.chrome.com/docs/extensions/mv3/tut_debugging/)

---

**Feel free to reach out if you encounter any issues or have questions about using the extension.**
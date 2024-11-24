# AI Bookmark Organizer

Organize your bookmarks effortlessly with AI-powered categorization.

## Overview

AI Bookmark Organizer is a Chrome extension that automatically organizes your bookmarks into categories using AI. By leveraging the power of AI models built into Google Chrome, it provides a seamless way to keep your bookmarks tidy without manual intervention.

## Demo Video

[Watch the Demo Video on YouTube](https://youtu.be/wWhv3a-wKeo)

## Features

- **Automatic Categorization**: Newly added bookmarks are automatically categorized based on their content.
- **Batch Organization**: Organize all existing bookmarks with a single click from the extension's popup.
- **Custom Categories**: The AI categorizes bookmarks into appropriate categories, making it easier to find them later.

## How It Works

The extension listens for bookmark creation events. When a new bookmark is added, it:

1. Sends the bookmark's title and URL to an AI model.
2. The AI model analyzes the content and determines the most suitable category.
3. The bookmark is moved into a folder named after the category.

For existing bookmarks, you can click the "Organize My Bookmarks" button in the popup to categorize them all at once.

## APIs Used

- **Chrome Bookmarks API**: To interact with and manipulate bookmarks.
- **Chrome Tabs API**: To inject content scripts into tabs for AI processing.
- **Chrome Scripting API**: To execute scripts in the context of web pages.
- **AI Model Integration**: Utilizes AI capabilities built into Google Chrome for natural language processing.

## Installation

### Prerequisites (Based on Google Prompt API documentation)

- **Google Chrome Dev or Canary Channel**: The extension requires Chrome version **128.0.6545.0** or above.
- **Enable Experimental Features**: Access to the AI capabilities requires enabling experimental flags in Chrome.
- **Sufficient Storage**: Ensure you have at least **22 GB** of free storage space on the volume where Chrome stores its user data.
- **Supported Operating Systems**:
  - **Windows**: Version 10 or 11
  - **macOS**: Version 13 (Ventura) or higher
  - **Linux**: (Check for specific requirements)

### Steps

1. **Clone the Repository**

   ```bash
   git clone git@github.com:dakshpareek/ai-bookmark-organizer.git
   ```

2. **Install Dependencies**

   Navigate to the project directory and install the necessary dependencies:

   ```bash
   cd ai-bookmark-organizer
   npm install
   ```

3. **Build the Extension**

   Build the extension using the provided script:

   ```bash
   npm run build
   ```

4. **Enable AI Capabilities in Chrome**

   To use the built-in AI features, you need to enable the Prompt API and ensure that the AI model (Gemini Nano) is available:

   - **Enable Experimental Flags**:

     - Open Chrome and navigate to `chrome://flags/#optimization-guide-on-device-model`.
     - In the flag titled **"Optimization Guide: On Device Model"**, select **"Enabled BypassPerfRequirement"** from the dropdown.
     - Navigate to `chrome://flags/#prompt-api-for-gemini-nano`.
     - In the flag titled **"Prompt API for Gemini Nano"**, select **"Enabled"**.
     - Relaunch Chrome when prompted.

   - **Confirm AI Model Availability**:

     - Open Chrome and navigate to `chrome://components`.
     - Look for **"Optimization Guide On Device Model"** in the list of components.
     - If the version is **0.0.0.0**, click **"Check for update"** to initiate the download of the AI model.
     - Wait for the download to complete. The version number should update to reflect the installed model.

   - **Trigger AI Model Activation**:

     - Open the Chrome DevTools console (press `Ctrl+Shift+I` or `Cmd+Option+I` on macOS).
     - Run the following command to check if the AI model is available:

       ```javascript
       (await ai.languageModel.capabilities()).available;
       ```

     - If it returns `"readily"`, the AI model is available and ready to use.

     - If it returns `"no"`, proceed to trigger the model download:

       - Run:

         ```javascript
         await ai.languageModel.create();
         ```

       - This may fail, but it signals to Chrome that you intend to use the AI features.

       - Restart Chrome and check the availability again.

5. **Load the Extension into Chrome**

   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** by toggling the switch in the top-right corner.
   - Click on **Load unpacked** and select the `dist` directory inside your project folder.

## Usage

- **Automatic Categorization**

  Simply add bookmarks as you normally would. The extension will automatically categorize and move them into the appropriate folders.

- **Organize Existing Bookmarks**

  - Click on the Bookmark Organizer extension icon to open the popup.
  - Click the **Organize My Bookmarks** button.
  - Wait for the process to complete. A status message will inform you when it's done.

## Troubleshooting

If you encounter issues with the AI capabilities:

- **Ensure Chrome is Updated**: Verify that you're using Chrome version **128.0.6545.0** or above.
- **Check Experimental Flags**: Confirm that the necessary flags are enabled as described in the installation steps.
- **Verify AI Model Availability**: Use the Chrome DevTools console to check if the AI model is available.
- **Sufficient Disk Space**: Ensure you have at least **22 GB** of free disk space on the volume where Chrome stores its user data.
- **Network Connection**: A stable, non-metered network connection is required for downloading the AI model.
- **Incognito Mode**: The AI features may not work in Incognito or Guest mode.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.

## License

This project is licensed under the [MIT License](LICENSE).

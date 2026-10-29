# Odle Dolomites Italy screen saver

A macOS screen saver with the photographic Odle scene in Val di Funes: the sky follows the real time, with the Sun, the Moon, the stars, the seasons, the mountain hut and its inhabitants. The options can also run a whole day in a few minutes.

## Install

The ready screen saver is attached to the [latest release](https://github.com/alirux/odle-live-panorama/releases/latest) on GitHub: nothing has to be built.

* [`Odle-Dolomites-Italy.saver.zip`](https://github.com/alirux/odle-live-panorama/releases/latest/download/Odle-Dolomites-Italy.saver.zip): the screen saver for macOS 12 Monterey or later, Apple silicon and Intel.

**Download** it, then double-click the ZIP in Finder to extract `Odle Dolomites Italy.saver`.

### 1. Install it

1. Double-click `Odle Dolomites Italy.saver` in Finder.
2. If macOS asks who to install it for, choose **Only this user** and confirm.
3. Open **System Settings → Screen Saver** and select **Odle Dolomites Italy**, usually under **Other**.
4. Try the preview. It may take a few seconds to load. Move the mouse to leave the preview; macOS may ask for your login password.

On macOS Monterey, use **System Preferences → Desktop & Screen Saver** instead. Labels and locations can vary with the macOS version.

### 2. If macOS blocks it

This screen saver has a local signature, but has not been notarized by Apple. You can authorize your own copy without a paid developer account. Only do this for a copy you built yourself or obtained from a source you trust.

For a warning that the developer cannot be verified or that Apple cannot check the software:

1. Dismiss the warning without moving the file to the Trash.
2. Open **System Settings → Privacy & Security**.
3. Scroll to **Security** and look for the message about the blocked screen saver.
4. Click **Open Anyway**, authenticate if asked, and confirm **Open**.
5. Return to **Screen Saver**, select **Odle Dolomites Italy**, and try the preview again. If installation had not finished, double-click the `.saver` file again first.

On Monterey, look under **System Preferences → Security & Privacy → General**. If the message is missing, try opening the file again and then return to the security settings. Apple describes this procedure in [Open apps safely on your Mac](https://support.apple.com/en-us/102445).

### 3. If there is no “Open Anyway” button for the screen saver

For a trusted copy blocked because it was downloaded, you can remove the download restriction from just this screen saver:

1. In Finder, choose **Go → Go to Folder…**.
2. Paste `~/Library/Screen Savers` and press Return. If the folder does not exist, open `~/Library` and create a folder named `Screen Savers` inside it.
3. Copy `Odle Dolomites Italy.saver` into that folder if it is not already there. Keep that exact filename.
4. Close System Settings.
5. Open **Terminal**, which you can find with Spotlight.
6. Copy this entire line, paste it into Terminal, and press Return:

   ```bash
   xattr -dr com.apple.quarantine "$HOME/Library/Screen Savers/Odle Dolomites Italy.saver"
   ```

7. No output normally means the command completed. If it says **No such file**, check the folder and filename in step 3. If it says the attribute does not exist, that download restriction is already absent.
8. Reopen **System Settings → Screen Saver**, select **Odle Dolomites Italy**, and try the preview. If the previous block persists, restart the Mac and try again.

The command applies only to this installed copy and does not disable Gatekeeper for the rest of your Mac. It does not notarize the code or repair a damaged file. You may need to repeat it after installing a newly downloaded version.

If macOS reports malware or says the software will damage your computer, do not use these steps to bypass that warning. If it reports a damaged file, obtain a fresh copy or rebuild it from source first. On a managed Mac, your administrator may need to authorize installation.

## Options and removal

In **System Settings → Screen Saver**, the **Options** button sets the time (real, accelerated or fixed), the season, the place, the frame rate and more: see [Options](../../docs/screensaver/README.md#options).

To remove it, choose another screen saver and delete `~/Library/Screen Savers/Odle Dolomites Italy.saver`.

## Licence

The code is under the [Apache License 2.0](../../LICENSE). The landscape is derived from the photograph [“Gruppo delle Odle dalla malga Geisleralm” by Luca Lorenzi](https://commons.wikimedia.org/wiki/File:Gruppo_delle_Odle_dalla_malga_Geisleralm.jpg) (Wikimedia Commons) and is released under CC BY-SA 3.0: see [NOTICE](../../NOTICE). How the screen saver works and how to build it is in [docs/screensaver/README.md](../../docs/screensaver/README.md).

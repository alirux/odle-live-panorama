# Odle Dolomites Italy screen saver

A macOS screen saver with the photographic Odle scene in Val di Funes: the sky follows the real time, with the Sun, the Moon, the stars, the seasons, the mountain hut and its inhabitants. The options can also run a whole day in a few minutes.

## Install

The ready screen saver is attached to the [latest release](https://github.com/alirux/odle-live-panorama/releases/latest) on GitHub: nothing has to be built.

* [`Odle-Dolomites-Italy.saver.zip`](https://github.com/alirux/odle-live-panorama/releases/latest/download/Odle-Dolomites-Italy.saver.zip): the screen saver for macOS 12 Monterey or later, Apple silicon and Intel.

**Download** it, then double-click the ZIP in Finder to extract `Odle Dolomites Italy.saver`.

> **macOS 27**: the **Open Anyway** button in Privacy & Security does not unblock this screen saver. After installing it (steps 1 and 2 below), go straight to [3. Remove the download restriction](#3-remove-the-download-restriction): that is the step that makes it work.

### 1. Install it

1. Double-click `Odle Dolomites Italy.saver` in Finder.
2. If macOS asks who to install it for, choose **Only this user** and confirm.
3. Open the screen saver settings. Where they are depends on the macOS version:
   * **macOS 26 Tahoe and macOS 27**: **System Settings → Wallpaper**, then click **Screen Saver** on the right (scroll down if you don't see it).
   * **macOS 13 Ventura to 15 Sequoia**: **System Settings → Screen Saver**.
   * **macOS 12 Monterey**: **System Preferences → Desktop & Screen Saver**, tab **Screen Saver**.
4. Select **Odle Dolomites Italy**, under **Other** (on Monterey, in the list on the left).
5. Try the preview: on macOS 13 and later, move the pointer over the thumbnail at the top of the window and click **Preview**. It may take a few seconds to load. Move the mouse to leave the preview; macOS may ask for your login password.

Labels and locations can vary slightly between macOS updates. Apple describes the screen saver settings in [Change Screen Saver settings on Mac](https://support.apple.com/guide/mac-help/mchlp1227/mac).

### 2. If macOS blocks it

On macOS 27 skip this section and use [section 3](#3-remove-the-download-restriction).

This screen saver has a local signature, but has not been notarized by Apple. You can authorize your own copy without a paid developer account. Only do this for a copy you built yourself or obtained from a source you trust.

For a warning that the developer cannot be verified or that Apple cannot check the software:

1. Dismiss the warning without moving the file to the Trash.
2. Open **System Settings → Privacy & Security**.
3. Scroll to **Security** and look for the message about the blocked screen saver.
4. Click **Open Anyway**, authenticate if asked, and confirm **Open**.
5. Return to the screen saver settings (on macOS 26 and 27 under **Wallpaper → Screen Saver**), select **Odle Dolomites Italy**, and try the preview again. If installation had not finished, double-click the `.saver` file again first.

On Monterey, look under **System Preferences → Security & Privacy → General**. If the message is missing, try opening the file again and then return to the security settings. Apple describes this procedure in [Open apps safely on your Mac](https://support.apple.com/en-us/102445).

### 3. Remove the download restriction

This is the way to go on macOS 27, and on earlier versions when there is no **Open Anyway** button or it does not help. For a trusted copy blocked because it was downloaded, you can remove the download restriction from just this screen saver:

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
8. Reopen the screen saver settings (**System Settings → Wallpaper → Screen Saver** on macOS 26 and 27, **System Settings → Screen Saver** on 13 to 15), select **Odle Dolomites Italy**, and try the preview. If the previous block persists, restart the Mac and try again.

The command applies only to this installed copy and does not disable Gatekeeper for the rest of your Mac. It does not notarize the code or repair a damaged file. You may need to repeat it after installing a newly downloaded version.

If macOS reports malware or says the software will damage your computer, do not use these steps to bypass that warning. If it reports a damaged file, obtain a fresh copy or rebuild it from source first. On a managed Mac, your administrator may need to authorize installation.

## Options and removal

In the screen saver settings, the **Options** button at the top of the window sets the time (real, accelerated or fixed), the season, the place, the frame rate and more: see [Options](../../docs/screensaver/README.md#options).

On macOS 26 Tahoe the **Options** button of third-party screen savers sometimes does nothing: close System Settings, open it again and retry.

To remove it, choose another screen saver and delete `~/Library/Screen Savers/Odle Dolomites Italy.saver`.

## Licence

The code is under the [Apache License 2.0](../../LICENSE). The landscape is derived from the photograph [“Gruppo delle Odle dalla malga Geisleralm” by Luca Lorenzi](https://commons.wikimedia.org/wiki/File:Gruppo_delle_Odle_dalla_malga_Geisleralm.jpg) (Wikimedia Commons) and is released under CC BY-SA 3.0: see [NOTICE](../../NOTICE). How the screen saver works and how to build it is in [docs/screensaver/README.md](../../docs/screensaver/README.md).

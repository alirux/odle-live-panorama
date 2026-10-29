# Odle Dolomites Italy wallpapers

Two dynamic macOS wallpapers with the photographic Odle scene in Val di Funes, one for summer and one for winter. Each file holds about twenty pictures of the same day, and macOS shows the one that matches the Sun where your Mac is: night, dawn, the day, sunset and evening follow the real sky. The wallpaper is also what macOS shows on the login window and on the lock screen.

## Install

The ready wallpapers are attached to the [latest release](https://github.com/alirux/odle-live-panorama/releases/latest) on GitHub; nothing has to be built or installed besides the file itself:

* [`Odle-Dolomites-Italy-Summer.heic`](https://github.com/alirux/odle-live-panorama/releases/latest/download/Odle-Dolomites-Italy-Summer.heic): green meadows, 20 pictures, about 11 MB.
* [`Odle-Dolomites-Italy-Winter.heic`](https://github.com/alirux/odle-live-panorama/releases/latest/download/Odle-Dolomites-Italy-Winter.heic): snow, 19 pictures, about 15 MB.

They need macOS 10.14 Mojave or later.

1. **Download** the file you want. Keep the `.heic` extension and do not open it with another app first: an app that saves it again keeps only one picture.
2. **Move it** to a folder that will stay, for example **Pictures** in your home folder. macOS reads the file from there every time the light changes, so do not leave it in Downloads if you clean that folder.
3. **Set it** from the wallpaper settings, not from Finder or Preview: other ways of setting a picture may not keep it dynamic.
   * **macOS 26 Tahoe and macOS 27**: open **System Settings → Wallpaper**, scroll down to **Your Photos**, click **Add Photo**, then **Choose File**, pick the file and click **Open**. You can also drag the file onto the thumbnail at the top of the Wallpaper settings.
   * **macOS 13 Ventura to 15 Sequoia**: open **System Settings → Wallpaper**, click **Add Photo** and pick the file.
   * **macOS 12 Monterey or older**: open **System Preferences → Desktop & Screen Saver**, then the **+** button under the list.
4. **Choose how it changes**, in the pop-up menu next to the wallpaper thumbnail:
   * **Dynamic**: the picture follows the Sun during the day. This is the point of these files.
   * **Light (Still)** or **Dark (Still)**: always noon or always night (**Light** and **Dark** on older versions).
   * **Automatic**: noon or night with the Light and Dark appearance of macOS.
5. If you use the Odle screen saver as well, leave **Show as screen saver** off where it appears: it only applies to Apple's Aerial wallpapers, and on would replace the Odle screen saver.
6. If you have more than one display or desktop space, turn on **Show on all Spaces** to use the same wallpaper everywhere.

macOS works out where the Sun is from your location, so Dynamic is most accurate with Location Services on for System Settings; otherwise it guesses from the time zone. macOS checks the Sun from time to time, not continuously: right after setting the file it may take a moment to show the picture for the current hour. Apple describes these settings in [Wallpaper settings on Mac](https://support.apple.com/guide/mac-help/mchlp1103/mac).

The login window and the lock screen show the same wallpaper. After a restart with FileVault, the login window may still show the old one the first time.

To remove it, choose another wallpaper and delete the file.

## Licence

The pictures are derived from the photograph [“Gruppo delle Odle dalla malga Geisleralm” by Luca Lorenzi](https://commons.wikimedia.org/wiki/File:Gruppo_delle_Odle_dalla_malga_Geisleralm.jpg) (Wikimedia Commons) and are released under CC BY-SA 3.0, like the rest of the landscape: see [NOTICE](../../NOTICE). How they are made and how to build them is in [docs/wallpaper/README.md](../../docs/wallpaper/README.md).

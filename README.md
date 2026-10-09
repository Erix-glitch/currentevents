# Current Events presentation

Double-click `index.html` to open the slides in Chrome. Right now it holds the rent story; `gazelles.html` and `tumbler-ridge.html` are the two earlier decks (their words are in `content-gazelles.js` and `content-tumbler-ridge.js`). Press **→** to go forward and **←** to go back.

Most slides build up one piece per press, and → only moves to the next slide once the current one is finished. Moving between slides is a morph: anything the two slides share flies to its new place. That includes words that appear in both titles, the "Current Events" header, the newspaper's name and date, the article page (which turns into the video frame) and the globe (which shrinks into a small logo by the header and grows back out). One photo frame also travels through the deck: it becomes an inset on the "who" slide, grows into a full background, then shrinks into the portrait beside "why".

## Make it yours

All your words go in `content.js`. Open it in VS Code (or any plain-text editor), change the text between the quotes, save, then refresh the browser. Refreshing keeps you on the same slide.

- **Verity:** the smiley from `MultiColor-AMS-Version.3mf` floats beside each slide and hops to a new spot when the slide changes. `verity: false` hides her.
- **Intro slide (optional):** `intro` adds a slide before the story, like "Something cheerful for a change", with up to three floating photos. Leave its title and text `''` to skip it.
- **Look:** `theme` picks the style. `'night'` (used for the Tumbler Ridge deck) is dark slate and bone white, with black-and-white photos and a candlelight highlighter. It adds a 3D scene: snow falls behind the dark slides and the camera flies through it between slides, and the first and last slides show a mountain valley drawn in dots with a small town's lights. `'cobalt'` is the original bright blue look with the turning globe.
- **Highlights:** put `*stars*` around a phrase and the highlighter sweeps across it when the slide appears.
- **The article:** save a screenshot of it in the `assets` folder as `article.jpg`, or change `screenshot` to match your file's name. A tall screenshot scrolls slowly so the whole article gets shown.
- **News clip (optional):** save the video as `assets/clip.mp4`, or paste a YouTube link into `clip`. A YouTube clip only plays inside the slide when the deck runs from a website; opened as a file, pressing Space opens it on YouTube. Use `clip: ''` to remove the slide.
- **Photo credits:** each deck's photos are listed in `CREDITS.txt` in its `assets` folder (`assets/rent`, `assets/gazelles`), and `photoCredit` prints them small on the last slide.
- **Photos:** the photos in `assets/article` come from the CBC story, and `photoCredit` lists their photographers on the last slide. They're fine to show in class with that credit, but don't post the slides publicly. The landscapes in `assets/placeholders` are free Unsplash stand-ins (credited in `CREDITS.txt`). To change a photo, save it in `assets` and change the matching file name in `content.js`: `coverImage`, `who.image` and each group's `image`, `issue.image`, the timeline events' `image`, each question's `image`, `whyImage` and `endImage`. Use `''` to leave one out. Photos behind text are toned down automatically, so any photo works there.
- **The map:** the globe turns to `lat` and `lon` and highlights the country there. In Google Maps, right-click the place and click the numbers at the top of the menu to copy them. The first number is `lat`, the second is `lon`.
- **More options in `content.js`:** `class` adds a Class field on the cover; `photoTint: false` shows background photos in their real colours, softly blurred; `sections: false` hides the worksheet section in the top bar; `qr: false` hides the QR codes; `veritySays` sets Verity's speech bubbles; `issue.title`, `where.title` and `when.title` reword those slide titles; `whySign`, `article.byline`, `article.titleLabel` and `when.todayDate` replace the automatic wording. `\n` in any text starts a new line. `fonts` picks the fonts for titles, text, small labels and the citation (this deck: Arial Rounded MT Bold and Avenir Next, as in the PowerPoint). Those two come with Macs; on a computer without them the titles use Nunito and the text uses Libre Franklin, both included.
- **Long text** shrinks to fit its slide, but shorter answers read better from the back of the room.

If the slides don't load after an edit, there's a typo in `content.js`. The page lists the usual causes. The most common is an apostrophe inside single quotes: write `"it's"`, not `'it's'`.

## Presenting

| Key | Does |
| --- | --- |
| → or Space | Next animation, or the next slide when this one is done |
| ← | Step back |
| Home / End | First / last slide |
| F | Full screen |
| B | Black screen (any key brings the slides back) |
| Space or P | Play or pause, on the news clip slide |
| ? | Show the list of keys |

Clickers that send Page Down / Page Up work too.

**Hosting it on your network:** run `python3 serve.py` in this folder and open the address it prints on any device on the same Wi-Fi. (Python's plain `python3 -m http.server` drops connections when a page loads many files at once, which makes photos go missing at random; `serve.py` doesn't.)

**Hosting it vs. double-clicking:** served from a website or a local server, the discussion cards are drawn with three.js, so they bend as they flip, catch the light, and a ring of dots runs out from each one as it lands. Opened by double-clicking `index.html`, browsers won't let three.js read your photos, so the same cards are drawn with the browser's built-in 3D instead. The night theme's snow and mountains work either way, since they don't use photos.

## The slides, and what each press does

Every item on the worksheet has a slide, in the worksheet's order.

1. **Cover:** your title, plus your Name and Date (blank `date` shows today's date). In the night theme the camera tilts down out of the dark onto the snowy valley as the title rises.
2. **Information about the article:** title, author(s), date published and newspaper next to the article, which swings in like a page on a hinge. The second press brings the article forward, large enough to read.
3. **News clip** (optional): the article page turns into the video frame.
4. **Who does this article affect?** One group appears per press, and the photo panel turns over in 3D to show that group's photo.
5. **What is the most important issue in the article?** Your sentence first, then the background, then the quote.
6. **Where does this issue take place?** The globe starts zoomed in on the city. Each press zooms out a level and highlights it: province or state, then country, then continent.
7. **When did this issue begin? When might it be resolved?** The timeline grows one event per press (each photo stands up out of the line like a pop-up card), adds today's date by itself, and ends with when it might be resolved.
8. **Discussion questions:** each question has its own card with its own photo. The cards are dealt face down. Each press lifts the next one out, turns it over in the middle of the slide, and its photo spreads into the background. The question you've finished goes back to the fan, face up.
9. **Why did you choose this article?**
10. **Thanks for listening:** your source as an MLA citation, built from the article details.

To have every slide appear complete instead, set `clickBuilds: false` in `content.js`.

## Files

- `index.html`: open this to present
- `content.js`: your words
- `assets/`: your screenshot and clip
- `engine/`: the slide code. Bundled fonts are Libre Franklin, Newsreader, Nunito and Caladea (SIL Open Font License); Arial Rounded MT Bold, Avenir Next, Arial and Cambria are used when the computer has them. Animation uses GSAP, the discussion cards and Verity use three.js (MIT), Verity's eyes and smile come from the `MultiColor-AMS-Version.3mf` model, the globe uses d3-geo and Natural Earth map data (public domain), and the QR codes use qrcode-generator (MIT).

Keep the whole folder together when you copy it to a USB stick or another computer. Everything works offline.

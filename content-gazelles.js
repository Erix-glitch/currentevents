/*
  CURRENT EVENTS PRESENTATION (sand gazelles): open gazelles.html to show these slides.

  Rules for editing:
  - Keep every piece of text inside quotes: 'like this'.
  - If your text needs an apostrophe, use double quotes instead: "it's fine like this".
  - Put *stars around a phrase* to highlight it. The highlighter sweeps across it when the slide appears.
  - Save the file, then refresh the browser to see your changes.
  - Photos: the ones in assets/gazelles are credited in assets/gazelles/CREDITS.txt and on the last slide.
    Change the file names below to use other photos, or '' to leave a photo out.
*/

window.CONTENT = {

  name: 'Your Name',
  date: '',                 // the day you present, e.g. 'October 8, 2026'. Leave it '' to show today's date.

  // The look of the slides:
  // 'cobalt': bright blue and white with a yellow highlighter and a turning globe.
  // 'night':  dark slate and bone white, black-and-white photos, falling snow. Suits serious stories.
  theme: 'cobalt',
  verity: true,             // Verity floats along with you through the slides. false hides her.

  // true: pressing → reveals each slide one piece at a time (one group, one timeline event, one question...).
  // false: every slide appears complete and → always goes to the next slide.
  clickBuilds: true,

  // A slide before the story. Leave title and text '' to skip it.
  intro: {
    kicker: 'Before we start',
    title: 'Something *cheerful* for a change',
    text: "Every current event we've heard so far has been about something going wrong. So here's one about something going right.",
    images: ['assets/gazelles/gazelle-fawns.jpg', 'assets/gazelles/gazelle-herd.jpg', 'assets/gazelles/arabian-hare.jpg'],   // up to 3, floating beside the text
  },

  // Big title on the first slide of the story. Leave it '' to use the article's headline instead.
  coverTitle: 'Solar panels are giving *sand gazelles* a safe place to grow',
  coverImage: 'assets/gazelles/sand-gazelle.jpg',


  /* ---------- INFORMATION ABOUT THE ARTICLE ---------- */
  article: {
    title: 'Saudi Solar Park Proves Brilliant Breeding Ground for Threatened Sand Gazelles',
    authors: ['Andy Corbley'],   // one name per quote: ['Jane Doe'] or ['Jane Doe', 'Sam Lee']
    published: 'October 7, 2026',
    newspaper: 'Good News Network',
    url: 'https://www.goodnewsnetwork.org/saudi-solar-park-proves-brilliant-breeding-ground-for-threatened-sand-gazelles/',   // makes the "scan to read" code. Use '' to hide it.

    // A screenshot of the article. Save it in the "assets" folder with this name.
    screenshot: 'assets/gazelles/article.jpg',

    // Optional news clip. Save a video in "assets" (e.g. 'assets/clip.mp4') or paste a YouTube link.
    // Use '' if you don't have a clip and that slide disappears.
    clip: '',
    clipCaption: '',
  },


  /* ---------- MAJOR POINTS OF THE ARTICLE ---------- */

  // Who does this article affect? Start with the group it affects most. 2 to 4 groups fit best.
  who: {
    summary: 'A threatened desert animal, and the people working to bring it back.',
    image: 'assets/gazelles/gazelle-in-shrubs.jpg',   // shown with the question; each group's photo replaces it
    groups: [
      { name: 'Arabian sand gazelles',            how: 'Only about *3,000* are left in the wild. Now 38 live inside the solar park, safe from predators.', image: 'assets/gazelles/sand-gazelle-walking.jpg' },
      { name: 'Conservationists in Saudi Arabia', how: 'The nature reserve hopes the herd grows to *over 500*, then releases them into the wild.',          image: 'assets/gazelles/gazelle-portrait.jpg' },
      { name: 'Everyone who needs clean energy',  how: 'The 250-megawatt plant powers a resort, and shows solar farms can *share their land with wildlife*.', image: 'assets/gazelles/desert-solar-farm.jpg' },
    ],
  },

  // What is the most important issue in the article?
  issue: {
    statement: 'One solar park is making *clean energy and a safe home* for a threatened animal at the same time.',
    detail: 'Fenced in from predators, 38 Arabian sand gazelles graze and breed among the panels, which give shade 8 to 18 degrees cooler than the open desert. Mountain gazelles and Arabian hares were released there too.',
    quote: 'Our rewilding goal is to build self-sustaining wildlife populations that can survive in the wild without ongoing human intervention.',   // use '' for no quote
    quoteBy: 'Andrew Zaloumis, director of the nature reserve',
    image: 'assets/gazelles/solar-park-gazelles.jpg',
  },

  // Where does this issue take place?
  // For the map: in Google Maps, right-click the place and click the numbers at the top of the menu to copy them.
  where: {
    city: 'Amaala, on the Red Sea',
    region: 'Tabuk',
    regionLabel: 'Province',
    country: 'Saudi Arabia',
    continent: 'Asia',
    lat: 26.64,        // first number from Google Maps
    lon: 36.23,        // second number from Google Maps
  },

  // When did this issue begin? When might it be resolved?
  // The timeline adds "Today" automatically. Add 0 to 3 events in the middle.
  when: {
    began:    { date: 'Oct. 2025',        text: 'Sand gazelles, mountain gazelles and Arabian hares are released into the solar park', image: 'assets/gazelles/mountain-gazelles.jpg' },
    events: [
                { date: 'May 2026',         text: 'Males join the herd, once the animals have settled in',                              image: 'assets/gazelles/sand-gazelle-dune.jpg' },
                { date: 'Oct. 2026',        text: '38 sand gazelles live there. The idea is called "ReWildingVoltaics"',                image: 'assets/gazelles/solar-park-gazelles.jpg' },
    ],
    resolved: { date: 'At 500+ gazelles', text: 'The herd is big enough to release into the wild reserve',                             image: 'assets/gazelles/gazelle-in-the-wild.jpg' },
  },


  /* ---------- DISCUSSION QUESTIONS ---------- */
  // Each question gets its own card with its own photo; each → deals the next card. Ask things with no single right answer.
  questions: [
    { text: 'Should more solar farms be built to *share their land with wildlife*?', image: 'assets/gazelles/desert-solar-farm.jpg' },
    { text: 'Is it better to keep rare animals in *zoos*, or to rebuild wild herds like this one?', image: 'assets/gazelles/gazelle-herd.jpg' },
    { text: 'What could our community do to *help wildlife* where we live?', image: 'assets/placeholders/who-1.jpg' },
  ],


  /* ---------- WHY DID YOU CHOOSE THIS ARTICLE? ---------- */
  why: "Every current event we've heard has been about something going wrong, so I wanted to share something going right. I liked that one idea solves two problems at once: clean energy, and a safe place for a *threatened animal to make a comeback*.",
  whyImage: 'assets/gazelles/gazelle-portrait.jpg',  // tall photo beside your answer

  endImage: 'assets/gazelles/sand-gazelle-dune.jpg',

  // Shown small on the last slide, under your source
  photoCredit: 'Photos: Prince bin Salman Nature Reserve (via Good News Network); Charles J. Sharp, Saudi Press Agency, otomops and Shah Jahan (Wikimedia Commons, CC BY / CC BY-SA); U.S. Bureau of Land Management; Unsplash.',

};

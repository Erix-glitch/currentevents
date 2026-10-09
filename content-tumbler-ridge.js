/*
  CURRENT EVENTS PRESENTATION (Tumbler Ridge): open tumbler-ridge.html to show these slides.

  Rules for editing:
  - Keep every piece of text inside quotes: 'like this'.
  - If your text needs an apostrophe, use double quotes instead: "it's fine like this".
  - Put *stars around a phrase* to highlight it. The highlighter sweeps across it when the slide appears.
  - Save the file, then refresh the browser to see your changes.
  - Photos: the ones in assets/article come from the CBC story (credited on the last slide). Change the file
    names below to use other photos, or '' to leave a photo out.
*/

window.CONTENT = {

  name: 'Your Name',
  date: '',                 // the day you present, e.g. 'October 5, 2026'. Leave it '' to show today's date.

  // The look of the slides:
  // 'night': dark slate and bone white, black-and-white photos, a candlelight highlighter, falling snow,
  //          and a mountain valley with a small town's lights on the first and last slides. Suits serious stories.
  // 'cobalt': bright blue and white with a yellow highlighter and a turning globe. Suits most other stories.
  theme: 'night',

  // true: pressing → reveals each slide one piece at a time (one group, one timeline event, one question...).
  // false: every slide appears complete and → always goes to the next slide.
  clickBuilds: true,

  // Big title on the first slide. Leave it '' to use the article's headline instead.
  coverTitle: 'A U.S. resident is charged over *Tumbler Ridge*',
  coverImage: '',            // a photo behind the first slide. In the 'night' theme, '' shows the snowy mountain valley instead


  /* ---------- INFORMATION ABOUT THE ARTICLE ---------- */
  article: {
    title: 'U.S. resident charged with offering advice, money to Tumbler Ridge killer in months before mass shooting',
    authors: ['Sarah Petz', 'Courtney Dickson', 'Tom Summer', 'Caroline Barghout'],   // one name per quote
    published: 'October 6, 2026',
    newspaper: 'CBC News',
    url: 'https://www.cbc.ca/news/canada/british-columbia/livestory/tumbler-ridge-mass-shooting-arrest-9.7371316',   // makes the "scan to read" code. Use '' to hide it.

    // A screenshot of the article. Save it in the "assets" folder with this name.
    screenshot: 'assets/article/cbc-article.jpg',

    // Optional news clip. Save a video in "assets" (e.g. 'assets/clip.mp4') or paste a YouTube link.
    // Use '' if you don't have a clip and that slide disappears.
    clip: '',
    clipCaption: '',
  },


  /* ---------- MAJOR POINTS OF THE ARTICLE ---------- */

  // Who does this article affect? Start with the group it affects most. 2 to 4 groups fit best.
  who: {
    summary: 'A small northern B.C. town that is still grieving, and people on both sides of the border trying to understand how it happened.',
    image: 'assets/article/memorial-wall.jpg',      // shown with the question; each group's photo replaces it
    groups: [
      { name: 'Families in Tumbler Ridge', how: 'Eight people were killed, six of them children. The local MP says the news *brings up all those bad memories again*.', image: 'assets/article/memorial-wall.jpg' },
      { name: 'Students and schools',      how: 'Tumbler Ridge Secondary is being torn down, and schools everywhere are asking how to *keep students safe*.', image: 'assets/article/school-teardown.jpg' },
      { name: 'Police and governments',    how: 'The RCMP and FBI worked together across the border. B.C.\'s attorney general wants *proper regulation* of online platforms.', image: 'assets/article/news-conference.jpg' },
    ],
  },

  // What is the most important issue in the article?
  issue: {
    statement: 'A U.S. resident is accused of *helping plan a Canadian school shooting* online, instead of warning anyone.',
    detail: 'James Cody Bryant, 30, of Washington state is charged with conspiracy to murder persons in a foreign country, which carries up to life in prison. The indictment says Bryant offered the shooter advice and money for at least six months, and offered to livestream the attack.',
    quote: 'Instead, he encouraged and offered assistance to a murderer.',   // use '' for no quote
    quoteBy: 'Neil Floyd, acting U.S. attorney for western Washington',
    image: 'assets/article/us-attorney.jpg',        // fills this slide, toned down so the text reads on top
  },

  // Where does this issue take place?
  // For the map: in Google Maps, right-click the place and click the numbers at the top of the menu to copy them.
  where: {
    city: 'Tumbler Ridge',
    region: 'British Columbia',
    regionLabel: 'Province',
    country: 'Canada',
    continent: 'North America',
    lat: 55.1263,      // first number from Google Maps
    lon: -120.9942,    // second number from Google Maps
  },

  // When did this issue begin? When might it be resolved?
  // The timeline adds "Today" automatically. Add 0 to 3 events in the middle.
  when: {
    began:    { date: 'Aug. 2025',      text: 'The shooter is planning the attack and talking with Bryant almost daily, the indictment says', image: 'assets/placeholders/when-1.jpg' },
    events: [
                { date: 'Feb. 10, 2026',  text: 'Eight people are killed in Tumbler Ridge',                    image: 'assets/article/rcmp-at-school.jpg' },
                { date: 'Oct. 6, 2026',   text: 'Tipped off by Discord, police charge Bryant in Seattle',      image: 'assets/article/rcmp-news-conference.jpg' },
    ],
    resolved: { date: 'Oct. 20, 2026',   text: 'A preliminary hearing. A trial, if there is one, would come later', image: 'assets/article/court-sketch.jpg' },
  },


  /* ---------- DISCUSSION QUESTIONS ---------- */
  // Each question gets its own card with its own photo; each → deals the next card. Ask things with no single right answer.
  questions: [
    { text: 'Bryant never fired a shot. Should *helping plan* an attack be punished as harshly as carrying it out?', image: 'assets/article/court-sketch.jpg' },
    { text: 'Discord warned police about the messages. Should websites and AI companies *have to report* users who talk about violence?', image: 'assets/article/bc-attorney-general.jpg' },
    { text: 'What would make you *feel safer at school*, and who should be responsible for it?', image: 'assets/article/school-grounds.jpg' },
  ],


  /* ---------- WHY DID YOU CHOOSE THIS ARTICLE? ---------- */
  why: "It happened at a high school in our own province, to students our age. Seven months later, I was surprised to learn that someone in another country is accused of helping plan it online, and that a tip from a website is what led police to Bryant. It made me think about *how much of our lives happen online*, and who should act when someone sees a warning sign.",
  whyImage: 'assets/article/memorial-wall-tall.jpg',  // tall photo beside your answer

  endImage: '',             // a photo behind the last slide. In the 'night' theme, '' shows the mountain valley instead

  // Shown small on the last slide, under your source
  photoCredit: 'Photos: CBC News; court sketch by Lois Silver/CBC; Ben Nelms/CBC; Tom Summer/CBC; David Ryder/Reuters.',

};

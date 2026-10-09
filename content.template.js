/*
  CURRENT EVENTS PRESENTATION: edit this file to make the slides yours.

  Rules for editing:
  - Keep every piece of text inside quotes: 'like this'.
  - If your text needs an apostrophe, use double quotes instead: "it's fine like this".
  - Put *stars around a phrase* to highlight it. The highlighter sweeps across it when the slide appears.
  - Save the file, then refresh the browser to see your changes.
  - Photos: the ones in assets/placeholders are stand-ins (landscapes). Save photos about your story in the
    "assets" folder and change the file names below. Use '' to leave a photo out.
*/

window.CONTENT = {

  name: 'Your Name',
  date: '',                 // the day you present, e.g. 'October 5, 2026'. Leave it '' to show today's date.

  // The look of the slides:
  // 'cobalt': bright blue and white with a yellow highlighter and a turning globe. Suits most stories.
  // 'night': dark slate and bone white, black-and-white photos, a candlelight highlighter, falling snow,
  //          and a mountain valley with a small town's lights on the first and last slides. Suits serious stories.
  theme: 'cobalt',

  verity: true,             // Verity floats along with you through the slides. false hides her.

  // true: pressing → reveals each slide one piece at a time (one group, one timeline event, one question...).
  // false: every slide appears complete and → always goes to the next slide.
  clickBuilds: true,

  // An optional slide before the story. Leave title and text '' to skip it.
  intro: {
    kicker: '',
    title: '',
    text: '',
    images: [],             // up to 3 photos floating beside the text
  },

  // Big title on the first slide. Leave it '' to use the article's headline instead.
  coverTitle: 'The headline of your story *goes right here*',
  coverImage: 'assets/placeholders/cover.jpg',     // fills the first slide, tinted. In the 'night' theme, '' shows the snowy mountain valley instead


  /* ---------- INFORMATION ABOUT THE ARTICLE ---------- */
  article: {
    title: 'Headline of the article, copied exactly the way the newspaper printed it',
    authors: ['First Reporter', 'Second Reporter'],   // one name per quote: ['Jane Doe'] or ['Jane Doe', 'Sam Lee']
    published: 'September 30, 2026',
    newspaper: 'Name of the Newspaper',
    url: 'https://www.example.com/news/your-article',   // makes the "scan to read" code. Use '' to hide it.

    // A screenshot of the article. Save it in the "assets" folder with this name.
    screenshot: 'assets/article.png',

    // Optional news clip. Save a video in "assets" (e.g. 'assets/clip.mp4') or paste a YouTube link.
    // Use '' if you don't have a clip and that slide disappears.
    clip: 'assets/clip.mp4',
    clipCaption: 'What the clip shows, and where it is from (e.g. the news channel and the date)',
  },


  /* ---------- MAJOR POINTS OF THE ARTICLE ---------- */

  // Who does this article affect? Start with the group it affects most. 2 to 4 groups fit best.
  who: {
    summary: 'One sentence on who feels this story the most.',
    image: 'assets/placeholders/who.jpg',           // shown with the question; each group's photo replaces it
    groups: [
      { name: 'The group hit hardest',  how: 'Explain how the story *changes their everyday lives*.',          image: 'assets/placeholders/who-1.jpg' },
      { name: 'A second group',         how: 'Who else feels it, and in what way?',                              image: 'assets/placeholders/who-2.jpg' },
      { name: 'Everyone else',          how: 'How the story reaches the wider community, province or country.', image: 'assets/placeholders/who-3.jpg' },
    ],
  },

  // What is the most important issue in the article?
  issue: {
    statement: 'Sum up *the most important issue* in one clear sentence the class will remember.',
    detail: 'Add a sentence or two of background: what happened, who is involved, and why it matters right now.',
    quote: 'Paste one short, powerful quote from the article here.',   // use '' for no quote
    quoteBy: 'Person quoted, their job or role',
    image: 'assets/placeholders/issue.jpg',          // fills this slide, tinted blue
  },

  // Where does this issue take place?
  // For the map: in Google Maps, right-click the place and click the numbers at the top of the menu to copy them.
  where: {
    city: 'Surrey',
    region: 'British Columbia',
    regionLabel: 'Province or state',   // change to 'Province' or 'State' if you like
    country: 'Canada',
    continent: 'North America',
    lat: 49.1913,      // first number from Google Maps
    lon: -122.8490,    // second number from Google Maps
  },

  // When did this issue begin? When might it be resolved?
  // The timeline adds "Today" automatically. Add 0 to 3 events in the middle.
  when: {
    began:    { date: 'January 2026',   text: 'What first happened',                     image: 'assets/placeholders/when-1.jpg' },
    events: [
                { date: 'June 2026',      text: 'A turning point along the way',           image: 'assets/placeholders/when-2.jpg' },
                { date: 'September 2026', text: 'What this article reports',               image: 'assets/placeholders/when-3.jpg' },
    ],
    resolved: { date: 'Maybe 2027',     text: 'What would need to happen for it to end', image: 'assets/placeholders/when-4.jpg' },
  },


  /* ---------- DISCUSSION QUESTIONS ---------- */
  // Each question gets its own card with its own photo; each → deals the next card. Ask things with no single right answer.
  questions: [
    { text: 'Do you agree with what happened in this story? Why or why not?',               image: 'assets/placeholders/question-1.jpg' },
    { text: 'How could this story affect people our age, here in our community?',           image: 'assets/placeholders/question-2.jpg' },
    { text: 'What should happen next, and who should be responsible for making it happen?', image: 'assets/placeholders/question-3.jpg' },
  ],


  /* ---------- WHY DID YOU CHOOSE THIS ARTICLE? ---------- */
  why: "Explain why you picked this story. Maybe it *affects people you know*, it surprised you, or you think everyone should be talking about it. Finish with one thing you learned from reading it.",
  whyImage: 'assets/placeholders/why.jpg',         // tall photo beside your answer

  endImage: 'assets/placeholders/end.jpg',         // behind the last slide, tinted. In the 'night' theme, '' shows the mountain valley instead

  // Shown small on the last slide, under your source. Use '' for none.
  photoCredit: '',

};

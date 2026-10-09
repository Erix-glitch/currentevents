/*
  CURRENT EVENTS PRESENTATION: edit this file to make the slides yours.

  Rules for editing:
  - Keep every piece of text inside quotes: 'like this'.
  - If your text needs an apostrophe, use double quotes instead: "it's fine like this".
  - Put *stars around a phrase* to highlight it. The highlighter sweeps across it when the slide appears.
  - \n starts a new line; \n\n leaves a blank line between paragraphs.
  - Save the file, then refresh the browser to see your changes.
  - Photos: the ones in assets/rent are credited in assets/rent/CREDITS.txt.
    Change the file names below to use other photos, or '' to leave a photo out.
*/

window.CONTENT = {

  name: 'Eric Li & Calvin Van Heerden',
  date: 'October 7, 2026',  // shown exactly as typed. Leave it '' to show today's date.
  class: 'CLC 11',          // '' to leave out

  // The look of the slides:
  // 'cobalt': bright blue and white with a yellow highlighter and a turning globe.
  // 'night':  dark slate and bone white, black-and-white photos, falling snow. Suits serious stories.
  theme: 'cobalt',
  photoTint: false,         // false: photos behind text keep their colours, softly blurred. true: tinted blue.
  sections: false,          // true shows the worksheet section next to "Current Events" at the top
  qr: false,                // true adds a "scan to read the article" code

  // Fonts: titles, text, small labels and question cards, and the citation. Arial Rounded MT Bold and Avenir Next come
  // with Macs; on a computer without them the slides use similar backup fonts.
  fonts: { titles: 'Arial Rounded MT Bold', text: 'Avenir Next', labels: 'Arial', citation: 'Cambria' },

  // Verity floats on the first two slides, glows by "Today" on the timeline, and two of her roll in at the end.
  // false hides her. Her speech bubbles:
  verity: true,
  veritySays: {
    cover: 'Nice!',
    end: 'Thank you so much!!\n- Eric and Calvin',
  },

  // true: pressing → reveals each slide one piece at a time (one group, one timeline event, one question...).
  // false: every slide appears complete and → always goes to the next slide.
  clickBuilds: true,

  // A slide before the story. Leave title and text '' to skip it.
  intro: {
    kicker: 'Before we start',
    title: 'Something cheerful for a change',
    text: "Every current event we've heard so far has been about something going wrong. So here's one about something going right.",
    images: ['assets/rent/false-creek.jpg', 'assets/rent/west-end-tall.jpg', 'assets/rent/seawall.jpg'],   // up to 3, floating beside the text
  },

  // Big title on the first slide of the story. Leave it '' to use the article's headline instead.
  coverTitle: 'Rents across Canada have been falling for two years',
  coverImage: 'assets/rent/apartments-for-rent.jpg',


  /* ---------- INFORMATION ABOUT THE ARTICLE ---------- */
  article: {
    title: 'Average asking rent down 2.9% in B.C. in September, marking 2 years of decreases: report',
    titleLabel: '',                                   // the small label above the title; '' for none
    authors: ['Daniel Johnson'],                      // used for the citation
    byline: 'Daniel Johnson, The Canadian Press',     // shown next to "Author"
    published: 'October 7, 2026',
    newspaper: 'CBC News',
    url: 'https://www.cbc.ca/news/canada/british-columbia/canada-average-rents-fall-2-years-9.7373338',

    // A screenshot of the article. Save it in the "assets" folder with this name.
    screenshot: 'assets/rent/article.jpg',

    // Optional news clip. Save a video in "assets" (e.g. 'assets/clip.mp4') or paste a YouTube link.
    // Use '' if you don't have a clip and that slide disappears.
    clip: '',
    clipCaption: '',
  },


  /* ---------- MAJOR POINTS OF THE ARTICLE ---------- */

  // Who does this article affect? Start with the group it affects most. 2 to 4 groups fit best.
  who: {
    summary: 'Almost everyone who rents or hopes to, and the people who own the apartments.',
    image: 'assets/rent/west-end-apartments.jpg',      // shown with the question; each group's photo replaces it
    groups: [
      { name: 'Renters', how: 'Prices have been sky high for decades and are finally falling now. This will benefit renters the most.', image: 'assets/rent/for-rent-vancouver.jpg' },
      { name: 'Young people living at home', how: 'Young people who are living with their parents looking to move out can take advantage of this opportunity, since wages are up and rent is low.', image: 'assets/rent/seawall.jpg' },
      { name: 'Landlords and condo owners', how: 'Condo rents fell 7.8% in a year. This will affect landlords  adversely and they will earn less money', image: 'assets/rent/toronto-condos.jpg' },
    ],
  },

  // What is the most important issue in the article?
  issue: {
    title: 'What is the most important  “issue” in the article?',
    statement: 'Rents in Canada have been falling for two full years, the longest drop in recent history.',
    detail: 'The average asking rent in September was $2,034, down 7.3% over two years and 9.2% below the peak of $2,202 in May 2024. In British Columbia rents fell 2.9% in the past year.\nThe article says a wave of new apartments is the reason.',
    quote: '',                // use '' for no quote
    quoteBy: '',
    image: 'assets/rent/false-creek.jpg',
  },

  // Where does this issue take place?
  // For the map: in Google Maps, right-click the place and click the numbers at the top of the menu to copy them.
  where: {
    title: 'Where does this “issue” take place?',
    city: 'Vancouver, and cities across Canada',
    region: 'British Columbia',
    regionLabel: 'Province',
    country: 'Canada',
    continent: 'North America',
    lat: 49.2827,      // first number from Google Maps
    lon: -123.1207,    // second number from Google Maps
  },

  // When did this issue begin? When might it be resolved?
  // The timeline adds "Today" automatically. Add 0 to 3 events in the middle.
  when: {
    title: 'When did this “issue” begin?\nWhen might it be resolved?',
    began: { date: 'May 2024', text: 'The average asking rent peaks at $2,202 a month', image: 'assets/rent/cranes-cambie-bridge.jpg' },
    events: [
      { date: 'Oct. 2024', text: 'Rents start falling compared with a year before', image: 'assets/rent/for-rent-toronto.jpg' },
      { date: 'Sept. 2026', text: 'Average rent is $2,034 two full years of drops', image: 'assets/rent/apartments-for-rent.jpg' },
    ],
    todayDate: 'Oct. 2026',
    resolved: { date: 'Coming months', text: 'The report expects rents to start rising again, led by Toronto and Vancouver. So start renting now!', image: 'assets/rent/west-end-apartments.jpg' },
  },


  /* ---------- DISCUSSION QUESTIONS ---------- */
  // Each question gets its own card with its own photo; each → deals the next card. Ask things with no single right answer.
  questions: [
    { text: 'Falling rent is great for renters. What about the landlords?', image: 'assets/rent/rent-banner.jpg' },
    { text: 'New apartments helped bring rents down. Should our city build more homes?', image: 'assets/rent/cranes-cambie-bridge.jpg' },
    { text: 'Where do you hope to live after high school and what do you expect it would it cost?', image: 'assets/rent/seawall.jpg' },
  ],


  /* ---------- WHY DID YOU CHOOSE THIS ARTICLE? ---------- */
  why: 'Before now, every current event we heard was all doom and gloom. We thought that was a little bit depressing since a lot of good things have also happened.\n\nHousing is also relevant for students like us in CLC as it is a factor we must consider in the near future when we get a job and become independent adults',
  whySign: '- Eric and Calvin',
  whyImage: 'assets/rent/west-end-tall.jpg',   // tall photo beside your answer

  endImage: 'assets/rent/false-creek.jpg',

  // Shown small on the last slide, under your source. '' for none.
  photoCredit: '',

};

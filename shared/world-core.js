// Pure helpers shared by the API (server-side cache) and the app (direct fallback):
// topic search terms, safety filter and mapping of Wikimedia Commons video results.
export const TOPICS = {
  nature: ['waterfall', 'forest', 'mountain', 'sunset', 'sunrise', 'river', 'flowers', 'clouds', 'snow', 'autumn', 'lake', 'volcano', 'rainbow', 'storm', 'desert'],
  animals: ['cat', 'kitten', 'dog', 'puppy', 'bird', 'horse', 'elephant', 'monkey', 'squirrel', 'butterfly', 'lion', 'parrot', 'bee', 'owl', 'penguin', 'giraffe', 'fox', 'duck'],
  space: ['vertical video', 'rocket launch', 'space station', 'aurora', 'Earth from space', 'Mars', 'eclipse', 'galaxy', 'Moon', 'astronaut', 'Hubble'],
  ocean: ['ocean', 'waves', 'coral', 'underwater', 'beach', 'dolphin', 'whale', 'turtle', 'jellyfish', 'shark', 'seal'],
  city: ['timelapse', 'skyline', 'night city', 'train', 'tram', 'street', 'drone', 'bridge', 'fireworks', 'metro'],
  sports: ['football', 'skateboard', 'surfing', 'basketball', 'cycling', 'parkour', 'skiing', 'gymnastics', 'climbing', 'snowboard', 'tennis', 'karate'],
  dance: ['dance', 'dancing', 'dancers', 'ballet', 'folk dance', 'traditional dance'],
  music: ['musician', 'guitar', 'drum', 'violin', 'piano', 'singing', 'flute', 'concert', 'choir', 'busker'],
  food: ['cooking', 'street food', 'bread', 'coffee', 'tea', 'fruit market', 'pizza', 'cake', 'grill', 'couscous', 'chocolate'],
  travel: ['festival', 'market', 'desert', 'village', 'old town', 'harbour', 'Sahara', 'carnival', 'castle', 'temple', 'boat'],
};
export const TOPIC_IDS = Object.keys(TOPICS);

export const BLOCK = /\b(nud(e|ity|ist)|naked|topless|sex|porn|erotic|breast|penis|vagin\w*|genital\w*|masturbat\w*|autopsy|surg(ery|ical)|corpse|dead(?! sea)|death|killed|execution|slaughter|gore|blood|wound\w*|injur\w*|behead\w*|war|military|army|soldiers?|weapons?|guns?|rifle|shoot\w*|bomb\w*|explos\w*|missiles?|attack\w*|protest\w*|riot|police|arrest|prison|politic\w*|election|candidate|senate|parliament|campaign\w*|president|minister|drugs?|weed|thc|cannabis|marijuana|cocaine|heroin|smok\w*|cigar\w*|vape|alcohol|drunk|lecture|webinar|screencast|tutorial|interview\w*|presentations?|slides|conference|podcast|speech|test ?pattern|test video|sample|countdown|blank|hotel|suite|advert\w*|commercial|promo|trailer|youtube|vlog|unboxing|cira|navy|usn|army|air force|airmen|airman|marines?|corps|sgt|sergeant|seaman|sailors?|potus|white house|times of india|covid\w*|lockdown|pandemic|coronavirus|čsla|nato|himawari|goes-\d+|imagery|typhoon|hurricane|cyclone|tropical storm|analysis|comparative|method|study|experiment\w*|specimens?|journal|supplementa\w*|figure|movie s\d+|video s\d+|herdenking|memorial|funeral|fire|burning|accident|crash|flood|disaster|news|broadcast|documentary|episodes?|full movie|film \(\d{4}\))\b/i;

export const strip = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
export const cleanTitle = (t) => String(t || '').replace(/^File:/, '').replace(/\.(webm|ogv|ogg|mp4|mpg|mpeg|mov)$/i, '').replace(/[_]+/g, ' ').replace(/\s*\((?:SVS)?\d{4,}[^)]*\)\s*/g, ' ').replace(/\.(theora|ogv|webm|vp9)\b/gi, '').replace(/^\d{6,8}[-_ ]?/, '').replace(/\b(DSC|IMG|VID|MVI|MOV|GOPR|P)\d{3,}\b/gi, '').replace(/\s+/g, ' ').trim();

/** Best playable WebM transcode: around 480p on the short side (light on mobile data). */
export function pickSource(v) {
  const ders = (v.derivatives || []).filter((d) => /^video\/webm/.test(d.type) && d.src && d.width && d.height);
  if (!ders.length) return null;
  const short = (d) => Math.min(d.width, d.height);
  const ok = ders.filter((d) => short(d) >= 360 && short(d) <= 1080);
  const pool = ok.length ? ok : ders;
  pool.sort((a, b) => Math.abs(short(a) - 480) - Math.abs(short(b) - 480));
  return pool[0];
}

export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
export function commonsParams(term, limit = 40) {
  return {
    action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrnamespace: '6',
    gsrsearch: `filetype:video intitle:"${term}"`, gsrlimit: String(limit), gsrsort: 'random',
    prop: 'videoinfo', viprop: 'url|size|mime|derivatives|extmetadata', viurlwidth: '640',
    viextmetadatafilter: 'Artist|LicenseShortName|ImageDescription|ObjectName|Restrictions',
  };
}

export function toItem(page, topic) {
  const v = page.videoinfo?.[0];
  if (!v || !v.thumburl) return null;
  const dur = Number(v.duration || 0);
  if (dur < 4 || dur > 150) return null;
  if (Math.min(v.width || 0, v.height || 0) < 480) return null;
  const m = v.extmetadata || {};
  let title = cleanTitle(strip(m.ObjectName?.value) || page.title);
  const description = strip(m.ImageDescription?.value).replace(/^(English|en|Français|fr|Deutsch|de|Español|es)\s*:\s*/i, '').slice(0, 600);
  const letters = (title.match(/\p{L}/gu) || []).length;
  if (letters < 6 || letters / title.length < 0.5) title = description.split(/(?<=[.!?])\s/)[0].slice(0, 120);
  if (!title) return null;
  if (/ČSLA|CSLA/i.test(strip(m.Artist?.value))) return null;
  if (BLOCK.test(`${page.title} ${title} ${description} ${strip(m.Artist?.value)}`)) return null;
  const authorRaw = strip(m.Artist?.value);
  if (/^([A-Z][\w'-]+ [A-Z]{1,2}, ){2,}/.test(authorRaw + ', ')) return null; // scientific-paper supplements
  const src = pickSource(v);
  if (!src) return null;
  const author = strip(m.Artist?.value).replace(/^Uploaded by\s*/i, '').slice(0, 80) || 'Wikimedia Commons';
  return {
    source: 'commons', source_id: String(page.pageid), topic, url: src.src, poster: v.thumburl,
    width: src.width, height: src.height, duration: dur, title: title.slice(0, 200), description,
    author, license: strip(m.LicenseShortName?.value).slice(0, 40) || 'CC', page_url: v.descriptionurl,
  };
}


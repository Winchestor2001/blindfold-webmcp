// Deterministic sensitive-entity detection.
//
// Everything here runs locally, in the page, with no model call and no network.
// That is the point of the project: the document is never uploaded anywhere, so
// detection cannot be delegated to a server either.
//
// Design notes:
//   - Every rule returns spans with char offsets into the page's plain text.
//   - Rules may overlap. `resolveOverlaps` keeps the strongest claim on a run of
//     characters, so a credit card is never also reported as a phone number and
//     an honorific-anchored name beats a loose capitalised-words guess.
//   - Anything checkable arithmetically (Luhn, IBAN mod-97) is checked. A false
//     positive the reviewer must dismiss costs more attention than a narrower
//     regex costs recall.
//   - Confidence is reported to the agent so it can treat weak candidates as
//     questions for the human rather than facts.

import type { EntityType, Finding } from "./types";

type Span = {
  type: EntityType;
  start: number;
  end: number;
  value: string;
  confidence: number;
};

/**
 * Higher wins when two rules claim overlapping text. The ordering encodes
 * specificity: an IBAN is a more specific claim about a run of characters than
 * "this looks like a phone number".
 */
const PRIORITY: Record<EntityType, number> = {
  EMAIL: 100,
  URL: 95,
  ACCOUNT: 90,
  NATIONAL_ID: 85,
  IP: 80,
  DATE: 75,
  MONEY: 70,
  PHONE: 65,
  ADDRESS: 60,
  ORG: 55,
  PERSON: 50
};

// ---------------------------------------------------------------------------
// Checksums
// ---------------------------------------------------------------------------

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (digit < 0 || digit > 9) return false;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function passesIbanMod97(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const code = character.charCodeAt(0);
    const chunk =
      code >= 65 && code <= 90
        ? String(code - 55) // A -> 10 ... Z -> 35
        : character;
    for (const digit of chunk) {
      remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}

// ---------------------------------------------------------------------------
// Vocabulary for the PERSON heuristic
// ---------------------------------------------------------------------------

const HONORIFICS =
  "Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Professor|Judge|Justice|Officer|Detective|Inspector|Sgt|Sergeant|Capt|Captain|Lt|Lieutenant|Col|Colonel|Gen|General|Sen|Senator|Rep|Representative|Gov|Governor|Rev|Reverend|Sir|Dame|Lord|Lady|Nurse|Chief";

/**
 * Common given names. Not exhaustive by design — a hit raises confidence, a miss
 * does not veto detection. The capitalised-sequence rule still catches names
 * outside the list, at lower confidence.
 */
const GIVEN_NAMES = new Set(
  `james robert john michael david william richard joseph thomas tomas charles christopher daniel matthew anthony mark marcus donald steven andrew paul joshua kenneth kevin brian george timothy ronald edward jason jeffrey ryan jacob gary nicholas eric jonathan stephen larry justin scott brandon benjamin samuel gregory alexander patrick frank raymond jack dennis jerry tyler aaron jose adam nathan henry douglas zachary peter kyle ethan walter noah jeremy christian keith roger terry gerald harold sean austin carl arthur lawrence dylan jesse jordan bryan billy bruce gabriel joe logan alan juan albert willie elijah wayne randy vincent mason roy ralph bobby russell bradley philip eugene julian felix oscar hugo victor leo simon martin ivan
mary patricia jennifer linda elizabeth barbara susan jessica sarah karen lisa nancy betty margaret sandra ashley kimberly emily donna michelle carol amanda dorothy melissa deborah stephanie rebecca sharon laura cynthia kathleen amy angela shirley anna brenda pamela emma nicole helen helena samantha katherine christine debra rachel carolyn janet catherine maria heather diane ruth julie olivia joyce virginia victoria kelly lauren christina joan evelyn judith megan andrea cheryl hannah jacqueline martha gloria teresa ann sara madison frances kathryn janice jean abigail alice julia judy sophia grace denise amber marilyn danielle beverly charlotte natalie theresa diana brittany doris kayla alexis lori elena renata anneliese clara greta iris nadia vera
ahmed ali omar hassan ibrahim yusuf khalid tariq amina fatima layla noor zainab mohammed mustafa rashid samir nadir
wei ling chen jun ming hui yan feng lei ping xiu tao
priya raj arjun ananya rohit deepak neha vikram anita sanjeev meera kavya
sofia mateo lucia diego valentina santiago camila alejandro isabella carlos miguel javier rosa
lars anders nils erik ingrid astrid henrik freja magnus soren birgit
dmitri sergei nikolai olga irina natalia vladimir mikhail anastasia yelena
kenji yuki haruto sakura hiroshi aiko takashi
minjun seoyeon jihoon hana sungmin`
    .split(/\s+/)
    .filter(Boolean)
);

/**
 * Role, institution and document-structure nouns. These are the words that make
 * a capitalised pair look like a name when it is really a job title or a form
 * label — "Chief Risk Officer", "Medical Record Number", "Quality Lead".
 */
const ROLE_AND_LABEL_WORDS =
  `chief officer director manager coordinator lead head deputy assistant associate
   analyst engineer architect developer designer consultant specialist technician
   advocate counsel counselor attorney solicitor barrister notary auditor
   physician surgeon clinician nurse practitioner pharmacist therapist dentist
   president chairman chairperson secretary treasurer trustee principal partner
   supervisor administrator executive controller inspector examiner registrar
   quality risk safety security privacy compliance legal finance operations
   engagement delivery product project program portfolio account service support
   medical clinical dental surgical patient care ward unit theatre
   record records number reference identifier code file case matter
   social national federal state county municipal regional local central
   insurance assurance policy claim premium deductible coverage
   supplier vendor client customer contractor employee staff personnel
   department division section branch office bureau agency authority ministry
   committee council board panel commission tribunal court
   hospital clinic pharmacy laboratory university college school institute
   company corporation firm group holdings enterprise organisation organization
   summary report memorandum agreement contract schedule appendix exhibit
   date time page total subtotal amount balance invoice receipt payment
   name title subject reference regarding attention`
    .split(/\s+/)
    .filter(Boolean);

/**
 * Capitalised words that routinely start sentences or name non-people. Without
 * this the capitalised-sequence rule floods the review queue.
 */
const NOT_A_NAME = new Set([
  ...ROLE_AND_LABEL_WORDS,
  ...`the a an and or but if then this that these those there here when while after before during since until
  january february march april may june july august september october november december
  monday tuesday wednesday thursday friday saturday sunday
  we you they he she it i our your their his her its my me us them
  please note however therefore moreover furthermore additionally accordingly subsequently
  attached enclosed confidential privileged internal external draft final preliminary
  united states america american european union kingdom republic
  north south east west northern southern eastern western
  street avenue road boulevard lane drive court suite floor building terrace place
  inc llc ltd gmbh corp limited foundation partners llp plc
  all any each every some none both few many most other another same such
  dear sincerely regards best thanks thank hello
  per via cc bcc from to re fwd
  data system server user admin access request response error status
  new old first second third fourth fifth last next previous initial
  notice warning caution important urgent action required immediate
  approved rejected pending review reviewed submitted received sent signed prepared
  yes no true false
  instruction instructions ignore override
  key next steps reason course billing release information further`
    .split(/\s+/)
    .filter(Boolean)
]);

/** One word of a name. Deliberately excludes whitespace — names do not wrap. */
const NAME_WORD = "[A-Z][a-z]{1,20}(?:['’\\-][A-Z]?[a-z]{1,20})?";
/** Separator between name words. A newline ends a name. */
const GAP = "[ \\t]";

function isPlausibleNameWord(word: string): boolean {
  return !NOT_A_NAME.has(word.toLowerCase().replace(/[^a-z'’-]/g, ""));
}

/**
 * Words the document itself uses in lower case somewhere. If "engagement"
 * appears lower case in a sentence, then "Engagement" in a capitalised pair is
 * far more likely to be a heading than a surname. Cheap, and it generalises to
 * documents whose vocabulary we could never enumerate in advance.
 */
function lowercaseVocabulary(text: string): Set<string> {
  const words = new Set<string>();
  for (const match of text.matchAll(/\b[a-z]{3,}\b/g)) words.add(match[0]);
  return words;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function collect(
  text: string,
  pattern: RegExp,
  type: EntityType,
  confidence: number,
  options?: {
    /** Which capture group is the entity itself. Defaults to the whole match. */
    group?: number;
    /** Return false to reject a candidate after matching. */
    accept?: (value: string) => boolean;
  }
): Span[] {
  const spans: Span[] = [];
  const group = options?.group ?? 0;
  for (const match of text.matchAll(pattern)) {
    const whole = match[0];
    const value = match[group];
    if (value === undefined || match.index === undefined) continue;
    if (options?.accept && !options.accept(value)) continue;

    // Offset of the capture group inside the whole match. Capture groups used
    // here always sit at the first occurrence of their text within the match.
    const offsetInMatch = group === 0 ? 0 : whole.indexOf(value);
    if (offsetInMatch < 0) continue;

    const start = match.index + offsetInMatch;
    spans.push({ type, start, end: start + value.length, value, confidence });
  }
  return spans;
}

function detectEmail(text: string): Span[] {
  return collect(
    text,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,24}\b/g,
    "EMAIL",
    0.99
  );
}

function detectUrl(text: string): Span[] {
  return collect(
    text,
    /\bhttps?:\/\/[^\s<>"'()[\]]+[^\s<>"'()[\].,;:!?]/g,
    "URL",
    0.97
  );
}

function detectIp(text: string): Span[] {
  return collect(text, /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "IP", 0.95, {
    accept: (value) =>
      value.split(".").every((octet) => {
        const number = Number(octet);
        return octet.length <= 3 && number >= 0 && number <= 255;
      })
  });
}

function detectAccount(text: string): Span[] {
  const cards = collect(text, /\b(?:\d[ -]?){12,18}\d\b/g, "ACCOUNT", 0.98, {
    accept: (value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits);
    }
  });

  const ibans = collect(
    text,
    /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g,
    "ACCOUNT",
    0.98,
    {
      accept: (value) => {
        const compact = value.replace(/\s+/g, "");
        return (
          compact.length >= 15 && compact.length <= 34 && passesIbanMod97(compact)
        );
      }
    }
  );

  // Identifiers the document itself labels as financial. Catching these by their
  // label rather than their shape is what makes the detector portable to schemes
  // it has never seen.
  const labelled = collect(
    text,
    /\b(?:Account(?: No\.?| Number)?|IBAN|BIC|SWIFT|Sort Code|Routing(?: Number)?|Policy(?: No\.?| Number)?|Claim(?: Reference| No\.?| Number)?|Invoice(?: No\.?| Number)?|Reference)\b[:#\s]{1,3}([A-Z0-9][A-Z0-9–-]{3,24}[A-Z0-9])/gi,
    "ACCOUNT",
    0.88,
    // The digit requirement is what makes the case-insensitive match safe: it
    // separates an identifier from the ordinary words that follow a label.
    { group: 1, accept: (value) => /\d/.test(value) }
  );

  return [...cards, ...ibans, ...labelled];
}

function detectNationalId(text: string): Span[] {
  // US SSN shape. The negative lookaheads reject the ranges the SSA never issues.
  const ssn = collect(
    text,
    /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    "NATIONAL_ID",
    0.97
  );

  const labelled = collect(
    text,
    /\b(?:SSN|Social Security(?: Number)?|National ID|NIN|Passport(?: No\.?| Number)?|Tax ID|TIN|NHS Number|Medicare(?: Number)?|Medical Record Number|MRN|Member Number|Company Number|File Number|Licen[cs]e(?: No\.?| Number)?)\b[:#\s]{1,3}([A-Z0-9][A-Z0-9–-]{3,24}[A-Z0-9]|\d{4,12})/gi,
    "NATIONAL_ID",
    0.9,
    { group: 1, accept: (value) => /\d/.test(value) }
  );

  return [...ssn, ...labelled];
}

function detectPhone(text: string): Span[] {
  // The boundary guards keep the rule out of longer identifiers: the "7719-2244"
  // inside "4B-7719-2244" is part of a policy number, not a phone number.
  return collect(
    text,
    /(?<![\w–-])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})(?:[\s.-]\d{2,5}){1,4}(?![\w–-])/g,
    "PHONE",
    0.85,
    {
      accept: (value) => {
        const digits = value.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15) return false;
        // Require a separator or an international prefix, so bare runs of digits
        // (totals, reference numbers) are not swept up.
        return /[\s.\-()]/.test(value) || value.startsWith("+");
      }
    }
  );
}

function detectMoney(text: string): Span[] {
  return collect(
    text,
    /(?:[$€£¥]\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:USD|EUR|GBP|CHF|JPY|UZS))?)|(?:\b\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|EUR|GBP|CHF|JPY|UZS)\b)/g,
    "MONEY",
    0.9
  );
}

function detectDate(text: string): Span[] {
  const MONTH =
    "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";

  const numeric = collect(
    text,
    /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4})\b/g,
    "DATE",
    0.93
  );

  const monthFirst = collect(
    text,
    new RegExp(`\\b(?:${MONTH})\\.?${GAP}+\\d{1,2}(?:st|nd|rd|th)?,?${GAP}*\\d{4}\\b`, "g"),
    "DATE",
    0.95
  );

  const dayFirst = collect(
    text,
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?${GAP}+(?:${MONTH})\\.?,?${GAP}+\\d{4}\\b`, "g"),
    "DATE",
    0.95
  );

  return [...numeric, ...monthFirst, ...dayFirst];
}

const STREET_SUFFIX =
  "Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl|Terrace|Ter|Parkway|Pkwy|Circle|Cir|Square|Sq|Highway|Hwy|Row|Mews|Close|Crescent|Gardens|Gdns|Walk|Hill|Green|Park|Quay|Wharf|Yard|Grove|Rise|Vale|Path|Alley|Loop|Trail";

function detectAddress(text: string): Span[] {
  const street = collect(
    text,
    new RegExp(
      `\\b\\d{1,6}[A-Za-z]?${GAP}+(?:${NAME_WORD}${GAP}+){0,3}(?:${STREET_SUFFIX})\\b\\.?(?:${GAP}*,?${GAP}*(?:Apt|Suite|Ste|Unit|Floor|Fl)\\.?${GAP}*[A-Za-z0-9-]+)?`,
      "g"
    ),
    "ADDRESS",
    0.9
  );

  const postal = collect(
    text,
    new RegExp(`\\b${NAME_WORD}(?:${GAP}+${NAME_WORD})?,${GAP}*[A-Z]{2}${GAP}+\\d{5}(?:-\\d{4})?\\b`, "g"),
    "ADDRESS",
    0.88
  );

  return [...street, ...postal];
}

const ORG_SUFFIX =
  "Inc|Inc\\.|LLC|L\\.L\\.C\\.|Ltd|Ltd\\.|Limited|GmbH|Corp|Corp\\.|Corporation|Holdings|Foundation|Institute|Group|Partners|LLP|PLC|N\\.V\\.|B\\.V\\.|S\\.A\\.|A\\.G\\.|Bank|Trust|Capital|Ventures|Laboratories|Labs|Clinic|Hospital|University|College|Pharmacy|Mutual|Insurance|Assurance|Society|Association|Agency|Authority|Analytics|Consulting|Advisors|Associates|Services|Solutions|Systems|Technologies";

/**
 * Organisation names are routinely set in full capitals in letterheads and
 * signature blocks, where the mixed-case rule cannot see them. The suffix list
 * here is deliberately narrower — "MASTER SERVICES AGREEMENT" must not read as a
 * company.
 */
const ORG_SUFFIX_UPPER =
  "INC|LLC|LTD|LIMITED|GMBH|CORP|CORPORATION|HOLDINGS|FOUNDATION|INSTITUTE|LLP|PLC|BANK|TRUST|HOSPITAL|UNIVERSITY|COLLEGE|CLINIC|PHARMACY|LABORATORIES";

function detectOrg(text: string): Span[] {
  const mixedCase = collect(
    text,
    new RegExp(`\\b(?:${NAME_WORD}${GAP}+){1,4}(?:${ORG_SUFFIX})(?![a-z])`, "g"),
    "ORG",
    0.9
  );

  const upperCase = collect(
    text,
    new RegExp(`\\b(?:[A-Z]{2,20}${GAP}+){1,4}(?:${ORG_SUFFIX_UPPER})\\b`, "g"),
    "ORG",
    0.9
  );

  return [...mixedCase, ...upperCase];
}

function detectPerson(text: string): Span[] {
  const spans: Span[] = [];
  const lowercaseWords = lowercaseVocabulary(text);

  // 1. Honorific trigger. The strongest signal available without a model.
  //    The honorific is deliberately left outside the span: a reviewer often
  //    wants to keep "Dr." while removing the name that follows it.
  spans.push(
    ...collect(
      text,
      new RegExp(
        `\\b(?:${HONORIFICS})\\.?${GAP}+(${NAME_WORD}(?:${GAP}+[A-Z]\\.)?(?:${GAP}+${NAME_WORD}){0,2})`,
        "g"
      ),
      "PERSON",
      0.95,
      { group: 1, accept: (value) => value.split(/\s+/).every(isPlausibleNameWord) }
    )
  );

  // 2. A known given name followed by at least one more capitalised word.
  spans.push(
    ...collect(
      text,
      new RegExp(
        `\\b${NAME_WORD}(?:${GAP}+[A-Z]\\.)?(?:${GAP}+${NAME_WORD}){1,2}\\b`,
        "g"
      ),
      "PERSON",
      0.88,
      {
        accept: (value) => {
          const words = value.split(/\s+/);
          const first = words[0]!.toLowerCase().replace(/[^a-z'’-]/g, "");
          if (!GIVEN_NAMES.has(first)) return false;
          return words.every((word) => word.endsWith(".") || isPlausibleNameWord(word));
        }
      }
    )
  );

  // 3. A capitalised pair or triple with no known given name. Reported as a
  //    candidate, not a certainty — this is the tier the human is there for.
  spans.push(
    ...collect(
      text,
      new RegExp(`\\b${NAME_WORD}(?:${GAP}+${NAME_WORD}){1,2}\\b`, "g"),
      "PERSON",
      0.6,
      {
        accept: (value) => {
          const words = value.split(/\s+/);
          if (words.length < 2) return false;
          if (!words.every(isPlausibleNameWord)) return false;
          // If the document itself uses any of these words in lower case, the
          // capitalisation is structural, not a name.
          return !words.some((word) => lowercaseWords.has(word.toLowerCase()));
        }
      }
    )
  );

  return spans;
}

const RULES: Array<(text: string) => Span[]> = [
  detectEmail,
  detectUrl,
  detectIp,
  detectAccount,
  detectNationalId,
  detectPhone,
  detectMoney,
  detectDate,
  detectAddress,
  detectOrg,
  detectPerson
];

// ---------------------------------------------------------------------------
// Overlap resolution
// ---------------------------------------------------------------------------

/**
 * Keeps the strongest claim on any run of characters.
 *
 * Confidence is compared before length on purpose. "Officer Renata Silvani"
 * matches the weak capitalised-sequence rule and is longer than the honorific
 * rule's "Renata Silvani", but the honorific rule is the one that actually knows
 * what it found.
 */
function resolveOverlaps(spans: Span[]): Span[] {
  const ordered = [...spans].sort((a, b) => {
    const priority = PRIORITY[b.type] - PRIORITY[a.type];
    if (priority !== 0) return priority;
    const confidence = b.confidence - a.confidence;
    if (confidence !== 0) return confidence;
    const length = b.end - b.start - (a.end - a.start);
    if (length !== 0) return length;
    return a.start - b.start;
  });

  const kept: Span[] = [];
  for (const span of ordered) {
    const clashes = kept.some(
      (existing) => span.start < existing.end && existing.start < span.end
    );
    if (!clashes) kept.push(span);
  }

  return kept.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function detectInText(text: string): Span[] {
  return resolveOverlaps(RULES.flatMap((rule) => rule(text)));
}

/**
 * Scans every page and returns findings with stable ids. Ids are assigned in
 * reading order, so an agent iterating them moves through the document the way a
 * person would.
 */
export function detectInPages(
  pages: Array<{ number: number; text: string }>
): Finding[] {
  const findings: Finding[] = [];
  let counter = 0;

  for (const page of pages) {
    for (const span of detectInText(page.text)) {
      counter += 1;
      findings.push({
        id: `f${counter}`,
        type: span.type,
        page: page.number,
        start: span.start,
        end: span.end,
        value: span.value,
        confidence: Number(span.confidence.toFixed(2)),
        status: "unreviewed",
        decidedBy: null,
        ruleId: null,
        disclosed: false
      });
    }
  }

  return findings;
}

export type { Span };

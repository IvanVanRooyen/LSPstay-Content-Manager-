# Compendium Setup: project handover

**Status as of 14 October 2026 (session 5):** working prototype. **One HTML file with no network dependency for anything that matters** — the customer saves it, double-clicks it, works through three steps and downloads a content pack to email back. Presented as a sample throughout, watermarked as such. Not yet used with a real customer.

**Live page:** https://claude.ai/artifact/R6Au2uRMPpmVTXAerg8NnR (claude.ai artifact, version 11, shared as "anyone with the link")
**Source:** `compendium-setup.html`, sent with this document. It is the exact code behind version 11, wrapped so it opens directly in a browser.

---

## 1. What this is and why it exists

We build a custom hotel compendium interface: the in-room TV home screen and menu that guests use (reference install: RACV Noosa). Collecting content from hoteliers has meant a lot of back and forth, because customers don't know what's possible or exactly what we need from them.

This tool is a **customer-facing questionnaire and content-collection system**:

1. The customer sees a working replica of our TV home screen and is **guided through every part of it, one at a time**, learning what each part does and choosing which optional features to include.
2. They are then asked **only for the content those choices need** (logos, menus, offers, photos and so on), with hints giving our real specs.
3. They review what's complete and **download one content pack** (.zip) to send back to us.

**Guiding principle (from the product owner):** the tool exists to collect the information and assets *we* need to build their compendium. It does not configure the product. Questions about settings we decide ourselves, such as colours, TV counts, go-live dates or contact details, were deliberately removed. Ask only for things the customer has to supply.

---

## 1a. How it reaches the customer

The intended flow is deliberately boring: **we email them the HTML file, they double-click it, it opens in their browser, they work through it and download one .zip to send back.** No install, no login, no hosting, nothing to go wrong at our end.

What that costs us, and what was done about it:

| Constraint of running from a local file | Where it stands |
|---|---|
| A CDN script would simply not load with no internet, and the download is the whole point | **JSZip 3.10.1 is inlined** into the page (session 5). Nothing is fetched to build the pack. `test/verify-zip.js` builds a real zip from the inlined copy and reads it back byte for byte |
| Google Fonts cannot be relied on either | Still referenced, but only for looks. Each family has a real fallback (Manrope -> system sans, Bricolage -> Manrope, Cormorant -> Iowan Old Style/Georgia), so offline the page is plainer, not broken |
| `localStorage` is blocked in some browsers on `file://` and in private windows | Handled and **said out loud**: when a save fails the header reads "Progress can't be saved in this view" instead of falsely claiming it saved |
| `IndexedDB` is commonly unavailable on `file://`, which is where uploaded files live between visits | Detected. When it is missing, step 2 shows "Files you attach are held only for this visit, so finish and download your pack before closing this page." Files still work fine within the one visit |
| The download itself | `saveFile()` uses a Blob URL plus a synthetic `<a download>` click, which works from `file://` |

**The honest residual risk:** the file is ~190 KB, which emails fine, but some mail gateways strip or quarantine `.html` attachments. Sending it zipped, or putting it on a URL, sidesteps that. Hosting it also brings back reliable save-and-resume, which is the one real advantage the local file gives up.

---

## 2. How the tool works today

### Step 1: Choose features (guided walkthrough)

- **Intro card:** "Let's walk through your guest TV screen", followed by **14 parts** reviewed in reading order: the top row, then the middle of the screen, then the menu bar from left to right.
- **Walkthrough order (the `STOPS` array):** Branding → Languages (globe button) → Room & guest card → Weather → Exclusive for You → Landing page content panel → TV & Radio → Apps & Casting → Dining & Bars → In-room Dining → Resort Info → Local Attractions → Resorts & Benefits → Additional information sections.
- **Highlighting:** the current part has a pulsing jade outline on the TV replica and everything else is dimmed. Parts not yet reviewed show their walkthrough number as a badge. Reviewed optional parts show a ✓ when included or a + when left off.
- **Standard parts** (always included, no toggle) only have **Back** and **Next**, and viewing one counts as reviewing it.
- **"We'll ask you for"** is normally derived from the feature's required fields. A feature can override it with a hand-written `need` array, which Dining & Bars, In-room Dining and Resort Info now use, so the list stays short instead of naming every sub-field.
- **Optional parts:** the customer must choose **Enable** or **Disable** before moving on. The last part asks "Would you like to add your own information sections?" (**Yes, add sections** or **No thanks**).
- **Switching rule:** the walkthrough card is the **only** place a feature can be switched on or off. Tapping something on the TV, or a row in the "On your screens" list, just jumps to that part.
- **Moving around:** a segmented progress bar at the top of the card can be clicked to jump to any part. Left and right arrow keys also work. Progress is saved in the browser.
- **Locking:** Add content and Review & send (the header steps and the footer button) stay **locked until all 14 parts are reviewed**. If someone reaches the end with gaps, they get a "N parts still to review" card listing them.
- **Layout (session 5):** three columns that read left to right — the **walkthrough card and its stats** on the left, the **TV replica** in the middle, **"On your screens"** on the right. Below 1320 px the feature list drops under the screen; below 1060 px everything stacks with the screen first.
- **"On your screens"** shows **only the features that are on**, grouped as Always included, Menu bar and Additional sections.
- **Sample disclaimer** sits at the foot of the step: the page is a sample representation of the features and appearance, not the finished interface.
- **Guest view:** a toggle shows the home screen as guests would see it with the current choices.
- **Phones:** the TV preview stays pinned at the top while the card scrolls beneath it.

### Step 2: Add content

- **Which sections appear:** only features that are on *and* have questions. Weather, Room & guest card, Languages, TV & Radio and Exclusive for You have no questions, so they're absent.
- **Layout:** a left rail shows each section with a progress ring and done/required count, above a live mini preview of the TV, which picks up the property name and some answers.
- **Field behaviour:** fields show/hide based on earlier answers (for example, choosing the menu format shows a file upload, a URL field or a text box). Repeating groups cover venues, offers, attractions and similar ("Add a venue"; removing one needs a second click to confirm).
- **Uploads:** drag and drop or file picker, with image thumbnails.
- **Sample answers:** "Try sample answers" fills empty fields with example content, labelled "(sample)". Since session 3 the button **only appears when the URL carries `?demo=1`**, so customers never see it. Internal testers add the flag.

### Step 3: Review & send

- **Completion overview:** an overall percentage, plus a per-section table listing what's missing. Each missing item is a button that jumps back to that field.
- **Download content pack:** builds a .zip in the browser containing:
  - `summary.md`: a human-readable summary, with a "Still to come" list of missing items
  - `content.json`: structured data for the build team, including a `missing` array
  - `files/<feature-id>/…`: every uploaded file, sorted by feature
- **Copy summary:** copies the Markdown summary to the clipboard. If the browser blocks it, the customer is told to download the pack instead, which contains the same summary. (The on-page "Preview the summary" block was removed in session 4.)
- **Start over:** clears everything, after a second click to confirm.

---

## 3. Feature catalogue (current)

| id | Name | Group | Walkthrough | Content we ask for |
|---|---|---|---|---|
| `branding` | Branding & property details | Standard | Next | Property name\*, Logos\* (all versions), Home screen background image\*, Brand standards / style guide, Photos and visual assets, Link to a larger asset library |
| `language` | Languages | Standard | Next | Nothing: every supported language is included as standard |
| `room` | Room & guest card | Standard | Next | Nothing (see open question 1) |
| `weather` | Weather | Standard | Next | Nothing |
| `offers` | Exclusive for You | Standard | Next | Nothing. The customer adds and manages their own offers once they are live, so this has no content section |
| `video` | Landing page content panel | Standard | Next | Videos / Photos / Videos and photos\*, then the matching uploads\*, and a download link for large videos |
| `tv` | TV & Radio | Menu bar | Include / Leave off | Nothing |
| `apps` | Apps & Casting | Menu bar | Include / Leave off | Apps to include\* (chips) |
| `dining` | Dining & Bars | Menu bar | Enable / Disable | One repeating list (at least one\*). Per node: name\*, content type\* (Website / PDF / Image / Plain text) and the matching field\*, plus a photo of the venue\* |
| `ird` | In-room Dining | Menu bar | Enable / Disable | One repeating list (at least one\*). Per node: name\*, content type\* (Website / PDF / Image / Plain text) and the matching field\*, plus a supporting photo\* |
| `info` | Resort Info | Menu bar | Enable / Disable | One repeating list (at least one\*). Per node: name\*, content type\* (Website / PDF / Image / Plain text) and the matching field\*, plus a supporting photo\* |
| `local` | Local Attractions | Menu bar | Enable / Disable | One repeating list (at least one\*). Per node: name\*, content type\* (Website / PDF / Image / Plain text) and the matching field\*, plus a photo of the attraction\* |
| `group` | Resorts & Benefits | Menu bar | Enable / Disable | One repeating list (at least one\*). Per node: property or program name\*, content type\* (Website / PDF / Image / Plain text) and the matching field\*, plus a supporting photo\* |
| `extra` | Additional information sections | Additional | Yes / No thanks (off by default) | Repeating sections: name\*, what it should cover\*, text content, photos and documents, QR link. Each section becomes its own menu bar tile in the preview |

\* = required. The "What's possible" bullets and descriptions on each walkthrough card were partly written by the product owner (see `sees` and `can` in the code). Treat that wording as approved copy.

**The node-list pattern.** Dining & Bars, In-room Dining, Resort Info, Local Attractions and Resorts & Benefits are **the same question, five times**. Each is a single repeating list and nothing else. The customer adds as many nodes as they want ("Add a venue", "Add a menu", "Add a facility", "Add an attraction", "Add a property"), and each node asks exactly seven things: a **name**, **what kind of content should go with it** (Website / PDF / Image / Plain text), the four content fields of which exactly one is ever visible, and a **photo**. Nothing more granular is collected — opening hours, venue type, booking extensions, Wi-Fi details, check-in times and loyalty-program structure were all removed, because what goes on a page is the customer's call and belongs inside their content. `test/verify-catalogue.js` asserts all five node shapes are identical field for field, so they cannot drift apart.

---

## 4. Code guide

**One HTML file, with no build step and no framework.** All CSS and JS are inline. The only external code is JSZip 3.10.1 from cdnjs, used for the zip export, plus Google Fonts (Bricolage Grotesque, Manrope and Cormorant Garamond).

| Section (in file order) | What's there |
|---|---|
| `<style>` | Design tokens on `:root` (single dark theme, chosen to match the TV). Then step 1 styles, the TV replica (sized in `cqw` container units so it scales), walkthrough styles, step 2 and 3 styles, and responsive breakpoints at 1060, 860 and 620 px |
| `helpers` | `$`, `esc`, the `I` icon set (inline SVG strings) and the `WX` weather icons |
| `feature catalogue` | **`FEATURES`**, the single source of truth for every feature, its copy and its questions. Also `GROUPS`, `DEFAULT_ON` (optional features on by default) and `SAMPLE` (sample answers) |
| `state` | `S`, saved to `localStorage` under **`compendium-setup-v2`**. Uploaded files are kept as Blobs in IndexedDB (`compendium-setup`) and in a memory map |
| `value + progress` | `getP`/`setP` (dotted-path access such as `dining.venues.0.name`), `vis()` (show rules), `filled()`, `progress()` (required count, done count and missing list per feature), `totals()`, `contentSecs()` |
| `painted backgrounds` | Canvas-painted placeholder landscape and beach images. These are generated, so no image assets are needed |
| `TV replica` | `tvHTML(mode)` renders the home screen in `'edit'` (interactive, with badges) or `'guest'` mode, and reflects uploaded logo, background and photos and some answers |
| `step 1: guided walkthrough` | **`STOPS`** (order), `goTour()`, `decide()`, `tourCard()`, `step1()`. Also migrates older saved state |
| `step 2` / `step 3` | Form rendering (`fieldHTML`), section rail, review table, `buildMarkdown()`, `downloadZip()` |
| `events` | One delegated click/input/change/drag handler, driven by `data-*` attributes |

### Field schema (used in `FEATURES[].fields`)

```js
{ k:'key', l:'Label', t:'text|textarea|email|tel|url|number|date|time|select|seg|chips|color|file|repeat|note',
  req:1,                 // required
  hint:'…', ph:'…',      // helper text, placeholder
  opts:[…],              // select / seg / chips options
  def:'…',               // default value
  multi:1, accept:'…',   // file fields
  show:{k:'otherKey', in:['Value A','Value B']},  // show only when a sibling field has one of these values (works with chips too)
  // repeat only:
  item:'Venue', add:'Add a venue', min:1, fields:[…], suggest:[…] }
```

A feature may also carry `need:['…']`, a hand-written "We'll ask you for" list that replaces the one derived from its required fields. Inside a repeat, `list:1` on a text field wires it to the repeat's `suggest` datalist.

To add or change a question, edit `FEATURES`; rendering, progress, review and export all follow automatically. A feature with `fields:[]` has no content section. A feature's walkthrough position comes from `STOPS`, and a new feature needs adding there too. A new menu bar feature also needs `tint` and `icon` (a key of `I`).

### Things that only work inside claude.ai (important for the move)

1. **The download button** is no longer claude.ai-only. `saveFile(filename, blob)` uses the artifact runtime's `window.claude.use('downloads')` when it is available, and falls back to a Blob URL plus a synthetic `<a download>` click everywhere else. Nothing needs changing to self-host it.
2. **The page skeleton:** the published artifact source starts at `<title>` and has no doctype, head or body, because claude.ai adds those. The `compendium-setup.html` sent with this handover has a minimal wrapper added so it runs standalone. If you republish to claude.ai, the Artifact tool handles the skeleton itself.
3. **Saved answers** are kept per browser (localStorage under `compendium-setup-v3`, and IndexedDB). They never reach us, and nothing is sent to a server.

---

## 5. Decision log

The decisions in order, so the reasoning isn't lost.

**Session 1 (12 Oct)**
- The format is an interactive replica of the real home screen, based on the RACV Noosa screenshot, rather than a plain form. Customers click parts of the screen.
- Delivery is the customer downloading a .zip and emailing it to us, with no backend for the prototype.
- From comments on the page:
  - The content panel is described as "A landing page panel that displays video, photo or advertising content."
  - "A seasonal change without a site visit" was removed from it.
  - Branding is described as "Your brand or property logo, brand standards/visual identity." A brand standards upload was added.
  - The highlight colour and seasonal background options were removed from Branding.
- **Revision round (choose features):**
  1. The feature list shows enabled features only.
  2. Room & guest card, Weather, Exclusive for You, the content panel and Languages are **always included and can't be switched off**.
  3. Toggling happens only in the feature's own card; list rows just navigate.
  4. The preset extra modules (Spa, What's On, Guest Requests, Express Check-out, Feedback) and the "More" tile were removed, and replaced with a single "Additional information sections" toggle that collects custom sections.
  5. **All time estimates were removed.**
- **Revision round (add content):**
  - Removed highlight colour, number of TVs, go-live date and the name/email/phone contact fields from Branding.
  - Removed the Room & guest card section and replaced it with the **Landing page content panel** section (choose videos, photos or both, then upload accordingly).
  - Removed the TV & Radio and Movies sections.
  - Removed the Wi-Fi network name from Apps & Casting.
- The Languages content section was removed, because all languages are standard.

**Session 2 (13 Oct)**
- The product owner edited a downloaded copy directly (mostly the walkthrough wording: `sees` and `can` for most features, and the title "Compendium Setup Draft"). That version was published as-is, then built on.
- **The guided walkthrough was added** (section 2, step 1). The customer must review all parts before moving to the content step.
- **Content aligned to the walkthrough:**
  - Weather has no questions.
  - Branding was reframed as asset collection: logos, brand standards, fonts, imagery and an asset-library link. The welcome line was removed.
  - Offers gained an audience question.
  - Dining and In-room Dining menus can be a PDF or image, a website link or plain text.
  - In-room Dining TV ordering and the POS question were removed.
  - Local Attractions became a list where each attraction has a content type. The "draft them for us" option was removed to match the owner's wording.
  - Resorts & Benefits now starts with a "What would you like to feature?" choice.
  - Typos fixed.

**Session 3 (14 Oct)**
- **Fixes:** uploaded logos and the home screen background now actually appear in the TV replica. The logo became a multi-file field, so the old single-file read never resolved; the background had no field at all, and is now taken from the first image in branding's "Photos and visual assets". Reads of fields we no longer ask for (room label, guest name format, weather units and location, the welcome line) were replaced with fixed representative values. The vestigial `depWarnings` was removed.
- **Downloads** now work outside claude.ai, via a `saveFile` helper (see section 4).
- **"Try sample answers"** moved behind `?demo=1`, and the page title is "Compendium Setup" rather than "Compendium Setup Draft".
- **Removed entirely:** brand fonts (Branding); video sound and order/timing/schedule (content panel); the casting choice (Apps & Casting); the category (Local Attractions).
- **The node-list pattern** was made consistent across Dining & Bars, In-room Dining and Resort Info (see the footnote under section 3). In-room Dining changed shape most: its single menu became a repeating list of menus. Resort Info's facility pages went from optional to at least one, and each page now chooses a content format instead of always being plain text. Every node in all three now requires a supporting photo.
- **"We'll ask you for"** on those three walkthrough cards is now hand-written and deliberately unspecific, through the new `need` override, instead of listing every sub-field.
- `KEY` was bumped to `compendium-setup-v3`, because In-room Dining's saved shape changed.

**Session 4 (14 Oct)**
- **The node-list pattern was simplified hard** and applied to all four list sections (see the footnote under section 3). Dining lost venue type, description, opening hours, location and booking method; In-room Dining lost its service hours, ordering extension and tray charge; Resort Info lost check-in/check-out, Wi-Fi, reception extension, emergency information and the property map. Each section is now one list of nodes, each node one content type plus a photo. Resort Info's dropped essentials are offered instead as suggested facility names (Wi-Fi, Check-in & check-out, Emergency information), so the customer can still cover them as pages.
- **Content types were unified** to Local Attractions' set: Website / PDF / Image / Plain text, replacing the three-way "PDF or image / Website link / Plain text".
- **Movies was removed entirely** from the catalogue and the walkthrough, which is now 14 parts.
- **Exclusive for You** keeps its walkthrough card but has no content section: the customer adds and manages their own offers once they are live.
- **Branding** gained a required **Home screen background image**, and "Photos and visual assets" became optional. The replica reads the background from that field, so what the customer uploads is what they see.
- **"Include" / "Leave off"** became **"Enable" / "Disable"** throughout the choose-features step.
- **Presented as a sample:** the title is "Compendium Sample Setup" and a non-interactive **SAMPLE** watermark (`.tvmark`, `z-index:40`) sits across the TV replica in every mode, including the step 2 mini preview.
- **"Preview the summary"** was removed from Review & send.

**Session 5 (14 Oct)**
- **Delivery was settled:** send the file, double-click, fill in, download, email back. JSZip inlined, storage failures surfaced honestly rather than hidden. See section 1a.
- **Resorts & Benefits** became the fifth node list. The "What would you like to feature?" chips and the separate program / benefits / sign-up / promotional-material fields are gone; a membership or promotion is now just a node with its own content.
- **Local Attractions** lost the address field and gained a required photo, making all five lists identical.
- **Step 1 was relaid out** to walkthrough | screen | feature list (section 2), with a sample disclaimer at the foot.
- **The watermark** became a single large rotated SAMPLE rather than a tiled grid, which was jarring over the UI.
- **Title** is now "Compendium Sample Content Setup".
- **Closed without change:** the walkthrough `sees` / `can` copy. It describes what each feature *can* do so the customer knows what is possible; it was never a promise about what we collect. Sessions 3 and 4 wrongly logged this as a defect.

---

## 6. Open questions for the product owner

**Closed in session 5.** Questions 1 to 5 of the previous list are withdrawn. They assumed the walkthrough `sees` / `can` copy was a promise about what we collect. It is not: it tells the customer what each feature *can* do, and what they actually put in it, and how they use it, is up to them. Treat that copy as correct and deliberate.

Still open:

1. **Required photos.** Every node in all five list sections requires a photo. A property with 4 venues, 2 menus, 8 facilities, 6 attractions and 3 group properties owes 23 photos before the pack reads 100%. Most likely cause of a stalled submission. Parked at your direction.

2. **Who's submitting.** A pack is identified only by the property name typed into Branding. Enough, or should we hand out per-customer copies that pre-fill it?

3. **`.html` email attachments.** Some corporate mail gateways strip or quarantine them. Worth a test send to a real hotel domain before the first customer, or send it inside a .zip.

4. **Save and resume.** From a local file, progress saving is best-effort and attached files usually do not survive closing the page. The tool now says so plainly. If customers are expected to fill this in over several sittings, hosting it at a URL is the fix.

5. **Resorts & Benefits scope.** It is now a flat list of "properties". A loyalty program or a brand promotion has to be added as a node with its own content. Confirm that reads sensibly to a customer, or rename the section.

6. **"Included as standard"** was left as-is when Include/Leave off became Enable/Disable, since it labels a standard feature rather than a toggle.

7. **In-room Dining as a list.** A property with one room service menu adds a single node. Acceptable, or rename to something like "Room Service Menus"?

---

## 7. Recommended next steps

**Before the first real customer**
- Run one internal "fake customer" pass end to end from a double-clicked copy of the file, not from a dev server, since that is how the customer will see it. Check the .zip against what the build team needs.
- Resolve open questions 1 to 3.
- Run one internal "fake customer" pass end to end, check the .zip contents against what the build team needs, and adjust the questions. The three node-list sections (Dining, In-room Dining, Resort Info) are the ones to watch, since they changed shape in session 3.

**Moving off claude.ai (the likely next phase in Claude Code)**
- Host the HTML on our own domain (for example `setup.<ourdomain>`) and replace the claude.ai download call (section 4).
- Replace download-and-email with a **Submit** that uploads the content and files straight to us: for example a small API that writes to S3, Google Drive or Dropbox and emails the team. Large videos are the main reason. Customers can paste links today, but direct upload with progress would be better.
- **Per-customer links** (for example `?p=racv-noosa`) to pre-fill the property name and tag submissions. Optionally save progress server-side so customers can switch devices.
- Consider splitting the single file into modules, with `FEATURES` as its own JSON or config so non-developers can edit questions.
- Add an internal view for the team to see each customer's submission status.

---

## 8. Working notes

- **Changing the shape of `FEATURES` keys:** old saved answers are harmless (unknown keys are ignored). But if the shape of the state `S` changes in an incompatible way, bump `KEY` (`compendium-setup-v2` → `v3`) so customers start fresh.
- **Copy style:** plain, direct Australian English, written from the customer's side ("We'll ask you for…", "Nothing. We set this up for you."). No time estimates anywhere.
- **Visual style:** a single deliberate dark theme (`--night`, `--deck`, jade `#6fd3a6` accent, sand `#e6c79c` for "required"). Display face Bricolage Grotesque, UI face Manrope, serif Cormorant Garamond (used only inside the TV replica, to mirror the real UI).
- **How it is tested:** three Node scripts in `test/`, no install needed. `verify-catalogue.js` asserts the catalogue is sound and the five node lists are identical; `verify-render.js` runs the whole page under `node:vm` against a stub DOM and inspects the HTML each step renders; `verify-zip.js` builds a real zip from the *inlined* JSZip and reads it back byte for byte. Run all three before shipping a change.
- **Previously (session 3):** two Node scripts, no install needed. One slices `FEATURES` and the progress functions out of the file and asserts the catalogue is sound (every `show.k` resolves to a real sibling, every format branch has a required field, `STOPS` covers every feature, `SAMPLE` matches the live field shapes). The other runs the whole script under `node:vm` against a stub DOM and inspects the HTML each step renders. A quick syntax check: extract the inline `<script>` and run `node --check`.
- **How it was tested before that:** Playwright with headless Chromium. The script loads the page, clicks through all 15 walkthrough parts, fills sample answers, opens each content section and the review, checks there are no JS errors, and checks there's no sideways scrolling at 390 px. A quick syntax check: extract the inline `<script>` and run `node --check`.
- **Responsive breakpoints:** 1060 px (panels stack), 860 px (content rail becomes a horizontal strip), 620 px (phone: header not sticky, TV preview pinned).

# Hebrew UI copy

Rules for apps in Hebrew (RTL). Yael's apps are the reference; the *practice* of writing the register rules down per app is the general rule, whatever the language.

## Registers, by string type

A hybrid of the classic Microsoft convention (masculine imperative commands) and the modern Google Israel microcopy convention (gender-neutral phrasing):

1. **Single-word commands: masculine imperative.** שמור, העתק, ערוך, מחק, טען מחדש, לחץ לעדכון. Fossilized UI vocabulary; reads as neutral.
2. **Labels, states, destinations: action nouns.** התחברות, יציאה, ביטול, אישור, פרסום, מחיקה, סיום.
3. **Sentences, placeholders, hints, empty states: gender-neutral.** Infinitive (לכתוב תבנית..., לנסות שוב), impersonal (אפשר לשחרר קבצים כאן, ההודעה שתישלח לקבוצה), or first-person plural (מתחילים, לוחצים על). Never a gendered imperative (לחצי / לחץ in a sentence) and never masculine singular future aimed at the user.

Eli reads it as: actions are masculine imperative, states are nouns. יציאה not התנתקות for sign-out.

## Punctuation and typography

- Hebrew comma `,` only. Watch for the Arabic comma `،` (U+060C) sneaking in from LLM output when joining names.
- Gershayim ״…״ when quoting OS UI labels (״הוסף למסך הבית״); OS strings are quoted verbatim even when gendered.
- Fonts: Heebo, self-hosted, hebrew + latin subsets only, variable weight declared `100 900`, `font-display: swap`. Serif looked wrong in an app.
- Dates: admin uses dd/mm/yyyy; the public app uses natural Hebrew dates via `Intl.DateTimeFormat('he-IL')` (14 באוגוסט). Relative: `Intl.RelativeTimeFormat('he', { numeric: 'auto' })`.

## Layout

- `<html lang="he" dir="rtl">` and `"dir": "rtl"` in the manifest.
- Progress bars, transport controls, timecodes, numeric sequences: `direction: ltr`.
- Logical properties everywhere (`inset-inline-start`, `margin-inline-start`, `border-inline-end`); `text-align: start`.
- Directional icons: the raw chevron `>` is already the "back" direction in RTL; flip with `scaleX(-1)` under `[dir='ltr']`.
- The drawer slides from the start edge (right).

## Copy voice

First person, the owner's voice ("אני מזמינה אתכם..."), not a brand's. Short. The install nudge, the empty states and the daily message all sound like the same person.

# Product — source of truth for WHAT & WHY

See architecture.md for how; specs/ for per-feature behaviour. Keep ≤100 lines.

## Thesis
AVA Reader (avareader.space) is a cross-platform reading app built around an integrated AI assistant that turns reading into an interactive process. 
Instead of passively moving through text, readers investigate meaning as they go — clarifying hard passages, exploring etymology,
translating, answering questions, and unpacking references without breaking focus. The AI is a contextual guide available at any moment.
At its core the app is a tool for **learning, and connecting to similar-minded people**.

## Audience
- **Curious readers** who want to read more deeply, study, and build a lasting reading habit, listen to books.
- **Language learners** who want to read exciting foreign books before they're fluent, at any level of language knowledge.
- **Authors** of novels and short stories who want to publish, find first readers, get feedback, and earn fairly.

## Values & principles
- We love great books and the people who read them.
- We want reading to be deeper, more studied, and more popular — and to help people build the habit.
- We want to make our readers better: help them grow, learn, and develop as they choose.
- We respect our users: **no dark patterns, no advertisement.** The product earns trust by creating value.

## Jobs to be done
- Read books of various formats across devices, online or fully offline.
- Understand hard passages in flow — explain, etymology, translate, ask questions — without leaving the page.
- Read foreign books via **parallel translation**: explore the original beside a translation and start learning the language while reading something exciting.
- **Listen**: high quality theatrical AI narration with different voices for characters. Full voice interaction — interrupt, ask questions, and control playback hands-free.
- Learn & retain vocabulary or concepts with **flashcards** and meaningful, customisable **reminders/notifications**.
- Track **progress** with precise estimates of time spent and time remaining. And more meaningfully — track your **knowledge graph** as you read new themes, and connect concepts.  
- Reflect in a **reading diary**: answer questions about a book and discuss it with AI and other users to think more deeply.
- Organize a personal **library**, **collections**, and share them with friends.
- **Share & connect**: publish lists, notes, insights, quotes, and reviews; connect and chat with readers of similar interests; control visibility per person (public/private/granular).
- **Publish your own writing**: reach first readers and admirers, talk with them, and earn the majority of revenue.

## North star
Depth of engagement per reader — investigations made, words learned, books finished, new people with similar interests found.

## Monetization
- **Freemium.** Core reading is free; advanced capabilities are paid tiers.
- **Bring your own key.** Users supply an OpenRouter or own model key and AI features are free to them; otherwise they top up app credits used for any AI work in the app.
- **Author economics.** When selling books, authors keep the large majority (target 80%+), not the ~20% legacy publishing leaves them. Long-term goal: connect authors and readers directly.
- **Discovery.** Landing + SEO optimised for AI search (answer engines and bots).

## No-list (deliberately not doing)
- No ads, no engagement-bait, no manipulative retention mechanics.
- No locking a reader's own data behind the network (offline-first is a promise).
- No selling attention or reader data.
- Not a general social network — social exists to deepen reading, not to maximise scrolling.

## Status — shipped
Reader (offline-capable), highlights, AI toolbox (translate/explain/etymology), AI comments, reading sessions + progress + stats, save-for-offline, library + collections, reading preferences, home dashboard, Clerk auth, feedback capture, catalog/admin (curation). See specs/.

## Roadmap — next
- **AI chat about a book** (the diary's discussion layer; UI scaffold exists).
- **Listening / TTS narration** with voice interaction (preferences UI scaffold exists).
- **Insights** page (reading analytics) and **Explore** (discovery/recommendations).
- BYO-key + credit accounting and billing.

## Roadmap — later
- **Flashcards** + spaced repetition and customisable learning reminders.
- **Parallel translation** reading mode (original ↔ translation).
- **Reading diary** as a first-class surface.
- **Social**: profiles (public/private/granular visibility), posts (insights, quotes), sharing lists/notes/reviews, add to friends + chat.
- **Author publishing**: upload, first-reader distribution, feedback loop, sales with creator-favourable revenue share.

## Open questions
- Credit pricing and the free/paid line per AI feature.
- Moderation and trust model for social + published works.
- Author payout mechanics and rights/licensing.

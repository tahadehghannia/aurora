# Aurora — تشریح کامل و تکه‌تکه‌ی پروژه

این نسخه، عمیق‌تر از خلاصه‌ی قبلی است: پروژه از زمان بررسی اول هم رشد کرده — یک فیچر بزرگ به نام «AI Mood Watchlists» و یک زیرساخت واقعی اتصال به مدل‌های هوش مصنوعی (Anthropic، OpenAI، Gemini، Groq، Mistral، DeepSeek) به آن اضافه شده. این سند کل پروژه را به بخش‌های مجزا تقسیم می‌کند و هر بخش را با جزئیات واقعی از خود کد (نه حدس) توضیح می‌دهد.

---

## نقشه‌ی کلی (جریان داده از بالا)

```
Providerهای محتوا (TMDB/TVmaze/iTunes/Spotify/Deezer/Mock)
        │  (فقط در seed)
        ▼
   PostgreSQL  ◄────────────► Prisma Client (src/generated/prisma)
        │
        ▼
 لایه‌ی محتوا (src/lib/content) → ContentCard یکسان برای همه‌چیز
        │
        ├──► موتور پیشنهاددهی (src/lib/recommendations)
        ├──► سیستم سلیقه/هویت (src/lib/taste)
        ├──► کشف بین‌رسانه‌ای (src/lib/crossmedia)
        └──► کشف بر اساس حس‌وحال (src/lib/mood) ──► لایه‌ی سرویس AI (src/lib/ai)
                                                              │
                                                    Anthropic/OpenAI/Gemini/Groq/…
        │
        ▼
   API Routes (src/app/api) — همیشه { data } یا { error }
        │
        ▼
   صفحات Server Component (src/app/(app), src/app/(auth))
        │
        ▼
   کامپوننت‌های React (src/components) + هوک‌های TanStack Query (src/hooks)
```

قانون طلایی معماری که در همه‌جای کد تکرار شده: **موتور Aurora همیشه بازیابی، رتبه‌بندی و تنوع را خودش انجام می‌دهد؛ مدل هوش مصنوعی فقط اجازه دارد از میان گزینه‌های واقعی که Aurora از قبل رتبه‌بندی کرده، یکی را انتخاب کند یا جمله‌ای درباره‌ی آن بنویسد.** مدل هرگز اجازه ندارد عنوانی اختراع کند یا آماری بسازد؛ هر خروجی مدل با Zod schema اعتبارسنجی می‌شود و اگر شکست بخورد یا id ناموجودی برگرداند، کل نتیجه‌ی AI دور ریخته می‌شود و مسیر قطعی (deterministic) جایگزینش می‌شود.

---

# بخش ۱ — زیرساخت و پیکربندی ریشه

| فایل | نقش دقیق |
|---|---|
| `package.json` | اسکریپت‌های اصلی: `dev`, `build`, `test` (Vitest)، `test:e2e` (Playwright)، `db:migrate`/`db:seed`/`db:seed:live`، و `ai:verify` که اسکریپت جدید بررسی کلید AI را اجرا می‌کند. |
| `next.config.ts` | تصاویر را از `picsum.photos`/`fastly.picsum.photos` بدون بهینه‌سازی سرور Next عبور می‌دهد (چون همه placeholder هستند). |
| `docker-compose.yml` | یک Postgres 16 محلی با کاربر/پسورد/دیتابیس `aurora`. |
| `.env` / `.env.example` | شامل `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, کلیدهای اختیاری Google/TMDB/Spotify، و حالا **`AI_API_KEY`** (+ `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL` برای override دستی گیت‌وی/مدل). |
| `vitest.config.ts` | تنظیم Vitest؛ به‌روزرسانی جدید یک stub برای `server-only` اضافه کرده (`src/test/server-only-stub.ts`) تا ماژول‌های `server-only` بدون خطا زیر Vitest اجرا شوند. |
| `playwright.config.ts` | تست E2E؛ اگر سروری روی 3000 نباشد خودش `npm run dev` را بالا می‌آورد. |
| `prisma.config.ts`, `components.json`, `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json` | پیکربندی‌های استاندارد ابزارها؛ بدون منطق کسب‌وکار. |
| `AGENTS.md` / `CLAUDE.md` | یادداشت خودکار Next.js درباره‌ی تغییرات breaking نسخه — برای دستیارهای AI، نه برای انسان. |
| `README.md` | مستندات رسمی پروژه (ویژگی‌ها، معماری، نحوه‌ی اجرا). |

---

# بخش ۲ — مدل داده (`prisma/schema.prisma`)

## گروه Auth (جداول استاندارد Auth.js)
`User`, `Account`, `Session`, `VerificationToken`. `User.passwordHash` برای ورود با ایمیل/رمز، و مدل شامل رابطه به تقریباً همه‌ی جدول‌های دیگر پروژه است (یک User واحد، مرکز همه‌چیز).

`Follow`: دنبال‌کردن بین کاربران — `followerId`/`followingId` با `@@unique` جفتی تا یک نفر دو بار دنبال نشود.

## پروفایل و سلیقه
- **`Profile`**: `username`, `bio`, `isPublic` (سوییچ اصلی) + چهار فلگ ریزتر حریم خصوصی (`showRatingsPublicly`, `showActivityPublicly`, `showCollectionsPublicly`, `showTasteDataPublicly`) که فقط وقتی `isPublic=true` معنا دارند. `tasteTraits: String[]` صفت‌های سلیقه‌ای مثل «Cinematic».
- **`UserPreference`**: `contentTypes`, `favoriteMoods`, `recommendationDiversity` (۰ تا ۱۰۰)، و چهار آرایه‌ی override صریح: `mutedGenres`, `mutedMoods`, `boostedMoods`, `mutedCreators` (با پیشوند `director:` یا `artist:`) — این‌ها روی سیگنال یادگرفته‌شده اعمال می‌شوند، نه جایگزینش.
- **`UserFeedback`**: لاگ append-only هر اصلاحی که کاربر روی پیشنهاد می‌زند (`LIKE`, `DISLIKE`, `MORE_LIKE_THIS`, `LESS_LIKE_THIS`, `NOT_FOR_ME`, `HIDE_CREATOR`, `MUTE_GENRE`, `MUTE_MOOD`, `USEFUL`). فیلد `undoneAt` باعث می‌شود رکورد هرگز حذف نشود — فقط نشانه‌گذاری می‌شود، تا هم قابل توضیح باشد («چرا این ژانر بی‌صدا شد؟») و هم قابل Undo.
- **`UserGenre`** / **`UserArtist`**: وزن‌های affinity مستقیم (از آنبوردینگ) برای ژانر و هنرمند.

## کاتالوگ محتوا
`Genre`, `Movie`, `TVShow`, `Episode` (زیرمجموعه‌ی TVShow با `@@unique([showId, season, episodeNumber])`), `Artist`, `Album`, `Song`. همه دارای `moods: String[]` (تگ‌های حس‌وحال آزاد) و `popularity`/`communityRating`/`ratingCount` برای رتبه‌بندی.

## فعالیت کاربر
`Rating`, `SavedItem`, `WatchHistory`, `ListeningHistory`, `UserContentInteraction` — همه **چندشکلی (polymorphic)** با enum `ContentType` (`MOVIE|TV_SHOW|EPISODE|ARTIST|ALBUM|SONG`) + `contentId`، به‌علاوه یک فیلد FK اختیاری مستقیم به هر مدل (برای cascade delete و یکپارچگی رفرنس). `Rating.score` نیم‌ستاره‌ای (۰٫۵ تا ۵) است.

## سازمان‌دهی
`Collection`/`CollectionItem`, `Playlist`/`PlaylistItem` — پلی‌لیست فقط برای آهنگ (`songId` مستقیم، نه چندشکلی).

## پیشنهاددهی و جست‌وجو
`Recommendation` (کش امتیازهای محاسبه‌شده، با enum `RecommendationSource: CONTENT_BASED|COLLABORATIVE|POPULARITY|HYBRID|EDITORIAL`)، `SearchHistory`.

## گروه جدید — زیرساخت هوش مصنوعی (اضافه‌شده در commit اخیر)
- **`AiArtifact`**: کش متن‌های تولیدشده توسط مدل برای Identity / DNA / Mood Profile / Taste Evolution. کلید یکتا `[userId, kind]` — یعنی هر کاربر برای هر نوع، فقط یک رکورد کش دارد. فیلدهای کلیدی: `payload` (JSON اعتبارسنجی‌شده)، `modelVersion`، `promptVersion`، `dataVersion` (اثرانگشت داده‌ی سلیقه، نه timestamp).
- **`AiExplanation`**: کش جمله‌ی «چرا این پیشنهاد» به ازای هر (`userId`, `contentType`, `contentId`) — چون این خیلی بیشتر از Identity/DNA درخواست می‌شود (هر بازدید صفحه‌ی جزئیات)، جدول جدا دارد تا سهمیه‌ی مشترک AI را با تکرار زیاد ته نکشد.
- **`MoodWatchlist`** / **`MoodWatchlistItem`**: لیست‌های «حس‌وحال» ذخیره‌شده. `parsedIntent: Json` نیت ساختاریافته‌ی درخواست کاربر را نگه می‌دارد تا لیست بعداً قابل بازتولید/پالایش باشد بدون نیاز به پارس مجدد جمله. `MoodWatchlistItem.reasonType` از enum `MoodReasonType` استفاده می‌کند.

سه مایگریشن جدید دقیقاً همین سه گروه جدول را اضافه کرده‌اند (`add_personalization_and_follows`, `add_profile_privacy_controls`, `add_user_feedback_log`) به‌علاوه یک مایگریشن مستقل برای زیرساخت AI.

---

# بخش ۳ — لایه‌ی احراز هویت (`src/lib/auth/`)

- **`auth.ts`**: پیکربندی Auth.js با استراتژی `jwt`. Provider اصلی `Credentials` است: ایمیل/رمز را با `loginSchema` (Zod) اعتبارسنجی می‌کند، کاربر را با `prisma.user.findUnique` پیدا می‌کند و رمز را با `bcrypt.compare` بررسی می‌کند. اگر `AUTH_GOOGLE_ID`/`SECRET` تنظیم شده باشند، Provider گوگل هم اضافه می‌شود. Callback های `jwt`/`session` مطمئن می‌شوند `session.user.id` همیشه پر باشد (چون NextAuth به‌طور پیش‌فرض این را نمی‌دهد).
- **`session.ts`**: دو تابع — `getCurrentUserId()` (برای API routeها، برمی‌گرداند `null` اگر لاگین نباشد) و `requireSession()` (برای Server Componentها، در صورت نبود سشن با `redirect("/login")` ریدایرکت می‌کند؛ حتی اگر layout هم قبلاً همین کار را کرده باشد، چون React ممکن است یک صفحه را قبل از تکمیل ریدایرکت رندر کند).

---

# بخش ۴ — لایه‌ی دیتابیس (`src/lib/db/prisma.ts`)

یک Singleton از `PrismaClient` با `@prisma/adapter-pg` (اتصال مستقیم به pg به‌جای اتصال پیش‌فرض Prisma). در حالت dev، نمونه روی `globalThis` کش می‌شود تا هر Hot Reload کانکشن جدید به Postgres باز نکند.

---

# بخش ۵ — لایه‌ی محتوا (`src/lib/content/`)

- **`queries.ts`**: کوئری‌های Prisma → `ContentCard` (شکل یکسان کارت محتوا در همه‌جای UI).
- **`mappers.ts`**: توابع خالص `movieToCard`, `showToCard`, `episodeToCard`, `artistToCard`, `albumToCard`, `songToCard` که رکورد Prisma را به `ContentCard` تبدیل می‌کنند (ژانرها را به آرایه‌ی نام تبدیل می‌کنند، `artistId`/`creator` را برای امتیازدهی affinity ست می‌کنند).
- **`rating-aggregate.ts`**: بعد از هر رتبه‌دهی، میانگین `communityRating` و `ratingCount` آیتم را بازمحاسبه می‌کند؛ یک `MODEL` map دارد که kind را به نام مدل Prisma می‌برد (مثلاً `tv_show → tVShow`).
- **`relation-key.ts`**: نگاشت kind به نام فیلد FK چندشکلی (`movieId`, `showId`, ...) — یک منبع حقیقت واحد که هم در recommendations و هم در API routeها استفاده می‌شود.
- **`user-state.ts`**: برای یک آیتم خاص می‌گوید کاربر آن را ذخیره کرده یا نه و چه امتیازی داده.
- **`providers/`**: لایه‌ی آداپتور — فقط در اسکریپت‌های seed اجرا می‌شود، نه در زمان درخواست کاربر:
  - `types.ts`: قرارداد مشترک (`MovieProvider`, `TvProvider`, `MusicProvider`) — هر Provider باید `isAvailable()` و `fetchX()` را با شکل خروجی یکسان (`SeedMovie`, `SeedShow`, ...) پیاده کند.
  - `mock.ts`: کاتالوگ فیلم ساختگی (fallback همیشگی).
  - `tmdb.ts`: فیلم واقعی، فعال می‌شود با `TMDB_API_KEY` (Bearer token نسخه v4).
  - `tvmaze.ts`: سریال واقعی، بدون کلید — Provider پیش‌فرض سریال.
  - `itunes.ts`: موسیقی واقعی، بدون کلید — پیش‌فرض موسیقی.
  - `spotify.ts`: موسیقی با Client Credentials flow (سرور-به-سرور، بدون لاگین کاربر) — وقتی کلید ست شود جایگزین iTunes می‌شود.
  - `deezer.ts`: جایگزین با عکس هنرمند واقعی و ژانر دقیق‌تر — وقتی هر دو موجود باشند، بر iTunes ارجحیت دارد.
  - `index.ts`: توابع `getMovieProvider()`/`getTvProvider()`/`getMusicProvider()` که بهترین Provider موجود را در لحظه‌ی seed انتخاب می‌کنند؛ بقیه‌ی کد هرگز مستقیم به یک Provider وابسته نیست.

---

# بخش ۶ — موتور پیشنهاددهی (`src/lib/recommendations/`)

این پرکاربردترین و پیچیده‌ترین لایه‌ی پروژه است. مراحل پایپ‌لاین دقیقاً این‌هاست:

### ۶.۱ `signals.ts` — ساخت «سیگنال سلیقه» (`TasteSignal`)
تابع `buildTasteSignal(userId)` (با `react.cache` برای جلوگیری از کوئری تکراری در یک درخواست) همه‌ی این‌ها را می‌خواند و در Mapهای وزن‌دار جمع می‌کند:
- **امتیازها** (`Rating`): وزن = `score - 2.5` (پس امتیاز پایین وزن منفی می‌دهد). امتیاز ≥۴ هم به `likedTitles` اضافه می‌شود.
- **ذخیره‌ها** (`SavedItem`): وزن ثابت ۱٫۵، همیشه به `likedTitles` اضافه می‌شود.
- **تاریخچه‌ی تماشا/گوش‌دادن** (`WatchHistory`/`ListeningHistory`، حداکثر ۲۰۰ ردیف اخیر): وزن سبک‌تر (۰٫۷۵ برای ژانر، ۰٫۴ برای مود) چون سیگنال ضمنی است.
- **«این پیشنهاد مفید بود»** (`USEFUL` interaction): مثل یک save سبک، وزن ۱.
- **«کمتر مثل این»** (`LESS_LIKE_THIS` فیدبک): یک منفی *نرم* — آیتم به `softDownranked` می‌رود (بعداً در hybrid.ts امتیازش نصف می‌شود، نه حذف)، و ژانر/مودش وزن منفی کوچک (`-0.35`/`-0.2`) می‌گیرد — خیلی ملایم‌تر از یک امتیاز ۱ ستاره.
- **موارد رد‌شده** (`DISMISS` interaction): مستقیم به `seen` می‌رود — یعنی از استخر کاندیدها کامل حذف می‌شود.
- در انتها، override های صریح کاربر (`mutedGenres`, `mutedMoods`, `boostedMoods`, `mutedCreators`) روی همه‌چیز اعمال می‌شوند و همیشه برنده‌اند، مهم نیست سیگنال رفتاری چقدر قوی باشد.
- علاوه بر `genreWeights`/`moodWeights`/`artistWeights`، این ماژول `directorWeights` (کارگردان/سازنده‌ی سریال) و `actorWeights` (بازیگر) هم می‌سازد، و یک نسخه‌ی «فقط ۱۴ روز اخیر» به نام `recentGenreWeights`/`recentMoodWeights` — تا جمله‌ی «اخیراً به سراغ ... رفته‌ای» یک ادعای واقعی و متمایز از سلیقه‌ی همه‌عمر باشد.

### ۶.۲ `contentBased.ts`
`scoreContentBased()` — جمع ساده‌ی وزن ژانر + (۰٫۶×وزن مود) + (۱٫۲×وزن هنرمند) + (۱٫۲×وزن کارگردان) برای یک کاندید.

### ۶.۳ `collaborative.ts` — فیلترینگ مشارکتی واقعی
`buildCollaborativeModel()` همه‌ی امتیازهای **همه‌ی کاربران** را می‌خواند و برای هر آیتم، نگاشت «کاربر→امتیاز» می‌سازد. `scoreCollaborative()` شباهت کسینوسی بین بردار امتیازدهندگان دو آیتم را حساب می‌کند (`coRaterSimilarity`) و بر اساس آن پیش‌بینی می‌کند. یک آیتم باید حداقل ۳ رأی‌دهنده داشته باشد (`minRatersForSignal`) وگرنه امتیازش صفر می‌ماند — با دیتابیس seed کوچک فعلی، این تقریباً همیشه صفر است، اما معماری واقعی و تست‌شده است.

### ۶.۴ `popularity.ts`
`scorePopularity()` = `popularity/100 + 0.5×recencyBoost`، جایی که `recencyBoost` هرچه فیلم/آلبوم جدیدتر باشد بیشتر است (کاهش ۰٫۰۸ به‌ازای هر سال فاصله از سال جاری).

### ۶.۵ `hybrid.ts` — ترکیب نهایی
`rankCandidates()` سه امتیاز بالا را با وزن‌های پویا ترکیب می‌کند:
- اگر سیگنال سلیقه‌ای نباشد → وزن content-based صفر (فقط محبوبیت).
- اگر باشد → `contentWeight = (hasCollaborative ? 0.55 : 0.75) × stageMultiplier` که `stageMultiplier` از «مرحله‌ی بلوغ» کاربر می‌آید (بخش ۶.۷).
- `collaborativeWeight` فقط وقتی کاربر حداقل یک امتیاز داده باشد فعال می‌شود (۰٫۲).
- بقیه به popularity می‌رود (ضرب در ۴ برای هم‌مقیاس‌شدن با بقیه).
- آیتم‌های `softDownranked` («کمتر مثل این») در همین مرحله امتیازشان ۵۰٪ کاهش می‌یابد (نه صفر).

### ۶.۶ `diversify.ts` — تنوع‌بخشی
کاندیدهای رتبه‌بندی‌شده را به سه لایه تقسیم می‌کند: «تناسب قوی» (~۷۰٪)، «مجاور» (~۲۰٪)، «اکتشاف» (~۱۰٪) — بر اساس `contentScore` خام (پیش از ترکیب). یک سقف روی هر ژانر اصلی می‌گذارد (پیش‌فرض ~۴۰٪ از حد نهایی) تا مثلاً یک طرفدار Sci-Fi ده پیشنهاد تقریباً یکسان نگیرد. اگر یک لایه کم بود، سهمیه به لایه‌ی بعد سرریز می‌شود؛ در بدترین حالت، محدودیت ژانر هم نادیده گرفته می‌شود تا لیست کامل شود (بهتر از لیست ناقص).

### ۶.۷ `maturity.ts` — «مرحله‌ی بلوغ» کاربر (۱ تا ۵)
بر اساس تعداد امتیاز+ذخیره+رفتار ضمنی، کاربر را در یکی از ۵ مرحله می‌گذارد (از «فقط آنبوردینگ» تا «Hybrid کامل با داده‌ی کافی»). این عدد فقط برای وزن‌دهی داخلی استفاده می‌شود، هرگز به کاربر به‌عنوان «امتیاز اطمینان» نشان داده نمی‌شود.

### ۶.۸ `reasons.ts` — منبع واحد حقیقت برای «چرا این؟»
`buildRecommendationReasons()` تابعی است که همه‌ی جاهای دیگر (rails خانه، صفحه‌ی جزئیات، One Perfect Pick) از آن استفاده می‌کنند. اولویت‌بندی دقیق:
1. امتیاز واقعی ≥۴ روی عنوانی با ژانر/هنرمند/کارگردان مشترک («چون به X امتیاز ۴٫۵ دادی»)
2. اگر امتیازی نبود، یک save مرتبط
3. ترجیح ژانر/مود قوی (با آستانه‌های `weightConfidence`: ≥۴ = high، ≥۱٫۵ = medium)
4. affinity کارگردان/هنرمند
5. رفتار «۱۴ روز اخیر» به‌طور خاص
6. سیگنال اجتماعی (collaborative، وقتی رأی‌دهنده کافی باشد)
7. fallback صادقانه‌ی اکتشاف/محبوبیت (وقتی هیچ‌کدام بالا صدق نکند)
هر دلیل `confidence`, `priority`, و در صورت وجود `discoveryHref` (لینک به Discover/Search) دارد. `explanation.ts` این را به رشته‌ی ساده (برای متن پیشنهاد) و چک‌لیست (برای «چرا این؟» باز‌شونده) تبدیل می‌کند.

### ۶.۹ `why-this.ts` و `explain-ai.ts` — لایه‌ی هوش مصنوعی روی توضیح‌ها
`whyRecommended()` نسخه‌ی قطعی (بدون AI) را می‌سازد. `whyRecommendedWithAi()` همان دلایل ساختاریافته را به `explainRecommendation()` در `explain-ai.ts` می‌دهد که یک مدل زبانی را برای **فقط بازنویسی خط اول** صدا می‌زند — چک‌لیست زیرین همیشه متن اصلی Aurora می‌ماند، هرگز نوشته‌ی مدل نیست. `explain-ai.ts`:
- جمله را در جدول `AiExplanation` به ازای هر (کاربر، آیتم) کش می‌کند تا بازدید مکرر صفحه‌ی جزئیات هزینه‌ی AI نداشته باشد.
- خروجی مدل را با regex ساده‌ای به نام `OVERCLAIM` فیلتر می‌کند (کلماتی مثل «you love»، «obsessed»، «favourite ever») — اگر مدل بیش‌ازحد ادعا کند، خروجی رد می‌شود.

### ۶.۱۰ `index.ts` — نقطه‌ی ورود اصلی
`getRecommendationsForUser()`: سیگنال + مدل collaborative + کلید امتیازهای کاربر + مرحله‌ی بلوغ را موازی می‌گیرد → استخر کاندید (فیلم/سریال/آلبوم، حداکثر ۲۰۰ تای هرکدام، منهای موارد دیده‌شده و خالق‌های بی‌صداشده) → `rankCandidates` → `diversify` → برای هرکدام دلیل می‌سازد → **best-effort** نتیجه را در جدول `Recommendation` کش می‌کند (اگر نوشتن شکست بخورد، مهم نیست، چون به caller برگردانده شده). توابع دیگر همین فایل:
- `getBecauseYouLiked()`: بر اساس بالاترین امتیاز کاربر، یک rail «چون X را دوست داشتی» می‌سازد.
- `getOutsideUsualTaste()`: کاندیدهایی که `contentScore ≤ 0` ولی محبوبیت ≥۴۰ دارند — یک rail جدا برای اکتشاف.
- `getExploreBeyond()`: از صفحه‌ی جزئیات، همان مود ولی **ژانر متفاوت** از آیتم فعلی را پیشنهاد می‌دهد (متمایز از «بیشتر شبیه این» که هم‌ژانر است).
- `getSimilarTo()`: rail «مشابه X» برای فیلم/سریال/آلبوم؛ برای آلبوم، اول «بقیه‌ی کارهای همین هنرمند» را می‌آورد، بعد آلبوم‌های هم‌ژانر از هنرمندان دیگر.
- `persistRecommendations()`: نوشتن دسته‌ای (`$transaction`) در جدول کش.

### ۶.۱۱ `one-pick.ts` و `one-pick-select.ts` — «یک پیشنهاد کامل»
به‌جای دیوار گزینه‌ها، فقط **یک** پیشنهاد نشان می‌دهد — دقیقاً همان پایپ‌لاین کامل (نه یک میان‌بر ساده‌شده) را اجرا می‌کند تا هرگز صرفاً «محبوب‌ترین چیز» نباشد. «امتحان یکی دیگر» یک reroll تصادفی نیست: `selectNextPick()` تلاش می‌کند اولین کاندید در یک **ژانر اصلی متفاوت** از موارد قبلاً نشان‌داده‌شده را بردارد. یک مدل AI هم می‌تواند از میان ۱۲ گزینه‌ی برتر یکی را با دلیل خودش انتخاب کند (`pickOneWithAi` در `explain-ai.ts`) — ولی id بیرون از این ۱۲تا رد می‌شود.

### ۶.۱۲ `maturity.ts`, `traits.ts`, `diversify.ts`
از قبل توضیح داده شد. `traits.ts` یک نگاشت ثابت ژانر→صفت (مثلاً Sci-Fi → «سینمایی، تخیلی») برای صفحه‌ی آنبوردینگ دارد.

---

# بخش ۷ — سیستم سلیقه/هویت (`src/lib/taste/`)

هرکدام از این فایل‌ها یک واقعیت *قابل‌شمارش* از دیتابیس محاسبه می‌کنند، نه چیز شبیه‌سازی‌شده:

| فایل | کاری که می‌کند |
|---|---|
| `dna.ts` | «DNA سرگرمی»: ژانر/مود/هنرمند/کارگردان/بازیگر محبوب با سطح اطمینان (strong/emerging/exploring بر اساس آستانه‌ی وزن). حالا AI هم یک خلاصه (`narrative.summary`) و صفت‌های مبتنی‌بر‌شواهد (`aiTraits`) به آن اضافه می‌کند (بخش ۹). |
| `identity.ts` + `identity-model.ts` + `identity-types.ts` | آرکی‌تایپ هویت سلیقه‌ای. `identity-model.ts` منطق تطبیق را در فایلی **بدون** `server-only` نگه می‌دارد تا مستقیماً قابل تست باشد (`identity-model.test.ts`). زیر آستانه‌ی `MIN_SIGNALS=8`، به‌جای اختراع، حالت «در حال شکل‌گیری» برمی‌گردد. |
| `spectrums.ts` | طیف‌های سلیقه (`reach`, `breadth`, `tone`, `pace`) — نقطه روی یک خط، نه امتیاز؛ زیر `MIN_SAMPLE=6` نمایش داده نمی‌شود. |
| `evolution.ts` | روند تغییر ژانر برتر در بازه‌های زمانی؛ زیر ۲ دوره، `available=false`. حالا AI یک جمله‌ی «جهت تغییر» (`shift`) هم اضافه می‌کند. |
| `insights.ts` | تغییرات محسوس اخیر (سهم ژانر که حداقل ۱۵٪ جابه‌جا شده). |
| `habits.ts` | عادت‌های واقعی («به یک خالق برمی‌گردد» با آستانه‌ی `DEEP_DIVE_THRESHOLD=3`، «سریال را کامل می‌بیند») — زیر `MIN_ACTIVITY=8` چیزی گفته نمی‌شود. |
| `favorites.ts`, `journal.ts`, `milestones.ts`, `ratings-distribution.ts`, `stats.ts` | محبوب‌ترین‌ها، فید زمانی فعالیت، نقاط عطف واقعی (مثل «۱۰۰امین امتیاز» با تاریخ واقعی)، هیستوگرام امتیاز، آمار کلی. |
| `mood-profile.ts` | چه حس‌وحال‌هایی در کتابخانه‌ی کاربر بیشتر دیده می‌شود؛ حالا با خلاصه‌ی AI که *هرگز* حال احساسی کاربر را توصیف نمی‌کند، فقط موضوع محتوا را. |
| `surprise.ts`, `discoveries.ts` | «غافلگیرم کن» (خارج از قوی‌ترین ژانر ولی مرتبط) و «کشف‌های اخیر» (خارج از ۳ ژانر برتر تاریخی). |
| `taste-match.ts`, `friends-activity.ts` | مقایسه‌ی سلیقه با کاربران دیگر، فید فعالیت دنبال‌شده‌ها. |
| `covers.ts` | موزاییک کاور واقعی برای مجموعه‌ها/پلی‌لیست‌ها. |
| `feedback.ts` | هسته‌ی سیستم فیدبک: ثبت/Undo «نه برای من»، «کمتر مثل این»، بی‌صداکردن ژانر/مود/خالق، ریست پرسونالیزیشن — همه در `UserFeedback` به‌صورت append-only. |
| `identity-ai.ts`, `narrative-ai.ts`, `narrative-types.ts` | لایه‌ی نوشتار AI روی این داده‌ها — بخش ۹. |

---

# بخش ۸ — زیرساخت هوش مصنوعی (`src/lib/ai/`) — فیچر تازه و محوری

این لایه‌ی عمومی است که همه‌ی فیچرهای AI پروژه (توضیح پیشنهاد، هویت، DNA، mood profile، evolution، پلی‌لیست، واچ‌لیست حس‌وحال) روی آن سوار می‌شوند.

### ۸.۱ `provider/types.ts` — قرارداد مشترک
یک اینترفیس بسیار کوچک: `AiProvider.complete({system, user, maxTokens, json, timeoutMs}) → {text, usage}`. هیچ SDK بیرونی وارد نمی‌شود؛ هر Provider فقط یک `fetch` خام به API HTTP همان سرویس است — یعنی وابستگی صفر و شفافیت کامل. کلاس خطای `AiProviderError` وضعیت HTTP و قابل‌تلاش‌مجدد‌بودن (`retryable`) را حمل می‌کند؛ `isRetryableStatus` می‌گوید ۴۲۹/۴۰۸/۵xx قابل retry هستند.

### ۸.۲ `provider/index.ts` — تشخیص و ساخت Provider
تابع `getAiProvider()`: کلید `AI_API_KEY` را می‌خواند، و بر اساس **پیشوند کلید** (یا override صریح `AI_PROVIDER`) provider درست را می‌سازد:
- `sk-ant-` → Anthropic (پیش‌فرض مدل: `claude-sonnet-5`)
- `sk-proj-`/`sk-` → OpenAI (`gpt-4o-mini`)
- `AIza` → Google Gemini (`gemini-2.5-flash`)
- `gsk_` → Groq (`openai/gpt-oss-20b`) — این Provider فعلاً واقعاً پیکربندی‌شده در محیط پروژه
- Mistral/DeepSeek بدون پیشوند خاص (باید با `AI_PROVIDER` صریح انتخاب شوند)
سه پیاده‌سازی HTTP واقعی دارد: `anthropic()` (Messages API)، `openAiCompatible()` (یک تابع مشترک برای OpenAI/Groq/DeepSeek/Mistral چون همه از شکل Chat Completions استفاده می‌کنند)، و `gemini()` (generateContent، با auth در header نه در URL — تا کلید هرگز در query string لو نرود). اگر پیشوند کلید با هیچ‌کدام جور نشود، **حدس نمی‌زند** — `null` برمی‌گرداند، چون فرستادن کلید به vendor اشتباه یک نشت واقعی است.

### ۸.۳ `service.ts` — هسته‌ی «Aurora AI Service»
تابع `generateStructured<T>()` تنها راهی است که بقیه‌ی کد با AI حرف می‌زند. **هرگز throw نمی‌کند** — همیشه یک `AiOutcome<T>` برمی‌گرداند (`{ok:true, data}` یا `{ok:false, reason}`). ویژگی‌های کلیدی:
- `extractJson()`: چون مدل‌ها گاهی JSON را داخل ```json فِنس یا متن اضافه می‌پیچند، این تابع با شمارش دقیق آکولاد (رشته‌آگاه، escape-آگاه) اولین آبجکت متوازن را بیرون می‌کشد.
- حداکثر ۲ تلاش: یک retry برای خطای گذرا (۴۲۹/۵xx/timeout)، یک retry برای خروجی نامعتبر. خطای auth (۴۰۱/۴۰۳) هرگز retry نمی‌شود.
- **Circuit breaker**: اگر ۴۲۹ بگیرد، به مدت ۲۰ ثانیه (`COOLDOWN_MS`) کاملاً از تلاش دوباره خودداری می‌کند (`isRateLimitCooldown`) — چون سهمیه‌ی رایگان بین همه‌ی فیچرهای AI مشترک است.
- هر تماس را با `recordAiCall()` (تله‌متری) ثبت می‌کند.
- `AI_FAILURE_COPY`: متن کاربرپسند برای هر دلیل شکست — هرگز نام Provider یا کد HTTP را افشا نمی‌کند.

### ۸.۴ `cache.ts` — کش و نسخه‌بندی محصولات AI
- `buildDataVersion()`: اثرانگشتی از تعداد امتیاز/ذخیره/تماشا/گوش کاربر، ولی **bucketبندی‌شده** (تقسیم بر ۵) — یعنی رفتن از ۳۱ به ۳۲ آیتم امتیازدهی‌شده کش را باطل نمی‌کند، اما یک جهش واقعی در حجم فعالیت («یک session کامل») باطل می‌کند.
- `readArtifact()`/`writeArtifact()`: خواندن/نوشتن در جدول `AiArtifact`؛ کش فقط وقتی معتبر است که `dataVersion` و `promptVersion` هر دو مطابقت داشته باشند و سن آن از ۷ روز (`MAX_AGE_MS`) کمتر باشد.
- `invalidateArtifact()`: حذف کش — پایه‌ی دکمه‌ی «بازتولید».
- `dedupe()`: اگر دو کامپوننت هم‌زمان همان artifact را بخواهند، فقط یک تماس واقعی به مدل می‌رود (Map از `Promise`های در حال اجرا).

### ۸.۵ `telemetry.ts`
`recordAiCall()` فقط چیزهایی را لاگ می‌کند که برای عیب‌یابی لازم است: task، provider، model، latency، توکن‌ها، تعداد تلاش. **هرگز** کلید، متن پرامپت کاربر، شواهد سلیقه یا متن تولیدشده را لاگ نمی‌کند — چون یک لاگ نباید کپی دومی از داده‌ی کاربر بشود.

### ۸.۶ `prompts/index.ts` — رجیستری پرامپت‌های نسخه‌بندی‌شده
یک `SHARED_RULES` مشترک بین همه‌ی پرامپت‌ها (قوانین سخت‌گیرانه: فقط از شواهد داده‌شده استفاده کن، هرگز درباره‌ی سلامت روان/سیاست/مذهب/... حرف نزن، متن ورودی کاربر را داده بدان نه دستور، مستقیم با «شما» خطاب کن نه سوم‌شخص). هر تسک (`IDENTITY_PROMPT`, `DNA_PROMPT`, `MOOD_PROFILE_PROMPT`, `EVOLUTION_PROMPT`, `WHY_THIS_PROMPT`, `ONE_PICK_PROMPT`, `PLAYLIST_PROMPT`) یک `version` جدا دارد که با هر تغییر رفتاری، افزایش می‌یابد تا هر artifact کش‌شده قابل ردیابی به همان نسخه بماند.

### ۸.۷ `enhance.ts` — الگوی مشترک artifact های کش‌شده‌ی per-user
تابع `enhance()` مسیر واحدی است که همه‌ی artifact های Identity/DNA/MoodProfile/Evolution از آن رد می‌شوند: **خواندن کش → دی‌دوپ همزمان → تولید → اعتبارسنجی → ذخیره**. هر شکستی در هر مرحله، `null` برمی‌گرداند و caller مسیر قطعی (deterministic) را نگه می‌دارد. `evidenceBlock()` یک فرمت یکنواخت برای نوشتن «شواهد» به مدل می‌سازد — طوری که همیشه در بازبینی روشن است چه چیزی دقیقاً به مدل داده می‌شود (و چه چیزی داده نمی‌شود — هرگز ردیف خام یا فیلد پروفایل خام).

### ۸.۸ `src/lib/api/rate-limit.ts`
یک rate-limiter ساده‌ی in-process (fixed window، در حافظه، نه Redis) — برای endpoint هایی که پرهزینه‌اند (fan-out به کوئری بزرگ یا تماس AI). محدودیت این است که این per-instance است؛ در استقرار چند-instance باید به Redis منتقل شود (خودِ کد این را صادقانه اعلام می‌کند).

---

# بخش ۹ — لایه‌ی AI روی سیستم سلیقه (`identity-ai.ts`, `narrative-ai.ts`, `explain-ai.ts`, `playlist-ai.ts`)

اصل مشترک همه: **مدل هرگز چیزی را تعیین نمی‌کند، فقط آن را به کلمات درمی‌آورد.**

- **`identity-ai.ts`**: آرکی‌تایپ را Aurora از قبل با ریاضیات روی طیف‌های اندازه‌گیری‌شده تعیین کرده؛ مدل فقط توصیف (`description`)، صفت‌ها (`traits`)، و صفت‌های نوظهور (`emergingTraits`) را می‌نویسد. یک گارد امنیتی/حریم‌خصوصی جدی دارد: `isSafeIdentityCopy()` با دو regex — یکی برای عباراتی مثل «you are a...»/«your personality» (که تبدیل توصیف سلیقه به ادعای شخصیتی است) و یکی برای ریشه‌های حساس (`psycholog`, `depress`, `anxious`, `trauma`, `suicid`, ...) — اگر هرکدام در خروجی مدل باشد، **کل خروجی دور ریخته می‌شود**، حتی اگر از کش خوانده شده باشد (چون قانون ممکن است بعد از ذخیره‌شدن کش سخت‌گیرتر شده باشد).
- **`narrative-ai.ts`**: همین الگو برای DNA (`generateDnaCopy` + `keepGroundedTraits` که هر صفتی را که شواهدش با چیزی که واقعاً به مدل داده شده مطابقت نداشته باشد حذف می‌کند)، Mood Profile (`generateMoodProfileCopy` + گارد `isSafeMoodCopy` که مانع می‌شود مود محتوا با احساس واقعی کاربر اشتباه گرفته شود — مثلاً رد می‌کند «you feel»/«your emotional state»/«depress»/«anxious»/«lonely»)، و Taste Evolution (`generateEvolutionCopy`، فقط با حداقل ۲ دوره‌ی قابل‌مقایسه).
- **`explain-ai.ts`**: (در `lib/recommendations/`) دو کاربرد — جمله‌ی «چرا این» برای یک پیشنهاد (کش‌شده در `AiExplanation`، با گارد `isGroundedExplanation` که عباراتی مثل «you love»/«obsessed»/«favourite ever» را رد می‌کند)، و انتخاب «یک پیشنهاد کامل» از میان یک لیست کوتاه (id بیرون از لیست قبول نمی‌شود).
- **`playlist-ai.ts`**: مدل فقط از میان آهنگ‌های واقعی داده‌شده انتخاب/ترتیب/توضیح می‌دهد؛ اگر بیش از نیمی از idهای برگشتی جعلی باشند، کل پاسخ دور ریخته می‌شود (چون یعنی بقیه‌اش هم غیرقابل‌اعتماد است).

---

# بخش ۱۰ — کشف بر اساس حس‌وحال / AI Mood Watchlists (`src/lib/mood/`) — بزرگ‌ترین فیچر جدید

فلسفه‌ی طراحی در یک جمله: «حس‌وحال» یک تگ کاتالوگ نیست. کاتالوگ Aurora فقط روی یک عنوان تگ «Calm» دارد، اما «امشب یک چیز آرام می‌خوام» دقیقاً همان درخواستی است که این فیچر باید جوابش را بدهد — پس یک حس به یک **مفهوم** (خوشه‌ای از چند تگ واقعی + گرایش ژانری) نگاشت می‌شود، نه یک تگ تنها.

### ۱۰.۱ `vocabulary.ts` — واژگان بسته
`CATALOG_MOODS`: ۱۵ تگ واقعی موجود در کاتالوگ. `MOOD_CONCEPTS`: حدود ۱۶ مفهوم (calm, comforting, uplifting, funny, dark, tense, scary, sad, emotional, romantic, thoughtful, atmospheric, dreamy, energetic, epic, nostalgic) که هرکدام synonyms، مودهای متناظر، ژانرهای مرتبط، و `avoidGenres` (ژانرهایی که آن حس را می‌شکنند، مثلاً calm همیشه Horror/Action را رد می‌کند) دارند. `AUDIENCE_RULES`: قوانین برای «تنها»/«دوستان»/«پارتنر»/«خانواده» — «خانواده» تنها موردی است که یک محدودیت *سخت* (رد قطعی Horror) تحمیل می‌کند، بقیه فقط گرایش‌اند.

### ۱۰.۲ `intent.ts` — استخراج نیت ساختاریافته
`moodIntentSchema` (Zod) قرارداد بین «چیزی که کاربر گفت» و «چیزی که Aurora کوئری می‌زند» است. `parseMoodIntent()` نسخه‌ی **قطعی بدون AI** است (مسیری که وقتی هیچ Provider تنظیم نشده اجرا می‌شود، نه یک fallback ضعیف):
- `splitExclusions()`: جمله را با marker هایی مثل «but not», «without», «nothing too», «not» به دو تکه‌ی include/exclude می‌شکند.
- `extractRuntime()`: از عباراتی مثل «90 minutes», «under 2 hours», «an hour and a half» زمان را استخراج می‌کند (چند regex به ترتیب خاص‌به‌عام).
- `extractAudience()`, `extractRecency()`, `extractContentTypes()`, `extractSimilarTo()` (برای «شبیه Interstellar»).
- یک قانون ظریف: اگر یک مود هم در include و هم در exclude مشترک باشد (مثلاً «emotional but not depressing» که هر دو Emotion-focused دارند)، آن exclude نادیده گرفته می‌شود تا درخواست اصلی خنثی نشود.
`sanitizeIntent()`: هر چیزی که مدل AI پیشنهاد دهد را دوباره در برابر واژگان واقعی صافی می‌کند — مدل هرگز مرجع نیست، فقط پیشنهاددهنده.

### ۱۰.۳ `candidates.ts` — بازیابی کاندید
`getCandidatePool()` از **۹ منبع مستقل** موازی کوئری می‌زند (mood, genre, taste, creator, popular, hidden_gem برای فیلم؛ mood, genre, popular برای سریال) و نتایج را با idهای مشترک ادغام می‌کند (اگر یک آیتم از چند منبع بیاید، `sources` آن چند تایی می‌شود و بعداً امتیاز «تأیید متقابل» می‌گیرد). محدودیت‌های سخت (ژانر/مود مستثنی‌شده، سقف زمان اجرا، تازگی) مستقیم در کوئری Prisma اعمال می‌شوند، نه در رتبه‌بندی — یعنی یک استثنا هرگز نمی‌تواند سر برآورد. اگر کاربر سقف زمانی گفته باشد، سریال‌ها اصلاً کاندید نمی‌شوند (یک قسمت نمی‌تواند «۹۰ دقیقه وقت دارم» را جواب دهد). «hidden gem» یعنی امتیاز جامعه ≥۷ ولی محبوبیت <۴۰ — تا لیست فقط پرمخاطب‌ها نباشد. `resolveSimilarTo()` عنوان ارجاع‌شده («شبیه Interstellar») را در دیتابیس واقعی پیدا می‌کند تا شباهت از روی متادیتای واقعی محاسبه شود، نه حافظه‌ی مدل از آن فیلم.

### ۱۰.۴ `rank.ts` — رتبه‌بندی خالص (بدون دیتابیس، کاملاً قابل‌تست)
`scoreCandidate()` هر کاندید را روی چند مؤلفه امتیاز می‌دهد: تطابق مود درخواستی (۹ به‌ازای هرکدام)، تطابق ژانر درخواستی (۶)، تطابق با عنوان مرجع «شبیه X»، سلیقه‌ی تاریخی کاربر (وزن‌دهی‌شده با `EXPLORATION_WEIGHTS` — نزدیک‌به‌سلیقه/متعادل/غافلگیرکننده)، رفتار اخیر، affinity کارگردان، تناسب مخاطب، تناسب زمان اجرا (با جریمه اگر زمان اجرا نامعلوم باشد ولی سقف تعیین شده)، کیفیت (امتیاز جامعه)، تأیید متقابل (چند منبع)، نوظگی (برای حالت surprise). سپس دقیقاً «مؤلفه‌ای که واقعاً برنده شده» را به دلیل متنی تبدیل می‌کند — نه زیباترین دلیل، بلکه صادق‌ترین. `diversify()` سقف حداکثر ۳ آیتم به‌ازای هر ژانر اصلی می‌گذارد. `diversifyReasons()` تنوع در **جمله‌بندی** ایجاد می‌کند — اگر یک دلیل قبلاً استفاده شده، از جایگزین‌های واقعی همان آیتم (که در `alternatives` ذخیره شده‌اند) استفاده می‌کند، هرگز دلیل جدید اختراع نمی‌کند.

### ۱۰.۵ `compose.ts` — نوشتار Aurora (کف کیفیت، حتی بدون AI)
`composeTitle()`: عنوان‌های سردستی مثل «Quiet Things to Watch»، «After Hours»، انتخاب قطعی بر اساس (مفهوم، seed). `composeDescription()`: یک جمله که فقط ژانرهای *واقعاً موجود در لیست نهایی* را نام می‌برد (نه ژانرهایی که فقط در جست‌وجو دخیل بودند). `personalizationLevel()`: صادقانه می‌گوید لیست چقدر واقعاً بر اساس سلیقه است (`strong`/`aligned`/`exploratory`/`general`) — بر اساس نسبت واقعی آیتم‌هایی که `tasteBacked` بودند، نه یک ادعای ثابت. `composeWhyThisList()`: جمله‌ی سطح-لیست که فقط چیزهایی را که کاربر واقعاً گفته («As you asked»load) به او نسبت می‌دهد؛ استثناهایی که خودِ Aurora به‌صورت داخلی اعمال کرده (نه کاربر) هرگز به‌عنوان خواسته‌ی کاربر گزارش نمی‌شوند.

### ۱۰.۶ `generate.ts` — ارکستراسیون کامل پایپ‌لاین
`generateMoodWatchlist()`: پارس قطعی همیشه اجرا می‌شود (چون کلیدهای مفهوم را برای عنوان‌گذاری تأمین می‌کند و fallback همیشگی است) → اگر AI پیکربندی شده باشد، تلاش برای تفسیر AI (`interpretMoodWithAi`) → اعمال کنترل‌های صریح UI (که همیشه بر استنتاج متن غالب‌اند) → اگر نیت خالی بود ولی کاربر سلیقه دارد، به‌جای لیست خالی از سلیقه‌اش استفاده می‌کند → بازیابی کاندید → رتبه‌بندی → تنوع → اگر AI پیکربندی شده، تلاش برای «کیوریشن» AI (`curateWithAi`) که می‌تواند عنوان/توضیح/ترتیب نهایی را عوض کند، ولی فقط از میان idهای مجاز. خروجی شیء `GeneratedMoodWatchlist` شامل فیلد شفاف `ai: {interpreted, curated, configured, note}` است — تا UI هرگز ادعای مشارکت AI نکند که واقعاً رخ نداده.
`pickReplacementItem()`: برای عوض‌کردن یک آیتم، کل پایپ‌لاین بازیابی+رتبه‌بندی را دوباره اجرا می‌کند ولی فقط بهترین باقی‌مانده را برمی‌گرداند — بدون تماس AI، بدون به‌هم‌ریختن بقیه‌ی لیست.

### ۱۰.۷ `ai.ts` — دو نقطه‌ی مجاز تماس مدل در این فیچر
`interpretMoodWithAi()` (نیت را از جمله می‌خواند، خروجی بلافاصله با `sanitizeIntent` صافی می‌شود) و `curateWithAi()` (انتخاب/توضیح نهایی از میان shortlist رتبه‌بندی‌شده — اگر کمتر از نصف idهای برگشتی معتبر باشند یا کمتر از حداقل لازم، کل پاسخ رد می‌شود).

### ۱۰.۸ `refine.ts` — پالایش
هیچ پالایشی مستقیماً لیست را ویرایش نمی‌کند؛ همه چیز یک درخواست جدید تولید می‌کند که از همان پایپ‌لاین کامل رد می‌شود. `REFINEMENT_PRESETS` (more_taste, more_unexpected, darker, lighter, more_emotional, less_emotional, shorter, newer) هرکدام یا `exploration` را عوض می‌کنند یا متن prompt را با یک عبارت جدید گسترش می‌دهند (`extend()`). `applyFreeformRefinement()` برای متن آزاد («make it more atmospheric»).

### ۱۰.۹ `store.ts` — ماندگاری
CRUD کامل روی `MoodWatchlist`/`MoodWatchlistItem`: ذخیره (با نیت ساختاریافته کنار متن)، بازخوانی (با خواندن مجدد زمان اجرا از دیتابیس فعلی، نه از زمان ذخیره)، تغییر نام، حذف، حذف یک آیتم (با فشرده‌سازی مجدد `position`ها)، و جایگزینی یک آیتم بدون دست‌زدن به بقیه.

### ۱۰.۱۰ `watchlist-types.ts`
شکل‌های امن-برای-کلاینت، جدا از فایل‌های `server-only` تا کامپوننت مرورگر هرگز به‌طور تصادفی Prisma را وارد نکند.

### ۱۰.۱۱ مسیرهای API مود
`POST /api/mood/watchlist` (تولید پیش‌نمایش، rate-limit ۱۲/دقیقه)، `POST /api/mood/watchlist/save` (ذخیره، با اعتبارسنجی کامل مجدد چون داده از مرورگر برگشته)، `GET/PATCH/DELETE /api/mood/watchlist/[id]`، `POST /api/mood/watchlist/[id]/items` (جایگزینی آیتم در لیست ذخیره‌شده) و `DELETE` همان مسیر (حذف آیتم)، `POST /api/mood/watchlist/replace` (جایگزینی در پیش‌نمایش هنوز ذخیره‌نشده). همه با `getCurrentUserId` محافظت می‌شوند و بیشترشان rate-limit دارند.

### ۱۰.۱۲ صفحات و کامپوننت‌های مود
- `src/app/(app)/mood/page.tsx`: فرم اصلی + لیست واچ‌لیست‌های اخیر کاربر؛ می‌تواند با query param `q` (از یک نقطه‌ی ورود دیگر مثل Discover) از قبل پر شود و با `go=1` خودکار تولید کند.
- `src/app/(app)/mood/[id]/page.tsx`: نمایش یک واچ‌لیست ذخیره‌شده با «چرا Aurora این را ساخت» و اکشن‌های مالکیت.
- `MoodEntry`: یک ردیف کوچک و کم‌سروصدا (نه بنر تبلیغاتی) که در Home، Discover و Library به‌عنوان درِ ورودی گذاشته شده.
- `MoodComposer`: فیلد متن آزاد + چیپ‌های پیشنهادی که در همان فیلد می‌نویسند (نه یک taxonomy ثابت) + `<details>` برای کنترل‌های اختیاری (زمان، مخاطب، نوع محتوا، میزان ماجراجویی، تعداد).
- `MoodCreator`: مدیریت کامل state سمت کلاینت (تولید، حذف آیتم، جایگزینی، پالایش، ذخیره، شروع دوباره) — پیش‌نمایش تا زمان ذخیره‌نشدن، سبک و برگشت‌پذیر است.
- `MoodResult`: نمایش لیست به‌صورت فهرست ویراستاری (نه گرید کارت)، با خط شفافیت («Chosen by AI...» یا «Ranked by Aurora...») و دکمه‌های Replace/Less like this/Not for me روی هر آیتم.
- `MoodWatchlistsSection`: نمایش واچ‌لیست‌های مود در تب Collections پروفایل.
- `SavedMoodWatchlistActions`: تغییر نام/حذف + دکمه‌های «همین حس را دوباره امتحان کن»/«یکی دیگر بساز».

---

# بخش ۱۱ — کشف بین‌رسانه‌ای (`src/lib/crossmedia/`)

- `types.ts`: چهار نوع رابطه — `DIRECT_RELATIONSHIP` (فقط وقتی schema واقعاً آن را تضمین کند، مثل آلبوم متعلق به هنرمند)، `TASTE_BASED`, `MOOD_BASED`, `COMMUNITY_BASED` — هیچ‌وقت یک رابطه‌ی استنتاجی به‌عنوان رابطه‌ی مستقیم قلمداد نمی‌شود.
- `explanations.ts`: `tasteAffinity()` (میزان تطابق یک کارت با سیگنال سلیقه‌ی *همین کاربر بازدیدکننده*)، `buildConnection()` (یک جمله‌ی مستدل: یا بر اساس affinity سلیقه یا بر اساس هم‌پوشانی مود واقعی با آیتم مبدأ).
- `discovery.ts`: `getCrossMediaConnections()` برای فیلم/سریال به سراغ هنرمند/آلبوم/آهنگ می‌رود و برعکس؛ هرگز هم‌نوع را برنمی‌گرداند (آن کار rail «بیشتر شبیه این» است). `getBeyondYourUsual()` برای Home، بر اساس بالاترین امتیاز کاربر لنگر می‌زند.

---

# بخش ۱۲ — لایه‌ی اعتبارسنجی (`src/lib/validation/`)

`auth.ts` (رمز عبور با قوانین حرف بزرگ/کوچک/عدد، ایمیل lowercase-شده)، `content.ts` (نوع محتوا، امتیاز نیم‌ستاره‌ای با `multipleOf(0.5)`)، `onboarding.ts`، `profile.ts` — همه با Zod و تست واحد برای auth/content.

---

# بخش ۱۳ — کمک‌کننده‌های API (`src/lib/api/`)

- `response.ts`: `ok`, `created`, `noContent`, `apiError`, `unauthorized`, `forbidden`, `notFound`, و `handleApi()` که خطای Zod را خودکار به پاسخ ۴۲۲ ساختاریافته تبدیل می‌کند و هر خطای دیگر را به ۵۰۰ عمومی (بدون افشای جزئیات داخلی).
- `client.ts`: `fetchJson()` سمت مرورگر — پاسخ غیر-ok را با پیام خطای سرور throw می‌کند، ۲۰۴ را به `undefined` تبدیل می‌کند.
- `rate-limit.ts`: توضیح داده‌شده در بخش ۸.۸.

---

# بخش ۱۴ — مسیرهای API (`src/app/api/`)

### هسته
`register`, `auth/[...nextauth]`, `auth/forgot-password`/`reset-password` (جریان کامل، فقط ارسال ایمیل شبیه‌سازی/لاگ‌شده است)، `search` + `search/history`, `recommendations` + `recommendations/one-pick`, `library`, `ratings`, `activity`, `onboarding`, `profile`, `collections` + `collections/[id]/items`, `playlists` + `playlists/[id]` + `playlists/[id]/items`, `follow`.

### `taste/*` (۱۸ روت)
`dna`, `identity`, `evolution`, `insights`, `journal`, `stats`, `favorites`, `mood-profile` + `mood-feedback`, `matches`, `activity`, `surprise`, `mute`, `dismiss`, `less-like-this`, `useful`, `undo`, `reset`, و روت تازه‌ی **`regenerate`** (باطل‌کردن کش AI برای یکی از چهار artifact — با rate-limit ۶/دقیقه).

### `ai/*` (تولید بر پایه‌ی prompt، نسخه‌ی قدیمی‌تر/ساده‌تر watchlist)
`mood-discover`, `playlist` + `playlist/save`, `watchlist` + `watchlist/save` — این‌ها از `src/lib/ai/mood-discovery.ts`, `playlist.ts`, `watchlist.ts` استفاده می‌کنند که پیش از فیچر بزرگ mood ساخته شده بودند (نسخه‌ی ساده‌تر، بدون سیستم نیت/رتبه‌بندی/کیوریشن کامل `src/lib/mood/`).

### `mood/*` (فیچر تازه — توضیح کامل در بخش ۱۰.۱۱)

همه‌ی روت‌ها یک قرارداد پاسخ دارند: موفق `{ data }`، ناموفق `{ error: { message, code } }`.

---

# بخش ۱۵ — صفحات (`src/app/`)

### گروه `(auth)`
`login`, `signup`, `forgot-password`, `reset-password` با layout مشترک وسط‌چین.

### گروه `(app)` — پوسته‌ی اصلی
`home` (اکنون شامل `MoodEntry` به‌عنوان یک ردیف کم‌سروصدا، `TasteSummaryCard` که ترجیح می‌دهد صفت‌های نوظهور AI را نشان دهد و فقط اگر خالی بود به insight قطعی برگردد)، `discover` (اکنون یک `MoodEntry` بالای فیلترها دارد که فیلتر فعال را به یک جمله برای مود تبدیل می‌کند)، `search`, `library` (`collections`, `collections/[id]`, `playlists`, `playlists/[id]`, `ratings` — صفحه‌ی `collections` هم اکنون `MoodEntry` دارد)، `profile` (اکنون تب Overview بخش هویت را در یک `Suspense` جدا استریم می‌کند چون ممکن است شامل یک تماس AI باشد؛ تب Collections اکنون `MoodWatchlistsSection` را نشان می‌دهد)، `recommendations`، صفحات جزئیات `movie/[slug]`, `show/[slug]`, `episode/[slug]`, `artist/[slug]`, `album/[slug]`, `song/[slug]`, `u/[username]`، و صفحات تازه‌ی **`mood/page.tsx`** و **`mood/[id]/page.tsx`**.

### مستقل
`onboarding/page.tsx`, `page.tsx` (لندینگ)، `layout.tsx` ریشه، `error.tsx`, `not-found.tsx`, `globals.css`.

---

# بخش ۱۶ — کامپوننت‌های React (`src/components/`)

### `ui/` — پرایمیتیوهای shadcn/ui روی Base UI
`button`, `dialog`, `alert-dialog`, `dropdown-menu`, `select`, `tabs`, `input`, `checkbox`, `switch`, `tooltip`, `popover`, `avatar`, `badge`, `progress`, `skeleton`, `sonner`, `label`, `separator`, `textarea` — بلوک‌های پایه، بدون منطق کسب‌وکار، فقط استایل و دسترس‌پذیری.

### `auth/` `login-form`, `signup-form`, `forgot-password-form`, `reset-password-form` — فرم‌های React Hook Form + Zod resolver.

### `brand/logo.tsx` لوگوی خطی سه‌قوسی، بدون آیکون کلیشه‌ای.

### `navigation/` `app-shell` (ترکیب `sidebar` دسکتاپ + `bottom-nav` موبایل)، `nav-items.ts` (منبع واحد آیتم‌های منو)، `theme-toggle`, `user-menu`.

### `content/` `content-card`/`content-grid`/`content-row` (واحدهای نمایش پایه‌ی محتوا در همه‌جا)، `cross-media-card`/`cross-media-section`، `ranked-list`, `section-header`, `star-rating`.

### `detail/` `detail-actions` (ذخیره/اشتراک/تماشا/گوش)، `genre-badges`, `why-recommended` (چک‌لیست باز/بسته‌شونده‌ی دلیل + دکمه‌های فیدبک مستقیم به `lib/taste/feedback`).

### `discover/filter-bar.tsx` کنترل ژانر/نوع/مرتب‌سازی از طریق query params.

### `home/` `taste-summary-card` (اکنون آگاه از `narrative.emergingTraits`)، `tonights-pick` (رابط «یک پیشنهاد کامل»).

### `library/` `ai-watchlist-dialog` (نسخه‌ی قدیمی‌تر ai/watchlist)، `collection-items-grid`, `create-collection-dialog`, `library-tabs`.

### `playlists/` `add-to-playlist-dialog`, `ai-playlist-dialog` (نسخه‌ی قدیمی‌تر ai/playlist)، `create-playlist-dialog`, `playlist-detail`.

### `onboarding/onboarding-wizard.tsx` ویزارد چندمرحله‌ای.

### `profile/` بزرگ‌ترین دسته: `ai-insights`, `collections-preview`, `content-distribution`, `creators-section`, `discovery-milestones`, `entertainment-dna` (اکنون `narrative`/`aiTraits` را رندر می‌کند + `RegenerateInsight`)، `entertainment-identity` (اکنون خط شفافیت «Aurora's interpretation... / Generated from your activity» + دکمه‌ی بازتولید دارد)، `favorite-content-sections`, `follow-button`, `friends-activity-section`, `identity-card`, `identity-snapshot`, `journal-section`, `mood-profile-section` (اکنون با narrative + regenerate)، `next-discoveries`, `playlists-preview`, `profile-header`, `profile-tabs(-config)`, `ratings-overview`, `ratings-section`, `recent-discoveries`, `settings-form`, `surprise-me`, `taste-evolution-section` (اکنون با narrative + shift)، `taste-matches-section`, `taste-spectrums`, `taste-stats-section`, و تازه‌ی **`regenerate-insight.tsx`** (کنترل عمومی «بازتولید» که کش AI را باطل می‌کند و صفحه را refresh می‌کند).

### `mood/` — کاملاً تازه، توضیح کامل در بخش ۱۰.۱۲.

### `search/search-experience.tsx` تجربه‌ی کامل جست‌وجو.

### `states/` `empty-state`, `error-state`.

### `providers.tsx` ترکیب `SessionProvider` + `ThemeProvider` + `QueryClientProvider`.

---

# بخش ۱۷ — هوک‌ها (`src/hooks/`)

`use-library`, `use-ratings`, `use-collections`, `use-playlists`, `use-activity` (همه با TanStack Query، toast خطا/موفقیت داخل خودشان)، `use-is-client` (جلوگیری از hydration mismatch).

---

# بخش ۱۸ — تست‌ها

### واحد (Vitest)
کنار همان ماژول منطقی: `lib/recommendations/*.test.ts` (contentBased, collaborative, diversify, explanation, hybrid, one-pick, popularity, traits)، `lib/taste/identity-model.test.ts`، `lib/validation/*.test.ts`، `lib/crossmedia/explanations.test.ts`، و تست‌های تازه‌ی زیرساخت AI: `lib/ai/cache.test.ts`, `lib/ai/guards.test.ts` (گاردهای isSafe*)، `lib/ai/service.test.ts` (شامل `extractJson`)، و تست‌های سیستم مود: `lib/mood/compose.test.ts`, `lib/mood/intent.test.ts`, `lib/mood/rank.test.ts`. طبق commit message، مجموعاً **۱۷۳ تست واحد** فقط برای بخش AI/mood اضافه شده.

### E2E (Playwright)
فایل‌های قبلی (`critical-flow`, `auth`, `search`, `collections`, `playlists`) + سه فایل جدید که در بررسی اول ندیده بودم: `profile-privacy.spec.ts`, `personalization.spec.ts`, `taste-feedback.spec.ts`, و از commit اخیر: **`ai-loop.spec.ts`** و **`mood-watchlist.spec.ts`** (۲۳ تست E2E روی حلقه‌ی کامل AI و جریان واچ‌لیست حس‌وحال). `e2e/helpers.ts` ابزار مشترک (`signUpAndSkipOnboarding`, `hideDevOverlay`).

---

# بخش ۱۹ — Seed و اسکریپت‌ها

- `prisma/seed.ts` / `seed-lib.ts`: کاتالوگ ساختگی، توابع upsert مشترک.
- `prisma/seed-live.ts`: کاتالوگ واقعی (TVmaze + iTunes/Spotify/Deezer + TMDB اختیاری) با لیست عنوان‌های دستچین‌شده.
- `prisma/seed-community.ts`: چند حساب نمونه با امتیازهای واقعی برای Taste Match/Friends Activity/collaborative filtering.
- `scripts/verify-ai-key.ts`: اسکریپت بازنویسی‌شده‌ی بزرگ (۲۳۴ خط) که کلید `AI_API_KEY` را در برابر ۶ vendor واقعی (Anthropic, OpenAI, Google, Mistral, Groq, DeepSeek) پروب می‌کند — بر اساس پیشوند کلید یا `AI_BASE_URL`/`AI_PROVIDER` صریح. تابع `redact()` حتی قطعات جزئی کلید (که برخی vendorها در پیام خطای ۴۰۱ echo می‌کنند) را هم پاک می‌کند. خروجی: VALID (با لیست مدل‌های در دسترس)، AUTHENTICATED but RATE LIMITED، یا INVALID.

---

# بخش ۲۰ — مستندات

`docs/entertainment-identity-research.md`: تحقیق پشت سیستم Entertainment Identity، مقایسه‌ی 16Personalities/Truity/MBTI برای طراحی یک سیستم صادقانه مبتنی‌بر رفتار واقعی به‌جای خوداظهاری.

---

# جمع‌بندی نهایی

Aurora از یک اپ توصیه‌ی محتوای «صادقانه» (بدون هوش مصنوعی واقعی، فقط منطق قطعی روی رفتار کاربر) به یک سیستم **هیبریدی** تکامل یافته که در آن:

1. **موتور Aurora** (recommendations + taste + mood + crossmedia) همیشه مسئول واقعیت است: چه چیزی وجود دارد، چه چیزی به چه کسی مرتبط است، و چرا.
2. **مدل هوش مصنوعی** (وقتی پیکربندی شده باشد) فقط دو کار مجاز دارد: (الف) خواندن یک جمله‌ی آزاد و تبدیل آن به نیت ساختاریافته، و (ب) نوشتن/انتخاب از میان چیزهایی که Aurora از قبل تعیین کرده.
3. هر مرز بین این دو با **Zod schema**، **گاردهای متنی صریح** (رد ادعاهای شخصیتی/احساسی/سلامت روان)، **کش نسخه‌بندی‌شده**، **rate limiting**، و **fallback همیشه‌کارآمد به مسیر قطعی** محافظت می‌شود — یعنی قطع‌شدن سرویس AI هرگز چیزی را از کار نمی‌اندازد، فقط لحن نوشتار را ساده‌تر می‌کند.

این الگو (retrieve → rank → diversify از خودِ Aurora؛ فقط word/curate از مدل) در سه جای کاملاً مستقل پروژه (توضیح پیشنهاد، هویت/DNA/mood profile/evolution، و واچ‌لیست‌های حس‌وحال) عیناً تکرار شده — یعنی یک تصمیم معماری واحد و آگاهانه است، نه سه پیاده‌سازی جدا.

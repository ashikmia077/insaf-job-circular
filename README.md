# চাকরি বিডি — ব্যক্তিগত জব হাব

সরকারি, বেসরকারি, ব্যাংক, এনজিও, শিক্ষা প্রতিষ্ঠান, ফার্মা ও ডিফেন্সের নিয়োগ বিজ্ঞপ্তি এক জায়গায় দেখার জন্য বানানো একটি **সম্পূর্ণ ফ্রি, অ্যাড-মুক্ত, ব্যক্তিগত** ওয়েবসাইট।

## যা যা আছে

- ৬টি উৎস থেকে প্রতিদিন ২ বার স্বয়ংক্রিয় আপডেট (GitHub Actions)
- ক্যাটাগরি ফিল্টার: সরকারি / বেসরকারি / ব্যাংক / এনজিও / শিক্ষা / ফার্মা / ডিফেন্স / অন্যান্য
- যোগ্যতা অনুযায়ী ফিল্টার: **SSC / সমমান, HSC / সমমান, Honors / স্নাতক, Masters / স্নাতকোত্তর**
- সার্চ, উৎস বাছাই, সorting (নতুন / শেষ তারিখ / বেশি পদ)
- **ভিউ জব**: বিস্তারিত, নোটিশ ইমেজ, PDF (থাকলে), মূল সাইটের লিংক
- **অ্যাপ্লাই জব**: সরাসরি আপনার WhatsApp নম্বরে রেডিমেসেজ (অফিসিয়াল আবেদন লিংকও দেখানো হয়)
- **ফেভারিট**: ব্রাউজারে সেভ হয়, `#favorites` পেজে আলাদা করে দেখা যায়
- সেটিংস প্যানেল: WhatsApp নম্বর, দোকানের নাম, ঠিকানা ও মেসেজ টেম্পলেট
- CSS 3D লোগো,cube, float card, orbit, marquee, hover tilt — কোনো বাইরের লাইব্রেরি ছাড়াই

## ফোল্ডার

```
index.html              UI
styles.css              ডিজাইন ও অ্যানিমেশন
app.js                  সব ফিল্টার / ফেভারিট / WhatsApp লজিক
data/jobs.json          স্ক্র্যাপ করা ডাটা (auto-generated)
scripts/scrape.mjs      সব উৎস থেকে ডাটা সংগ্রহ
scripts/embed-seed.mjs  index.html-এ ছোট seed ডাটা ঢোকায়
netlify/functions/refresh.mjs   সাইটের.refresh বাটনের API
.github/workflows/...   দিনে ২ বার auto update
netlify.toml            Netlify কনফিগ
```

## Netlify-তে চালানো (প্রায় ২ মিনিট)

1. GitHub-এ একটি নতুন **public/private repo** বানান ও সব ফাইল সেখানে push করুন।
2. [netlify.com](https://www.netlify.com) → **Add new site → Import an existing project** → GitHub repo বাছুন।
3. Build settings নিজে থেকে চলে যাবে (`netlify.toml` আছে)। **Deploy site** চাপুন।
4. Netlify আপনাকে দিবে `https://something-xxxx.netlify.app` — এটাই আপনার সাইট।

###Auto-update চাল করতে

- GitHub repo-র **Settings → Actions → General → Workflow permissions** → **Read and write permissions** বেছে **Save** করুন।
- Actions ট্যাবে `Update job circulars` → **Run workflow** দিয়ে এখনই টেস্ট করুন।
- এরপর দিনে ২ বার (ঢাকা সময় সকাল ৬টা ও সন্ধ্যা ৬টা) নিজেই আপডেট হয়ে Netlify-তে নতুন deploy হয়ে যাবে।
- সাইটের উপরের **🔄 বাটন** চাপলেই Netlify function থেকে তাৎক্ষণিক নতুন ডাটা আসবে।

## নিজের কম্পিউটারে চালানো

```bash
npm install
npm run update     # scrape + seed embed
npm run dev        # http://localhost:5173
```

## WhatsApp নম্বর

ডিফল্ট নম্বর: **+8801953708870**, দোকান: **Insaf Computer**, ঠিকানা: **Satkhira Govt College Road, 2nd Gate Opposition**। সাইটের উপরের ডানদিকের ⚙ সেটিংস বাটন থেকে যেকোনো সময় বদলে নিতে পারবেন। সেটিংস শুধু আপনার ব্রাউজারে (localStorage) সেভ হয়।

## নোট

- সব তথ্য publicly accessible ওয়েবসাইট থেকে নিয়ে আপনার **ব্যক্তিগত, অ-বাণিজ্যিক** ব্যবহারের জন্য দেখানো হয়। মূল উৎসের লিংক প্রতিটি কার্ডে আছে।
- কোনো সাইট কাঠামো বদলালে স্ক্র্যাপারের selector আপডেট করতে হতে পারে (`scripts/scrape.mjs` → `sourceList`)।
- ₹ / ৳ বা তারিখ নিয়ে সন্দেহ হলে সবসময় মূল বিজ্ঞপ্তি দেখে নিশ্চিত হবেন।

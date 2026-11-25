# Netlify-তে আপলোড করার নির্দেশনা (সংক্ষিপ্ত)

## ✅ যেটা আপলোড করবেন
`chakribd-netlify.zip` — এই ফাইলটির ভেতরে পুরো প্রজেক্ট আছে (সাইট + স্ক্রিপ্ট + অটো-আপডেট সেটআপ)।

---

## পদ্ধতি ১ — সুপারিশকৃত (GitHub দিয়ে, সব ফিচার কাজ করবে)

1. [github.com/new](https://github.com/new) → নতুন repo বানান (নাম যেমন `chakribd`) → **Create repository**।
2. Repo-তে **Add file → Upload files** → এই ZIP-টি খুলে ভেতরের **সব ফাইল** Upload করুন → **Commit changes**।
   - (ZIP আকারে আপলোড করতে চাইলে GitHub-এ ZIP unfold করে তারপর upload করতে হয়; অন্যথায় Git CLI ব্যবহার করুন।)
3. GitHub repo → **Settings → Actions → General → Workflow permissions → Read and write permissions** → Save।
4. [netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub** → `chakribd` repo বাছুন → **Deploy site**।
5. কয়েক সেকেন্ড পর আপনার লিংক দেখা যাবে: `https://xxxx-xxxx.netlify.app`

এতে কাজ করবে: সাইট + দিনে ২ বার অটো আপডেট + 🔄 বাটন (Netlify Function)।

---

## পদ্ধতি ২ — দ্রুত (ZIP drag-and-drop)

1. [app.netlify.com/drop](https://app.netlify.com/drop) খুলুন।
2. `chakribd-netlify.zip` ফাইলটি সরাসরি পেজে টেনে ছেড়ে দিন।
3. সাইট চলে যাবে **স্থ্যায়ী static** হিসেবে — সব চাকরি, ফিল্টার, ফেভারিট, WhatsApp বাটন কাজ করবে।
4. তবে **🔄 বাটন** ও GitHub Actions চলবে না (drag-and-drop-এ Netlify Functions যোগ হয় না)। ডাটা থাকবে `data/jobs.json` থেকে — সেটি আপডেট করতে চাইলে পদ্ধতি ১ বা `npm run update` ব্যবহার করুন।

---

## আপলোডের পর একবার চেক করুন

- হোম পেজে “সব চাকরি” সংখ্যাটি দেখা যাচ্ছে কি?
- **HSC / সমমান** চিপে ক্লিক করলে ফিল্টার হচ্ছে কি?
- কোনো কার্ডে **অ্যাপ্লাই** চাপলে WhatsApp খুলছে কি? (মোবাইলে টেস্ট করুন)
- ⚙ সেটিংসে নম্বর `+8801953708870` আছে কি?

---

## নিজের কম্পিউটারে (ঐচ্ছিক)

```bash
npm install
npm run update   # ৬টি উৎস থেকে নতুন ডাটা আনে
npm run dev      # http://localhost:5173
```

বেশি বিস্তারিত: `README.md`

# forms-launcher — Google Form PWA

A zero-build Progressive Web App (plain HTML5, CSS3, Vanilla JS) designed to be installed on mobile devices via **"Add to Home Screen"**. It opens full screen and automatically loads the **latest Google Form** published by an administrator via Supabase.

---

## 📁 Project Structure

```text
forms-launcher/
├── index.html              # User App (Full screen Google Form iframe, cache, PWA install prompt)
├── admin.html              # Admin Dashboard (Auth, Google Form URL validator, publish, history)
├── supabase.sql            # Database schema & Row Level Security (RLS) policies
├── vercel.json             # Vercel static deployment & Service Worker cache headers
├── manifest.webmanifest    # PWA configuration (standalone, icons, colors)
├── sw.js                   # Service Worker (Caches app shell; always network-fetches forms)
├── css/
│   └── style.css           # Premium mobile-first CSS with safe-area insets & dark theme
├── js/
│   ├── config.js           # ⚠️ Supabase URL & Anon Key placeholders
│   ├── app.js              # User app logic (Supabase query, embedded URL formatting, localStorage cache)
│   └── admin.js            # Admin portal logic (Supabase Auth, link validation, deletion)
└── icons/
    ├── icon-192.png        # Standard PWA icon (192x192)
    ├── icon-512.png        # High-res PWA icon (512x512)
    ├── icon-maskable-192.png # Adaptive maskable icon for Android (192x192)
    ├── icon-maskable-512.png # Adaptive maskable icon for Android (512x512)
    ├── apple-touch-icon.png  # iOS Home Screen icon (180x180)
    └── favicon.svg         # SVG vector favicon
```

---

## ⚡ Quick Setup Guide (Step-by-Step)

### Step 1: Run `supabase.sql` in Supabase
1. Go to your [Supabase Dashboard](https://app.supabase.com).
2. Open your project (or create a free new one).
3. In the left navigation, click **SQL Editor** &rarr; **New query**.
4. Copy the entire contents of `supabase.sql` and click **Run**.
5. This creates the `form_links` table with Row Level Security (RLS):
   - **Public users (`anon`):** Can `SELECT` the latest form.
   - **Authenticated admins:** Can `INSERT`, `UPDATE`, and `DELETE` forms.

### Step 2: Create an Admin Account
1. In the Supabase Dashboard, go to **Authentication** &rarr; **Users**.
2. Click **Add User** &rarr; **Create user**.
3. Enter your admin email and password (e.g., `admin@yourcompany.com`).
4. Keep **Auto Confirm User?** checked.

### Step 3: Insert Your Credentials in `js/config.js`
1. In your Supabase Dashboard, click **Project Settings** (gear icon) &rarr; **API**.
2. Copy:
   - **Project URL** (e.g., `https://abcdefghijkl.supabase.co`)
   - **Project API Anon / Public Key** (starts with `eyJ...`)
3. Open `js/config.js` and replace the placeholders:
   ```javascript
   window.APP_CONFIG = {
     appName: "forms-launcher",
     supabaseUrl: "https://xuldqiftdkkrmidscsrx.supabase.co",
     supabaseAnonKey: "sb_publishable_W8X9y3XC9c9kwLK5z-jWxw_fnzx9gKt",
     cacheKey: "forms_launcher"
   };
   ```

---

## 📝 How to Add a New Form

1. Open the admin URL: `https://forms-launcher-blue.vercel.app/admin`
2. Log in with your authorized administrator account (use the password you chose).
3. Paste the new Google Form link into the **Google Form URL** field.
4. Check that the form settings are published to **"Anyone with the link"** (so respondents can access it without domain restriction errors).
5. Click **Publish Form**. The updated form becomes the live active form immediately for all users opening the app.

---

## 🖥️ Local Testing

Since this project has no build step, you can serve it with any local static HTTP server:

```bash
# Using Python (built-in):
python -m http.server 8080

# Or using npx serve:
npx serve .
```

- Open `http://localhost:8080/admin.html` to log in and publish your first form.
- Open `http://localhost:8080/index.html` to verify the user experience.

---

## 🚀 Deploying to Vercel (Static)

Deploying takes under 2 minutes:

### Option A: Via Vercel CLI (Fastest)
From the project folder (`forms-launcher`), run:
```bash
npx vercel
```
- Set up and deploy: **Yes**
- Which scope: Select your account
- Link to existing project: **No**
- Project name: `forms-launcher` (or custom name)
- In which directory: `./`
- Modify settings: **No**

### Option B: Via GitHub & Vercel Dashboard
1. Push the folder to a GitHub repository.
2. In [Vercel Dashboard](https://vercel.com/new), click **Import**.
3. Select your repository.
4. Leave Framework Preset as **Other** (Root directory `./`).
5. Click **Deploy**.

---

## 📱 How Users Install on Mobile

### Android (Chrome / Edge / Samsung Internet)
1. Visit the deployed Vercel URL on mobile.
2. A banner saying **"Install forms-launcher"** will appear automatically at the bottom.
3. Tap **Install** (or tap the 3-dots browser menu &rarr; **"Install app"** or **"Add to Home Screen"**).
4. An icon will appear on the Android home screen that launches standalone full-screen.

### iOS / iPhone (Safari)
1. Open the Vercel URL in **Safari**.
2. Tap the **Share** button (box with upward arrow) at the bottom.
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**. The app will launch like a native iOS application.

---

## 🎨 Customizing the App & Replacing Icons

To use your own company/organization logo:
1. Replace `icons/icon-192.png` with your 192x192 PNG.
2. Replace `icons/icon-512.png` with your 512x512 PNG.
3. Replace `icons/icon-maskable-192.png` and `icons/icon-maskable-512.png` (leave a 15-20% safe margin around your logo so Android doesn't crop it).
4. Replace `icons/apple-touch-icon.png` with your 180x180 PNG.
5. In `js/config.js` and `manifest.webmanifest`, change `"forms-launcher"` to your brand name.

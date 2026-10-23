# Melo — Official Web Landing Page

The official web landing page and deep-link portal for **Melo**, featuring direct Android APK download (`melo.apk`), Open Graph preview cards for shared playlists and user profiles, and serverless OTP email relay.

## Features

- **Direct Android APK Download:** Serves the official `melo.apk` release build directly from the hero download section.
- **Deep-Link Web Fallback:** Automatically detects shared playlist (`?playlist=`) and user profile (`?profile=`) deep links and provides a one-tap **Open in Melo** banner.
- **Responsive Dark UI:** Built with custom CSS Grid (Bento layout), animated soundwave visualizers, and mobile-first styling.
- **Serverless Email Relay (`/api/send-email`):** Vercel serverless function powered by `nodemailer` for transactional OTP verification emails.

## Tech Stack

- **Frontend:** HTML5, CSS3 (Bento Grid & keyframe animations), Vanilla JavaScript
- **Serverless API:** Node.js (`api/send-email.js`), Nodemailer
- **Deployment:** Vercel

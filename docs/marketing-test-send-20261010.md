# Marketing Test Send — production-gated one-off QA

- Admin → MARKETING → Uji Kirim Marketing ke Telegram.
- Select a **saved** 1–365 day slot and a previously authorized tester for the currently active main bot.
- Click KIRIM TES MARKETING and accept browser confirmation. Explicit click causes one real Telegram send only to the tester; no broadcast or scheduling toggle.
- Backend validates team admin JWT; server Telegram send permission; active main bot; preauthorized tester record; START consent; active member; valid UUID-like request key; live source prompt hash, preview, CTA and HTTPS official-domain destination.
- Sends preview image (if Telegram can fetch it), complete prompt, then separate upselling text and CTA.
- Creates `telegram_deliveries.kind=test` with a Free deletion schedule (default 24 hours; adjusted in Telegram → Konten, up to 36 hours), automatically deleting **all test messages** while cron remains available; manual Test Delete is available from Telegram admin via the standard test-delivery endpoint.
- Crucially, `test:true` does not modify `telegram_members.delivery_day`, `next_send_at`, cursor, or Marketing settings. Failed tests are not automatically retried against real members.
- Marketing routine delivery stays **DRAF** until the admin explicitly selects **AKTIF** in Telegram → Konten; saving slots does not arm the sender. The server-side `TELEGRAM_SEND_ENABLED` safety lock is still required.
- **Testing limitations**: browser and unit CI mocks verify routing but cannot prove Telegram actually fetched Dropbox image. Operator must click once with authorized tester and confirm real message delivery and CTA on phone, then verify server sent/delivered state and 24h deletion after the due time.
- Risks: Telegram payment rules may restrict bot promotional flows for digital goods; keep actual purchase checkout on independent website and do not offer in-bot QRIS invoices.

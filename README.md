# Profile contact link evidence

Base commit: `55203a716b63a51b67dc57fcdaf66a80ddf78bb5`.
Fixed commit: `21173426eac16349b2c235dc1c0ea935dcf2df12`.

The profile form accepts X and Telegram handles and GitHub usernames. The base code saves these values as relative links. The browser then opens a Bountix route. The fix converts plain handles to the correct platform URL. It also converts stored handles when the public profile and applicant pages display them.

## Workflow

Both runs use the actual Next.js pages, profile save server action, Supabase SDK and Chromium. A local in-memory API supplies synthetic users, profiles, tasks and applications. No live Supabase data or accounts are used. External platform requests are intercepted after the browser selects the destination. This proves the saved link and browser URL. It does not prove external platform account availability.

1. Log in with a synthetic creator account.
2. Open a public profile that already contains plain handles.
3. Edit the profile. Enter `@bountix_test` for X and Telegram, and `bountix-test` for GitHub. Save the profile.
4. Open the public profile. Click Telegram.
5. Open the task applicant page as the synthetic task owner. Check the applicant contact links.
6. Open the public profile at 390 x 844. Check each link and horizontal overflow.

All four views produce Bountix routes before the fix. All four produce the expected platform links after the fix. The clicked Telegram destination changes from `/profile/@bountix_test` to `https://t.me/bountix_test`.

See `before/result.json` and `after/result.json` for saved values and all resolved links. The `workflow.webm` files show each complete run. Screenshots show the public profile on desktop and mobile, and the applicant page.

## Checks

Node 24.15.0. Next.js 16.2.6. Playwright 1.62.1 with system Chrome.

The base and fixed code pass:

- `npm run lint`
- `npm run build`
- `npm run compile -- --network hardhat`
- `npm run test:contract -- --network hardhat`: 46 tests pass.

The fixed code also passes `tsc --noEmit`. Direct checks confirm that full URLs and website values keep their content, blank values are omitted, and a second conversion does not change the result.

The change adds no dependencies or schema changes. Generated build files are unchanged.

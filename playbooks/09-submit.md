## Submit for App Review — human sign-off required

Before submitting, a human should:
1. Install the TestFlight build on a real iPhone and run through every journey in `{{specMd}}` (10 minutes).
2. Skim the App Store Connect version page: screenshots, preview, description, age rating, App Privacy answers.
3. Confirm the App Privacy label is published (`mac/app-privacy.sh {{slug}}` or by hand from `store/app_privacy.json`).
4. Confirm price + availability.

Then run the `farm-asc.yml` workflow with `action=submit` and `confirm=SUBMIT`
(or `npm run farm -- asc submit {{slug}} --confirm SUBMIT` with ASC credentials). The agent must never submit
without the human's explicit go-ahead in the conversation.

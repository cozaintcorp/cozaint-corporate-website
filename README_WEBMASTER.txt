COZAINT WEBSITE - FULL SITE UPDATE, NOVEMBER 12, 2026
=====================================================

WHAT TO DO
----------
This package is the COMPLETE cozaint.com website. Please replace the whole site
with the contents of the "site" folder, exactly as you did for the October 24
and November 3 full-site packages.

1. Back up the current website files on the server (in case we need to undo).
2. Upload EVERYTHING inside the "site" folder to the website's root folder
   (the folder that holds index.html today), replacing existing files.
   - Upload the CONTENTS of "site", not the "site" folder itself.
   - Keep the folder structure exactly as it is. Many pages live in small
     folders (for example banks/index.html, hollywood/index.html). These are
     the short addresses (cozaint.com/banks, cozaint.com/hollywood, ...) and
     must be uploaded too.
   - The "assets" folder holds the videos, pictures and PDFs. Please make sure
     every file in it uploads completely (the largest is about 29 MB).
3. If your upload tool asks, choose "replace/overwrite" for files that already
   exist. Nothing needs to be deleted from the server.

AFTER UPLOADING, PLEASE CHECK (about 5 minutes)
-----------------------------------------------
Open each address in a browser and press Ctrl+F5 to skip the browser's saved copy:

  https://cozaint.com/banks.html
     - Near the top there is a new gold button: "Take the Questionnaire &
       Watch the Webinar". Clicking it opens https://webinar.cozaint.com/banks
       in a new tab (Cozaint's bank questionnaire, hosted by ScoreApp).

  https://cozaint.com/marcia.html
     - The video plays. (It has new narration.)

  https://cozaint.com/hollywood.html   and   https://cozaint.com/hollywood
     - New page "Proven by Hollywood". Both addresses should open it.

  https://cozaint.com/
     - Home page: next to the "Proven by Hollywood" heading there is a picture
       of a Cozaint LTO library, and the top paragraph ends with a green
       "More" link that opens the Hollywood page.

  https://cozaint.com/assessment.html
     - The storage calculator loads and shows results (default tape: LTO-10, 30 TB).

If any page shows "Not Found", or looks unstyled (plain text, no colors), a
file or folder probably did not upload. Please re-upload that folder.

WHAT CHANGED SINCE THE NOVEMBER 3 PACKAGE
-----------------------------------------
- banks.html and styles.css: new questionnaire & webinar button on the Banks page.
- assets/marcia-hero-video.mp4: MARCIA page video with corrected narration.
- index.html: Hollywood picture and "More" link on the home page.
- hollywood.html + hollywood/ folder: new page and its short address.
- assessment.html, calculator.js, tco.js, report.js and related files: updated
  storage calculator.
Because this is a full-site package, everything else is included too and is
the same as before.

NOTES
-----
- webinar.cozaint.com is NOT part of this website. It is already set up in DNS
  (a CNAME to ScoreApp, added by Jay) and already works. Nothing is needed
  from you for it.
- The file preview-banner.js only shows a yellow banner on Cozaint's GitHub
  review copy. It never shows on cozaint.com, so it is safe to upload.
- The website contact forms stay switched ON (lead-config.js), as before.

Questions: Omar Qawiyy, omar.qawiyy@cozaint.com

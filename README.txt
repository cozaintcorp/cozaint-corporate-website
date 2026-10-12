COZAINT WEBSITE - PACKAGE FOR THE WEBMASTER (October 11, 2026)
Full instructions: "Cozaint Website - Webmaster Instructions.docx" (in this folder).
Questions: Omar Qawiyy, omar.qawiyy@cozaint.com

WHAT IT IS
The complete new cozaint.com. Plain static files (HTML, CSS, JS, images, videos, PDFs).
No database, no CMS, no server-side code, no build step. All links are relative.

ESSENTIAL STEPS
1. Back up the current site and keep its hosting until the new site passes the checklist.
2. Upload everything INSIDE the "site" folder to the web root (index.html at the top level).
   HTTPS on; index.html as default document; normal MIME types (.mp4 video/mp4);
   byte-range requests on (needed for video on iPhone/Safari). Keep file names exactly as they are.
3. 301-redirect old addresses: /about -> /about.html, /team -> /team.html,
   /podcasts -> /podcasts.html, /bobbym -> /bobbym.html; other old pages to the closest new page.
4. BOBBY VMS software (3 files from Omar): put on the server, then in downloads.html replace
   the three placeholder rows (see the WEBMASTER comment in that file, and section 7 of the docx).
5. Forms: work now by email to info@cozaint.com. To connect EspoCRM later, paste its Lead
   Capture address into lead-config.js (one file only). See section 8 of the docx.
6. Run the launch checklist in section 9 of the docx.

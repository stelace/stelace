# Stelace Email plugin

This plugin enables Email API with Nodemailer.

## Testing environment

Emails are not sent but stored in `build` folder of this plugin.
Some tests will send actually emails via external fake SMTP service [Ethereal](https://ethereal.email).

## Debugging

To activate the debugging and send emails for real, `NODE_ENV` must not be `test`.

You can add `DEBUG_EMAILS=user1@example.com,user2@example.com` to your `.env` file so that:

- Emails are sent to debug recipient(s) instead of recipient(s) specified via Stelace API.
- `[DEBUG]` tag will be prepended to email subject.
- `[ORIGINAL RECIPIENTS: recipient1@example.com...]` will be appended to subject

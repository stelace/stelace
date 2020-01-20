FROM node:12.14-alpine

# Puppeteer installation process inspired by:
# https://github.com/GoogleChrome/puppeteer/issues/1793#issuecomment-442730223

ENV CHROME_BIN="/usr/bin/chromium-browser"

RUN apk --no-cache add \
  python \
  make \
  g++ \
  git \
  # Puppeteer/chromium
  udev \
  ttf-freefont \
  chromium

WORKDIR /usr/src/app

USER node

CMD [ "node", "start.js" ]

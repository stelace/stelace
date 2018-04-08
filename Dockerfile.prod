FROM node:8.4.0

RUN apt-get update && apt-get install -y \
  git \
  vim \
  libpng12-dev \
  libjpeg62-turbo-dev \
  libjasper-dev \
  libghc-bmp-dev \
  && rm -rf /var/lib/apt/lists/*

RUN cd /tmp && wget http://freefr.dl.sourceforge.net/project/graphicsmagick/graphicsmagick/1.3.24/GraphicsMagick-1.3.24.tar.gz \
  && tar xzfv GraphicsMagick-1.3.24.tar.gz \
  && cd GraphicsMagick-1.3.24 \
  && ./configure \
  && make \
  && make install

RUN npm install -g --progress=false \
  bower \
  gulp

COPY package.json bower.json /tmp/

RUN cd /tmp && npm install
RUN cd /tmp && bower install --allow-root
RUN mkdir -p /usr/src/app && cd /usr/src/app && ln -s /tmp/node_modules \
  && mkdir -p /usr/src/app/assets && cd /usr/src/app/assets && ln -s /tmp/bower_components

RUN mkdir -p /tmp/assets/vue
COPY assets/vue/package.json assets/vue/yarn.lock /tmp/assets/vue/
RUN cd /tmp/assets/vue && yarn
RUN mkdir -p /usr/src/app/assets/vue && cd /usr/src/app/assets/vue && ln -s /tmp/assets/vue/node_modules

COPY . /usr/src/app

WORKDIR /usr/src/app/assets/vue
RUN yarn build

WORKDIR /usr/src/app
RUN gulp build-prod

#USER node # Uncomment this line when we find a way to create files without being root

WORKDIR /usr/src/app

EXPOSE 1337

CMD ["npm", "start"]

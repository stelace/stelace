# Stelace

Stelace helps entrepreneurs create online marketplaces and communities in no time to let them focus on experimenting and growing their audience.

This repository includes all marketplace features and integrations. Stelace marketplace launcher, automatic setup and cloud hosting are also available [without a line of code](https://stelace.com).

---

## Warning

Stelace is under active development, with *massive* ongoing updates.

**Everything will break in unexpected ways until v1 is released.**

![Stelace pre-launch](https://media.giphy.com/media/26xBEamXwaMSUbV72/giphy.gif)

---

## Contents

<!-- TOC -->

- [Stelace](#stelace)
    - [Warning](#warning)
    - [Contents](#contents)
    - [Features](#features)
    - [Environment](#environment)
        - [Install environment](#install-environment)
            - [Install Node.js](#install-nodejs)
                - [Node version warning](#node-version-warning)
                - [Node.js global dependencies](#nodejs-global-dependencies)
            - [Install MySQL](#install-mysql)
            - [Install GraphicsMagick](#install-graphicsmagick)
            - [Install local dependencies](#install-local-dependencies)
        - [Configure environment](#configure-environment)
            - [Create the MySQL database](#create-the-mysql-database)
            - [Create the local config](#create-the-local-config)
            - [PhantomJS symbolic link](#phantomjs-symbolic-link)
            - [Install Docker CE](#install-docker-ce)
        - [Run environment](#run-environment)
        - [Update environment](#update-environment)
        - [Backup database](#backup-database)
            - [Export the MySQL database](#export-the-mysql-database)
            - [Import the MySQL database](#import-the-mysql-database)
    - [Ongoing](#ongoing)
    - [Open source alternatives](#open-source-alternatives)
    - [License](#license)

<!-- /TOC -->

## Features

- Listing management
- Delayed payments (Stripe / Mangopay)
- Marketplace fees
- Advanced search (Elasticsearch)
- Maps (Google Maps)
- Booking calendars
- Flexible listing types and workflows
- Validation steps
- User ratings & public accounts
- Gamification
- Messaging
- Emailing
- Angular templates
- Translations
- …


## Environment
### Install environment

Instructions are given for Ubuntu 16.04 LTS but should not vary so much in other Unix environments.
#### Install Node.js
    sudo apt-get install npm
    sudo npm install -g n
    sudo n stable

To install a specific version or switch to a pre-installed version:

    sudo n [version]

> Recommended version: Node 8

To list all possible versions of Node:

    n list

To display help:

    n -h

##### Node version warning
Each time you change the version of Node.js, you need to reinstall npm because it's overridden.

    sudo npm install -g npm

And if you switch to another major version of Node.js (Major.Minor.Patch, see http://semver.org), you also need to reinstall all Node.js dependencies (global and local). See the section [Update environment](#update-environment).


##### Node.js global dependencies
    sudo npm install -g node-gyp
    sudo npm install -g sails@1.0.0-45
    sudo npm install -g gulp
    sudo npm install -g bower
    sudo npm install -g bunyan


#### Install MySQL

    sudo apt-get install mysql-server

> Required version: >= 5.7

Enter your identifiers (the following parameters can be used in dev environment):
> user: root
password: [pwd]

#### Install GraphicsMagick
=> http://www.graphicsmagick.org/INSTALL-unix.html

**Download the archive**

    cd /path/to/tmp
    wget http://freefr.dl.sourceforge.net/project/graphicsmagick/graphicsmagick/1.3.24/GraphicsMagick-1.3.24.tar.gz

**Extract the archive**

    tar xzfv GraphicsMagick-1.3.24.tar.gz

**Install the JPEG and PNG libraries**

    sudo apt-get install libpng12-dev \
    libjpeg62-dev libjasper-dev libghc-bmp-dev

**Install the package**

    cd GraphicsMagick-1.3.24
    ./configure
    make
    sudo make install


#### Install local dependencies

    cd /path/to/project
    npm install
    bower install

### Configure environment

#### Create the MySQL database

**Connect to MySQL**

    mysql -u [user] -p

> TIP: Omit the "p" parameter if no password is set.

**Create the project database**

    create schema [database_name];
    exit


#### Create the local config

    cp config/local.js.example config/local.js

- Fill the MySQLServer connection info
> user, password, database

- Fill the directories absolute paths info
> tmpDir, uploadDir, snapshotsDir

> For instance, if your project is located at /path/to/project, you can set the following parameters:
tmpDir: "/path/to/project-external/tmp"
uploadDir: "/path/to/project-external/upload"
snapshotsDir: "/path/to/project-external/snapshots"

- Set `debugMail` and `debugSms` email addresses if you want to test emails (emails will be sent to debug email addresses instead of real ones)

- Uncomment `migrate: "safe"` and comment `migrate: "alter"` option after populating database with first `sails lift` command, to speed up sails start
>Start once with "alter" when some model changes


#### PhantomJS symbolic link

    ln -s node_modules/phantomjs/bin/phantomjs

> (optional, useful to debug phantom scripts)


####Install Docker CE

Please go to [Docker website](https://docs.docker.com/install/#server) to install Docker CE. Choose the right installation guide for your system.


### Run environment

Open 2 terminals: 1 for client-side and 1 for server-side.

- For client-side: `gulp`

- For server-side: `sails lift`

Now go to the url: http://localhost:3000. Stelace should be up and running!

Launch Elasticsearch to search listings:
`./elasticsearch-run.sh`



**Populate database**

    node scripts_migration/createListingTypes.js


**Gulp tasks**

- Build assets and watch them `gulp`

- Build assets once `gulp build`

- Build assets once with production optimization `gulp build-prod`

- Clean tmp and build folders `gulp clean-build`


**Development tips**

- If you modify server-side files, don’t forget to restart the server

- Usually on client-side, you want the auto-reload. But you can also use `gulp build` rather than `gulp` to get static build served at http://localhost:1337.

> If you have problems with gulp-watch
https://stackoverflow.com/questions/16748737/grunt-watch-error-waiting-fatal-error-watch-enospc
    echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p




### Update environment

May be useful when breaking things:

**Reinstall Node.js local dependencies**

    cd /path/to/project
    rm -R node_modules
    npm cache clean (optional: do it if the whole process doesn't work)
    npm install

> You may also want to reinstall Node.js global dependencies.

**Reinstall Bower components**

    cd /path/to/project
    rm -R assets/bower_components
    bower cache clean (optional: do it if the whole process doesn't work)
    bower install



### Backup database

#### Export the MySQL database
=> http://dba.stackexchange.com/questions/50664/best-practices-for-backing-up-a-mysql-db

Using mysqldump for exporting "small" dataset is ok (< 10GB).

    mysqldump -u [user] -p --single-transaction --default-character-set=utf8mb4 [database_name] > [filename].sql

#### Import the MySQL database

    mysql -u [user] -p --default-character-set=utf8mb4 [database_name] < [filename].sql

## Ongoing

- Easier environment setup with docker and setup tools
- Internationalization (i18n branch)
- Stripe Connect integration
- Docs

## Open source alternatives
- [Sharetribe](https://github.com/sharetribe/sharetribe)
- [Cocorico](https://github.com/Cocolabs-SAS/cocorico)
- *Add yours*

## License
Stelace is open source under the terms of the [MIT license](LICENSE).

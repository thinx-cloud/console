# This is a portable development environment image for building and testing the Console

# docker build -t thinxcloud/console-build-env .

FROM ubuntu:bionic
USER root

# Install, build, protect (dependencies for Cypress, NodeJS/NPM and eslint)
RUN apt-get update \
    && apt-get install -y -qq curl libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb \
    && curl -fsSL https://deb.nodesource.com/setup_17.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@8.5.5 \
    && npm install node-gyp eslint -g
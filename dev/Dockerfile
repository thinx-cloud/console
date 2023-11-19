# This is a portable development environment image for building and testing the Console

# docker build -t thinxcloud/console-build-env .

FROM ubuntu:latest
USER root

# Install, build, protect (dependencies for Cypress, NodeJS/NPM and eslint)
RUN apt-get update \
    && apt-get install -y -qq curl python3 g++ build-essential libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb git \
    && curl -L https://deb.nodesource.com/nsolid_setup_deb.sh | bash -s -- 21 \
    && apt-get install -y nodejs \
    && npm install -g npm \
    && npm install node-gyp eslint -g \
    apt-get clean
# This is a portable development environment image for building and testing the Console

# docker build -t thinxcloud/console-build-env:vue .

FROM debian:bookworm-20250428-slim

ENV DEBIAN_FRONTEND=noninteractive

ENV NODE_OPTIONS=--openssl-legacy-provider

USER root

# Install, build, protect (dependencies for Cypress, NodeJS/NPM and eslint)
RUN apt-get update
RUN apt-get install -y -qq curl 

## Install Cypress Dependencies
RUN apt-get install -y libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 build-essential git libxtst6 xauth xvfb ca-certificates procps && apt-get clean

# Install Node.js v22.x using nvm
# Install NVM
ENV NVM_DIR=/root/.nvm
ENV NODE_VERSION=22

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && \
    . "$NVM_DIR/nvm.sh" && \
    nvm install $NODE_VERSION && \
    nvm use $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    # Make node/npm available globally
    ln -s $NVM_DIR/versions/node/v$NODE_VERSION/bin/node /usr/bin/node && \
    ln -s $NVM_DIR/versions/node/v$NODE_VERSION/bin/npm /usr/bin/npm && \
    ln -s $NVM_DIR/versions/node/v$NODE_VERSION/bin/npx /usr/bin/npx && \
    npm install -g npm yarn eslint node-gyp

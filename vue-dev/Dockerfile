# This is a portable development environment image for building and testing the Console

# docker build -t thinxcloud/console-build-env:vue .

FROM debian:13.5-slim

ENV DEBIAN_FRONTEND=noninteractive

ENV NODE_OPTIONS=--openssl-legacy-provider

USER root

# Install, build, protect (dependencies for Cypress, NodeJS/NPM and eslint)
RUN apt-get update
RUN apt-get install -y -qq curl 

## Install Cypress Dependencies
RUN apt-get install -y libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libnss3 libxss1 libasound2t64 build-essential git libxtst6 xauth xvfb ca-certificates procps && apt-get clean

# Install Node.js v25.x using nvm
# Install NVM
ENV NVM_DIR=/root/.nvm
ENV NODE_VERSION=25

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && \
    . "$NVM_DIR/nvm.sh" && \
    nvm install $NODE_VERSION && \
    nvm use $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    npm install -g npm yarn eslint node-gyp && \
    # Expose the resolved nvm bin dir (v25 -> v25.9.0) under a stable path,
    # so node/npm/npx/yarn/eslint resolve in non-login shells too (CI runs bash -eo pipefail).
    ln -s "$(dirname "$(nvm which $NODE_VERSION)")" /usr/local/nvm-bin

ENV PATH=/usr/local/nvm-bin:$PATH

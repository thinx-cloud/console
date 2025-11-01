# This is a portable development environment image for building and testing the Console

# docker build -t thinxcloud/console-build-env .

FROM ubuntu:latest
USER root

# Install, build, protect (dependencies for Cypress, NodeJS/NPM and eslint)
RUN apt-get update \
    && apt-get install -y -qq curl gnupg2 python3 g++ build-essential libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libnss3 libxss1 libxtst6 xauth xvfb git procps \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_25.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y -qq nodejs \
    && npm install -g npm \
    && npm install node-gyp eslint -g \
    apt-get clean
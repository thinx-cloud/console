# This is a portable development environment image for building and testing the Console

# docker build -t thinxcloud/console-build-env:vue .

FROM debian:bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

ENV NODE_OPTIONS=--openssl-legacy-provider

#USER root

# Install, build, protect (dependencies for Cypress, NodeJS/NPM and eslint)
RUN apt-get update
RUN apt-get install -y -qq curl 

## Install Cypress Dependencies
RUN apt-get install -y libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb ca-certificates procps && apt-get clean

# Install Node.js v17.x
RUN curl -fsSL https://deb.nodesource.com/setup_21.x | bash -

RUN apt-get install -y nodejs

## Install Node dependencies
RUN npm install -g npm yarn eslint node-gyp

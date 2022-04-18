# This is a portable development environment image for building and testing the THiNX Vue Console

# docker build -t thinxcloud/console-build-env:vue .

FROM ubuntu:impish

ENV DEBIAN_FRONTEND=noninteractive

#USER root

# Install, build, protect (dependencies for Cypress, NodeJS/NPM and eslint)
RUN apt-get update \
    && apt-get install --no-install-recommends -y -qq curl \
    && apt-get install --no-install-recommends -y libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb \
     && curl -fsSL https://deb.nodesource.com/setup_17.x | bash - \
     && apt-get install -y nodejs \
     && apt-get clean \
     && rm -rf /var/lib/apt/lists/*

## Install Node dependencies
RUN npm install -g npm yarn eslint cypress

RUN node --version

#
# Until all of the Cypress dependencies will be available on Alpine, we're using Ubuntu above.
#

#FROM alpine:latest

#RUN apk update
#RUN apk add --update nodejs npm curl yarn
#RUN apk add xvfb xauth
#RUN TODO: add libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6

# install latest yarn
#RUN curl --compressed -o- -L https://yarnpkg.com/install.sh | sh

#RUN npm install cypress -g
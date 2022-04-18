# This is a portable development environment image for building and testing the Console

# docker build -t thinxcloud/console-build-env:vue .

FROM ubuntu:impish

ENV DEBIAN_FRONTEND=noninteractive

#USER root

# Install, build, protect (dependencies for Cypress, NodeJS/NPM and eslint)
RUN apt-get update
RUN apt-get install -y -qq curl 

## Install Cypress Dependencies
RUN apt-get install -y libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb

# Install Node.js v17.x
RUN curl -fsSL https://deb.nodesource.com/setup_17.x | bash -

RUN apt-get install -y nodejs

## Install Node dependencies
RUN npm install -g npm yarn eslint node-gyp

#FROM alpine:latest

#RUN apk update
#RUN apk add --update nodejs npm curl yarn
#RUN apk add xvfb xauth

# install latest yarn
#RUN curl --compressed -o- -L https://yarnpkg.com/install.sh | sh

#RUN npm install cypress -g
# This is a portable development environment image for building and testing the Console

# docker build -t thinxcloud/console-build-env:vue .

#FROM ubuntu:bionic
#USER root

# Install, build, protect (dependencies for Cypress, NodeJS/NPM and eslint)
#RUN apt-get update
#RUN  apt-get install -y -qq curl libgtk-3-0 libgtk2.0-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb
#RUN  curl -fsSL https://deb.nodesource.com/setup_17.x | bash -
#RUN  apt-get install -y nodejs
#RUN  npm install -g npm yarn eslint node-gyp

FROM alpine:latest

RUN apk update
RUN apk add --update nodejs npm curl yarn

# install latest yarn
RUN curl --compressed -o- -L https://yarnpkg.com/install.sh | sh
# docker build -t thinx/console .

FROM thinxcloud/console-build-env:vue

ARG COMPOSE_PROJECT_NAME
ARG LANDING_HOSTNAME
ARG WEB_HOSTNAME
ARG API_HOSTNAME
ARG API_BASEURL
ARG ENTERPRISE
ARG ENVIRONMENT
ARG GOOGLE_ANALYTICS_ID
ARG ROLLBAR_ACCESS_TOKEN
ARG CRISP_WEBSITE_ID
ARG GOOGLE_MAPS_APIKEY

ARG VUE_APP_CRISP_WEBSITE_ID
ARG VUE_APP_API_HOSTNAME
ARG VUE_APP_ROLLBAR_ACCESS_TOKEN
ARG VUE_APP_LANDING_HOSTNAME
ARG VUE_APP_GOOGLE_ANALYTICS_ID
ARG VUE_APP_GOOGLE_MAPS_APIKEY
ARG VUE_APP_CONSOLE_HOSTNAME

ENV COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}
ENV LANDING_HOSTNAME=${LANDING_HOSTNAME}
ENV WEB_HOSTNAME=${WEB_HOSTNAME}
ENV API_HOSTNAME=${API_HOSTNAME}
ENV API_BASEURL=${API_BASEURL}
ENV ENTERPRISE=${ENTERPRISE}
ENV ENVIRONMENT=${ENVIRONMENT}
ENV GOOGLE_ANALYTICS_ID=${GOOGLE_ANALYTICS_ID}
ENV ROLLBAR_ACCESS_TOKEN=${ROLLBAR_ACCESS_TOKEN}
ENV CRISP_WEBSITE_ID=${CRISP_WEBSITE_ID}
ENV GOOGLE_MAPS_APIKEY=${GOOGLE_MAPS_APIKEY}

ENV NGINX_HOST=${WEB_HOSTNAME}
ENV NGINX_PORT=80
ENV CACHEBUST=1

ENV VUE_APP_CRISP_WEBSITE_ID=${VUE_APP_CRISP_WEBSITE_ID}
ENV VUE_APP_API_HOSTNAME=${VUE_APP_API_HOSTNAME}
ENV VUE_APP_ROLLBAR_ACCESS_TOKEN=${VUE_APP_ROLLBAR_ACCESS_TOKEN}
ENV VUE_APP_LANDING_HOSTNAME=${VUE_APP_LANDING_HOSTNAME}
ENV VUE_APP_GOOGLE_ANALYTICS_ID=${VUE_APP_GOOGLE_ANALYTICS_ID}
ENV VUE_APP_GOOGLE_MAPS_APIKEY=${VUE_APP_GOOGLE_MAPS_APIKEY}
ENV VUE_APP_CONSOLE_HOSTNAME=${VUE_APP_CONSOLE_HOSTNAME}

ENV NODE_OPTIONS=--openssl-legacy-provider
ENV NODE_ENV=production

USER root

# Create app directory
WORKDIR /home/node/build

# Install app dependencies & source code
COPY package.json ./

COPY . .

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

#  && which nvm fails
RUN bash -c 'whoami && uname -a'

## . ~/.nvm/nvm.sh && fails
RUN bash -c 'ls -la /root && find / -name "nvm.sh" && nvm use 22 && yarn && yarn build'

#
# Deployment Image
#

# needs to include gulp
FROM nginx:1.28.0-alpine

RUN apk add procps

WORKDIR /usr/share/nginx/html
COPY --from=0 /home/node/build/dist .

COPY default.conf /etc/nginx/conf.d/default.conf

# Expose port (HOST:CONTAINER; nginx, may be configured from outside with docker-compose)
EXPOSE 7440:80
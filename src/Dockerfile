# docker build -t thinx/console .

FROM thinxcloud/console-build-env

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
ARG COMMIT_ID

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
ENV COMMIT_ID=${COMMIT_ID}

ENV NGINX_HOST=${WEB_HOSTNAME}
ENV NGINX_PORT=80
ENV CACHEBUST=1

# Create app directory
WORKDIR /home/node/build

# Install app dependencies & source code
COPY package.json ./

COPY . .

# this should be in the build-image that will may go change for Vue
RUN apt-get update && apt-get install -y git

RUN npm install -g npm \
    && npm install . \
    && npm run build

#
# Deployment Image
#

# needs to include gulp
FROM nginx:1.20-alpine

WORKDIR /usr/share/nginx/html
COPY --from=0 /home/node/build/html .

COPY default.conf /etc/nginx/conf.d/default.conf

# Only for Alpine, but the nginx is somewhere else then?
#COPY harden.sh .
#RUN chmod +x ./harden.sh
#RUN ./harden.sh
#USER user

# Expose port (HOST:CONTAINER; nginx, may be configured from outside with docker-compose)
EXPOSE 7440:80

LABEL "com.datadoghq.ad.check_names"='["nginx"]'
LABEL "com.datadoghq.ad.init_configs"='[{}]'
LABEL "com.datadoghq.ad.instances"='[{"nginx_status_url": "http://%%host%%:%%port%%/nginx_status"}]'
LABEL "com.datadoghq.ad.logs"='[{"source": "nginx", "service": "webapp"}]'
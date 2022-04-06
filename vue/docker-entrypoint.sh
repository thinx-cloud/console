#!/bin/bash

#
# Section: Docker-in-Docker
#

# +e = prevents exit immediately if a command exits with a non-zero status (like StrictHostKeyChecking without a key...).

set +e

if [[ ${ENVIRONMENT} == "test" ]]; then
  echo "[thinx-entrypoint] Running in TEST MODE!"
  
  yarn test:e2e:ci

  # this is broken
  # bash <(curl -Ls https://coverage.codacy.com/get.sh) report --project-token ${CODACY_PROJECT_TOKEN}
  
  curl https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-4.6.2.2472-linux.zip -o sonar-scanner-cli-4.6.2.2472-linux.zip
  rm -rf ./sonar-scanner-cli-4.6.2.2472-linux
  7z x ./sonar-scanner-cli-4.6.2.2472-linux.zip > /dev/null
  export PATH=$PATH:$(pwd)/sonar-scanner-4.6.2.2472-linux/bin/
  # rm -rf /opt/thinx/thinx-device-api/sonar-scanner-4.6.2.2472-linux/jre/legal/
  # rm -rf spec/test_repositories/**
  # sonar-scanner -Dsonar.login=${SONAR_TOKEN}
  
  set -e
  
else
  echo "[thinx-entrypoint] Starting in production mode..."
  # tee is used to split pipe with application logs back to file which
  # is observed by the app. this way the app can map own incidents in log-flow actively
  yarn build | tee -ipa /opt/thinx/.pm2/logs/index-out-1.log
fi

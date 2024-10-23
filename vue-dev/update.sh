#!/bin/bash

docker buildx build --platform=linux/amd64 \
-t thinxcloud/console-build-env:vue .

docker push thinxcloud/console-build-env:vue

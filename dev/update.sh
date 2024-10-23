#!/bin/bash

# --platform linux/arm64/v8,linux/amd64

docker buildx build --push \
--platform linux/amd64 \
-t thinxcloud/console-build-env .

# THiNX Console Development Environment

This Docker image serves as development environment for THiNX.

This is to make sure all developers will work in same environment with versioned toolset and the builds will be as fast as possible.

It serves also as base image for Circle CI testing, to make sure developers will run tests in same environment as in the CI/CD pipeline. This prevents unwanted test environment split.

### Recommendations

* Map your repository working copy as volume and use your existing Git client

### Security Note

This image is not part of production runtime. In case it has some system package vulnerabilities, those apply to the dockerized development environment only and will not transfer to the built source-code (does not apply to npm dependencies, of course).
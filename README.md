# THiNX Management Console

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fsuculent%2Fthinx-console.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fsuculent%2Fthinx-console?ref=badge_shield)[![Total alerts](https://img.shields.io/lgtm/alerts/g/suculent/thinx-console.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/suculent/thinx-console/alerts/)

AngularJS web application to manage IoT devices via [THiNX API](https://github.com/suculent/thinx-device-api).

## Usage

You need to **BUILD YOUR OWN CONSOLE** Docker image, because the build injects various static variables specific for your environment (e.g. API Keys) into HTML on build (see .circleci/config.yml for list of required build-args until this is documented).

For that reason, no pre-built public thinxcloud/console Docker Hub Image is/will be available.

## Build Configuration

You can build your own image using `docker build -t yourname\console` and following environment variables will be injected to static HTML on build:

| Variable name          | Example                          | Purpose                          | Default                 |
|:-----------------------|:---------------------------------|:---------------------------------|:------------------------|
| `LANDING_HOSTNAME`     | https://thinx.yourdomain.tld     | Link to landing page             | https://thinx.cloud     |
| `API_HOSTNAME`         | https://api.thinx.yourdomain.tld | Link to API                      | https://api.thinx.cloud |
| `API_BASEURL`          | api.thinx.yourdomain.tld         | Link to API without protocol     | api.thinx.cloud         |
| `WEB_HOSTNAME`         | console.thinx.yourdomain.tld     | Link to Console without protocol | rtm.thinx.cloud     |
| `ENTERPRISE`			| true or false                    | disables Google/GitHub SSO       | false                   |
| `ENVIRONMENT`			| production                       | Console build config             | development             |
| `ROLLBAR_ACCESS_TOKEN` | -                                | Integration                      | see Rollbar             |
| `GOOGLE_ANALYTICS_ID`  | -                                | Integration                      | see GAI                 |
| `CRISP_WEBSITE_ID`     | -                                | Integration                      | see Crisp.io            |

**Security Notice: Do not push build results to public Docker Hub repository or your envinronment variables might become public. Do not store environment variables in your repo's fork.**


## License

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fsuculent%2Fthinx-console.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fsuculent%2Fthinx-console?ref=badge_large)

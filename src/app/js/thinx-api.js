// Thninx API Ajax Class
var urlBase = "<ENV::apiBaseUrl>";

if (urlBase.indexOf("localhost") !== -1) {
  $.ajaxSetup({
    contentType: "application/json; charset=utf-8"
  });
} else {
  $.ajaxSetup({
    contentType: "application/json; charset=utf-8",
    xhrFields: {
      withCredentials: urlBase.indexOf("localhost") !== -1 ? false : true
    }
  });
}

// eslint-disable-next-line  no-redeclare
var Thinx = {
  // RSA
  apikeyList: function () {
    return apikeyList();
  },
  createApikey: function (apikeyAlias) {
    return createApikey(apikeyAlias);
  },
  revokeApikeys: function (fingerprints) {
    return revokeApikeys(fingerprints);
  },
  // RSA keys (obsolete!!!)
  rsakeyList: function () {
    return rsakeyList();
  },
  addRsakey: function (rsakeyName, rsakeyValue) {
    return addRsakey(rsakeyName, rsakeyValue);
  },
  revokeRsakeys: function (fingerprints) {
    return revokeRsakeys(fingerprints);
  },

  // Deploy keys
  deploykeyList: function () {
    return deploykeyList();
  },
  createDeploykey: function () {
    return createDeploykey();
  },
  revokeDeploykeys: function (filenames) {
    return revokeDeploykeys(filenames);
  },

  // Channels
  channelList: function () {
    return channelList();
  },
  createChannel: function (meshId, alias, ownerId) {
    return createChannel(meshId, alias, ownerId);
  },
  revokeChannels: function (ownerId, meshIds) {
    return revokeChannels(ownerId, meshIds);
  },
  attachChannel: function (meshId, deviceUdid) {
    return attachChannel(meshId, deviceUdid);
  },
  detachChannel: function (meshId, deviceUdid) {
    return detachChannel(meshId, deviceUdid);
  },
  // SOURCE
  sourceList: function () {
    return sourceList();
  },
  addSource: function (sourceUrl, sourceAlias, sourceBranch, sourceCircleToken, $sourceGitSecret) {
    return addSource(sourceUrl, sourceAlias, sourceBranch, sourceCircleToken, $sourceGitSecret);
  },
  revokeSources: function (sourceIds) {
    return revokeSources(sourceIds);
  },
  // RSA
  enviroList: function () {
    return enviroList();
  },
  addEnviro: function (enviroName, enviroValue) {
    return addEnviro(enviroName, enviroValue);
  },
  revokeEnviros: function (names) {
    return revokeEnviros(names);
  },
  // DEVICE
  deviceList: function () {
    return deviceList();
  },
  submitDevice: function (deviceForm) {
    return submitDevice(deviceForm);
  },
  revokeDevices: function (deviceUdids) {
    return revokeDevices(deviceUdids);
  },
  transferDevices: function (transferForm, deviceUdids) {
    return transferDevices(transferForm, deviceUdids);
  },
  pushConfig: function (configForm, deiceUdids) {
    return pushConfig(configForm, deiceUdids);
  },
  attachSource: function (sourceId, deviceUdid) {
    return attachSource(sourceId, deviceUdid);
  },
  detachSource: function (deviceUdid) {
    return detachSource(deviceUdid);
  },
  build: function (deviceUdid, sourceId) {
    return build(deviceUdid, sourceId);
  },
  getLatestFirmwareEnvelope: function (deviceUdid) {
    return getLatestFirmwareEnvelope(deviceUdid);
  },
  getArtifacts: function (deviceUdid, build_id) {
    return getArtifacts(deviceUdid, build_id);
  },
  // PROFILE
  getProfile: function () {
    return getProfile();
  },
  submitProfile: function (profile) {
    return submitProfile(profile);
  },
  submitProfileAvatar: function (avatar) {
    return submitProfileAvatar(avatar);
  },
  submitProfileChanges: function (changes, profile) {
    return submitProfileChanges(changes, profile);
  },
  userDelete: function (deleteForm) {
    return userDelete(deleteForm);
  },
  profileDownload: function () {
    return profileDownload();
  },
  getAuditHistory: function () {
    return getAuditHistory();
  },
  getBuildLog: function (buildId) {
    return getBuildLog(buildId);
  },
  tailBuildLog: function (buildId) {
    return tailBuildLog(buildId);
  },
  getBuildHistory: function () {
    return getBuildHistory();
  },
  getStats: function () {
    return getStats();
  },
  submitSystemMessage: function (messageForm) {
    return submitSystemMessage(messageForm);
  },
  checkToken: function (token) {
    return checkToken(token);
  },
  apiBaseUrl: function () {
    return urlBase;
  },
  init: function ($rootScope, $scope) {
    return init($rootScope, $scope);
  }
};

function init($rootScope, $scope) {

  console.log("THiNX API INIT");

  if (typeof ($rootScope.xhrFailedListener) === "undefined") {
    $rootScope.xhrFailedListener = $rootScope.$on("xhrFailed", function (event, error) {
      event.stopPropagation();
      xhrFailed(error);
    });
  }

  function xhrFailed(error) {
    console.log("## xhr failed: ", error);
    if (error.status == 401) {
      console.log("Error 401: Unauthorized Access");
      window.location = "/";
    }
  }

  if (typeof ($rootScope.updateSourcesListener) === "undefined") {
    $rootScope.updateSourcesListener = $rootScope.$on("updateSources", function (event, data) {
      event.stopPropagation();
      updateSources(data);
    });
  }

  function updateSources(response) {

    if (typeof (response.success) === "undefined" || !response.success) {
      console.log("Sources fetch error.");
      return;
    }

    $rootScope.sources = [];
    $.each(response.response, function (sourceId, value) {
      value.sourceId = sourceId;
      if (typeof (value.platform) === "undefined") {
        value.platform = "unknown";
      }
      if (typeof (value.is_private) === "undefined") {
        value.is_private = false;
      }
      value.base_platform = value.platform.split(":")[0];
      $rootScope.sources.push(value);
    });

    console.log("/////// sources:");
    $rootScope.$apply();

    // save user-spcific goal achievement
    if ($rootScope.profile.info.goals.length > 0) {
      if (!$rootScope.profile.info.goals.includes("source") && Object.keys($rootScope.sources).length > 0) {
        $rootScope.profile.info.goals.push("source");
        $scope.$emit("saveProfileChanges", ["goals"]);
      }
    }
  }

  if (typeof ($rootScope.updateApikeysListener) === "undefined") {
    $rootScope.updateApikeysListener = $rootScope.$on("updateApikeys", function (event, data) {
      event.stopPropagation();
      updateApikeys(data);
    });
  }

  function updateApikeys(response) {
    $rootScope.apikeys = response.response;
    console.log("//////// apikeys:");
    $rootScope.$apply();
  }

  if (typeof ($rootScope.updateRsakeysListener) === "undefined") {
    $rootScope.updateRsakeysListener = $rootScope.$on("updateRsakeys", function (event, data) {
      event.stopPropagation();
      updateRsakeys(data);
    });
  }

  function updateRsakeys(response) {
    $rootScope.rsakeys = response.response;
    $scope.$apply();
    console.log("//////// rsakeys:");

    // save user-spcific goal achievement
    if ($rootScope.profile.info.goals.length > 0) {
      if (!$rootScope.profile.info.goals.includes("rsakey") && $rootScope.rsakeys.length > 0) {
        $rootScope.profile.info.goals.push("rsakey");
        $scope.$emit("saveProfileChanges", ["goals"]);
      }
    }

    console.log("refreshing view...");
    $rootScope.$apply();
  }

  if (typeof ($rootScope.updateDeploykeysListener) === "undefined") {
    $rootScope.updateDeploykeysListener = $rootScope.$on("updateDeploykeys", function (event, data) {
      event.stopPropagation();
      updateDeploykeys(data);
    });
  }

  function updateDeploykeys(data) {
    $rootScope.deploykeys = data.response;
    $scope.$apply();
    console.log("//////// deploykeys:");

    // save user-spcific goal achievement
    if ($rootScope.profile.info.goals.length > 0) {
      if (!$rootScope.profile.info.goals.includes("deploykey") && $rootScope.deploykeys.length > 0) {
        $rootScope.profile.info.goals.push("deploykey");
        $scope.$emit("saveProfileChanges", ["goals"]);
      }
    }

    console.log("refreshing view...");
    $rootScope.$apply();
  }

  if (typeof ($rootScope.updateChannelsListener) === "undefined") {
    $rootScope.updateChannelsListener = $rootScope.$on("updateChannels", function (event, data) {
      event.stopPropagation();
      updateChannels(data);
    });
  }

  function updateChannels(response) {
    if (typeof (response.response) === "undefined") {
      console.log("ERROR: Invalid channel data...");
      return;
    }

    $rootScope.channels = response.response;
    $scope.$apply();
    console.log("//////// channels:");

    // save user-spcific goal achievement
    if ($rootScope.profile.info.goals.length > 0) {
      if (!$rootScope.profile.info.goals.includes("channel") && $rootScope.channels.length > 0) {
        $rootScope.profile.info.goals.push("channel");
        $scope.$emit("saveProfileChanges", ["goals"]);
      }
    }

    console.log("refreshing view...");
    $rootScope.$apply();
  }

  if (typeof ($rootScope.updateDevicesListener) === "undefined") {
    $rootScope.updateDevicesListener = $rootScope.$on("updateDevices", function (event, data) {
      event.stopPropagation();
      updateDevices(data);
    });
  }

  function updateDevices(response) {
    $rootScope.devices = [];
    let devices = response.response;
    console.log("updateDevices with data", devices);
    for (var d in devices) {
      devices[d].base_platform = devices[d].platform.split(":")[0];
      $rootScope.devices.push(devices[d]);
    }
    updateTags();

    console.log("//////// devices:");

    $rootScope.meta.apikeys = {};
    $rootScope.meta.sources = {};
    $rootScope.meta.transformerDevices = {};

    // calculate device timeline
    if (typeof ($rootScope.devices) !== "undefined" && $rootScope.devices.length > 0) {
      updateTimeline();
    }

    $scope.$apply();

    // save user-spcific goal achievements
    if ($rootScope.profile.info.goals.length > 0) {
      if (!$rootScope.profile.info.goals.includes("enroll") && $rootScope.devices.length > 0) {
        // TODO enable
        $rootScope.profile.info.goals.push("enroll");
        $rootScope.profile.info.goals.push("enroll-setup");
        $scope.$emit("saveProfileChanges", ["goals"]);
      }
    }
  }

  function updateTimeline() {

    var deviceTimeline = [];

    for (var i in $rootScope.devices) {
      $rootScope.devices[i].lastseen = moment($rootScope.devices[i].lastupdate).fromNow(true);

      // iterate all device transformers and put them to meta container organised by utid
      if (typeof ($rootScope.devices[i].transformers) !== "undefined" && $rootScope.devices[i].transformers.length > 0) {
        for (var transformerIndex in $rootScope.devices[i].transformers) {
          var utid = $rootScope.devices[i].transformers[transformerIndex];
          if (typeof ($rootScope.meta.transformerDevices[utid]) === "undefined") {
            $rootScope.meta.transformerDevices[utid] = [];
          }
          $rootScope.meta.transformerDevices[utid].push($rootScope.devices[i].udid);
        }
      }

      // copy records to dashboard timeline
      deviceTimeline.push({
        date: moment($rootScope.devices[i].lastupdate).format("YYYY-MM-DD"),
        alias: $rootScope.devices[i].alias,
        icon: $rootScope.devices[i].icon,
        udid: $rootScope.devices[i].udid,
        category: $rootScope.devices[i].category
      });

      // generate list index of devices by attached apikey -> meta.apikeys
      if ($rootScope.getApikeyByHash($rootScope.devices[i].keyhash) != false) {
        if (typeof ($rootScope.meta.apikeys[$rootScope.devices[i].keyhash]) == "undefined") {
          $rootScope.meta.apikeys[$rootScope.devices[i].keyhash] = [];
        }
        $rootScope.meta.apikeys[$rootScope.devices[i].keyhash].push($rootScope.devices[i]);
      }

      // generate list index of devices by attached source -> meta.sources
      if ($rootScope.getSourceById($rootScope.devices[i].source) != false) {
        if (typeof ($rootScope.meta.sources[$rootScope.devices[i].source]) == "undefined") {
          $rootScope.meta.sources[$rootScope.devices[i].source] = [];
        }
        $rootScope.meta.sources[$rootScope.devices[i].source].push($rootScope.devices[i]);
      }

    }
    deviceTimeline.sort(function (a, b) {
      // Turn your strings into dates, and then subtract them
      // to get a value that is either negative, positive, or zero.
      return new Date(b.date) - new Date(a.date);
    });
    console.log("//////// deviceTimeline");

    $rootScope.stats.timeline.MIN = deviceTimeline[0]["date"];
    $rootScope.stats.timeline.MAX = deviceTimeline[deviceTimeline.length - 1]["date"];
    $rootScope.stats.timeline.COUNT = deviceTimeline.length - 1;
    $rootScope.stats.timeline.SPAN = moment($rootScope.stats.timeline.MAX).diff(moment($rootScope.stats.timeline.MIN), "days");
    $rootScope.stats.timeline.ERRORS = [];
    $rootScope.stats.timeline.CHECKINS = deviceTimeline;

    $rootScope.stats.total.DEVICES = $rootScope.devices.length;

  }

  function updateTags() {
    $rootScope.profile.info.tags = [];

    console.log("profile tags", $rootScope.profile.info.tags);

    for (let index in $rootScope.devices) {
      var tagsArray = $rootScope.devices[index].tags;
      if (tagsArray !== null) {
        for (var tagIndex in tagsArray) {
          if ($rootScope.profile.info.tags.includes(tagsArray[tagIndex])) {
            // duplicate tag found, skipping
            console.log("duplicate tag found, skipping", tagsArray[tagIndex]);
          } else {
            $rootScope.profile.info.tags.push(tagsArray[tagIndex]);
          }
        }
      }

    }
    console.log("tags:");
    console.log($rootScope.profile.info.tags);
  }

  if (typeof ($rootScope.submitNotificationResponseListener) === "undefined") {
    $rootScope.submitNotificationResponseListener = $rootScope.$on("submitNotificationResponse", function (event, data) {
      event.stopPropagation();
      submitNotificationResponse(data);
    });
  }

  function submitNotificationResponse(response) {
    var response_type = "string";
    if (typeof (response) === "boolean") {
      response_type = "bool";
    }

    return $.ajax({
      url: urlBase + "/device/notification",
      type: "POST",
      data: JSON.stringify({
        device: "nemam-udid",
        response_type: response_type,
        response: response
      }),
      dataType: "json",
      contentType: "application/json"
    });
  }

  // =================================================
  // API related functions

  $scope.$on("saveProfile", function (event) {
    // event.stopPropagation();
    console.log("SAVING PROFILE");
    submitProfile($rootScope.profile);
  });

  $scope.$on("saveProfileChanges", function (event, changes) {
    // event.stopPropagation();
    console.log("-- Saving Profile Changes: " + changes);
    submitProfileChanges(changes, $rootScope.profile);

    // update transformers
    if (changes.indexOf("transformers") > -1) {
      console.log("Transformers changed, updating metadata...");
      updateRawTransformers($rootScope.profile.info.transformers);
    }
  });

  $scope.$on("updateProfile", function (event, data) {
    updateProfile(data);
  });

  function updateProfile(response) {
    if ((typeof (response) === "undefined") || (typeof (response.success) === "undefined")) return;
    
    console.log("/////// Profile response:");

    // validate response and refresh view
    
    if (!response.success) {
      console.log("error", response);
      return;
    }

    var profile = response.response;

    // set default avatar if one's missing
    if (typeof (profile.avatar) === "undefined" || profile.avatar.length == 0) {
      console.log("- avatar not defined, falling back to default -");
      profile.avatar = "/assets/thinx/img/default_avatar_sm.png";
    }
    if (typeof (profile.info.goals) === "undefined") {
      console.log("- goals not defined, retaining current -");
      profile.info["goals"] = $rootScope.profile.info.goals;
    }
    if (typeof (profile.info.tags) === "undefined") {
      console.log("- tags not defined, creating -");
      profile.info["tags"] = $rootScope.profile.info.tags;
    }
    if (typeof (profile.info.transformers) === "undefined") {
      console.log("- transformers not defined, creating -");
      profile.info["transformers"] = $rootScope.profile.info.transformers;
    }
    $rootScope.profile = profile;

    updateRawTransformers($rootScope.profile.info.transformers);

    $scope.$apply();

    console.log("Emitting initWebsocket with owner_id", profile.owner);
    $scope.$emit("initWebsocket", profile.owner);
  }

  $scope.$on("updateRawTransformers", function (event, transformers) {
    $scope.$apply(function () {
      updateRawTransformers(transformers);
    });
  });

  function updateRawTransformers(transformers) {
    // decode all transformers
    console.log("Decoding Transformers...");
    for (let index in transformers) {
      $rootScope.meta.transformers[transformers[index].utid] =
      {
        "utid": transformers[index].utid,
        "alias": transformers[index].alias,
        // eslint-disable-next-line  no-undef
        "body": base64converter("decode", transformers[index].body),
        "changed": false
      };
    }

    console.log("/////// transformers:");
  }

  $scope.$on("updateAuditHistory", function (event, data) {
    updateAuditHistory(data);
  });

  var warningStr = "undefined";
  var dangerStr = "error";
  var invalidStr = "invalid";

  function updateAuditHistory(response) {
    console.log("/////// auditHistory response:");

    if (typeof (response.success) !== "undefined" && response.success) {
      $rootScope.auditlog = response.response;
      console.log("refreshing view...");
      if (typeof ($scope.chartRange) !== "undefined") {
        $scope.chart.computing = true;
      }

      var totalErrors = 0;
      var errorTimeline = {};
      for (let index in $rootScope.auditlog) {
        if (typeof ($rootScope.auditlog[index].message) !== "undefined") {
          if ($rootScope.auditlog[index].message.match(warningStr) !== null) {
            $rootScope.auditlog[index].flags.push("warning");
          }
          if ($rootScope.auditlog[index].message.match(dangerStr) !== null || $rootScope.auditlog[index].message.match(invalidStr) !== null) {
            $rootScope.auditlog[index].flags.push("danger");

            var errorDate = moment($rootScope.auditlog[index].date).format("YYYY-MM-DD");
            if (typeof (errorTimeline[errorDate]) == "undefined") {
              errorTimeline[errorDate] = 1;
            } else {
              errorTimeline[errorDate]++;
            }
            totalErrors++;
          }
        } else {
          // TODO: faulty audit log entries may be deleted
          console.log("History event missing message property - skipping...");
        }
      }
      $rootScope.stats.total.ERRORS = totalErrors;
      $rootScope.stats.timeline.ERRORS = errorTimeline;
      console.log($rootScope.stats.total.ERRORS);
      console.log($rootScope.stats.timeline.ERRORS);

      if (typeof ($scope.chartRange) !== "undefined") {
        $scope.chartRange($scope.chart.range);
      }
      $scope.$apply();
    } else {
      console.log("auditHistory fetch error.");
    }
  }

  $scope.$on("updateLatestFirmwareEnvelope", function (event, data) {
    updateLatestFirmwareEnvelope(data);
  });

  function updateLatestFirmwareEnvelope(data) {
    $rootScope.meta.latestFirmwareEnvelope = data;

    console.log("//////// envelope:");
    console.log(data);
    console.log("refreshing view...");
    $rootScope.$apply();
  }


  $scope.$on("updateStats", function (event, data) {
    updateStats(data);
  });

  function updateStats(response) {
    // sparkline stats defaults
    console.log("/////// stats data:");
    if (response.success) {
      var days = response.response;
      for (var prop in days) {
        var propTotal = 0;
        for (var i = 0; i < days[prop].length; i++) {
          propTotal = propTotal + parseInt(days[prop][i]);
        }
        $rootScope.stats.total[prop] = propTotal;
        $rootScope.stats.daily[prop] = days[prop];
      }
    }
  }


  $scope.$on("updateBuildHistory", function (event, data) {
    updateBuildHistory(data);
  });

  function sortByLastUpdate(b, a) {
    if (a.last_update < b.last_update) {
      return -1;
    }
    if (a.last_update > b.last_update) {
      return 1;
    }
    return 0;
  }

  function updateBuildHistory(response) {
    if (typeof (response.success) !== "undefined" && response.success) {
      console.log("buildHistory list length:", response.response.length);
      $rootScope.buildHistory = response.response;

      $rootScope.meta.builds = [];
      $rootScope.meta.deviceBuilds = {};

      console.log("Grouping Build Entries...");
      for (let index in response.response) {
        // reset device build history
        if (typeof ($rootScope.meta.deviceBuilds[response.response[index].udid]) == "undefined") {
          $rootScope.meta.deviceBuilds[response.response[index].udid] = [];
        }
        $rootScope.meta.deviceBuilds[response.response[index].udid].push({
          "build_id": response.response[index].build_id,
          "last_update": response.response[index].last_update,
          "timestamp": response.response[index].timestamp,
          "start_time": response.response[index].start_time,
          "state": response.response[index].state
        });

        if (typeof ($rootScope.meta.builds[response.response[index].build_id]) == "undefined") {
          $rootScope.meta.builds[response.response[index].build_id] = [];
        }
        $rootScope.meta.builds[response.response[index].build_id].push(response.response[index]);
      }

      // sort device build entries by date
      for (let index in $rootScope.meta.deviceBuilds) {
        $rootScope.meta.deviceBuilds[index].sort(sortByLastUpdate);
      }
      $scope.$apply();
    } else {
      console.log("buildHistory fetch error.");
    }
  }

  /*
  function registerNotification() {
    $webNotification.showNotification('Wohoo!', {
      body: 'Browser Notification Test Success.',
      icon: '/assets/thinx/img/favicon-32x32.png',
      onClick: function onNotificationClicked() {
        console.log('Notification clicked.');
      },
      autoClose: 4000 //auto close the notification after 4 seconds (you can manually close it via hide function)
    }, function onShow(error, hide) {
      if (error) {
        window.alert('Unable to show notification: ' + error.message);
      } else {
        console.log('Notification Shown.');

        setTimeout(function hideNotification() {
          console.log('Hiding notification....');
          hide(); //manually close the notification (you can skip this if you use the autoClose option)
        }, 5000);
      }
    });
  }
  */

  Thinx.getProfile()
    .done(function (data) {
      updateProfile(data);
    })
    .fail(error => $scope.$emit("xhrFailed", error));

  Thinx.getBuildHistory()
    .done(function (data) {
      updateBuildHistory(data);
    })
    .fail(error => $scope.$emit("xhrFailed", error));

}


//////////////////////// end of init

// Devices /user/devices
//
// deviceList GET /
function deviceList() {
  return $.ajax({
    url: urlBase + "/user/devices",
    type: "GET"
  });
}

function submitDevice(deviceForm) {
  var data = {
    changes: {
      udid: deviceForm.udid,
      alias: deviceForm.alias,
      platform: deviceForm.platform,
      keyhash: deviceForm.keyhash,
      description: deviceForm.description,
      auto_update: deviceForm.auto_update,
      category: deviceForm.category,
      tags: deviceForm.tags,
      icon: deviceForm.icon,
      transformers: deviceForm.transformers,
      timezone_abbr: deviceForm.timezone_abbr,
      timezone_offset: deviceForm.timezone_offset
    }
  };
  return $.ajax({
    url: urlBase + "/device/edit",
    type: "POST",
    data: JSON.stringify(data),
    dataType: "json",
    contentType: "application/json"
  });
}

function revokeDevices(deviceUdids) {
  return $.ajax({
    url: urlBase + "/device/revoke",
    type: "POST",
    data: JSON.stringify({ udids: deviceUdids }),
    dataType: "json",
    contentType: "application/json"
  });
}

function transferDevices(transferForm, deviceUdids) {
  return $.ajax({
    url: urlBase + "/transfer/request",
    type: "POST",
    data: JSON.stringify({
      udids: deviceUdids,
      to: transferForm.email,
      mig_sources: transferForm.mig_sources,
      mig_apikeys: transferForm.mig_apikeys
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function pushConfig(configForm, deviceUdids) {
  var enabledEnviros = [];
  for (let index in configForm.enviros) {
    if (configForm.enviros[index]) {
      enabledEnviros.push(index);
    }
  }
  return $.ajax({
    url: urlBase + "/device/push",
    type: "POST",
    data: JSON.stringify({
      enviros: enabledEnviros,
      udids: deviceUdids,
      reset_devices: configForm.resetDevices
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function attachSource(sourceId, deviceUdid) {
  return $.ajax({
    url: urlBase + "/device/attach",
    type: "POST",
    data: JSON.stringify({
      source_id: sourceId,
      udid: deviceUdid
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function detachSource(deviceUdid) {
  return $.ajax({
    url: urlBase + "/device/detach",
    type: "POST",
    data: JSON.stringify({
      udid: deviceUdid
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function getLatestFirmwareEnvelope(deviceUdid) {
  return $.ajax({
    url: urlBase + "/device/envelope",
    type: "POST",
    data: JSON.stringify({
      udid: deviceUdid
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function getArtifacts(deviceUdid, build_id) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", urlBase + "/device/artifacts", true);
    xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
    xhr.withCredentials = urlBase.indexOf("localhost") !== -1 ? false : true;
    xhr.responseType = "blob";
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(xhr.statusText);
    xhr.send(
      JSON.stringify({
        udid: deviceUdid,
        build_id: build_id
      })
    );
  });
}

function saveBlob(blob, fileName) {
  var a = document.createElement("a");
  a.href = window.URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
}

function submitSystemMessage(messageForm) {
  return $.ajax({
    url: urlBase + "/user/chat",
    type: "POST",
    data: JSON.stringify({
      message: messageForm.text
    }),
    dataType: "json",
    contentType: "application/json",
    success: function () {
      console.log("SUCCESS");
    },
    error: function () {
      console.log("ERROR");
    }
  });
}

function build(deviceUdid, sourceId) {
  return $.ajax({
    url: urlBase + "/build",
    type: "POST",
    data: JSON.stringify({
      build: {
        udid: deviceUdid,
        source_id: sourceId,
        dryrun: false
      }
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

// Apikeys /user/apikey
//
// apikeyList /list
// createApikey /
// revokeApikey [keyToRevoke] /
function apikeyList() {
  return $.ajax({
    url: urlBase + "/user/apikey/list",
    type: "GET"
  });
}

function createApikey(apikeyAlias) {
  return $.ajax({
    url: urlBase + "/user/apikey",
    type: "POST",
    data: JSON.stringify({
      alias: apikeyAlias
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function revokeApikeys(fingerprints) {
  return $.ajax({
    url: urlBase + "/user/apikey/revoke",
    type: "POST",
    data: JSON.stringify({ fingerprints: fingerprints }),
    dataType: "json",
    contentType: "application/json"
  });
}


// Rsakeys /user/rsakey
// createKey /
// revokeKey [keyToRevoke] /
// keyList /list
function rsakeyList() {
  return $.ajax({
    url: urlBase + "/user/rsakey/list",
    type: "GET"
  });
}

function revokeRsakeys(fingerprints) {
  return $.ajax({
    url: urlBase + "/user/rsakey/revoke",
    type: "POST",
    data: JSON.stringify({ fingerprints: fingerprints }),
    dataType: "json",
    contentType: "application/json"
  });
}


// NOTE: this is hacked, will be rerouted

// Deploy keys /user/rsakey
//
// createKey /
// revokeKey [filenameToRevoke] /
// keyList /list
function deploykeyList() {
  return $.ajax({
    url: urlBase + "/user/rsakey/list",
    type: "GET"
  });
}

function createDeploykey() {
  return $.ajax({
    url: urlBase + "/user/rsakey/create",
    type: "GET"
  });
}

function revokeDeploykeys(filenames) {
  return $.ajax({
    url: urlBase + "/user/rsakey/revoke",
    type: "POST",
    data: JSON.stringify({ filenames: filenames }),
    dataType: "json",
    contentType: "application/json"
  });
}

// Mesh channels //mesh/list
//
// createChannel
// revokeChannels [channel_ids]
// channelList
function channelList() {
  return $.ajax({
    url: urlBase + "/mesh/list",
    type: "GET"
  });
}

function createChannel(mesh_id, alias, owner_id) {
  return $.ajax({
    url: urlBase + "/mesh/create",
    type: "POST",
    data: JSON.stringify({
      owner_id: owner_id,
      mesh_id: mesh_id,
      alias: alias
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function revokeChannels(owner_id, mesh_ids) {
  return $.ajax({
    url: urlBase + "/mesh/delete",
    type: "POST",
    data: JSON.stringify({
      owner_id: owner_id,
      mesh_ids: mesh_ids
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function attachChannel(meshId, deviceUdid) {
  return $.ajax({
    url: urlBase + "/device/mesh/attach",
    type: "POST",
    data: JSON.stringify({
      mesh_id: meshId,
      udid: deviceUdid
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function detachChannel(meshId, deviceUdid) {
  return $.ajax({
    url: urlBase + "/device/mesh/detach",
    type: "POST",
    data: JSON.stringify({
      mesh_id: meshId,
      udid: deviceUdid
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

// Enviros /user/enviro
// createKey /
// revokeKey [keyToRevoke] /
// keyList /list
function enviroList() {
  return $.ajax({
    url: urlBase + "/user/env/list",
    type: "GET"
  });
}

function addEnviro(enviroName, enviroValue) {
  return $.ajax({
    url: urlBase + "/user/env/add",
    type: "POST",
    data: JSON.stringify({
      key: enviroName,
      value: enviroValue
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function revokeEnviros(enviroNames) {
  return $.ajax({
    url: urlBase + "/user/env/revoke",
    type: "POST",
    data: JSON.stringify({ names: enviroNames }),
    dataType: "json",
    contentType: "application/json"
  });
}

// Sources /user/source
//
// sourceList GET / * list of sources is obtained by userProfile *
// addSource [sourceUrl] POST /
// removeSource [index] POST /
function sourceList() {
  return $.ajax({
    url: urlBase + "/user/sources/list",
    type: "GET"
  });
}

function addSource(url, alias, branch, circleToken, gitSecret) {
  return $.ajax({
    url: urlBase + "/user/source",
    type: "POST",
    data: JSON.stringify({
      url: url,
      alias: alias,
      branch: branch,
      circleToken: circleToken,
      secret: gitSecret
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function revokeSources(sourceIds) {
  return $.ajax({
    url: urlBase + "/user/source/revoke",
    type: "POST",
    data: JSON.stringify({ source_ids: sourceIds }),
    dataType: "json",
    contentType: "application/json"
  });
}

// Profile /user/profile
//
// getProfile GET /
// submitProfile POST /
function getProfile() {
  return $.ajax({
    url: urlBase + "/user/profile",
    type: "GET"
  });
}

function submitProfile(profile) {
  console.log("Submitting profile...");
  var info = {
    first_name: profile.info.first_name,
    last_name: profile.info.last_name,
    mobile_phone: profile.info.mobile_phone,
    git_webhook: profile.info.git_webhook,
    slack_token: profile.info.slack_token,
    goals: profile.info.goals,
    security: profile.info.security,
    username: profile.info.username,
    owner: profile.info.owner,
    tags: profile.info.tags,
    transformers: profile.info.transformers,
    timezone_abbr: profile.timezone_abbr,
    timezone_offset: profile.timezone_offset
  };

  return $.ajax({
    url: urlBase + "/user/profile",
    type: "POST",
    data: JSON.stringify({
      info: info
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function submitProfileAvatar(avatar) {
  return $.ajax({
    url: urlBase + "/user/profile",
    type: "POST",
    data: JSON.stringify({
      avatar: avatar
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function submitProfileChanges(changes, profile) {
  var info = {};
  for (var change in changes) {
    info[changes[change]] = profile.info[changes[change]];
  }

  return $.ajax({
    url: urlBase + "/user/profile",
    type: "POST",
    data: JSON.stringify({
      info: info
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function userDelete(deleteForm) {
  return $.ajax({
    url: urlBase + "/user/delete",
    type: "POST",
    data: JSON.stringify({
      username: deleteForm.username,
      owner: deleteForm.owner
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function profileDownload() {
  return $.ajax({
    url: urlBase + "/gdpr/transfer",
    type: "POST",
    data: {},
    dataType: "json",
    contentType: "application/json"
  });
}

function getAuditHistory() {
  return $.ajax({
    url: urlBase + "/user/logs/audit",
    type: "GET"
  });
}

function getBuildHistory() {
  return $.ajax({
    url: urlBase + "/user/logs/build/list",
    type: "GET"
  });
}

function getBuildLog(buildId) {
  return $.ajax({
    url: urlBase + "/user/logs/build",
    type: "POST",
    data: JSON.stringify({
      build_id: buildId
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function tailBuildLog(buildId) {
  return $.ajax({
    url: urlBase + "/user/logs/tail",
    type: "POST",
    data: JSON.stringify({
      build_id: buildId
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function checkToken(token) {
  return $.ajax({
    url: urlBase + "/login",
    type: "POST",
    data: JSON.stringify({
      token: token
    }),
    dataType: "json",
    contentType: "application/json"
  });
}

function getStats() {
  return $.ajax({
    url: urlBase + "/user/stats",
    type: "GET"
  });
}

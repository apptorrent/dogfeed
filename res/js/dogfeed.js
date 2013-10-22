angular.module('dogfeed', ['ngRSS', 'ngSockethubClient', 'ngRemoteStorage']).


/**
 * routes
 */
config(['$routeProvider',
function ($routeProvider) {
  $routeProvider.
    when('/', {
      templateUrl: "feeds.html"
    }).
    otherwise({
      redirectTo: "/"
    });
}]).



run(['SockethubSettings', 'SH', '$rootScope', 'RS',
function (settings, SH, $rootScope, RS) {
  var default_cfg = {
    host: 'silverbucket.net',
    port: 443,
    path: '/sockethub',
    tls: true,
    secret: '1234567890'
  };

  function sockethubConnect(cfg) {
    console.log('USING SH CONFIG: ', cfg);
    //$rootScope.$broadcast('message', {type: 'clear'});
    // connect to sockethub and register
    if (settings.save('conn', cfg)) {
      $rootScope.$broadcast('message', {
            message: 'attempting to connect to sockethub',
            type: 'info',
            timeout: false
      });
      SH.connect({register: true}).then(function () {
        //console.log('connected to sockethub');
        $rootScope.$broadcast('message', {
              message: 'connected to sockethub',
              type: 'success',
              timeout: true
        });
      }, function (err) {
        console.log('error connecting to sockethub: ', err);
        $rootScope.$broadcast('SockethubConnectFailed', {message: err});
      });
    } else {
      $rootScope.$broadcast('message', {
            message: 'failed saving sockethub credentials',
            type: 'success',
            timeout: true
      });
    }
  }

  RS.call('sockethub', 'getConfig', ['dogfeed'], 3000).then(function (c) {
    console.log('GOT SH CONFIG: ', c);
    if ((typeof c !== 'object') || (typeof c.host !== 'string')) {
      //cfg = settings.conn;
      c = default_cfg; 
    }
    sockethubConnect(c);
  }, function (err) {
    console.log("RS.call error: ",err);
    sockethubConnect(default_cfg);    
  });
}]).


/**
 * remoteStorage & sockethub connect
 */
run(['SockethubSettings', 'SH', '$rootScope', 'RS', '$timeout',
function (settings, SH, $rootScope, RS, $timeout) {
  if (!RS.isConnected()) {
    $timeout(function () {
      if (!RS.isConnected()) {
        $rootScope.$broadcast('message', {message: 'remotestorage-connect', timeout: false});
      }
    }, 6000);
  }
}]).


/**
 * emitters
 */
run(['$rootScope',
function ($rootScope) {
  $rootScope.$on('showModalAddFeed', function(event, args) {
    backdrop_setting = true;
    if ((typeof args === 'object') && (typeof args.locked !== 'undefined')) {
      if (args.locked) {
        backdrop_setting = "static";
      }
    }
    $("#modalAddFeed").modal({
      show: true,
      keyboard: true,
      backdrop: backdrop_setting
    });
  });

  $rootScope.$on('closeModalAddFeed', function(event, args) {
    $("#modalAddFeed").modal('hide');
  });
}]).


/**
 * filter: urlEncode
 */
filter('urlEncode', [
function() {
  return function (text, length, end) {
    return encodeURIComponent(escape(text));
  };
}]).

filter('fromNow', [
function() {
  return function(dateString) {
    return new Date(dateString).toDateString(); ///moment(new Date(dateString)).fromNow();
  };
}]).




///////////////////////////////////////////////////////////////////////////
//
// CONTROLLERS
//
///////////////////////////////////////////////////////////////////////////


/**
 * controller: titlebarCtrl
 */
controller('titlebarCtrl',
['$scope', '$rootScope', 'SockethubSettings', 'RS',
function ($scope, $rootScope, settings, RS) {
  $scope.addFeed = function () {
    $rootScope.$broadcast('showModalAddFeed', {locked: false});
  };
  $scope.sockethubSettings = function () {
    $rootScope.$broadcast('showModalSockethubSettings', {locked: false});
  };

  $scope.$watch('settings.connected', function (newVal, oldVal) {
    if (settings.connected) {
      settings.conn.port = Number(settings.conn.port);
      RS.call('sockethub', 'writeConfig', [settings.conn]).then(function () {
        console.log("Sockethub config saved to remoteStorage");
      }, function (err) {
        console.log('Failed saving Sockethub config to remoteStorage: ', err);
      });
    }
  });
}]).




///////////////////////////////////////////////////////////////////////////
//
// DIRECTIVES
//
///////////////////////////////////////////////////////////////////////////


/**
 * directive: message
 */
directive('message',
['$rootScope', '$timeout',
function ($rootScope, $timeout) {
  return {
    restrict: 'A',
    template: '<div class="alert alert-{{ m.type }}" ng-show="haveMessage">'+
              '  <strong>{{m.title}}</strong> ' +
              '  <span>{{m.message}}</span>' +
              '</div>',
    link: function (scope) {
      scope.haveMessage = false;
      scope.m = {type: '', title: '', message: ''};

      var presets = {
        'remotestorage-connect': {
          type: 'warning',
          title : 'Connect to remoteStorage',
          message: 'No changes will be saved, you must sign in to remoteStorage for persistence'
        },
        'sockethub-config': {
          type: 'warning',
          title: 'Sockethub configuration needed',
          message: 'You must fill in your Sockethub connection details'
        },
        'sockethub-connect': {
          type: 'danger',
          title: 'Sockethub connection error',
          message: 'Unable to connect to Sockethub please check your configuration and try again'
        },
        'sockethub-register': {
          type: 'danger',
          title: 'Sockethub registration problem',
          message: 'We were unable to register with your Sockethub instance'
        },
        'xmpp-connect': {
          type: 'danger',
          title: 'XMPP connection failed',
          message: 'There was a problem connecting to the XMPP server, please verify you settings'
        },
        'unknown': {
          type: 'danger',
          title: 'An unknown error has occurred',
          message: ''
        }
      };


      $rootScope.$on('message', function (event, e) {
        //console.log('message event: ', e);

        var timeout = (typeof e.timeout === 'boolean') ? e.timeout : true;
        scope.haveMessage = false;

        if (typeof e === 'undefined') {
          e = 'no error specified';
        }

        if (e.type === 'clear') {
          scope.haveMessage = false;
          scope.m = {type: '', title: '', message: ''};
          return;
        } else if (typeof presets[e.message] !== 'undefined') {
          scope.m = presets[e.message];
        } else if (typeof e.message === 'string') {
          if (e.type === 'success') {
            scope.m.title = 'Success';
          } else if (e.type === 'info') {
            scope.m.title = 'Info';
          } else {
            scope.m.title = "Danger!";
            e.type = 'danger';
          }
          scope.m.message = e.message;
          scope.m.type = e.type;
        }
        console.log('done processing: ', scope.m, timeout);

        scope.haveMessage = true;
        if (timeout) {
          $timeout(function () {
            scope.haveMessage = false;
            scope.m = {type: '', title: '', message: ''};
          }, 4000);
        }
      });
    }
  };
}]);


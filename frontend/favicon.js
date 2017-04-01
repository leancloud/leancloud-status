// https://github.com/dlom/favicon.js
/* http://mit-license.org */

// private

var head = document.getElementsByTagName("head")[0];
var loopTimeout = null;
var changeFavicon = function(iconURL) {
    var newLink = document.createElement("link");
    newLink.type = "image/x-icon";
    newLink.rel = "icon";
    newLink.href = iconURL;
    removeExistingFavicons();
    head.appendChild(newLink);
};
var removeExistingFavicons = function() {
    var links = head.getElementsByTagName("link");
    for (var i = 0; i < links.length; i++) {
        if (/\bicon\b/i.test(links[i].getAttribute("rel"))) {
            head.removeChild(links[i]);
        }
    }
};

// public

export default {
  "defaultPause": 2000,
  "change": function(iconURL, optionalDocTitle) {
      clearTimeout(loopTimeout);
      if (optionalDocTitle) {
          document.title = optionalDocTitle;
      }
      if (iconURL !== "") {
          changeFavicon(iconURL);
      }
  },
  "animate": function(icons, optionalDelay) {
      clearTimeout(loopTimeout);
      // preload icons
      icons.forEach(function(icon) {
          (new Image()).src = icon;
      });
      optionalDelay = optionalDelay || this["defaultPause"];
      var iconIndex = 0;
      changeFavicon(icons[iconIndex]);
      loopTimeout = setTimeout(function animateFunc() {
          iconIndex = (iconIndex + 1) % icons.length;
          changeFavicon(icons[iconIndex]);
          loopTimeout = setTimeout(animateFunc, optionalDelay);
      }, optionalDelay);
  },
  "stopAnimate": function() {
      clearTimeout(loopTimeout);
  }
};

import $ from 'jquery';
import 'babel-polyfill';

import favicon from './favicon';

const SERVICES = ['LeanStorage', 'LeanMessage', 'LeanPush', 'LeanAnalytics', 'LeanEngine', 'Website', 'Support'];
const NODES = ['cn-n1', 'us-w1', 'cn-e1'];
const CHECK_POINTS = ['cn-n1', 'us-w1', 'cn-e1'];
const DOWN_THRESHOLD = 0.6;

const SERVICE_INFO = {
  LeanStorage: {
    name: '数据存储',
    icon: 'cloud-storage'
  },
  LeanMessage: {
    name: '实时消息',
    icon: 'chat'
  },
  LeanPush: {
    name: '消息推送',
    icon: 'push'
  },
  LeanAnalytics: {
    name: '应用统计',
    icon: 'chart-alt'
  },
  LeanEngine: {
    name: '云引擎',
    icon: 'cloud'
  },
  Website: {
    name: '网站',
    icon: 'home'
  },
  Support: {
    name: '技术支持',
    icon: 'checked'
  }
};

const STATUS_MAPPING = {
  success: {
    text: '正常',
    class: 'up'
  },
  warning: {
    text: '异常',
    class: 'warning'
  },
  error: {
    text: '故障',
    class: 'down'
  }
};

const state = {
  currentNode: 'cn-n1',
  status: []
};

$( () => {
  loadStatusFromObjectStorage().then( result => {
    state.status = mergeStatusCheckPoints(result);
    renderToPage();
  });

  $('.nav-tabs.nodes a').click(function(event) {
    event.preventDefault();
    state.currentNode = $(this).data('target');
    $('.nav-tabs.nodes li.active').toggleClass('active');
    $(this).parent('li').toggleClass('active');
    renderToPage();
  });
});

function renderToPage() {
  $('#status-root').html(render());
}

function render() {
  return SERVICES.map( serviceName => {
    const statusItem = state.status.find( ({nodeName, service}) => {
      return nodeName === state.currentNode && service === serviceName;
    });

    return `
      <div class='col-xs-6'>
        <div class='status-block loaded ${STATUS_MAPPING[statusItem.status].class}'>
          <i class='icon icon-${SERVICE_INFO[serviceName].icon}'></i>
          <div class='status-title font-logo' title='${SERVICE_INFO[serviceName].name}'>${serviceName}</div>
          <div class='status-meta' id='data-status'>
            <p class='label'>${STATUS_MAPPING[statusItem.status].text}</p>
            <p class='timestamp'>${minuteAgo(new Date(statusItem.lastSuccess))}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function loadStatusFromObjectStorage() {
  return Promise.all(CHECK_POINTS.map( name => {
    return $.getJSON(`https://leancloud-status.s3.amazonaws.com/${name}-latest.json`);
  }));
}

function mergeStatusCheckPoints(checkPointsResult) {
  var result = [];

  for (let nodeName of NODES) {
    for (let service of SERVICES) {
      checkPointsResult.sort( (a, b) => {
        return new Date(b) - new Date(a);
      });

      let checkResult = checkPointsResult.map( checkPoint => {
        return checkPoint.status[nodeName][service];
      });

      let successResult = checkResult.filter( ({error}) => {
        return !error;
      });

      let failedResult = checkResult.filter( ({error}) => {
        return error;
      });

      let upRatio = 1 - (failedResult.length / NODES.length);

      result.push({
        nodeName: nodeName,
        service: service,
        error: failedResult[0] ? failedResult[0].error : null,
        upRatio: upRatio,
        lastSuccess: successResult[0].time,
        latency: medianNumber(checkResult.map( ({latency}) => {
          return latency;
        })),
        status: ( () => {
          if (upRatio === 1) {
            return 'success';
          } else if ((1 - upRatio) < DOWN_THRESHOLD) {
            return 'warning';
          } else {
            return 'error';
          }
        })()
      });
    }
  }

  return result;
}

function minuteAgo(time) {
  const milliseconds = Date.now() - time.getTime();
  const minutes = Math.floor(milliseconds / 1000 / 60);
  return minutes === 0 ? '刚刚' : `${Math.floor(milliseconds / 1000 / 60)} 分钟前`;
}

function medianNumber(numbers) {
  numbers.sort( (a, b) => {
    return a - b;
  });

  const half = Math.floor(numbers.length / 2);

  if (numbers.length % 2) {
    return numbers[half];
  }

  else {
    return (numbers[half - 1] + numbers[half]) / 2.0;
  }
}

function l() {
  $(function() {
    'use strict';

    var services = ['data', 'rtm2', 'push', 'stats', 'code', 'site', 'support'];
    var feeds = ['https://blog.leancloud.cn/category/failure-notices/feed/json', 'https://blog.leancloud.cn/category/maintenance/feed/json'];
    // var feeds = ['http://drrr.com/status.json', 'http://drrr.com/status2.json'];
    var check_interval = 30000; // defaultt: 30000, 30s

    var status_counter = 0;
    var status_color = 'red';
    var status_timeout = 5000; // default: 5000, 5s
    var check_promises = [];

    var rss_timeout = 10000; // default: 10000, 10s
    var rss_promises = [];
    var rss_wrap = $('#rss-update');
    var rss_placeholder = $('#load-placeholder-wrap');
    var rss_error_wrap = $('#error-message');
    var rss_error_flag = false;

    // check service status via JSON
    function init_check(service) {
      var label = $("#" + service + "-status");
      var label_wrap = label.parent(".status-block");
      var label_text = label.find(".label");
      var label_date = label.find(".timestamp");
      var timeout_warning = $('.timeout-warning');

      // remove last timestamps first
      label_date.removeClass('on');

      // remove loaded status
      label_wrap.removeClass("loaded up down timeout");

      // reset text to loading
      label_text.text("Loading");

      var do_ajax = $.ajax({
        url: 'https://leancloud.cn/node/status/' + service + '?format=json',
        // url: 'http://sparanoid.com/node/status/' + service + '?format=json',
        dataType: 'text',
        timeout: status_timeout,
        success: function(data) {
          var json = $.parseJSON(data);

          label_date.text("Last check: " + json.time);
          timeout_warning.slideUp();

          setTimeout(function() {
            label_date.addClass("on");
          }, Math.floor(Math.random() * 1000));

          if (json.status === 0) {

            setTimeout(function() {
              label_wrap.addClass("loaded up");
            }, 200);

            label_text.text("Operational");
            status_counter += 1;
            status_color = 'green';
            console.log("%c" + service + " is up, counter: " + status_counter, "color: " + status_color);

          } else  {

            setTimeout(function() {
              label_wrap.addClass("loaded down");
            }, 300);

            if (json.status === 1) {
              label_text.text("Error");
            } else if (json.status === 2) {
              label_text.text("Waiting");
            } else {
              label_text.text("Unkown");
            }

            status_color = 'red';
            console.log("%c" + service + " is down", "color: " + status_color);

          }
        },
        error: function(data) {

          setTimeout(function() {
            label_wrap.addClass("loaded timeout");
          }, 400);

          label_text.text("Timeout");
          timeout_warning.slideDown();
          status_color = 'black';
          console.log("%c" + service + " is timeout", "color: " + status_color);
        }
      });

      check_promises.push(do_ajax);
    }

    function update_favicon() {
      $.when.apply(null, check_promises).done(function() {
        if (status_counter === services.length) {
          console.log("%call up!", "color: green; font-weight: bold");
          favicon.change("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAMFBMVEUAAAAfwR8fwR8fwR8ewh4fwh8AqgAfwR+K34ql5qWi5aLS8tL////6/fohwiEgwiACOoErAAAACHRSTlMAOq7o/f8GjPiGxicAAABxSURBVHja7daxDoAwCEVRKFDUqv3/vxUnky71xcSlvftZeVDESdS6qSSmu+xqL1PPAdyAnIgVAcqUDCqRYEBIMaBkYJ/BskYbAMoeHRNMMMHg4HyqXdBUBgBWm+Dr/T+AJwseRXh24WFHXwf8OYHfnwsTcTOGPp9qywAAAABJRU5ErkJggg==");
          $("body").removeClass().addClass("status status-up");
        } else if (status_counter === 0) {
          console.log("%call down!", "color: red; font-weight: bold");
          favicon.change("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAM1BMVEUAAAD/ADn/ADz/ADz/ADz/AD3/ACv/ADz/epn/mbH/lq//zNj/////+vv/Az//Aj7/AT0xAGOBAAAACHRSTlMAOq7o/f8GjPiGxicAAABxSURBVHgB7dY1AgMxFENB2ZaW6f6XXWjCpDBN/8oPmIWYqLOYYsAiy6kLMc/mIJchBwJlYECUJSLJkkBZCJluDopyVhlB3czaf/AP/sGPB91af0mwqf6BYOh3DP72fnpAWWgfRfvs+ofdfh3858R8fyY/qDOchDKCNwAAAABJRU5ErkJggg==");
          $("body").removeClass().addClass("status status-down");
        } else {
          console.log("%csomething wrong, service up: " + status_counter, "color: orange; font-weight: bold");
          favicon.change("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAM1BMVEUAAAD/owD/owD/owD/ogD/owD/gAD/ogD/z3r/2pn/2Zb/7Mz//////fr/pAP/owL/owGl71DWAAAACHRSTlMAOq7o/f8GjPiGxicAAABxSURBVHgB7dY1AgMxFENB2ZaW6f6XXWjCpDBN/8oPmIWYqLOYYsAiy6kLMc/mIJchBwJlYECUJSLJkkBZCJluDopyVhlB3czaf/AP/sGPB91af0mwqf6BYOh3DP72fnpAWWgfRfvs+ofdfh3858R8fyY/qDOchDKCNwAAAABJRU5ErkJggg==");
          $("body").removeClass().addClass("status status-partial");
        }
        console.log('favicon updated');
      });
    }

    function reset_check_counter(i) {
      status_counter = i;
    }

    function start_check_loop() {

      for (var i = 0; i < services.length; i++) {
        init_check(services[i]);
      }

      update_favicon();
      reset_check_counter(0);
    }

    function init_rss(feed) {

      rss_wrap
        // add translucent mask
        .addClass("loading")

        // mark deprecated posts as pending delete
        .find(".rss-item").removeClass("new").addClass("pending-delete");

      // show placeholder when refreshing feeds
      rss_placeholder.addClass("on").removeClass("slow");

      // reset error message
      rss_error_wrap.text("");

      var do_ajax = $.ajax({
        url: feed,
        dataType: 'jsonp',
        timeout: rss_timeout,
        success: function(data) {
          var json = data;

          // console.log(json);

          $.each(json, function(i, post) {
            var title = post.title;
            var permalink = post.permalink;
            var date = post.date;
            var excerpt = post.excerpt.substring(0, 140) + "…";
            var category = post.categories[0];
            var category_class;
            var category_text;

            if (category === "维护") {
              category_class = "maintenance";
              category_text = "Maintenance";
            } else {
              category_class = "failure";
              category_text = "Incident";
            }

            var output = "<li class='rss-item new'>"
                       + "  <div class='category category--" + category_class + "'>" + category_text + "</div>"
                       + "  <div class=date>" + date + "</div>"
                       + "  <h3 class=title>"
                       + "    <a  href='" + permalink + "'>" + title + "</a>"
                       + "  </h3>"
                       + "  <div class=content>" + excerpt + "</div>"
                       + "</li>";

            rss_wrap.append(output);
          });

          rss_error_flag = false;
        },
        error: function(data) {
          rss_error_flag = true;
          rss_error_wrap.text("无法获取 RSS 更新");
          rss_placeholder.addClass("slow");
        }
      });

      console.log("rss_promises.push(do_ajax)");
      rss_promises.push(do_ajax);
    }

    function check_rss_list_height() {
      $(".height-wrap").height(rss_wrap.outerHeight(true));
    }

    function prepare_rss() {

      // remove deprecated posts
      rss_wrap.find('.pending-delete').remove();

      // when fetch done, sort all posts by date
      rss_wrap.find('.rss-item').sort(sort_rss_posts).appendTo(rss_wrap);

      // show new posts
      rss_wrap.find('.new').show();

      rss_wrap

        // show wrap (only necessary for the first time load)
        .show()

        // remove translucent mask
        .removeClass("loading");

      // hide loading placeholder
      rss_placeholder.removeClass("on slow");

      // calculate height for animation
      check_rss_list_height();

      window.addEventListener("resize", function() {
        check_rss_list_height();
      });
    }

    function process_rss() {
      console.log("process_rss");

      if (rss_error_flag) {
        prepare_rss();
      }

      $.when.apply(null, rss_promises).done(function() {
        prepare_rss();
      });
    }

    function start_rss_loop() {

      for (var i = 0; i < feeds.length; i++) {
        console.log("start_rss_loop");
        init_rss(feeds[i]);
      }
      process_rss();
    }

    function format_date(d) {
      return new Date(d.substr(0, 4), d.substr(5, 2) - 1, d.substr(8, 2), d.substr(11, 2), d.substr(14, 2), d.substr(17, 2));
    }

    function sort_rss_posts(a, b) {
      var date1  = $(a).find(".date").text();
          date1 = format_date(date1);

      var date2  = $(b).find(".date").text();
          date2 = format_date(date2);

      return date1 < date2 ? 1 : -1;
    }

    function init_progress() {
      $(".progress").addClass("loaded");
    }

    function reset_progress() {
      $(".progress").removeClass("loaded");
    }

    function init() {
      reset_progress();
      start_check_loop();
      setTimeout(function() {
        init_progress();
      }, 10);
    }

    // run all checks on every check_interval
    var start_timer = setInterval(function() {
      console.log('refreshing @ ' + Date());
      init();
    }, check_interval);

    // init tasks on ready
    init();

    // run RSS check
    start_rss_loop();
  });
}

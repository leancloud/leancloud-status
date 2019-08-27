import $ from 'jquery';
import 'babel-polyfill';

import favicon from './favicon';
import {BUCKET_PREFIX} from './settings';

const SERVICES = ['LeanStorage', 'LeanMessage', 'LeanEngine', 'Website', 'Support'];
const NODES = ['cn-n1', 'us-w1', 'cn-e1'];
const CHECK_POINTS = ['cn-n1', 'us-w1', 'cn-e1'];
const AUTO_REFRESH = 30 * 1000;
const CURRENT_EVENT = 24 * 3600 * 1000;
const EVENT_HISTORY_DAYS = 7;

const WARNING_THRESHOLD = 0.4;
const DOWN_THRESHOLD = 0.4;

const IGNORE_WARNING_SHORTER_THAN = 120000;

const SHOW_HISTORY_CHART = localStorage.getItem('historyChart') === null ? true : localStorage.getItem('historyChart');
const ENABLE_AUTO_REFRESH = localStorage.getItem('refresh') === 'false' ? false : true;

const SERVICE_INFO = {
  LeanStorage: {
    name: '数据存储',
    icon: 'cloud-storage'
  },
  LeanMessage: {
    name: '实时消息',
    icon: 'chat',
    ignore: ['cn-e1']
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
    icon: 'checked',
    ignore: ['us-w1', 'cn-e1']
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
  timeout: {
    text: '超时',
    class: 'timeout'
  },
  error: {
    text: '故障',
    class: 'down'
  }
};

const state = {
  currentNode: 'cn-n1',
  status: [],
  charts: {},
  events: []
};

$.ajaxSetup({ cache: false });

$( () => {
  function refresh() {
    loadLatestStatus().then( result => {
      state.status = mergeStatusCheckPoints(result);
      state.charts = mergeChartCheckPoints(result);
      $('#status-root').html(render());
    }).catch( err => {
      console.error(err);
      $('#status-root').html(render());
    });

    localStatusEvents().then( ({events}) => {
      state.events = events;
      $('#status-events').html(renderStatusEvents());
      $('#event-history').html(renderEventHistory());
    }).catch( err => {
      console.error(err);
      $('#status-events').html(renderStatusEvents());
      $('#event-history').html(renderEventHistory());
    });
  }

  refresh();

  setInterval( () => {
    if (ENABLE_AUTO_REFRESH) {
      refresh();
    }
  }, AUTO_REFRESH);

  $('.nav-tabs.nodes a').click(function(event) {
    event.preventDefault();
    state.currentNode = $(this).data('target');
    $('.nav-tabs.nodes li.active').toggleClass('active');
    $(this).parent('li').toggleClass('active');
    $('#status-root').html(render());
  });
});

function loadLatestStatus() {
  return Promise.all(CHECK_POINTS.map( nodeName => {
    return $.getJSON(`${BUCKET_PREFIX}/${nodeName}-latest.json`).then( result => {
      return Object.assign(result, {nodeName});
    });
  }));
}

function localStatusEvents() {
  return $.getJSON(`${BUCKET_PREFIX}/events.json`);
}

function toFixedSmart(n, d) {
  if (!d) return n.toFixed(d);
  return n.toFixed(d).replace(/\.?0+$/, '');
}

function render() {
  const chartData = state.charts[state.currentNode];

  return SERVICES.map( serviceName => {
    if (SERVICE_INFO[serviceName].ignore && SERVICE_INFO[serviceName].ignore.indexOf(state.currentNode) !== -1) {
      return '';
    }

    const statusItem = state.status.find( ({nodeName, service}) => {
      return nodeName === state.currentNode && service === serviceName;
    });

    const statusTitle = statusItem.checkResult.map( ({nodeName, error, latency}) => {
      return `${nodeName}: ${latency}ms, ${quoteattr(error ? error : 'success')}`;
    }).join('\n');

    const timestampTitle = statusItem.checkResult.map( ({nodeName, time}) => {
      return `${nodeName}: ${minuteAgo(new Date(time))}`;
    }).join('\n');

    return `
      <div class='col-xs-6'>
        <div class='status-block loaded ${STATUS_MAPPING[statusItem.status].class}'>
          <i class='icon icon-${SERVICE_INFO[serviceName].icon}'></i>
          <div class='status-title font-logo' title='${SERVICE_INFO[serviceName].name}'>${serviceName}</div>
          <div class='status-meta' id='data-status'>
            <p class='label' title='${statusTitle}'>${STATUS_MAPPING[statusItem.status].text}</p>
            <p class='timestamp' title='${timestampTitle}'>${minuteAgo(new Date(statusItem.lastCheck))}</p>
          </div>
        </div>
      </div>
    `;
  }).join('') + (SHOW_HISTORY_CHART ? `
    <div class='col-xs-12 charts'>
      <hr>

      ${SERVICES.map( service => {
        if (SERVICE_INFO[service].ignore && SERVICE_INFO[service].ignore.indexOf(state.currentNode) !== -1) {
          return '';
        }

        return `
          <div class='chart'>
            <div class='chart-label'>
              <h3>${SERVICE_INFO[service].name}</h3>
            </div>
            <div class='chart-bar'>
              <div>
                <span class='timestamp pull-left'>24 hours ago</span>
                <span class='timestamp pull-right'>now</span>
              </div>
              <div class='chart-flex'>
                ${chartData[service].map( item => {
                  return `<div style='flex: ${item.duration}' class='bar-block ${STATUS_MAPPING[item.status].class}'
                               title='${quoteattr(`${item.time.toLocaleString()} - ${item.timeEnd.toLocaleString()} ${item.status} ${item.error ? item.error : ''}`)}'/>`;
                }).join('')}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '');
}

function renderStatusEvents() {
  var currentEvents = [];
  var inProgressEvents = [];

  for (let i = state.events.length - 1; i >= 0; i--) {
    let event = state.events[i];

    if (Date.now() - new Date(event.time).getTime() < CURRENT_EVENT) {
      currentEvents = inProgressEvents.concat(currentEvents);
      currentEvents.unshift(event);
    } else if (event.inProgress) {
      inProgressEvents.unshift(event);
    } else if (event.type === 'success') {
      inProgressEvents = [];
    }
  }

  return currentEvents.map( ({content, type, time}) => {
    return `
      <p class='col-sm-12'>
        <span class='${type}'>${content}</span> <br /> <span class='date'>${new Date(time).toLocaleString()}</span>
      </p>
    `;
  }).join('');
}

function renderEventHistory() {
  var html = '';

  for (let daysAgo = 1; daysAgo <= EVENT_HISTORY_DAYS; daysAgo++) {

    const day = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toLocaleDateString();

    const events = state.events.filter( ({time}) => {
      return new Date(time).toLocaleDateString() === day;
    });

    if (events.length === 0) {
      events.push({
        type: 'success',
        content: '当日无事件'
      });
    }

    html += `
      <div class='history-item'>
        <div class='history-date'>${day}</div>
        <div class='history-content-wrap'>
          ${events.map( ({content, type, time}) => {
            return `<div class='history-content'>
              <div class='date'>${time ? new Date(time).toLocaleTimeString() : ''}</div>
              <div class=${type}>${content}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

function mergeStatusCheckPoints(checkPointsResult) {
  var result = [];
  var overallStatus = 'success';

  for (let nodeName of NODES) {
    for (let service of SERVICES) {
      let checkResult = checkPointsResult.map( checkPoint => {
        return Object.assign(checkPoint.status[nodeName][service] || {}, {nodeName: checkPoint.nodeName});
      });

      checkResult.sort( (a, b) => {
        return new Date(b.time) - new Date(a.time);
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
        checkResult: checkResult,
        lastCheck: checkResult[checkResult.length - 1].time,
        status: ( () => {
          if (upRatio === 1) {
            return 'success';
          } else if ((1 - upRatio) < DOWN_THRESHOLD) {
            return 'success';

            if (failedResult.every( ({timeout}) => {
              return timeout;
            })) {
              return 'timeout';
            } else {
              return 'warning';
            }
          } else {
            return 'error';
          }
        })()
      });
    }
  }

  for ({status} of result) {
    if (status === 'warning' && overallStatus !== 'error'){
      overallStatus = 'warning';
    } else if (status === 'error') {
      overallStatus = 'error';
    }
  }

  updateFavicon(overallStatus);

  return result;
}

function mergeChartCheckPoints(checkPointsResult) {
  const flattenServiceChart = (nodeName, service) => {
    const serviceChartItems = [];

    checkPointsResult.forEach( checkPoints => {
      checkPoints.charts[nodeName][service].forEach( serviceChartItem => {
        serviceChartItems.push(Object.assign(serviceChartItem, {
          nodeName: checkPoints.nodeName,
          time: new Date(serviceChartItem.time)
        }));
      });
    });

    return serviceChartItems;
  };

  const mergeServiceChartItems = (serviceChartItems) => {
    const result = [];
    const lastStatus = {};

    const currentStatus = () => {
      var upCount = 0;
      var count = 0;

      for (let nodeName in lastStatus) {
        count++;

        if (lastStatus[nodeName] === 'success') {
          upCount++;
        }
      }

      const upRatio = upCount / count;

      if (upRatio > WARNING_THRESHOLD) {
        return 'success';
      } else if (upRatio > DOWN_THRESHOLD) {
        return 'warning';
      } else {
        return 'error';
      }
    };

    serviceChartItems.sort( (a, b) => {
      return a.time - b.time;
    });

    serviceChartItems.forEach( item => {
      if (lastStatus[item.nodeName] != item.status) {
        lastStatus[item.nodeName] = item.status;

        const status = currentStatus();

        if (result.status !== status) {
          result.status = status;
          result.push({
            time: item.time,
            error: item.error,
            status: status
          });
        }
      }
    });

    const totalDuration = Date.now() - result[0].time.getTime();

    for (let i = 0; i < result.length; i++) {
      const nextItem = result[i + 1];
      const duration = (nextItem ? nextItem.time.getTime() : Date.now()) - result[i].time.getTime();
      result[i].timeEnd = nextItem ? nextItem.time : new Date;
      result[i].duration = duration;
      result[i].period = (duration / totalDuration) * 100;

      if (!IGNORE_WARNING_SHORTER_THAN) {
        const lastStatus = result[i - 1] && result[i - 1].status;
        const nextStatus = result[i + 1] && result[i + 1].status;

        if (result[i].status === 'warning' && (!lastStatus || lastStatus === 'success') && nextStatus === 'success' && result[i].duration <= IGNORE_WARNING_SHORTER_THAN) {
          result[i].status = 'success';
        }
      }
    }

    return result;
  };

  const result = {};

  const countUpTime = (chartItems) => {
    return chartItems.filter( chartItem => {
      return chartItem.status !== 'error';
    }).map( ({period}) => {
      return period;
    }).reduce( (a, b) => {
      return a + b;
    }, 0);
  };

  for (let nodeName of NODES) {
    for (let service of SERVICES) {
      result[nodeName] = result[nodeName] || {};
      const serviceChartItems = flattenServiceChart(nodeName, service);
      result[nodeName][service] = mergeServiceChartItems(serviceChartItems);

      result[nodeName][service].uptime = countUpTime(result[nodeName][service]);
    }
  };

  return result;
}

function updateFavicon(type) {
  if (type === 'success') {
    favicon.change('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAMFBMVEUAAAAfwR8fwR8fwR8ewh4fwh8AqgAfwR+K34ql5qWi5aLS8tL////6/fohwiEgwiACOoErAAAACHRSTlMAOq7o/f8GjPiGxicAAABxSURBVHja7daxDoAwCEVRKFDUqv3/vxUnky71xcSlvftZeVDESdS6qSSmu+xqL1PPAdyAnIgVAcqUDCqRYEBIMaBkYJ/BskYbAMoeHRNMMMHg4HyqXdBUBgBWm+Dr/T+AJwseRXh24WFHXwf8OYHfnwsTcTOGPp9qywAAAABJRU5ErkJggg==');
    $('body').removeClass().addClass('status status-up');
  } else if (type === 'warning') {
    favicon.change('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAM1BMVEUAAAD/owD/owD/owD/ogD/owD/gAD/ogD/z3r/2pn/2Zb/7Mz//////fr/pAP/owL/owGl71DWAAAACHRSTlMAOq7o/f8GjPiGxicAAABxSURBVHgB7dY1AgMxFENB2ZaW6f6XXWjCpDBN/8oPmIWYqLOYYsAiy6kLMc/mIJchBwJlYECUJSLJkkBZCJluDopyVhlB3czaf/AP/sGPB91af0mwqf6BYOh3DP72fnpAWWgfRfvs+ofdfh3858R8fyY/qDOchDKCNwAAAABJRU5ErkJggg==');
    $('body').removeClass().addClass('status status-partial');
  } else if (type === 'error') {
    favicon.change('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAM1BMVEUAAAD/ADn/ADz/ADz/ADz/AD3/ACv/ADz/epn/mbH/lq//zNj/////+vv/Az//Aj7/AT0xAGOBAAAACHRSTlMAOq7o/f8GjPiGxicAAABxSURBVHgB7dY1AgMxFENB2ZaW6f6XXWjCpDBN/8oPmIWYqLOYYsAiy6kLMc/mIJchBwJlYECUJSLJkkBZCJluDopyVhlB3czaf/AP/sGPB91af0mwqf6BYOh3DP72fnpAWWgfRfvs+ofdfh3858R8fyY/qDOchDKCNwAAAABJRU5ErkJggg==');
    $('body').removeClass().addClass('status status-down');
  }

  if (localStorage.getItem('fullscreen')) {
    $('body').addClass('fullscreen');
  }
}

function minuteAgo(time) {
  const milliseconds = Date.now() - time.getTime();
  const minutes = Math.floor(milliseconds / 1000 / 60);
  return minutes === 0 ? '刚刚' : `${Math.floor(milliseconds / 1000 / 60)} 分钟前`;
}

function quoteattr(s) {
  return s.replace(/&/g, '&amp;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n/g, '&#13;')
    .replace(/[\r\n]/g, '&#13;');
}

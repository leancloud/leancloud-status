import $ from 'jquery';
import 'babel-polyfill';

const BUCKET_PREFIX = 'https://leancloud-status.s3.amazonaws.com';

$( () => {
  $.getJSON(`${BUCKET_PREFIX}/events.json`).then( statusEvents => {
    $('#status-events-editor').html(JSON.stringify(statusEvents, null, '  '));
  });

  $('#save-button').click( () => {
    Promise.resolve().then( () => {
      return $.ajax({
        method: 'put',
        url: '/events.json',
        data: JSON.stringify(JSON.parse($('#status-events-editor').val())),
        contentType: 'application/json'
      });
    }).then( () => {
      alert('success');
      location.reload();
    }).catch( err => {
      console.error(err);
      alert(err.message || err.responseText);
    });
  });

  $('#create-button').click( () => {
    try {
      const statusEvents = JSON.parse($('#status-events-editor').val());

      statusEvents.events.unshift({
        type: 'warning',
        content: 'TODO ...',
        time: new Date()
      });

      $('#status-events-editor').html(JSON.stringify(statusEvents, null, ' '));
    } catch (err) {
      alert(err.message);
    }
  });
});

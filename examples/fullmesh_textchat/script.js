// Connect to SkyWay, have server assign an ID instead of providing one
// Showing off some of the configs available with SkyWay :).
var peer = new Peer({
  // Set API key for cloud server (you don't need this if you're running your
  // own.
  key: window.__SKY_WAY_KEY__,
  // Set highest debug level (log everything!).
  debug: 3,
  // Set a logging function:
  logFunction: function() {
    var copy = Array.prototype.slice.call(arguments).join(' ');
    $('.log').append(copy + '<br>');
  }
});
var connectedPeers = {};
// Show this peer's ID.
peer.on('open', function(id){
  $('#pid').text(id);
});
// Await connections from others
peer.on('connection', connect);
peer.on('error', function(err) {
  console.log(err);
});
// Handle a connection object.
function connect(room) {
  // Handle a chat connection.
  $('#text').focus();
  var chatbox = $('<div></div>').addClass('connection').addClass('active').attr('id', room.name);
  var roomName = room.name.replace('sfu_text_', '');
  var header = $('<h1></h1>').html('Room: <strong>' + roomName + '</strong>');
  var messages = $('<div><em>Peer connected.</em></div>').addClass('messages');
  chatbox.append(header);
  chatbox.append(messages);
  // Select connection handler.
  chatbox.on('click', function() {
    if ($(this).attr('class').indexOf('active') === -1) {
      $(this).addClass('active');
    } else {
      $(this).removeClass('active');
    }
  });
  $('.filler').hide();
  $('#connections').append(chatbox);
  room.getLog();
  room.once('log', function(logs) {
    for(var i = 0; i < logs.length; i++) {
      var log = JSON.parse(logs[i]);

      switch (log.messageType) {
        case 'ROOM_DATA':
          messages.append('<div><span class="peer">' + log.message.src + '</span>: ' + log.message.data + '</div>');
          break;
        case 'ROOM_USER_JOIN':
          if (log.message.src === peer.id) {
            break;
          }
          messages.append('<div><span class="peer">' + log.message.src + '</span>: has joined the room </div>');
          break;
        case 'ROOM_USER_LEAVE':
          if (log.message.src === peer.id) {
            break;
          }
          messages.append('<div><span class="peer">' + log.message.src + '</span>: has left the room </div>');
          break;
      }
    }
  });
  room.on('data', function(message) {
    if (message.data instanceof ArrayBuffer) {
      var dataView = new Uint8Array(message.data);
      var dataBlob = new Blob([dataView]);
      var url = window.URL.createObjectURL(dataBlob);
      messages.append('<div><span class="file">' +
        message.src + ' has sent you a <a target="_blank" href="' + url + '">file</a>.</span></div>');
    } else {
      messages.append('<div><span class="peer">' + message.src + '</span>: ' + message.data + '</div>');
    }
  });
  room.on('peerJoin', function(peerId) {
    messages.append('<div><span class="peer">' + peerId + '</span>: has joined the room </div>');
  });
  room.on('peerLeave', function(peerId) {
    messages.append('<div><span class="peer">' + peerId + '</span>: has left the room </div>');
  });
}
$(document).ready(function() {
  // Prepare file drop box.
  var box = $('#box');
  box.on('dragenter', doNothing);
  box.on('dragover', doNothing);
  box.on('drop', function(e){
    e.originalEvent.preventDefault();
    var file = e.originalEvent.dataTransfer.files[0];
    eachActiveRoom(function(room, $c) {
      room.send(file);
      $c.find('.messages').append('<div><span class="file">You sent a file.</span></div>');
    });
  });
  function doNothing(e){
    e.preventDefault();
    e.stopPropagation();
  }
  $('#roomName').focus();
  // Connect to a room
  $('#connect').submit(function(e) {
    e.preventDefault();
    var roomName = $('#roomName').val();
    if (!roomName) {
      return;
    }
    if (!connectedPeers[roomName]) {
      // Create 2 connections, one labelled chat and another labelled file.
      var room = peer.joinRoom('mesh_text_' + roomName);
      room.on('open', function() {
        connect(room);
      });
    }
  });
  // Close a connection.
  $('#close').click(function() {
    eachActiveRoom(function(room, $c) {
      room.close();
      $c.remove();
    });
  });
  // Send a chat message to all active connections.
  $('#send').submit(function(e) {
    e.preventDefault();
    // For each active connection, send the message.
    var msg = $('#text').val();
    eachActiveRoom(function(room, $c) {
      room.send(msg);
      $c.find('.messages').append('<div><span class="you">You: </span>' + msg
        + '</div>');
    });
    $('#text').val('');
    $('#text').focus();
  });
  // Goes through each active peer and calls FN on its connections.
  function eachActiveRoom(fn) {
    var actives = $('.active');
    var checkedIds = {};
    actives.each(function() {
      var peerId = $(this).attr('id');
      if (!checkedIds[peerId]) {
        var room = peer.rooms[peerId];
        fn(room, $(this));
      }
      checkedIds[peerId] = 1;
    });
  }
  // Show browser version
  $('#browsers').text(navigator.userAgent);
});
// Make sure things clean up properly.
window.onunload = window.onbeforeunload = function(e) {
  if (!!peer && !peer.destroyed) {
    peer.destroy();
  }
};

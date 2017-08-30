/* eslint-disable require-jsdoc */
$(function() {
  // Connect to SkyWay, have server assign an ID instead of providing one
  // Showing off some of the configs available with SkyWay :).
  const peer = new Peer({
    // Set API key for cloud server (you don't need this if you're running your
    // own.
    key:         window.__SKYWAY_KEY__,
    // Set highest debug level (log everything!).
    debug:       3,
    // Set a logging function:
    logFunction: args => {
      const copy = [...args].join(' ');
      $('.log').append(copy + '<br>');
    },
  });
  const connectedPeers = {};

  // Show this peer's ID.
  peer.on('open', id => {
    $('#pid').text(id);
  });
  // Await connections from others
  peer.on('connection', connect);
  peer.on('error', err => console.log(err));

  // Prepare file drop box.
  const box = $('#box');
  box.on('dragenter', doNothing);
  box.on('dragover', doNothing);
  box.on('drop', e => {
    e.originalEvent.preventDefault();
    const [file] = e.originalEvent.dataTransfer.files;
    eachActiveRoom((room, $c) => {
      room.send(file);
      $c.find('.messages').append('<div><span class="file">You sent a file.</span></div>');
    });
  });
  function doNothing(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  $('#roomName').focus();

  // Connect to a room
  $('#connect').on('submit', e => {
    e.preventDefault();
    const roomName = $('#roomName').val();
    if (!roomName) {
      return;
    }
    if (!connectedPeers[roomName]) {
      // Create 2 connections, one labelled chat and another labelled file.
      const room = peer.joinRoom('mesh_text_' + roomName);
      room.on('open', function() {
        connect(room);
        connectedPeers[roomName] = room;
      });
    }
  });

  // Close a connection.
  $('#close').on('click', () => {
    eachActiveRoom(function(room, $c) {
      room.close();
      $c.remove();
    });
  });

  // Send a chat message to all active connections.
  $('#send').on('submit', e => {
    e.preventDefault();
    // For each active connection, send the message.
    const msg = $('#text').val();

    eachActiveRoom((room, $c) => {
      room.send(msg);
      $c.find('.messages').append('<div><span class="you">You: </span>' + msg
        + '</div>');
    });
    $('#text').val('');
    $('#text').focus();
  });

  // Show browser version
  $('#browsers').text(navigator.userAgent);

  // Make sure things clean up properly.
  window.onunload = window.onbeforeunload = function(e) {
    if (!!peer && !peer.destroyed) {
      peer.destroy();
    }
  };

  // Handle a connection object.
  function connect(room) {
    // Handle a chat connection.
    $('#text').focus();
    const chatbox = $('<div></div>').addClass('connection').addClass('active').attr('id', room.name);
    const roomName = room.name.replace('sfu_text_', '');
    const header = $('<h1></h1>').html('Room: <strong>' + roomName + '</strong>');
    const messages = $('<div><em>Peer connected.</em></div>').addClass('messages');
    chatbox.append(header);
    chatbox.append(messages);
    // Select connection handler.
    chatbox.on('click', () => {
      chatbox.toggleClass('active');
    });

    $('.filler').hide();
    $('#connections').append(chatbox);

    room.getLog();
    room.once('log', logs => {
      for (let i = 0; i < logs.length; i++) {
        const log = JSON.parse(logs[i]);

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

    room.on('data', message => {
      if (message.data instanceof ArrayBuffer) {
        const dataView = new Uint8Array(message.data);
        const dataBlob = new Blob([dataView]);
        const url = URL.createObjectURL(dataBlob);
        messages.append('<div><span class="file">' +
          message.src + ' has sent you a <a target="_blank" href="' + url + '">file</a>.</span></div>');
      } else {
        messages.append('<div><span class="peer">' + message.src + '</span>: ' + message.data + '</div>');
      }
    });

    room.on('peerJoin', peerId => {
      messages.append('<div><span class="peer">' + peerId + '</span>: has joined the room </div>');
    });

    room.on('peerLeave', peerId => {
      messages.append('<div><span class="peer">' + peerId + '</span>: has left the room </div>');
    });
  }

  // Goes through each active peer and calls FN on its connections.
  function eachActiveRoom(fn) {
    const actives = $('.active');
    const checkedIds = {};
    actives.each((_, el) => {
      const peerId = $(el).attr('id');
      if (!checkedIds[peerId]) {
        const room = peer.rooms[peerId];
        fn(room, $(el));
      }
      checkedIds[peerId] = 1;
    });
  }
});

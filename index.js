const IPFS = require("ipfs");
const Room = require("ipfs-pubsub-room");
const fs = require("fs");
const pickBy = require("lodash/pickBy");
const keys = require("lodash/keys");
const isEmpty = require("lodash/isEmpty");

module.exports = function (vorpal) {
  if (vorpal.config.remote.enable) {
    initialize(vorpal);
  }

  vorpal
    .command("remote [user] [command...]")
    .option("-l, --list", "List all peers")
    .option("-w, --whois <name>", "Show peers with this name")
    .description("Run command on distant bot(s)")
    .action(function (args, callback) {
      if (vorpal.config.remote.enable) {
        if (args.options.list) {
          showPeers();
        } else if (args.options.whois) {
          showWhois(args.options.whois);
        } else {
          remoteCommand(args.command.join(" "), args.user);
        }
      } else {
        console.log('remote command is not enabled - set the config remote.enable to true in config.yaml')
      }

      callback();
    });
};

let myIdentity;
let room;
const userMap = {};
const internalCommandPrefix = "[internal] ";

function initialize(vorpal) {
  console.log("[bot-remote] Initializing...");

  function repo() {
    return "ipfs/acailly/bot-remote/" + Math.random();
  }
  const ipfs = new IPFS({
    repo: repo(),
    EXPERIMENTAL: {
      pubsub: true,
      dht: true
    },
    config: {
      Addresses: {
        Swarm: [
          // '/dns4/wrtc-star.discovery.libp2p.io/tcp/443/wss/p2p-webrtc-star' //MORE "BROWSERISH", BUT LESS STABLE
          "/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star" //MORE STABLE, PREFFERRED FOR LIVE DEMO
        ]
      }
    }
  });

  ipfs.on("error", err => {
    console.error(err);
  });

  ipfs.on("ready", () =>
    ipfs.id((err, info) => {
      if (err) {
        throw err;
      }

      myIdentity = info.id;
      const myUsername = vorpal.config.remote.username;
      registerUsername(myIdentity, myUsername);
      showPeerCount();

      const roomName = vorpal.config.remote.room;
      room = Room(ipfs, roomName);

      room.on("peer joined", peer => {
        room.sendTo(
          peer,
          `${internalCommandPrefix} register ${myIdentity} ${myUsername}`
        );
      });

      room.on("peer left", peer => {
        if (peer === myIdentity) return;

        unregisterUsername(peer);
        showPeerCount();
      });

      room.on("subscribed", () => {
        console.log("[bot-remote] Entered the room!");
        showPeerCount();
      });

      room.on("message", message => {
        const command = message.data.toString();

        if (command.startsWith(internalCommandPrefix)) {
          const internalCommand = command.substring(
            internalCommandPrefix.length
          );
          const registerUsernameMatch = /register (.+) (.+)/.exec(
            internalCommand
          );
          if (registerUsernameMatch) {
            const peer = registerUsernameMatch[1];
            const peerUsername = registerUsernameMatch[2];
            registerUsername(peer, peerUsername);
            showPeerCount();
          }
          return;
        }

        console.log(
          "[bot-remote] User",
          message.from,
          "asked to execute",
          command
        );

        vorpal
          .exec(command)
          .then(res => {
            if (res) vorpal.log(res);
          })
          .catch(error => {
            if (error) console.log("error", error);
          });
      });
    })
  );
}

function remoteCommand(command, username) {
  if (!command) {
    console.error("[bot-remote] No command specified");
    return;
  }

  if (!room) {
    console.error(
      "[bot-remote] You cannot execute command on remote because you are not connected to the room yet"
    );
    return;
  }

  if (username === "all") {
    room.broadcast(command);
  } else {
    const peers = findPeersFromUsername(username);
    if (isEmpty(peers)) {
      console.error("[bot-remote] No peer was found with the name", username);
      return;
    }

    peers.forEach(peer => room.sendTo(peer, command));
  }
}

function findPeersFromUsername(username) {
  return keys(pickBy(userMap, value => value === username));
}

function registerUsername(peer, username) {
  console.log(`[bot-remote] Peer ${peer} is named ${username}`);
  userMap[peer] = username;
}

function unregisterUsername(peer) {
  const peerUsername = userMap[peer];
  console.log(`[bot-remote] Peer ${peer}(${peerUsername}) left`);
  userMap[peer] = undefined;
}

function showPeerCount() {
  if (!room) return;

  const peerCount = room.getPeers().length;
  console.log(`[bot-remote] ${peerCount} other peers are connected`);
}

function showPeers() {
  if (!room) return;

  const peers = room.getPeers();
  console.log(
    `[bot-remote] I am ${myIdentity} and my name is ${userMap[myIdentity]}`
  );
  console.log(`[bot-remote] ${peers.length} other peers are connected`);
  peers.forEach(peer => {
    console.log(`[bot-remote] ${peer} is named ${userMap[peer]}`);
  });
}

function showWhois(username) {
  const peers = findPeersFromUsername(username);
  console.log(`[bot-remote] These peers are named ${username}`);
  peers.forEach(peer => {
    console.log(`[bot-remote] - ${peer}`);
  });
}
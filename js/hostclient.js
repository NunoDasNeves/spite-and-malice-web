/* Peer to peer, host/client stuff */

/* Packet format
 * {
 *  type,
 *  data,
 * }
 * data depends on the packet type
 * 
 * client
 * PLAYERINFO { name }
 * STARTGAME {}
 * MOVE { type, <other fields depending on type> }
 * // EMOTE { type }
 * // ENDGAME {}
 * 
 * host
 * ROOMINFO { players: { [id]: { name, id, isAdmin } ... } }
 * GAMESTART { <game view stuff> }
 * MOVE { playerId, move: { type, <other fields depending on type> }, result: { <stuff to update game view> } }
 * // PLAYERLEFT { playerId }
 * // EMOTE { playerId, type }
 * GAMEEND { winnerId }
 */
const CLIENTPACKET = Object.freeze({
    PLAYERINFO: 0,
    STARTGAME: 1,
    MOVE: 2,
    //EMOTE: 3,
    //ENDGAME: 4,
});

const HOSTPACKET = Object.freeze({
    ROOMINFO: 0,
    GAMESTART: 1,
    MOVE: 2,
    //PLAYERLEFT: 3,
    //EMOTE: 4,
    GAMEEND: 5,
});

/* connection to a local player */
LocalConn.count = 0;
function LocalConn(rcvFn, closeFn) {
    this.id = `${LocalConn.count}-local`;
    LocalConn.count++;
    /* Host does stuff on these callbacks */
    this.onData = () => {};
    this.onClose = () => {};
    this.onError = () => {};
    this.queue = [];
    this.dequeueing = false;
    this.dequeue = () => {
        if (this.queue.length > 0) {
            this.queue.shift()(); // call it
        }
        if (this.queue.length > 0) {
            setTimeout(this.dequeue, testing ? TEST_LOCAL_LATENCY : 0);
        }
    }
    /* Host uses this to signal client */
    this.send = (data) => {
        this.queue.push(() => { rcvFn(data); });
        if (!this.dequeueing) {
            setTimeout(this.dequeue, testing ? TEST_LOCAL_LATENCY : 0);
        }
    };
    this.close = () => {
        this.queue.push(closeFn);
        if (!this.dequeueing) {
            setTimeout(this.dequeue, testing ? TEST_LOCAL_LATENCY : 0);
        }
    };
}

class Host {
    constructor() {
        this.nextPlayerId = 0;
        this.nextColor = 0;
        this.game = null;
        this.players = {};
        this.playersByConn = {};
        this.turn = 0;
        this.peer = null;
        this.hostId = 'local-host';
        this.inLobby = true;
    }
    /* Connect to peering server, open to remote connections */
    open(hostIdCb) {
        const options = {
            debug: 3,
        };
        this.peer = new Peer(options);
        this.peer.on('open', (id) => {
            this.hostId = id;
            console.log('Host ID is: ' + id);
            hostIdCb(id);
        });
        this.peer.on('connection', (conn) => {
            this.addRemotePlayer(conn);
        });
        this.peer.on('disconnected', () => {
            this.tryReconnectPeer();
        });
        this.peer.on('close', () => {
            console.log('Peer closed');
            this.close();
        });
        this.peer.on('error', (err) => {
            console.error('Peer error');
            console.error(err);
            switch(err.type) {
                case 'network':
                case 'disconnected':
                    this.tryReconnectPeer();
                    break;
                default:
                    alert('Network error! Disconnected');
                    this.close();
                    break;
            }
        });
    }
    tryReconnectPeer() {
        console.log('Host peer disconnected');
        if (this.peer.destroyed) {
            this.close();
            return;
        }
        console.log('Attempting reconnect');
        displayConnectionStatus('Disconnected...attempting to reconnect');
        try {
            this.peer.reconnect();
            displayConnectionStatus('Reconnected. Hopefully.');
        } catch (err) {
            console.error(`Failed due to '${err.name}':`);
            console.error(err.message);
            this.close();
        }
    }
    reconnectPlayer(conn, connId, oldConnId) {
        if (this.playersByConn.hasOwnProperty(oldConnId)) {
            const player = this.playersByConn[oldConnId];
            player.conn = conn;
            player.connId = connId;
            player.connected = false;
            player.reconnected = true;
            this.playersByConn[connId] = player;
            delete this.playersByConn[oldConnId];
            return true;
        } else {
            return false;
        }
    }
    getNextAvailableColor(color) {
        const takenColors = Object.values(this.players).map(({color}) => color);
        if (takenColors.length >= PLAYER_COLORS.length) {
            console.error('No colors available!');
            return -1;
        }
        while (true) {
            let available = true;
            for (const takenColor of takenColors) {
                if (takenColor == color) {
                    available = false;
                    break;
                }
            }
            if (available) {
                break;
            }
            color = (color + 1) % PLAYER_COLORS.length;
        }
        return color;
    }
    addPlayer(conn, connId) {
        /* first check for reconnect */
        if (!this.inLobby) {
            if (conn.metadata != undefined && conn.metadata.hasOwnProperty('connId')) {
                return this.reconnectPlayer(conn, connId, conn.metadata.connId);
            } else {
                return false;
            }
        }

        if (Object.keys(this.players).length >= MAX_PLAYERS) {
            return false;
        }
        /* Find the next id; there has to be one because of the above check */
        while (this.players[this.nextPlayerId] != undefined) {
            this.nextPlayerId = (this.nextPlayerId + 1) % MAX_PLAYERS;
        }
        const player = {
            conn,
            connId,
            name: "Unknown",
            color: this.getNextAvailableColor(0),
            id: this.nextPlayerId,
            connected: false,
            reconnected: false,
            haveInfo: false,
            isAdmin: false,
            local: false,
            buffer: [],
        };
        this.players[player.id] = player;
        this.playersByConn[connId] = player;

        return true;
    }
    /* Add a player with an existing PeerJs connection */
    addRemotePlayer (conn) {
        const connId = conn.peer;
        if (!this.addPlayer(conn, connId)) {
            conn.close();
            return;
        }
        const player = this.playersByConn[connId];

        /* big yikes. we have to buffer messages because 'data' can come before 'open' */
        conn.on('open', () => {
            console.log('Player connected');
            player.connected = true;
            while (player.buffer.length) {
                console.log('Playing back buffered message');
                const data = player.buffer.shift();
                this.receive(connId, data);
            }
        });
        conn.on('data', (data) => {
            this.receive(connId, data);
        });
        conn.on('close', () => {
            console.log(`Player ${connId} connection closed`);
            if (this.inLobby) {
                this.removePlayer(connId);
            } else {
                this.disconnectPlayer(connId);
            }
        });
        conn.on('error', (err) => {
            console.error('Error in remote player connection');
            console.error(this.playersByConn[connId]);
            console.error(err);
        });
    }
    /* Add a player with a LocalConn */
    addLocalPlayer(conn) {
        const connId = conn.id;
        if (!this.addPlayer(conn, connId)) {
            conn.close();
            return;
        }
        const player = this.playersByConn[connId];
        player.connected = true;
        player.local = true;
        console.log('Player connected');

        conn.onData = (data) => {
            this.receive(connId, JSON.parse(JSON.stringify(data)));
        }
        conn.onClose = () => {
            if (this.inLobby) {
                this.removePlayer(connId);
            } else {
                this.disconnectPlayer(connId);
            }
        }
        conn.onError = (err) => {
            console.error('Error in local player connection');
            console.error(this.playersByConn[connId]);
            console.error(err);
        }
    }
    removePlayer(connId) {
        const player = this.playersByConn[connId];
        const playerId = this.playersByConn[connId].id
        player.conn.close();
        delete this.playersByConn[connId];
        delete this.players[playerId];
        this.broadcast((id) => this.packetRoomInfo(id));
    }
    disconnectPlayer(connId) {
        const player = this.playersByConn[connId];
        player.connected = false;
        player.conn.close();
        this.broadcast((id) => this.packetRoomInfo(id));
    }
    close() {
        /* close local connections (remote will be closed by peer) */
        for (const player of Object.values(this.players)) {
            if (player.local) {
                player.conn.close();
            }
        }
        if (this.peer != null) {
            this.peer.destroy();
        }
    }
    broadcast(packetFn) {
        for (const {conn, id, connected} of Object.values(this.players)) {
            if (connected) {
                conn.send(packetFn(id));
            }
        };
    }
    packetRoomInfo(id) {
        const player = this.players[id];
        return {
            type: HOSTPACKET.ROOMINFO,
            data: { 
                    connId: player.connId,
                    myId: id,
                    players: Object.values(this.players)
                                .filter(({haveInfo}) => haveInfo)
                                .reduce((obj, {name, id, isAdmin, color, connected}) => {
                                    obj[id] = {name, id, isAdmin, color, connected};
                                    return obj;
                                }, {})
                  },
        };
    }
    packetGameStart(id) {
        return {
            type: HOSTPACKET.GAMESTART,
            data: this.game.toView(id),
        };
    }
    packetGameMove(id, move, playerId) {
        return {
            type: HOSTPACKET.MOVE,
            data: {
                move,
                playerId: playerId,
                gameView: this.game.toView(id),
            }
        };
    }
    /* Handle messages from the client */
    receive(connId, data) {
        const player = this.playersByConn[connId];
        if (!player.connected) {
            player.buffer.push(data);
            return;
        }
        switch(data.type) {
            case CLIENTPACKET.PLAYERINFO:
                console.debug('Received player info');
                if (!player.haveInfo) {
                    player.name = data.data.name.replace(/[^a-zA-Z0-9_\- ]+/g, "").slice(0, MAX_NAME_LEN);
                    player.haveInfo = true;
                    /* first player is admin */
                    const numHaveInfo = Object.values(this.players).reduce((prev, {haveInfo}) => haveInfo ? prev + 1 : prev, 0);
                    if (numHaveInfo == 1) {
                        player.isAdmin = true;
                    }
                    this.broadcast((id) => this.packetRoomInfo(id));
                } else if (player.reconnected) {
                    /* tell everyone they reconnected and tell them the room details */
                    this.broadcast((id) => this.packetRoomInfo(id));
                    /* tell reconnected player to start their game and give them the game view */
                    player.conn.send(this.packetGameStart(player.id));
                    player.reconnected = false;
                }
                break;
            case CLIENTPACKET.STARTGAME:
                console.debug('Received start game');
                if (this.inLobby && player.isAdmin) {
                    this.inLobby = false;
                    /* remove any players whom we don't have info for yet */
                    const notHaveInfoIds = Object.keys(this.playersByConn).filter(connId => !this.playersByConn[connId].haveInfo);
                    for (const connId of notHaveInfoIds) {
                        const player = this.playersByConn[connId];
                        const playerId = player.id
                        delete this.playersByConn[connId];
                        delete this.players[playerId];
                        player.conn.close();
                    }
                    this.game = new Game(this.players, 2, testing ? 2 : 13, 4);
                    this.broadcast((id) => this.packetGameStart(id));
                }
                break;
            case CLIENTPACKET.MOVE:
                console.debug('Received game move');
                if (!this.inLobby && this.game != null && !this.game.ended()) {
                    const playerId = player.id;
                    if (this.game.move(data.data, playerId)) {
                        this.broadcast((id) => this.packetGameMove(id, data.data, playerId));
                        if (this.game.ended()) {
                            this.inLobby = true; /* TODO make this part of roomInfo */
                        }
                    }
                }
                break;
            default:
                console.warn('Unknown client packet received');
        }
    }
}

/* The local client who talks to either Host or RemoteHost */
class Client {
    constructor(name, isAdmin, openCb, popLobbyCb, closeCb) {
        this.playerInfo = { name };
        this.roomInfo = {};
        this.isAdmin = isAdmin;
        this.gameScene = new GameScene(gameCanvas);
        this.inLobby = true;
        this.playerDomNames = {};
        this.openCb = openCb;
        this.popLobbyCb = popLobbyCb;
        this.closeCb = closeCb;
    }
    /* Handle messages from the host */
    receive(data) {
        switch(data.type) {
            case HOSTPACKET.ROOMINFO:
                this.roomInfo = data.data;
                console.debug(`Player ${this.roomInfo.myId} received roomInfo`);
                if (this.inLobby) {
                    localStorage.setItem('hostConnection', JSON.stringify({hostId: this.hostId, connId: this.roomInfo.connId}));
                    this.popLobbyCb(this.roomInfo, this.isAdmin);
                } else {
                    this.gameScene.updateRoomInfo(this.roomInfo);
                }
                break;
            case HOSTPACKET.GAMESTART:
                console.debug(`Player ${this.roomInfo.myId} received game start`);
                if (this.inLobby) {
                    this.gameScene.start(data.data, this.roomInfo);
                    this.inLobby = false;
                    goToGame();
                }
                break;
            case HOSTPACKET.MOVE:
                console.debug(`Player ${this.roomInfo.myId} received game move`);
                if (!this.inLobby) {
                    const {move, gameView, playerId} = data.data;
                    this.gameScene.updateGameViewFromServer(gameView, move);
                    if (gameView.ended) {
                        showWinner(this.roomInfo.players[gameView.winner].name);
                        this.inLobby = true;
                        /* hack because we might see the wrong lobby and not be able to restart game (for local testing) */
                        if (testing) {
                            currLocalClient = 0;
                            client = localClients[currLocalClient];
                        }
                    }
                }
                break;
            default:
                console.warn('Unknown host packet received');
        }
    }

    sendPacketMove(move) {
        this.send({
            type: CLIENTPACKET.MOVE,
            data: move
        });
    }
}

class LocalClient extends Client {
    constructor(host, name, openCb, popLobbyCb, closeCb, sendInfo) {
        super(name, true, openCb, popLobbyCb, closeCb);
        this.host = host;
        this.conn = new LocalConn((data) => { this.receive(JSON.parse(JSON.stringify(data))); }, () => { this.hostClosed(); });
        this.host.addLocalPlayer(this.conn);
        /* Local client connections are immediately 'open' aka connected to the host
         * But we need to defer the call because the client/s must be fully created before running the callback, sending info etc
         * Really we just do this so it works the same as a RemoteClient.
         */
        setTimeout(() => {
            /* this is for testing players who connect but don't send info due to bug or browser compat issue */
            if (sendInfo == true) {
                this.send({type: CLIENTPACKET.PLAYERINFO, data: this.playerInfo});
            }
            this.openCb(host.hostId);
        }, 0);
    }
    /* send data to host */
    send (data) {
        this.conn.onData(data);
    }
    /* called by a UI button or something - close the connection (which will cause host to close it from that side too) */
    close () {
        this.conn.onClose();
    }
    /* called by localConn when the host closed us (implicitly called by close() above) */
    hostClosed() {
        console.log(`'${this.playerInfo.name}': Host disconnected me`);
        this.closeCb();
    }
}

/* create a connection with a remote host, send them player info, forward data to the client */
class RemoteClient extends Client {
    constructor(hostId, name, openCb, popLobbyCb, closeCb) {
        super(name, false, openCb, popLobbyCb, closeCb);
        this.hostId = hostId;
        const options = {
            debug: 3,
        };
        this.peer = new Peer(options);
        this.conn = null;
        this.closing = false;

        this.peer.on('open', (id) => {
            this.localId = id;
            console.log('My player ID is: ' + id);
            console.log('Attempting to connect to ' + this.hostId);

            const hostConnection = localStorage.getItem('hostConnection');
            const options = {
                serialization: 'json',
                reliable:true,
            };
            this.conn = this.peer.connect(this.hostId, options);
            if (hostConnection != null) {
                const { hostId, connId } = JSON.parse(hostConnection);
                if (hostId == this.hostId) {
                    this.conn.metadata = { connId };
                }
            }
            this.conn.on('open', () => {
                console.log('Connected to host');
                this.conn.send({type: CLIENTPACKET.PLAYERINFO, data: this.playerInfo});
                this.openCb(id);
            });
            this.conn.on('data', (data) => {
                this.receive(data);
            });
            this.conn.on('close', () => {
                console.log('Host connection was closed');
                /* Did we expect to close? */
                if (!this.closing) {
                    this.close();
                    alert('You were disconnected from the host!');
                }
            });
            this.conn.on('error', (err) => {
                console.error('Error in host connection')
                console.error(err);
                if (!this.closing) {
                    this.close();
                    alert('Error in host connection!');
                }
            });
        });
        this.peer.on('disconnected', () => {
            this.tryReconnectPeer();
        });
        this.peer.on('close', () => {
            console.log('Peer closed');
            this.close();
        });
        this.peer.on('error', (err) => {
            console.error('Peer error');
            console.error(err);
            switch(err.type) {
                case 'invalid-id':
                    alert('Invalid game ID - illegal characters');
                    this.close();
                    break;
                case 'peer-unavailable':
                    alert('Invalid game ID - game does not exist');
                    this.close();
                    break;
                case 'network':
                case 'disconnected':
                    this.tryReconnectPeer();
                    break;
                default:
                    alert('Network error! Disconnected');
                    this.close();
                    break;
            }
        });
    }
    tryReconnectPeer() {
        console.log('Peer disconnected');
        if (this.peer.destroyed) {
            this.close();
            return;
        }
        console.log('Attempting reconnect');
        displayConnectionStatus('Disconnected from server...attempting to reconnect');
        try {
            this.peer.reconnect();
            displayConnectionStatus('Reconnected. Hopefully.');
        } catch (err) {
            console.error(`Failed due to '${err.name}':`);
            console.error(err.message);
            this.close();
        }
    }
    send(data) {
        this.conn.send(data);
    }
    close() {
        this.closing = true;
        this.peer.destroy();
        this.closeCb();
    }
}


# Spite and Malice
An easy way to enjoy the playing card game Spite and Malice (also known as Cat and Mouse) with your friends online.  

(This game is not done by the way...many parts are still incomplete or just plain broken - see TODO).

## How to play

Just play in your browser here:  
https://nunodasneves.com/spite-and-malice-web/

## Technical notes

- [peerjs](https://peerjs.com/) is used to create data connections between clients and the game server.
    - Peerjs wraps WebRTC, the standard that enables peer-to-peer connections in the browser.
    - Each player is a peerjs 'peer'.
    - The server is just the peer who created the game.
    - For now I just use PeerJS's public server for NAT punching with STUN/TURN/whatever.
    - Note there is no peer/lobby discovery mechanism at this time. You have to share the lobby code with anyone who wants to join.
- [threejs](https://threejs.org/]) is used for all the 3D stuff.

## Testing
I just spin up a server with python to get around browser single-origin restrictions etc:
```
cd spite-and-malice-web
python3 -m http.server 50000
```
Then you can open http://localhost:50000 in one tab per player and test creating/joining games, gameplay, etc.

There's also a 'test game' button. Enter the number of players, and it will start a game with local-only players (no remote connections are made).  
Switch between players with the arrow keys.

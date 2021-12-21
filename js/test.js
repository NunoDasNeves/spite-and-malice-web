let testing = false;

const testingKeyDownFunc = {
    left() {
        currLocalClient = (currLocalClient + localClients.length - 1) % localClients.length;
        client = localClients[currLocalClient];
        windowResize();
    },
    right() {
        currLocalClient = (currLocalClient + 1) % localClients.length;
        client = localClients[currLocalClient];
        windowResize();
    },
    up() {
        let k = 'y';
        if (rawInput.z) {
            k = 'z';
        }
        client.gameScene.camera.position[k]++;
        client.gameScene.camera.lookAt(client.gameScene.cameraLookAtPoint);
    },
    down() {
        let k = 'y';
        if (rawInput.z) {
            k = 'z';
        }
        client.gameScene.camera.position[k]--;
        client.gameScene.camera.lookAt(client.gameScene.cameraLookAtPoint);
    },
    refresh() {
        windowResize();
    }
};

function testGame(num) {
    testing = true;
    host = new Host();
    localClients = Array.from(Array(num), (_,i) =>
        new LocalClient(host,
                        `Bob${i}`,
                        (id) => {
                            if (i == 0) {
                                goToLobby(id);
                            }
                        },
                        (roomInfo, _) => {
                            if (i == 0) {
                                populateLobby(roomInfo, true);
                            }
                        },
                        () => {
                            if (i == 0) {
                                changeScreen(SCREENS.MAIN);
                            }
                        },
                        true));
    /* this client connects but doesn't send info; should be dropped when game starts */
    const fakeClient = new LocalClient(host, 'Charles', () => {}, () => {}, () => {}, false);
    currLocalClient = 0;
    client = localClients[currLocalClient];
}

function test() {
    const num = parseInt(prompt('Num players:'), 10);
    if (num != NaN && num >= MIN_PLAYERS && num <= MAX_PLAYERS) {
        testGame(num);
    }
}

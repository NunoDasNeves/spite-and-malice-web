const keyToInputMap = Object.freeze({
    'ArrowLeft':    'left',
    'ArrowRight':   'right',
    'ArrowDown':    'down',
    'ArrowUp':      'up',
    'Escape':       'esc',
    'p':            'pause',
    ' ':            'refresh',
    '`':            'debug',
    '.':            'nextFrame',
});

const rawInput = {
    mouse: {
        pos: {x: 0, y: 0},
        left: false,
        right: false,
    },
    left: false,
    right: false,
    down: false,
    up: false,
    esc: false,
    pause: false,
    refresh: false,
    debug: false,
    nextFrame: false,
};

function inputKeyDown(event) {
    var inputName = keyToInputMap[event.key];
    if (inputName) {
        if (!rawInput[inputName]) {
            if (keyDownFunc[inputName]) {
                keyDownFunc[inputName]();
            }
            rawInput[inputName] = true;
        }
    }
}

function inputKeyUp(event) {
    var inputName = keyToInputMap[event.key];
    if (inputName) {
        rawInput[inputName] = false;
    }
}

function inputMouseMove(event) {
    //rawInput.mouse.pos = {x: event.x - canvas.main.offsetLeft, y: event.y - canvas.main.offsetTop};
}
function inputMouseDown(event) {
    //rawInput.mouse.pos = {x: event.x - canvas.main.offsetLeft, y: event.y - canvas.main.offsetTop};
    switch (event.button) {
        case 0:
            rawInput.mouse.left = true;
            break;
        case 2:
            rawInput.mouse.right = true;
            break;
    }
}
function inputMouseUp(event) {
    //rawInput.mouse.pos = {x: event.x - canvas.main.offsetLeft, y: event.y - canvas.main.offsetTop};
    switch (event.button) {
        case 0:
            rawInput.mouse.left = false;
            break;
        case 2:
            rawInput.mouse.right = false;
            break;
    }
}

function initInput() {
    window.addEventListener('keydown', inputKeyDown, false);
    window.addEventListener('keyup', inputKeyUp, false);
    //window.addEventListener('mousemove', inputMouseMove, false);
    //window.addEventListener('mousedown', inputMouseDown, false);
    //window.addEventListener('mouseup', inputMouseUp, false);
}
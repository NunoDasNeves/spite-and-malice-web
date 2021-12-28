function drawClub(ctx, x, y, scale) {
    ctx.fillStyle = 'black';
    for (const [cx,cy] of [[50,25],[26,66],[74,66]]) {
        ctx.beginPath();
        ctx.arc(x+cx*scale, y+cy*scale, 24*scale, 0, 2*Math.PI);
        ctx.fill();
    }
    /* fill middle */
    ctx.beginPath();
    ctx.arc(x+50*scale, y+52*scale, 13*scale, 0, 2*Math.PI);
    ctx.fill();
    /* stem */
    ctx.rect(x+46*scale,y+55*scale,8*scale,40*scale);
    ctx.fill();
}

function drawHeart(ctx, x, y, scale) {
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(x+26*scale, y+25*scale, 24*scale, 0, 2*Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x+74*scale, y+25*scale, 24*scale, 0, 2*Math.PI);
    ctx.fill();
    //ctx.strokeStyle = 'yellow';
    ctx.beginPath();
    const ax = x+2*scale;
    const ay = y+25*scale;
    const bx = x+50*scale;
    const by = y+98*scale;
    const cx = x+98*scale;
    const cy = ay;
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(ax, ay+30*scale, bx, by-40*scale, bx, by);
    ctx.bezierCurveTo(bx, by-40*scale, cx, cy+30*scale, cx, cy);
    //ctx.stroke();
    ctx.fill();
}

function drawDiamond(ctx, x, y, scale) {
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(x+50*scale, y+1*scale);
    ctx.lineTo(x+90*scale, y+50*scale);
    ctx.lineTo(x+50*scale, y+98*scale);
    ctx.lineTo(x+10*scale, y+50*scale);
    ctx.fill();
}

function drawSpade(ctx, x, y, scale) {
    ctx.fillStyle = 'black';
    for (const [cx,cy] of [[26,66],[74,66]]) {
        ctx.beginPath();
        ctx.arc(x+cx*scale, y+cy*scale, 24*scale, 0, 2*Math.PI);
        ctx.fill();
    }
    const ax = x+2*scale;
    const ay = y+66*scale;
    const bx = x+50*scale;
    const by = y+2*scale;
    const cx = x+98*scale;
    const cy = ay;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(ax, ay-30*scale, bx, by+40*scale, bx, by);
    ctx.bezierCurveTo(bx, by+40*scale, cx, cy-30*scale, cx, cy);
    ctx.fill();
    /* stem */
    ctx.rect(x+46*scale,y+55*scale,8*scale,40*scale);
    ctx.fill();
}

const SUITE_TO_DRAWFN = Object.freeze({
    [SUITS_IDX.SPADES]: drawSpade,
    [SUITS_IDX.HEARTS]: drawHeart,
    [SUITS_IDX.DIAMONDS]: drawDiamond,
    [SUITS_IDX.CLUBS]: drawClub,
});

const CARD_FONT = '140px bold Helvetica, Arial, sans-serif';
const CARD_FONT_JOKER = `${CARD_CANVAS_HEIGHT-22}px bold Helvetica, Arial, sans-serif`;

function makeCardCanvas(value, suite) {
    const canvas = createCanvas(CARD_CANVAS_WIDTH,CARD_CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    const edgeRadius = 30;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(1,1+edgeRadius);
    /* top edge */
    ctx.arcTo(1,1,1+edgeRadius,1,edgeRadius);
    ctx.lineTo(CARD_CANVAS_WIDTH-2-edgeRadius, 1);
    ctx.arcTo(CARD_CANVAS_WIDTH-2,1,CARD_CANVAS_WIDTH-2,1+edgeRadius,edgeRadius);
    /* right side */
    ctx.lineTo(CARD_CANVAS_WIDTH-2, CARD_CANVAS_HEIGHT-2-edgeRadius);
    /* bottom edge */
    ctx.arcTo(CARD_CANVAS_WIDTH-2,CARD_CANVAS_HEIGHT-2,CARD_CANVAS_WIDTH-2-edgeRadius,CARD_CANVAS_HEIGHT-2,edgeRadius);
    ctx.lineTo(1+edgeRadius, CARD_CANVAS_HEIGHT-2);
    ctx.arcTo(1,CARD_CANVAS_HEIGHT-2,1,CARD_CANVAS_HEIGHT-2-edgeRadius,edgeRadius);
    ctx.fill();
    const scale = 1.3;
    const suiteWidth = 100 * scale;
    if (value != 14) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = CARD_FONT;
        SUITE_TO_DRAWFN[suite](ctx, (CARD_CANVAS_WIDTH - suiteWidth)/2, (CARD_CANVAS_HEIGHT - suiteWidth)/1.3, scale);
        ctx.fillText(cardLetters(value), CARD_CANVAS_WIDTH/2, 23);
    } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = CARD_FONT_JOKER;
        ctx.fillStyle = 'black';
        ctx.fillText('J', CARD_CANVAS_WIDTH/2, 23);
    }

    return canvas;
}

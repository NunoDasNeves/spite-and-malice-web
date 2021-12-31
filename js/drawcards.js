const SUITE_WIDTH_PX = 100;
const SUITE_HEIGHT_PX = 100;

function drawClub(ctx, x, y, scale) {
    const sx = x - SUITE_WIDTH_PX*scale/2;
    const sy = y - SUITE_HEIGHT_PX*scale/2;
    ctx.fillStyle = 'black';
    for (const [cx,cy] of [[50,25],[26,66],[74,66]]) {
        ctx.beginPath();
        ctx.arc(sx+cx*scale, sy+cy*scale, 24*scale, 0, 2*Math.PI);
        ctx.fill();
    }
    /* fill middle */
    ctx.beginPath();
    ctx.arc(sx+50*scale, sy+52*scale, 13*scale, 0, 2*Math.PI);
    ctx.fill();
    /* stem */
    ctx.beginPath();
    ctx.rect(sx+46*scale,sy+55*scale,8*scale,40*scale);
    ctx.fill();
}

function drawHeart(ctx, x, y, scale) {
    const sx = x - SUITE_WIDTH_PX*scale/2;
    const sy = y - SUITE_HEIGHT_PX*scale/2;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(sx+26*scale, sy+25*scale, 24*scale, 0, 2*Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx+74*scale, sy+25*scale, 24*scale, 0, 2*Math.PI);
    ctx.fill();
    //ctx.strokeStyle = 'yellow';
    ctx.beginPath();
    const ax = sx+2*scale;
    const ay = sy+25*scale;
    const bx = sx+50*scale;
    const by = sy+98*scale;
    const cx = sx+98*scale;
    const cy = ay;
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(ax, ay+30*scale, bx, by-40*scale, bx, by);
    ctx.bezierCurveTo(bx, by-40*scale, cx, cy+30*scale, cx, cy);
    //ctx.stroke();
    ctx.fill();
}

function drawDiamond(ctx, x, y, scale) {
    const sx = x - SUITE_WIDTH_PX*scale/2;
    const sy = y - SUITE_HEIGHT_PX*scale/2;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(sx+50*scale, sy+1*scale);
    ctx.lineTo(sx+90*scale, sy+50*scale);
    ctx.lineTo(sx+50*scale, sy+98*scale);
    ctx.lineTo(sx+10*scale, sy+50*scale);
    ctx.fill();
}

function drawSpade(ctx, x, y, scale) {
    const sx = x - SUITE_WIDTH_PX*scale/2;
    const sy = y - SUITE_HEIGHT_PX*scale/2;
    ctx.fillStyle = 'black';
    for (const [cx,cy] of [[26,66],[74,66]]) {
        ctx.beginPath();
        ctx.arc(sx+cx*scale, sy+cy*scale, 24*scale, 0, 2*Math.PI);
        ctx.fill();
    }
    const ax = sx+2*scale;
    const ay = sy+66*scale;
    const bx = sx+50*scale;
    const by = sy+2*scale;
    const cx = sx+98*scale;
    const cy = ay;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(ax, ay-30*scale, bx, by+40*scale, bx, by);
    ctx.bezierCurveTo(bx, by+40*scale, cx, cy-30*scale, cx, cy);
    ctx.fill();
    /* stem */
    ctx.beginPath();
    ctx.rect(sx+46*scale,sy+55*scale,8*scale,40*scale);
    ctx.fill();
}

function drawJoker(ctx, x, y, scale) {
    const sx = x - SUITE_WIDTH_PX*scale/2;
    const sy = y - SUITE_HEIGHT_PX*scale/2;
    /* base of triangles */
    const x_base = sx+15*scale;
    const y_base = sy+(90-10)*scale;
    const base_width = 75;
    const base_height = 10;

    /* base below triangles */
    ctx.fillStyle = 'black';
    ctx.beginPath();
    const y_base_below = y_base+2*scale;
    ctx.moveTo(x_base, y_base_below);
    ctx.lineTo(x_base + base_width*scale, y_base_below+scale);
    ctx.lineTo(x_base + (base_width-8)*scale, y_base_below+base_height*scale);
    ctx.lineTo(x_base + 8*scale, y_base_below+base_height*scale);
    ctx.fill();

    /* triangles */
    for (const [ax_off,bx_off,by_off,color] of [[0,-20,-55,'#ff0000'],[35,90,-60,'#00ff00'],[18,45,-70,'#0000ff']]) {
        const ax = x_base + ax_off*scale;
        const ay = y_base;
        const bx = x_base + bx_off*scale;
        const by = y_base + by_off*scale;
        const cx = ax + 40*scale;
        const cy = y_base;
        ctx.fillStyle = color;
        ctx.beginPath();

        ctx.moveTo(ax, ay);
        ctx.lineTo(bx,by);
        ctx.lineTo(cx,cy);
        ctx.fill();
        /* ball */
        ctx.fillStyle = '#ffbb00';
        ctx.beginPath();
        ctx.arc(bx, by, 7*scale, 0, 2*Math.PI);
        ctx.fill();
    }
}

function drawJokerCardText(ctx) {
        ctx.font = CARD_FONT_JOKER;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const jokerText = 'JOKER';
        const textWidth = ctx.measureText(jokerText).width;
        const dx = textWidth/jokerText.length;
        let x = (CARD_CANVAS_WIDTH - textWidth)/2 + 13;
        let y = CARD_CANVAS_HEIGHT*2/3 - 25;
        let i = 0;
        ctx.fillStyle = 'black';
        for (const ch of jokerText.split('')) {
            ctx.fillText(ch, x, y);
            x += dx;
            y += 22;
            i++;
            if (i & 1 > 0) {
                ctx.fillStyle = 'red';
            } else {
                ctx.fillStyle = 'black';
            }
        }
}

function drawNonJokerCardText(ctx, value, color) {
        ctx.fillStyle = color;
        ctx.font = CARD_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cardLetters(value), CARD_CANVAS_WIDTH/2, CARD_CANVAS_HEIGHT/3-20);
}

const SUITE_TO_DRAWFN = Object.freeze({
    [SUITES_IDX.SPADES]: drawSpade,
    [SUITES_IDX.HEARTS]: drawHeart,
    [SUITES_IDX.DIAMONDS]: drawDiamond,
    [SUITES_IDX.CLUBS]: drawClub,
});

const SUITE_TO_COLOR = Object.freeze({
    [SUITES_IDX.SPADES]: '#000000',
    [SUITES_IDX.HEARTS]: '#ff0000',
    [SUITES_IDX.DIAMONDS]: '#ff0000',
    [SUITES_IDX.CLUBS]: '#000000',
});

const CARD_FONT_SIZE_PX = 140;
const CARD_FONT = `${CARD_FONT_SIZE_PX}px bold Helvetica, Arial, sans-serif`;
const CARD_FONT_JOKER = `${55}px bold Helvetica, Arial, sans-serif`;

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
    if (value != 14) {
        SUITE_TO_DRAWFN[suite](ctx, CARD_CANVAS_WIDTH/2, CARD_CANVAS_HEIGHT*2/3, scale);
        const color = SUITE_TO_COLOR[suite];
        drawNonJokerCardText(ctx, value, color);
        //document.lastChild.appendChild(canvas);
    } else {
        drawJoker(ctx, CARD_CANVAS_WIDTH/2, CARD_CANVAS_HEIGHT/3 - 20, scale);
        drawJokerCardText(ctx);
        //document.lastChild.appendChild(canvas);
    }

    return canvas;
}

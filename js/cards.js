
const NUM_CARDS_PER_DECK = 54;
const NUM_JOKERS_PER_DECK = 2;
const SUITS = ["Spades", "Hearts", "Diamonds", "Clubs"];

const VALUE_TO_CARD_NAME={
    1: "Ace",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "Jack",
    12: "Queen",
    13: "King",
    14: "Joker",
};

const WILD_VALUES = [13,14];

function card(value, suite) {
    return {
        value,
        suite
    };
}

function cardIsWild({value}) {
    return WILD_VALUES.includes(value);
}

function cardString({value, suite}) {
    return value == 14 ? "Joker" : `${VALUE_TO_CARD_NAME[value]} of ${SUITS[suite]}`;
}

const DECK_NO_JOKERS = SUITS.flatMap((_,s) => 
                                            Object.keys(VALUE_TO_CARD_NAME).map(val => card(Number(val), s)))
                            .filter(({value}) => value != 14) // omit jokers

const DECK = DECK_NO_JOKERS
                .concat(Array.from(Array(NUM_JOKERS_PER_DECK), () => card(14,0)));
console.log(DECK);

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function shuffleArray(a) {
    let n = a.length;
    while (n > 0) {
        const p = getRandomInt(n);
        n--;
        /* swap */
        let tmp = a[n];
        a[n] = a[p];
        a[p] = tmp;
    }
    return a;
}

function makeDecks(n) {
    return Array.from(Array(n), () => DECK).flat();
}

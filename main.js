// ToDo
//  QOL:
//     + Add ReadMe
//  Features:
//      + More error messages and communication with user
//      + User Preference and customization
//          - Colors, # Boards, Sounds?, Sizes
//      + Sample games for easy use
//  Code:
//      + Add checking for invalid pgns and incorrect move support within advance/revert position
//  Other:
//      + create github website
//

const { Chess } = require('chess.js')

const chess = Chess(); // used to store the current state of the game
const game = Chess();  // used to store the history of the game input by the user

let prevMovesToDict = {}; // used to store the previous moves of the last position
let moveCounter = 0; // Current move of the game

let BACKGROUNDS = {
    "-1" : 'black',
    "1" : 'PowderBlue',
};

const config = {
    draggable: false,
    position: 'start',
    onChange: onChange,
};
// chessboards, board1 is the normal board, board2 will show color gradients
let board1 = Chessboard('board1', config);
let board2 = Chessboard('board2', 'start');

// used to count control of squares for our color gradients
// 0 means a square is not controlled and will default to its natural color
// positive value means the square is controlled by white, the value being the # of pieces controlling it
// negative value means the square is controlled by black, the value being the # of pieces controlling it
let controlArray;

// html elements
let pgnForm = document.querySelector('#pgnForm');
let pgnFormInput = document.querySelector('#pgnFormInput');
let forwardBtn = document.querySelector('#forward');
let backwardBtn = document.querySelector('#backward');
let startGameBtn = document.querySelector('#startOfGame');
let endGameBtn = document.querySelector('#endOfGame');

function highlightSquare(square, value) {
    if (value === null) {return;}

    if (value !== 0) {
        value = value < 0 ? -1 : 1;
    }

    let background = BACKGROUNDS[value.toString()];
    let $square = $('#board2 .square-' + square);

    if(value === 0) {
        $square.css('box-shadow', "");
    }
    else {
        $square.css('box-shadow', 'inset 0 0 2px 2px ' + background);
    }
}

function updateBoardColors() {
    for (let i = 0; i < controlArray.length; i++) {
        let arr = controlArray[i];
        for (let j = 0; j < arr.length; j++) {
            let rank = String.fromCharCode(97 + j);
            let file = 8 - i;
            let square = rank + file;
            highlightSquare(square, arr[j]);
        }
    }
}

function updateControlArray() {
    /**Returns an array of up to two squares which are the two squares controlled by this pawn*/
    function getPawnControl(controlArr, Index, colorInt) {
        let rank = Index[0];
        let file = Index[1];
        let diag1;
        let diag2;
        if (colorInt > 0) {
            diag1 = Array(rank - 1, file - 1);
            diag2 = Array(rank - 1, file + 1);
        } else {
            diag1 = Array(rank + 1, file - 1);
            diag2 = Array(rank + 1, file + 1);
        }
        // check bounds of calculated square, then increment in controlArr
        if ( 0 <= diag1[0] && diag1[0] <= 7 && 0 <= diag1[1]  && diag1[1] <= 7) {
            controlArr[diag1[0]][diag1[1]] += colorInt;
        }
        if ( 0 <= diag2[0] && diag2[0] <= 7 && 0 <= diag2[1]  && diag2[1] <= 7) {
            controlArr[diag2[0]][diag2[1]] += colorInt;
        }
        return controlArr;
    }

    function getRookControl(controlArr, Index, board, colorInt) {
        let rank = Index[0];
        let file = Index[1];

        // moving down along file
        let posI = rank+1;
        while (posI <= 7) {
            controlArr[posI][file] += colorInt;
            // found a piece that isnt a same color queen or rook, we stop moving along this direction
            // otherwise this is a xray control and we keep going
            if (board[posI][file] != null) {
                let piece = board[posI][file]['type'];
                let pieceInt = board[posI][file]['color'] === 'w' ? 1 : -1
                if ((piece !== 'q' && piece !== 'r') || pieceInt !== colorInt) {
                    break;
                }
            }
            posI += 1;
        }
        // moving up along file
        let negI = rank-1;
        while (negI >= 0) {
            controlArr[negI][file] += colorInt;
            if (board[negI][file] != null) {
                let piece = board[negI][file]['type'];
                let pieceInt = board[negI][file]['color'] === 'w' ? 1 : -1
                if ((piece !== 'q' && piece !== 'r') || pieceInt !== colorInt) {
                    break;
                }
            }
            negI -= 1;
        }
        // moving right along rank
        let posJ = file+1;
        while (posJ <= 7) {
            controlArr[rank][posJ] += colorInt;
            if (board[rank][posJ] != null) {
                let piece = board[rank][posJ]['type'];
                let pieceInt = board[rank][posJ]['color'] === 'w' ? 1 : -1
                if ((piece !== 'q' && piece !== 'r') || pieceInt !== colorInt) {
                    break;
                }
            }
            posJ += 1;
        }
        // moving left along rank
        let negJ = file-1;
        while (negJ >= 0) {
            controlArr[rank][negJ] += colorInt;
            if (board[rank][negJ] != null) {
                let piece = board[rank][negJ]['type'];
                let pieceInt = board[rank][negJ]['color'] === 'w' ? 1 : -1
                if ((piece !== 'q' && piece !== 'r') || pieceInt !== colorInt) {
                    break;
                }
            }
            negJ -= 1;
        }

        return controlArr;
    }

    function getKnightControl(controlArr, Index, board, colorInt) {
        let indices = [[-1, -2], [1, -2], [-1, 2], [1, 2], [-2, -1], [-2, 1], [2, -1], [2, 1]];
        let rank = Index[0];
        let file = Index[1];
        for (let i = 0; i < indices.length; i++) {
            let newRank = rank + indices[i][0];
            let newFile = file + indices[i][1];
            if ( 0 <= newRank && newRank <= 7 && 0 <= newFile  && newFile <= 7) {
                controlArr[newRank][newFile] += colorInt;
            }
        }
        return controlArr;
    }

    function getBishopControl(controlArr, Index, board, colorInt) {
        let rank = Index[0];
        let file = Index[1];

        // bottom right diagonal
        let tempI = rank+1;
        let tempJ = file+1;
        while (tempI <= 7 && tempJ <= 7) {
            controlArr[tempI][tempJ] += colorInt;
            if (board[tempI][tempJ] != null) {
                let piece = board[tempI][tempJ]['type'];
                let pieceInt = board[tempI][tempJ]['color'] === 'w' ? 1 : -1
                //console.log("Bottom right:", piece);
                if ( (piece !== 'q' && piece !== 'b') || pieceInt !== colorInt) {
                    break;
                }
            }
            tempI += 1;
            tempJ += 1;
        }
        // bottom left diagonal
        tempI = rank+1;
        tempJ = file-1;
        while (tempI <= 7 && tempJ >= 0) {
            controlArr[tempI][tempJ] += colorInt;
            if (board[tempI][tempJ] != null) {
                let piece = board[tempI][tempJ]['type'];
                let pieceInt = board[tempI][tempJ]['color'] === 'w' ? 1 : -1
                if ((piece !== 'q' && piece !== 'b') || pieceInt !== colorInt) {
                    break;
                }
            }
            tempI += 1;
            tempJ -= 1;
        }
        // top right diagonal
        tempI = rank-1;
        tempJ = file+1;
        while (tempI >= 0 && tempJ <= 7) {
            controlArr[tempI][tempJ] += colorInt;
            if (board[tempI][tempJ] != null) {
                let piece = board[tempI][tempJ]['type'];
                let pieceInt = board[tempI][tempJ]['color'] === 'w' ? 1 : -1
                if ((piece !== 'q' && piece !== 'b') || pieceInt !== colorInt) {
                    break;
                }
            }
            tempI -= 1;
            tempJ += 1;
        }
        // top left diagonal
        tempI = rank-1;
        tempJ = file-1;
        while (tempI >= 0 && tempJ >= 0) {
            controlArr[tempI][tempJ] += colorInt;
            if (board[tempI][tempJ] != null) {
                let piece = board[tempI][tempJ]['type'];
                let pieceInt = board[tempI][tempJ]['color'] === 'w' ? 1 : -1
                if ((piece !== 'q' && piece !== 'b') || pieceInt !== colorInt) {
                    break;
                }
            }
            tempI -= 1;
            tempJ -= 1;
        }

        return controlArr;
    }

    function getQueenControl(controlArr, Index, board, colorInt) {
        controlArr = getRookControl(controlArr, Index, board, colorInt);
        controlArr = getBishopControl(controlArr, Index, board, colorInt);
        return controlArr;
    }

    function getKingControl(controlArr, Index, board, colorInt) {
        let rank = Index[0];
        let file = Index[1];
        let newRank;
        let newFile;
        let moves = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
        for (let i = 0; i < moves.length; i++) {
            newRank = rank + moves[i][0];
            newFile = file + moves[i][1];
            if ( 0 <= newRank && newRank <= 7 && 0 <= newFile  && newFile <= 7) {
                controlArr[newRank][newFile] += colorInt;
            }
        }
        return controlArr;
    }

    console.log('Updating Control Array \n ~~~~~~~~~~~~~~~~');
    let board = chess.board();
    controlArray = Array(8);
    for (let i = 0; i < controlArray.length; i++) {
        controlArray[i] = Array(8).fill(0);
    }

    // iterate over the every spot on the board
    // if that spot contains a piece increment that spots control by the corresponding color integer
    // then call control function for that piece on the square
    for (let i = 0; i < board.length; i++) {
        let arr = board[i];
        for (let j = 0; j < arr.length; j++) {
            if (arr[j] === null) {continue;}
            let squareIdx = Array(i, j);
            let piece = arr[j]['type'];
            let colorSign = arr[j]['color'] === 'w' ? 1 : -1;

            controlArray[i][j] += colorSign;

            // if we implement OO piece classes we can reduce this to one line of code
            // and refactor out the function from above into their appropriate classes
            switch(piece) {
                case 'p':
                    controlArray = getPawnControl(controlArray, squareIdx, colorSign);
                    break;
                case 'r':
                    controlArray = getRookControl(controlArray, squareIdx, board, colorSign);
                    break;
                case 'n':
                    controlArray = getKnightControl(controlArray, squareIdx, board, colorSign);
                    break;
                case 'b':
                    controlArray = getBishopControl(controlArray, squareIdx, board, colorSign);
                    break;
                case 'q':
                    controlArray = getQueenControl(controlArray, squareIdx, board, colorSign);
                    break;
                case 'k':
                    controlArray = getKingControl(controlArray, squareIdx, board, colorSign);
                    break;
                default:
                    console.log("This shouldn't happen");
            }

        }
    }
    console.log(controlArray);
}

function onSubmitUpdateGame(e) {
    e.preventDefault();
    console.log(pgnFormInput.value);
    let loading = game.load_pgn(pgnFormInput.value);
    console.log("Attempt to load PGN: ", loading);
    if (loading) {
        updateControlArray();
        updateBoardColors();
    }
}

function onChange (oldPos, newPos) {
    updateControlArray();
    updateBoardColors();
}
/**
 *  Advances the game to the next position in the loaded PGN
 *  returns False if the game is over, True otherwise
 * */
function advancePosition() {

    //TODO
    // add messages to User about game not loaded
    if (chess.game_over()) {return false;}

    if (game.history().length === 0) {
        console.log("INPUT A PGN!!!");
        alert('Put in a PGN');
        return false;
    }

    let nextMove = game.history({verbose: true})[moveCounter];
    let move_bool = chess.move(nextMove);

    board1.position(chess.fen());
    board2.position(chess.fen());
    moveCounter += 1;

    return true;
}
/**
 *  Reverts the game to the previous position in the loaded PGN
 *  returns False if the game is over, True otherwise
 * */
function revertPosition() {
    let move_bool = chess.undo();
    if (move_bool == null) {
        console.log("Undo returned null");
        return false;
    }

    if (moveCounter > 0) {
        moveCounter -= 1;
    }
    board1.position(chess.fen());
    board2.position(chess.fen());

    return true;
}
/**
 *  Sends the game to the first position in the loaded PGN
 * */
function goToStart() {
    while (revertPosition()) {}
}
/**
 *  Sends the game to the last position in the loaded PGN
 * */
function goToEnd() {
    while (advancePosition()) {}
}

forwardBtn.onclick = advancePosition;
backwardBtn.onclick = revertPosition;
startGameBtn.onclick = goToStart;
endGameBtn.onclick = goToEnd;
pgnForm.onsubmit = onSubmitUpdateGame;

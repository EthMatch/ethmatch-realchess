$(document).ready(function () {
    const addLog = (data, type = 0) => {
        switch (type) {
            case 0:
                $("#game-logs").prepend(`<p>${new Date().toISOString()}: ${data}</p>`);
                break;
            case 1:
                $("#game-logs").prepend(`<p style="color:#27AE60;">${new Date().toISOString()}: ${data}</p>`);
                break;
            case 2:
                $("#game-logs").prepend(`<p style="color:#E74C3C;">${new Date().toISOString()}: ${data}</p>`);
        }
    };
    const addSessionDetails = (player, lobbyId, signature) => {
        $("#session").html(`<p>PLAYER:${player}<br>LOBBY:${lobbyId}</p>`);
    };
    const updateFen = (fen) => {
        $("#fen").html(`<p style="color:#27AE60;">FEN: ${fen}</p>`);
    };
    var socket, serverGame;
    var playerColor;
    var game, board;
    socket = io();
    try {
        joinData = {
            player: window.location.pathname.split("/")[2],
            lobbyId: window.location.pathname.split("/")[3],
            signature: window.location.pathname.split("/")[4]
        };
        socket.emit("REGISTER_SESSION", joinData.player);
        addSessionDetails(joinData.player, joinData.lobbyId, joinData.signature);
        socket.on("REGISTERED", () => {
            addLog("registered session on server", 1);
            socket.emit("JOIN_SESSION", joinData);
        });
    } catch (error) {
        alert("failed to parse joinData");
    }
    socket.on("GAME_READY", () => {
        addLog("game ready, waiting for opponent to join", 1);
    });
    socket.on("LOBBY_READY", function (msg) {
        console.log("joined as game id: " + msg.game.id);
        addLog(`joined game ${msg.game.id}`, 1);
        playerColor = msg.color;
        initGame(msg.game);
        $("#page-game").show();
    });
    socket.on("GAME_END", (msg) => {
        addLog(`${msg.message}`, 2);
        $("#page-game").hide();
    });
    socket.on("ERROR", (msg) => {
        addLog(`${msg}`, 2);
        $("#page-game").hide();
    });
    socket.on("MOVE", function (msg) {
        if (serverGame && msg.gameId === serverGame.id) {
            game.move(msg.move);
            board.position(game.fen());
            updateFen(game.fen());
        }
    });
    var initGame = function (serverGameState) {
        serverGame = serverGameState;

        var cfg = {
            draggable: true,
            showNotation: false,
            orientation: playerColor,
            position: serverGame.board ? serverGame.board : "start",
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd
        };

        game = serverGame.board ? new Chess(serverGame.board) : new Chess();
        board = new ChessBoard("game-board", cfg);
    };
    var onDragStart = function (source, piece, position, orientation) {
        if (game.game_over() === true || (game.turn() === "w" && piece.search(/^b/) !== -1) || (game.turn() === "b" && piece.search(/^w/) !== -1) || game.turn() !== playerColor[0]) {
            return false;
        }
    };

    var onDrop = function (source, target) {
        var move = game.move({
            from: source,
            to: target,
            promotion: "q"
        });

        if (move === null) {
            return "snapback";
        } else {
            socket.emit("MOVE", { move: move, gameId: serverGame.id, board: game.fen() });
            updateFen(game.fen());
        }
    };

    var onSnapEnd = function () {
        board.position(game.fen());
    };
});

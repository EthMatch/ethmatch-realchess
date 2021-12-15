var express = require("express");
const { initializeEthMatchProxy, newGameSession, addLogToSession, addPlayer, getSessionPlayers, endGame } = require("./ethmatch");
var app = express();
const { Chess } = require("chess.js");
app.use(express.static("public"));
app.use(express.static("dashboard"));
var http = require("http").Server(app);
var io = require("socket.io")(http);
var port = process.env.PORT || 3005;
require("dotenv").config();
var lobbyUsers = {};
var users = {};
var activeGames = {};
initializeEthMatchProxy({ host: process.env.PROXY ? process.env.PROXY : "http://localhost:3004" });
app.use("/public", express.static("public"));
app.get("/ethgame/:address/:lobby/:signature", (req, res) => {
    newGameSession({
        lobbyId: req.params.lobby,
        player: req.params.address,
        signature: req.params.signature
    })
        .then((metadata) => {
            console.log(metadata);
            if (metadata.valid) {
                res.sendFile(__dirname + "/public/index.html");
            } else {
                res.status(500).end("Invalid request");
            }
        })
        .catch((err) => {
            res.status(500).end("Invalid request");
        });
});
app.get("/dashboard/", function (req, res) {
    res.sendFile(__dirname + "/dashboard/dashboard.html");
});

io.on("connection", function (socket) {
    console.log("new connection ", socket.id);
    socket.on("JOIN_SESSION", function (data) {
        console.log(data);
        if (data.lobbyId && data.player && data.signature) {
            setTimeout(() => {
                if (!activeGames[data.lobbyId]) {
                    addPlayer({
                        lobbyId: data.lobbyId,
                        signature: data.signature,
                        player: data.player,
                        side: "white",
                        socket
                    })
                        .then((joinReq) => {
                            console.log(joinReq);
                            if (joinReq.valid) {
                                let opponentId = null;
                                console.log(getSessionPlayers({ lobbyId: data.lobbyId }));
                                for (let i of getSessionPlayers({ lobbyId: data.lobbyId })) {
                                    if (i != data.player) {
                                        opponentId = i;
                                        break;
                                    }
                                }
                                var game = {
                                    id: data.lobbyId,
                                    board: null,
                                    locked: false,
                                    users: { white: data.player, black: opponentId }
                                };
                                socket.gameId = game.id;
                                activeGames[game.id] = game;
                                lobbyUsers[data.player].emit("GAME_READY", { id: game.id });
                            } else {
                                lobbyUsers[data.player].emit("ERROR", "invalid request");
                            }
                        })
                        .catch((err) => {
                            // console.log(err);
                        });
                } else {
                    if (!activeGames[data.lobbyId].locked) {
                        addPlayer({
                            lobbyId: data.lobbyId,
                            signature: data.signature,
                            player: data.player,
                            side: "black",
                            socket
                        }).then((joinReq) => {
                            if (joinReq.valid) {
                                activeGames[data.lobbyId].locked = true;
                                console.log(activeGames[data.lobbyId]);
                                lobbyUsers[activeGames[data.lobbyId].users.white].emit("LOBBY_READY", { game: activeGames[data.lobbyId], color: "white" });
                                lobbyUsers[data.player].emit("LOBBY_READY", { game: activeGames[data.lobbyId], color: "black" });
                            }
                        });
                    } else {
                        lobbyUsers[data.player].emit("ERROR", "ERR ! Lobby is locked cannot rejoin");
                    }
                }
            }, Math.floor(Math.random() * (5000 - 2000 + 1) + 2000));
        }
    });
    socket.on("REGISTER_SESSION", (player) => {
        users[player] = {
            address: player
        };
        lobbyUsers[player] = socket;
        socket.emit("REGISTERED", player);
    });
    socket.on("MOVE", function (msg) {
        try {
            console.log("event", msg);
            socket.broadcast.emit("MOVE", msg);
            activeGames[msg.gameId].board = msg.board;
            addLogToSession({
                lobbyId: msg.gameId,
                data: msg
            });

            let currentBoard = new Chess(msg.board);
            if (currentBoard.in_checkmate()) {
                if (currentBoard.turn() == "w") {
                    endGame({
                        lobbyId: msg.gameId,
                        winner: activeGames[msg.gameId].users.black,
                        finalState: currentBoard.fen()
                    });

                    lobbyUsers[activeGames[msg.gameId].users.black].emit("GAME_END", { message: "You won the game! claim your winnings now" });
                    lobbyUsers[activeGames[msg.gameId].users.while].emit("GAME_END", { message: "You lost the game! better luck next time" });
                } else {
                    endGame({
                        lobbyId: msg.gameId,
                        winner: activeGames[msg.gameId].users.white,
                        finalState: currentBoard.fen()
                    });
                    lobbyUsers[activeGames[msg.gameId].users.white].emit("GAME_END", { message: "You won the game! claim your winnings now" });
                    lobbyUsers[activeGames[msg.gameId].users.black].emit("GAME_END", { message: "You lost the game! better luck next time" });
                }
            } else if (currentBoard.in_stalemate() || currentBoard.in_draw() || currentBoard.insufficient_material()) {
                endGame({
                    lobbyId: msg.gameId,
                    winner: null,
                    finalState: currentBoard.fen()
                });
                lobbyUsers[activeGames[msg.gameId].users.white].emit("GAME_END", { message: "The game resulted in a draw, redeem your pool after the timeout" });
                lobbyUsers[activeGames[msg.gameId].users.black].emit("GAME_END", { message: "The game resulted in a draw, redeem your pool after the timeout" });
            }
        } catch (err) {}
    });
});

http.listen(port, function () {
    console.log("listening on *: " + port);
});

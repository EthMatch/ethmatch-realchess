const { default: Axios } = require("axios");
let apiProvider = Axios.create();
let sessions = {};
const initializeEthMatchProxy = ({ host = "http://localhost:3333" }) => {
    apiProvider = Axios.create({
        baseURL: `${host}/session`
    });
};
const newGameSession = ({ lobbyId = null }) => {
    return new Promise((resolve, reject) => {
        apiProvider
            .get(`/${lobbyId}`)
            .then((resp) => {
                resp = resp.data;
                console.log(resp);
                if (resp.statusCode === 200) {
                    sessions[lobbyId] = resp.data;
                    sessions[lobbyId].gameData = [];
                    resolve({
                        valid: true,
                        data: resp
                    });
                }
            })
            .catch((err) => {
                console.log(err);
                reject({
                    valid: false
                });
            });
    });
};
const getSessionPlayers = ({ lobbyId = null }) => {
    return sessions[lobbyId].allowed_players;
};
const addPlayer = ({ lobbyId = null, signature = null, player = null, side = "white", socket = null }) => {
    return new Promise((resolve, reject) => {
        apiProvider
            .post("/add_player", {
                player,
                key: signature,
                id: lobbyId
            })
            .then((response) => {
                response = response.data;
                if (response.statusCode === 200) {
                    sessions[lobbyId].players[side] = socket;
                    resolve({
                        valid: true
                    });
                } else {
                    resolve({
                        valid: false
                    });
                }
            })
            .catch((err) => {
                resolve({
                    valid: true
                });
            });
    });
};

const addLogToSession = ({ lobbyId = null, data = null }) => {
    if (data && sessions[lobbyId]) {
        sessions[lobbyId].gameData.push(data);
    }
};

const endGame = ({ lobbyId = null, winner = null }) => {
    console.log(winner, sessions[lobbyId]);
    return new Promise((resolve, reject) => {

    })
};

module.exports = {
    initializeEthMatchProxy,
    newGameSession,
    addLogToSession,
    endGame,
    addPlayer,
    getSessionPlayers
};

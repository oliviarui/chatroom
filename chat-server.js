const express = require("express");
const app = express();

// Require the packages we will use:
const http = require("http"),
    fs = require("fs");

// store data
let rooms = {};
let users = {};
// keep track of room id
let roomID = 0;
// create main lobby
rooms[roomID] = {
    name : "Main Lobby",
    owner : [],
    private: false,
    password: "",
    users : [],
    banned: []
}

const port = 3456;
// use express to create a server
const server = http.createServer(app);
server.listen(port);

// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
    wsEngine: 'ws'
});

app.use(express.static(__dirname));

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/client.html");
});

io.sockets.on("connection", function (socket) {
    // This callback runs when a new Socket.IO connection is established.

    // put new user into a map that associates username with socket.id
    socket.on('user_created', function(data) {
        users[data["user"]] = socket.id;
    })
    
    // receive & send out public message
    socket.on('message_to_server', function (data) {
        const roomID = data["room"];
        // This callback runs when the server receives a new message from the client.
        console.log("message: " + data["message"] + ', room: ' + rooms[roomID].name + ', importance: ' + data["importance"]);
        io.to(rooms[roomID].name).emit("message_to_client", { message: data["message"], sender:data["user"], roomID:data["room"], importance:data["importance"], isPrivate:false}) // broadcast the message to other users
    });
    // receive & send out private message
    socket.on('private_message_to_server', function(data) {
        // get usernames & room
        const sender = data["sender"];
        const receiver = data["receiver"];
        const room = rooms[data["room"]]; //gets actual room object
        // check if the receiver is in the same room as the sender / if the receiver exists
        let sameRoom = false;
        room.users.forEach(function(user) {
            if(user == receiver) {
                sameRoom = true;
            }
        })
        // send private message if the two users are in the same room
        if(sameRoom) {
            // two users are in the same room
            console.log("private message from " + sender + " to " + receiver + ": " + data["message"] + ", importance: " + data["importance"]);
            // emit message to sender and receiver
            io.to(users[sender]).to(users[receiver]).emit("message_to_client", {message:data["message"], sender:sender, receiver:receiver, importance:data["importance"], isPrivate:true});
        } else {
            // users are not in the same room or receiving user does not exist
            io.to(users[sender]).emit("info_from_server", {status:"user-not-exist", user:receiver});
        }
    });

    // create a room
    socket.on('create_room', function(data) {
        // get data
        let roomName = data["room"];
        const isPrivate = data["private"];
        let inputPass = ""
        if(isPrivate) {
            // user wants to create a private room, generate a password
            inputPass = Math.random().toString(16).substring(2, 8);
        }
        // increment room id
        roomID++;
        // check for empty room name
        if(data["room"] == "") {
            // user did not enter a room name
            roomName = "room" + count;
        }
        // put room into dictionary
        rooms[roomID] = {
            name : roomName,
            private: isPrivate,
            password: inputPass,
            owner : [socket.id],
            users : [],
            banned : []
        }
        console.log("new room created:");
        console.log(rooms[roomID])
        io.to(socket.id).emit('created_room', {id:roomID, password:rooms[roomID].password, private:isPrivate, debug:rooms});
    });

    // join a room that has been created using the room ID
    socket.on('join_room', function(data) {
        const username = data["user"] 
        // take user off of current room's list of users if the user is currently in a room
        if(data["currentRoom"] != undefined) {
            // log that the user is leaving their current room
            console.log(username + " leaving room " + data["currentRoom"]);
            const currentRoom = rooms[data["currentRoom"]]; // get room object
            // leave previous room
            socket.leave(currentRoom.name);
            // update the previous room's list of users
            let newUsersList = [];
            currentRoom.users.forEach(function(user) {
                if(user != username) {
                    newUsersList.push(user);
                }
            })
            currentRoom.users = newUsersList;
            // emit to everyone in the old room to update their list of users
            io.to(currentRoom.name).emit('update_users', {id:data["currentRoom"], users:currentRoom.users});
        }
        
        // retrieve data of room to be joined
        const newRoomID = data["newRoom"]
        const room = rooms[newRoomID]; // get actual room object
        if(room == undefined) {
            // room name does not exist
            io.to(users[username]).emit('info_from_server', {status:"room-not-exist", room:newRoomID});
        } else {
            // room does exist
            if(room.private) {
                // ask client to send back a password if the room is private
                io.to(socket.id).emit('request_password');
                socket.on('send_password', function(data) {
                    console.log("server received password " + data["inputPass"]);
                    if(data["inputPass"] == room.password) {
                        // password is correct
                        joinRoom(newRoomID, room, username);
                    } else {
                        // password is incorrect
                        io.to(users[username]).emit('info_from_server', {status:"password-incorrect", room:newRoomID});
                    }
                });
            } else {
                // room is public, join the room
                joinRoom(newRoomID, room, username);
            }
        }
    })
    function joinRoom(newRoomID, room, username) {
        // check if the user is on the banned list
        const banned = room.banned;
        let isBanned = false;
        banned.forEach(function(user) {
            if(user == username) {
                isBanned = true;
            }
        })
        if(!isBanned) {
            // user is not banned from the room
            // join room on server side
            socket.join(room.name);
            // DEBUG
            console.log(username + " joined room " + newRoomID);
            // update users list
            let roomUsers = room.users;
            roomUsers.push(username);

            // check if the current user is the owner
            let isOwner = false;
            // get list of owners
            const owners = room.owner;
            // loop through list of owners to see if the user is an owner
            owners.forEach(function(owner) {
                if(users[username] == owner) {
                    isOwner = true;
                }
            })
            // send back room name and other room info to the user who joined
            io.to(socket.id).emit('joined_room', {id:newRoomID, name:room.name, isPrivate:room.private, password:room.password, owner:isOwner});
            // tell everyone in the room to update the users list
            io.to(room.name).emit('update_users', {users:roomUsers});
            // send a announcement message that a new user has joined
            io.to(room.name).emit('room_announcement', {status:"join", newUser:username});
        } else {
            // user is banned from the room, send back a message telling them they cannot join
            io.to(socket.id).emit('info_from_server', {status:"banned-from-room", room:newRoomID});
            io.to(socket.id).emit('force_leave');
        }
    }

    // kick a user out from the room
    socket.on('kick_user', function(data) {
        const roomID = data["room"];
        const room = rooms[roomID];
        const kickedUser = data["user"];
        //get list of users from the current room
        let roomUsers = room.users;
        //check that the user being kicked is in this room
        let inRoom = false;
        roomUsers.forEach(function(user) {
            if(kickedUser == user) {
                inRoom = true;
            }
        })
        if(inRoom) {
            // user is in this room
            const kickedUserID = users[kickedUser];
            // send a force kick message to the user being kicked
            console.log(kickedUser + " is getting kicked out of room " + roomID);
            io.to(kickedUserID).emit('force_leave');
            // send room announcement that the user has been kicked
            io.to(room.name).emit('room_announcement', {status:"kick", kickedUser:kickedUser});
            // display a message on the client side letting the user know they have been kicked
            io.to(kickedUserID).emit('info_from_server', {status:"kicked"});
        } else {
            // user being kicked is not in this room, send message back to person doing the kicking
            io.to(socket.id).emit("info_from_server", {status:"user-not-exist", user:kickedUser});
        }
        
    })
    
    // ban a user from the room by adding them to a list of banned users
    socket.on('update_ban_list', function(data) {
        const roomID = data["room"];
        const room = rooms[roomID];
        const bannedUser = data["user"]
        const bannedUserID = users[bannedUser];

        //get list of users from the current room
        let roomUsers = room.users;
        //check that the user being kicked is in this room
        let inRoom = false;
        roomUsers.forEach(function(user) {
            if(bannedUser == user) {
                inRoom = true;
            }
        })

        if(inRoom) {
            // user is in the current room
            // get list of banned users and add the banned user to the list
            let banned = room.banned;
            banned.push(bannedUser);
            // log to the console that the user has been banned
            console.log(bannedUser + " has been banned from room " + roomID);
            console.log(banned);
            // send message to everyone in the room that the user has been kicked
            io.to(room.name).emit('room_announcement', {status:"ban", bannedUser:bannedUser});
            // show the banned user that they have been banned
            io.to(bannedUserID).emit('info_from_server', {status:"banned"});
        } else {
            // user is not in the current room, cannot ban them
            io.to(socket.id).emit("info_from_server", {status:"user-not-exist", user:bannedUser});
        }
    })

    // add an admin
    socket.on('add_room_owner', function(data) {
        // get room
        const roomID = data["room"];
        const room = rooms[roomID];
        const exists = userExists(data["newOwner"]);
        if(exists) {
            // new owner exists
            // get new Owner's socket id
            const newOwner = users[data["newOwner"]];
            console.log('adding new room owner ' + data["newOwner"] + ' to room ' + roomID);
            // add new owner to owners list
            let owners = room.owner;
            owners.push(newOwner);
            console.log('added new owner ' + data["newOwner"]);
            console.log(owners);
            // emit to the new owner to render the owner box on their page
            io.to(newOwner).emit('became_owner');
            // send message to everyone that a new owner was added
            io.to(room.name).emit('room_announcement', {status:"owner", newOwner:data["newOwner"]});
        }
        // if owner does not exist the userExists function would have already sent a message back to the client
    })

    function userExists(inputUser) {
        // check if the given user exists
        let exists = false;
        for(let user in users) {
            if(user == inputUser) {
                exists = true;
            }
        }
        if(!exists) {
            // user does not exist, send message back to client
            io.to(socket.id).emit("info_from_server", {status:"user-not-exist", user:inputUser});
        }
        // send exists value back to the function that called this function
        return exists;
    }
});


var socketio = io.connect();

// get buttons
const set = document.getElementById('set-username');
const create = document.getElementById('create-room-button');
const privateButton = document.getElementById("private");
const join = document.getElementById('join-room-button');
const send = document.getElementById('send-button');
const pass = document.getElementById('password-button');
const sendPriv = document.getElementById('send-private-button');
const kick = document.getElementById('kick-button');
const ban = document.getElementById('ban-button');
const add = document.getElementById('add-owner-button');
// get boxes
const userBox = document.getElementById('username-box');
const chatroom = document.getElementById('chatroom');
const createBox = document.getElementById('create-room-box');
const joinBox = document.getElementById('join-room-box');
const passwordBox = document.getElementById('password-box');
const ownerBox = document.getElementById('room-owner-box');
// set event listeners
set.addEventListener('click', setInitial);
send.addEventListener('click', sendMessage);
sendPriv.addEventListener('click', sendPrivateMessage);
create.addEventListener('click', createRoom);
join.addEventListener('click', joinRoom);
pass.addEventListener('click', sendPassword);
kick.addEventListener('click', kickUser);
ban.addEventListener('click', banUser);
add.addEventListener('click', addOwner);

let username;
let roomID = 0; //default to main lobby

// prompt user for a username
function setInitial() {
    // display everything
    createBox.style.display = 'inline-block';
    joinBox.style.display = 'inline-block';
    document.getElementById('chatroom-info').style.display = 'block';
    chatroom.style.display = 'flex';
    userBox.style.display = 'none';
    // auto-check the "default" option for messgae importance
    document.getElementById('import-default').checked = true;
    // set username
    username = document.getElementById("username").value;
    // clear input from input element
    document.getElementById("username").value = "";
    //display nickname
    document.getElementById("current-user").innerHTML = 'Your nickname: ' + username;
    document.getElementById("current-user").style.display = "block";
    // send username to server
    socketio.emit("user_created", {user:username});
    // join main lobby
    socketio.emit("join_room", {user:username, newRoom:0});
}

//display informational messages from server to user when user enters invalid input
socketio.on('info_from_server', function(data) {
    // get the type of message that we are supposed to display
    let status = data["status"];
    const info = document.getElementById('info');
    if(status == "kicked") {
        // display a message to the user telling them they have been kicked
        info.innerHTML = "You have been kicked out of room " + roomID;
    }
    if(status == "banned") {
        // display a message to the user telling them they have been banned
        info.innerHTML += ". You have been banned from room " + roomID;
    } else if(status == "room-not-exist") {
        info.innerHTML = "There is no room with ID " + data["room"];
    } else if(status == "password-incorrect") {
        info.innerHTML = "The password you entered for " + data["room"] + " is incorrect";
    } else if(status == "banned-from-room") {
        info.innerHTML = "You have been banned from room " + data["room"];
    } else if(status == "user-not-exist") {
        info.innerHTML = "The user " + data["user"] + " does not exist";
    }
    document.getElementById('info-box').style.display = "block";
})

// display room announcement received from server
socketio.on("room_announcement", function(data) {
    const type = data["status"];
    // create announcement message
    let msg = "📢ROOM ANNOUNCEMENT: "
    if(type == "join") {
        msg += data["newUser"] + " has joined the room!"
    } else if(type == "owner") {
        msg += data["newOwner"] + " is now an owner of this room!"
    } else if(type == "kick") {
        msg += data["kickedUser"] + " has been kicked out."
    } else if (type == "ban") {
        msg += data["bannedUser"] + " has been banned."
    }
    msg += "📢";
    
    // display message on the webpage
    let message = document.createElement('p');
    let content = document.createTextNode(msg);
    message.appendChild(content);
    message.className = 'message';
    // always render room announcement with high importance
    message.className = 'high-importance';
    // add message node to html
    document.getElementById("chatlog").appendChild(message);
})

// send a message to the server
function sendMessage(){
    // get contents of the message
    var msg = document.getElementById("message_input").value;
    // clear input box
    document.getElementById("message_input").value = "";
    // get importance of message
    let importance = "default";
    if(document.getElementById('import-med').checked) {
        importance = "med";
    } else if(document.getElementById('import-high').checked) {
        importance = "high";
    }
    socketio.emit("message_to_server", {message:msg, user:username, room:roomID, importance:importance});
}
//send private message to the server
function sendPrivateMessage() {
    // get input
    let msg = document.getElementById("private-message-input").value;
    let usr = document.getElementById("private-message-receiver").value;
    // clear input boxes
    document.getElementById("private-message-input").value = "";
    document.getElementById("private-message-receiver").value = "";
    // get importance of message
    let importance = "default";
    if(document.getElementById('import-med').checked) {
        importance = "med";
    } else if(document.getElementById('import-high').checked) {
        importance = "high";
    }
    // include the username of the person to receive this message
    socketio.emit("private_message_to_server", {message:msg, sender:username, receiver:usr, room:roomID, importance:importance});
}
// display message received from server
socketio.on("message_to_client",function(data) {
    let message = document.createElement('p');
    let content = data['message']
    message.className = 'message';
    // render messages with different importance differently
    if(data["importance"] == "med") {
        message.className = 'med-importance';
        console.log(message.className);
    } else if(data["importance"] == "high") {
        message.className = 'high-importance';
    }
    // render private messages differently
    if(data["isPrivate"]) {
        // message.className = 'private';
        content = "private message from " + data['sender'] + " to " + data['receiver'] + ": " + content;
    } else {
        content = data['sender'] + ": " + content;
    }
    // put contents of message into a text node
    let contentNode = document.createTextNode(content);
    // add text node to p element
    message.appendChild(contentNode);
    // add message node to html
    document.getElementById("chatlog").appendChild(message);
});


// create a new room
function createRoom() {
    const roomName = document.getElementById("create-room-name").value;
    const private = privateButton.checked;
    // clear input
    document.getElementById("create-room-name").value = "";
    privateButton.checked = false;
    // send info to server
    socketio.emit("create_room", {room:roomName, private:private});
}
// socket listens for successful creation of a room
socketio.on("created_room", function(data) {
    let successMsg = 'Successfully created room. The ID to join this room is ' + data["id"];
    if(data["private"]) {
        // give the user the password if the room is private
        successMsg += ", the password to join this room is " + data["password"];
    }
    document.getElementById('info').innerHTML = successMsg;
    document.getElementById('info-box').style.display = "block";
    console.log("a new room was just created. these are the current rooms:");
    console.log(data["debug"]);
});

// send data to server to join a room
function joinRoom() {
    let inputRoomID = document.getElementById("join-room-id").value;
    // send input room ID to server
    socketio.emit("join_room", {user:username, currentRoom:roomID, newRoom:inputRoomID});
}
socketio.on('request_password', function() {
    passwordBox.style.display = 'block';
})
function sendPassword() {
    let password = document.getElementById('join-room-password').value;
    // clear input value
    document.getElementById('join-room-password').value = "";
    // hide password box
    passwordBox.style.display = "none";
    socketio.emit('send_password', {inputPass:password});
}
// user joined a room, update web page accordingly
socketio.on('joined_room', function(data) {
    // update roomID
    roomID = data["id"];
    // update room name displayed to user
    document.getElementById("room-name").innerHTML = data["name"];
    // display room ID to user
    document.getElementById('room-id').innerHTML = "Room ID: " + roomID;
    // clear input html
    document.getElementById("join-room-id").value = "";
    //display room password to user if the room is private, hide the password box otherwise
    document.getElementById('room-password').style.display = 'none';
    if(data["isPrivate"]) {
        document.getElementById('room-password').innerHTML = "Room Password: " + data["password"];
        document.getElementById('room-password').style.display = 'block';
    }
    // give user the ability to kick and ban others if they are the owner
    if(data["owner"]) {
        ownerBox.style.display = 'block';
    } else {
        // user is not owner of the room, do not display the owner box
        ownerBox.style.display = 'none';
    }
    // clear chat log
    const chatlog = document.getElementById('chatlog');
    while(chatlog.firstChild) {
        chatlog.removeChild(chatlog.firstChild);
    }
});

// update list of users in the room when someone leaves
socketio.on('update_users', function(data) {
    // DEBUG
    console.log("users in room " + roomID + ":");
    console.log(data["users"]);
    // update list of users displayed on the webpage
    renderUserList(data["users"]);
})
// render the list of users in a list (called by joined_room and update_users)
function renderUserList(users) {
    // display each of the users in the room
    const userList = document.getElementById("user-list");
    // empty the current list of users
    while (userList.firstChild) {
        userList.removeChild(userList.firstChild);
    }
    users.forEach(function(user) {
        // create new list element for each user
        let li = document.createElement('li');
        li.innerHTML = user;
        // update the users list
        userList.appendChild(li);
    })
}

// kick a user out of a room
function kickUser() {
    const user = document.getElementById('kick-user').value;
    // clear input box value
    document.getElementById('kick-user').value = "";
    kickRequest(user);
}
// ban a user from a room
function banUser() {
    const user = document.getElementById('ban-user').value;
    // clear input box value
    document.getElementById('ban-user').value = "";
    // add user to list of banned users
    socketio.emit('update_ban_list', {user:user, room:roomID});
    // kick user from room
    kickRequest(user);
}
// emit message to server to kick a user from the room
function kickRequest (user) {
    socketio.emit('kick_user', {user:user, room:roomID});
}
// you have been kicked out of / banned from a room
socketio.on('force_leave', function() {    
    // make user join the main lobby
    socketio.emit("join_room", {user:username, currentRoom:roomID, newRoom:0});
})


// add another room owner
function addOwner() {
    const newOwner = document.getElementById('add-owner').value;
    // clear input box value
    document.getElementById('add-owner').value = "";
    socketio.emit('add_room_owner', {room:roomID, newOwner:newOwner});
}
socketio.on('became_owner', function() {
    ownerBox.style.display = 'block';
})
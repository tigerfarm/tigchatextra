// -----------------------------------------------------------------------------
// Documentation:      https://www.twilio.com/docs/chat/initializing-sdk-clients
// Documentation:      https://www.twilio.com/docs/chat/rest/user-channels#properties
//                     https://www.twilio.com/docs/chat/consumption-horizon
// Documentation:      https://www.twilio.com/docs/chat/rest/channels
// Server side delete: https://www.twilio.com/docs/chat/rest/channels
// Message properties: https://www.twilio.com/docs/chat/rest/messages

// Members:            https://www.twilio.com/docs/chat/rest/member-resource
// Membersproperties:  https://www.twilio.com/docs/chat/rest/member-resource#member-properties
// 
// Users:              https://www.twilio.com/docs/chat/rest/user-resource
// User properties:    https://www.twilio.com/docs/chat/rest/user-resource#user-properties
// User property, attributes: The JSON string that stores application-specific data.
// 
// -----------------------------------------------------------------------------
let thisChatClient = "";
let thisChannel;
let thisToken;
let totalMessages = 0; // This count of read channel messages needs work to initialize and maintain the count.

userIdentity = "";
chatChannelName = "";
chatChannelDescription = "";
// const Twilio = require('twilio');
// const Chat = require('twilio-chat');

// -----------------------------------------------------------------------------
function createChatClientObject() {
    userIdentity = $("#username").val();
    if (userIdentity === "") {
        logger("Required: Username.");
        addChatMessage("Enter a Username to use when chatting.");
        return;
    }
    addChatMessage("++ Creating Chat Client, please wait.");
    // Since, programs cannot make an Ajax call to a remote resource,
    // Need to do an Ajax call to a local program that goes and gets the token.
    logger("Refresh the token using client id: " + userIdentity);
    //
    // I should use: $.getJSON
    var jqxhr = $.get("generateToken?identity=" + userIdentity, function (token) {
        if (token === "0") {
            logger("- Error refreshing the token.");
            return;
        }
        thisToken = token;
        logger("Token refreshed: " + thisToken);
        // -------------------------------
        // https://www.twilio.com/docs/chat/initializing-sdk-clients#javascript_1
        // https://www.twilio.com/docs/chat/tutorials/chat-application-node-express#initialize-the-programmable-chat-client
        Twilio.Chat.Client.create(thisToken).then(chatClient => {
            logger("Chat client created: thisChatClient: " + thisChatClient);
            thisChatClient = chatClient;
            addChatMessage("+ Chat client created for the user: " + userIdentity);
            thisChatClient.getSubscribedChannels();
            // thisChatClient.getSubscribedChannels().then(joinChatChannel);
            setButtons("createChatClient");
            //
            // -------------------------------
            // Set event listeners.
            // 
            // Documentation:
            //   https://www.twilio.com/docs/chat/tutorials/chat-application-node-express?code-sample=code-initialize-the-chat-client-9&code-language=Node.js&code-sdk-version=default
            thisChatClient.on('channelAdded', onChannelAdded);
            // thisChatClient.on('channelRemoved', $.throttle(tc.loadChannelList));
            // thisChatClient.on('tokenExpired', onTokenExpiring);
            //
            thisChatClient.on('tokenAboutToExpire', onTokenAboutToExpire);
            //
        });
    }).fail(function () {
        logger("- Error refreshing the token and creating the chat client object.");
    });
}

function onChannelAdded(aChannel) {
    // https://media.twiliocdn.com/sdk/android/chat/releases/2.0.6/docs/com/twilio/chat/ChatClientListener.html
    // Called when the current user is added to a channel.
    logger("onChannelAdded, user added to the  channel: " + aChannel.friendlyName);
    // Note, joined but not subscribed.
}

function onTokenAboutToExpire() {
    logger("onTokenExpiring: Refresh the token using client id: " + userIdentity);
    var jqxhr = $.get("generateToken?identity=" + userIdentity, function (token, status) {
        if (token === "0") {
            logger("- Error refreshing the token.");
            return;
        }
        thisToken = token;
        logger("Token update: " + thisToken);
        // -------------------------------
        // https://www.twilio.com/docs/chat/access-token-lifecycle
        thisChatClient.updateToken(thisToken);
        // -------------------------------
    }).fail(function () {
        logger("- onTokenAboutToExpire: Error refreshing the chat client token.");
    });
}

// -----------------------------------------------------------------------------
function joinChatChannel() {
    logger("Function: joinChatChannel()");
    if (thisChatClient === "") {
        addChatMessage("First, create a Chat Client.");
        logger("Required: Chat Client.");
        return;
    }
    chatChannelName = $("#channelName").val();
    if (chatChannelName === "") {
        addChatMessage("Enter a Channel name.");
        logger("Required: Channel name.");
        return;
    }
    addChatMessage("++ Join the channel: " + chatChannelName);
    thisChatClient.getChannelByUniqueName(chatChannelName)
            .then(function (channel) {
                thisChannel = channel;
                logger("Channel exists: " + chatChannelName + " : " + thisChannel);
                joinChannel();
                logger("+ Channel Attributes: "
                        // + channel.getAttributes()
                        + " SID: " + channel.sid
                        + " name: " + channel.friendlyName
                        );
            })
            .catch(function () {
                logger("Channel doesn't exist, created the channel.");
                chatChannelDescription = $("#channelDescription").val();
                if (chatChannelDescription === "") {
                    chatChannelDescription = chatChannelName;
                }
                thisChatClient.createChannel({
                    uniqueName: chatChannelName,
                    friendlyName: chatChannelDescription
                }).then(function (channel) {
                    logger("Channel created : " + chatChannelName + " " + chatChannelDescription + " : " + channel);
                    thisChannel = channel;
                    joinChannel();
                }).catch(function (channel) {
                    logger('-- Failed to create the channel: ' + channel);
                });
            });
}

function joinChannel() {
    logger('Join the channel: ' + thisChannel.uniqueName);
    thisChannel.join().then(function (channel) {
        logger('Joined channel as ' + userIdentity);
        addChatMessage("+++ Channel joined. You can start chatting.");
        setButtons("join");
    }).catch(function (err) {
        if (err.message === "Member already exists") {
            addChatMessage("++ You already exist in the channel.");
            setButtons("join");
        } else if (err.message === "Webhook cancelled processing of command") {
            addChatMessage("++ You have joined the channel.");
            setButtons("join");
        } else {
            logger("- Join failed: " + thisChannel.uniqueName + ' :' + err.message + ":");
            addChatMessage("- Join failed: " + err.message);
        }
    });
    // -------------------------------------------------------------------------
    // Set channel event listeners.
    thisChannel.on('messageAdded', function (message) {
        addChatMessage("> " + message.author + " : " + message.channel.uniqueName + " : " + message.body);
        // IMe9c317dc4a1f4276bfeb1286535271d5 : david : undefined : +16508668188 : back to you
        // addChatMessage("> " + message.sid + " : "+ message.author + " : "+ message.friendlyName
        //         + " : " + message.channel.uniqueName + " : " + message.body);
        incCount();
    });
    // Documenation: https://www.twilio.com/docs/chat/channels
    // 
    // Set channel event listener: typing started
    // thisChannel.on('typingStarted', function (member) {
    //    logger("Member started typing: " + member);
    // });
    // Set channel event listener: typing ended
    // thisChannel.on('typingEnded', function(member) {
    //   logger("Member stopped typing: " + member');
    // });
}

// -----------------------------------------------------------------------------
function listChannels() {
    if (thisChatClient === "") {
        addChatMessage("First, create a Chat Client.");
        logger("Required: Chat Client.");
        return;
    }
    chatChannelName = $("#channelName").val();
    addChatMessage("+ List of public channels (+ uniqueName: friendlyName):");
    thisChatClient.getPublicChannelDescriptors().then(function (paginator) {
        for (i = 0; i < paginator.items.length; i++) {
            const channel = paginator.items[i];
            let listString = '++ ' + channel.uniqueName + ": " + channel.friendlyName + ": " + channel.createdBy;
            if (channel.uniqueName === chatChannelName) {
                listString += " *";
            }
            addChatMessage(listString);
        }
        addChatMessage("+ End list.");
    });
}

function deleteChannel() {
    logger("Function: deleteChannel()");
    if (thisChatClient === "") {
        addChatMessage("First, create a Chat Client.");
        logger("Required: Chat Client.");
        return;
    }
    chatChannelName = $("#channelName").val();
    if (chatChannelName === "") {
        addChatMessage("Enter a Channel name.");
        logger("Required: Channel name.");
        return;
    }
    thisChatClient.getChannelByUniqueName(chatChannelName)
            .then(function (channel) {
                thisChannel = channel;
                logger("Channel exists: " + chatChannelName + " : " + thisChannel);
                thisChannel.delete().then(function (channel) {
                    addChatMessage('+ Deleted channel: ' + chatChannelName);
                }).catch(function (err) {
                    if (thisChannel.createdBy !== userIdentity) {
                        addChatMessage("- Can only be deleted by the creator: " + thisChannel.createdBy);
                    } else {
                        logger("- Delete failed: " + thisChannel.uniqueName + ', ' + err);
                        addChatMessage("- Delete failed: " + err);
                    }
                });
            }).catch(function () {
        logger("Channel doesn't exist.");
        addChatMessage("- Channel doesn't exist, cannot delete it: " + chatChannelName);
    });
}

// -----------------------------------------------------------------------------
function listMembers() {
    logger("+ Called: listMembers().");
    var members = thisChannel.getMembers();
    addChatMessage("+ -----------------------");
    addChatMessage("+ Members of this channel: " + thisChannel.uniqueName);
    members.then(function (currentMembers) {
        currentMembers.forEach(function (member) {
            if (member.lastConsumedMessageIndex !== null) {
                addChatMessage("++ " + member.identity + ", Last Consumed Message Index = " + member.lastConsumedMessageIndex);
            } else {
                addChatMessage("++ " + member.identity);
            }
        });
    });
}

function listAllMessages() {
    logger("+ Called: listAllMessages().");
    thisChannel.getMessages().then(function (messages) {
        totalMessages = messages.items.length;
        logger('Total Messages: ' + totalMessages);
        addChatMessage("+ -----------------------");
        addChatMessage("+ All current messages:");
        for (i = 0; i < totalMessages; i++) {
            const message = messages.items[i];
            // properties: https://media.twiliocdn.com/sdk/js/chat/releases/3.2.1/docs/Message.html
            addChatMessage("> " + message.author + " : " + message.body);
        }
        thisChannel.updateLastConsumedMessageIndex(totalMessages);
        addChatMessage('+ Total Messages: ' + totalMessages);
    });
}

function doCountZero() {
    logger("+ Called: doCountZero(): thisChannel.setNoMessagesConsumed();");
    thisChannel.setNoMessagesConsumed();
}

function incCount() {
    totalMessages++;
    logger('+ Increment Total Messages:' + totalMessages);
    thisChannel.getMessages().then(function (messages) {
        thisChannel.updateLastConsumedMessageIndex(totalMessages);
    });
}

function setTotalMessages() {
    thisChannel.getMessages().then(function (messages) {
        totalMessages = messages.items.length;
        logger('setTotalMessages, Total Messages:' + totalMessages);
    });
}

// -----------------------------------------------------------------------------
// UI Functions

var theBar = 0;
function menuicon() {
    // logger("+ Clicked menuicon");
    document.getElementById("menuDropdownItems").classList.toggle("show");
}
function menubar() {
    theBar = 1;
    // logger("+ Clicked menubar");
}
window.onclick = function (e) {
    if (!e.target.matches('.menuicon') && !e.target.matches('.menubar')) {
        if (theBar === 0) {
            // logger("+ Clicked window");
            var dropdowns = document.getElementsByClassName("menuDropdownList");
            for (var d = 0; d < dropdowns.length; d++) {
                var openDropdown = dropdowns[d];
                if (openDropdown.classList.contains('show')) {
                    openDropdown.classList.remove('show');
                }
            }
        }
    }
    theBar = 0;
};

function activateChatBox() {
    $("#message").removeAttr("disabled");
    //
    $("#btn-createChatClient").click(function () {
        createChatClientObject();
    });
    $("#btn-join").click(function () {
        joinChatChannel();
    });
    $("#btn-list").click(function () {
        listChannels();
    });
    $("#btn-delete").click(function () {
        deleteChannel();
    });
    $("#btn-members").click(function () {
        listMembers();
    });
    $("#btn-listallmessages").click(function () {
        listAllMessages();
    });
    $("#btn-countzero").click(function () {
        doCountZero();
    });
    // --------------------------------
    $("#btn-chat").click(function () {
        if (thisChatClient === "") {
            addChatMessage("First, create a Chat Client.");
            return;
        }
        const message = $("#message").val();
        if (message === "") {
            return;
        }
        $("#message").val("");
        thisChannel.sendMessage(message);
    });
    $("#message").on("keydown", function (e) {
        if (e.keyCode === 13) {
            $("#btn-chat").click();
        }
    });
    // --------------------------------
}

function setButtons(activity) {
    logger("setButtons, activity: " + activity);
    // $("div.callMessages").html("Activity: " + activity);
    switch (activity) {
        case "init":
            $('#btn-createChatClient').prop('disabled', false);
            //
            $('#btn-list').prop('disabled', true);
            $('#btn-join').prop('disabled', true);
            //
            $('#btn-delete').prop('disabled', true);
            $('#btn-chat').prop('disabled', true);
            $('#btn-members').prop('disabled', true);
            $('#btn-count').prop('disabled', true);
            $('#btn-countzero').prop('disabled', true);
            $('#btn-listallmessages').prop('disabled', true);
            break;
        case "createChatClient":
            $('#btn-createChatClient').prop('disabled', true);
            //
            $('#btn-list').prop('disabled', false);
            $('#btn-join').prop('disabled', false);
            //
            $('#btn-delete').prop('disabled', false);
            $('#btn-chat').prop('disabled', true);
            $('#btn-members').prop('disabled', true);
            $('#btn-count').prop('disabled', true);
            $('#btn-countzero').prop('disabled', true);
            $('#btn-listallmessages').prop('disabled', true);
            break;
        case "join":
            $('#btn-createChatClient').prop('disabled', true);
            //
            $('#btn-list').prop('disabled', false);
            $('#btn-join').prop('disabled', false);
            //
            $('#btn-delete').prop('disabled', false);
            $('#btn-chat').prop('disabled', false);
            $('#btn-members').prop('disabled', false);
            $('#btn-count').prop('disabled', false);
            $('#btn-countzero').prop('disabled', false);
            $('#btn-listallmessages').prop('disabled', false);
            break;
    }
}

function logger(message) {
    var aTextarea = document.getElementById('log');
    aTextarea.value += "\n> " + message;
    aTextarea.scrollTop = aTextarea.scrollHeight;
}
function clearLog() {
    log.value = "+ Ready";
}
function addChatMessage(message) {
    var aTextarea = document.getElementById('chatMessages');
    aTextarea.value += "\n" + message;
    aTextarea.scrollTop = aTextarea.scrollHeight;
}
window.onload = function () {
    log.value = "+++ Start.";
    chatMessages.value = "+++ Ready to Create Chat Client, then join a chat channel and chat.";
    activateChatBox();
    setButtons("init");
};
// -----------------------------------------------------------------------------

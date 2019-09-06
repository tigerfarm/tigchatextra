// -----------------------------------------------------------------------------
// Chat web server
// 
// Easy to use.
// 
// Install modules.
//  $ npm install --save request
//  $ npm install --save express
//  $ npm install --save twilio-chat
//  
// Run the web server. Default port is hardcoded to 8000.
//  $ node chatsever.js
// 
// -----------------------------------------------------------------------------
// To do:
//  Complete testing of auto token refresh using tokenAboutToExpire.
//  
//  Delete abc channel, current error: - Delete failed: SessionError: User unauthorized for command
//      https://www.twilio.com/docs/chat/rest/users
//      https://www.twilio.com/docs/chat/permissions
//
//  Presence: 1) subscribe/unsubscribe to users. 2) Check who is online.
//  SMS Chat gateway.
//  Properly mantain the message count for a user for their current channel
//  Make this npm available?
//      https://docs.npmjs.com/creating-node-js-modules
//
// -----------------------------------------------------------------------------
// Chat docmentation links:
//  Chat Presence:
//      https://www.twilio.com/docs/chat/reachability-indicator
//  Tokens:
//      https://www.twilio.com/docs/chat/access-token-lifecycle
//  Message properties:
//      https://media.twiliocdn.com/sdk/js/chat/releases/3.2.1/docs/Message.html
//  sendMessage(message, messageAttributes):
//      https://media.twiliocdn.com/sdk/js/chat/releases/2.0.0/docs/Channel.html#sendMessage__anchor
//  Chat send/receive media files:
//      https://www.twilio.com/docs/chat/media-support
//      https://www.twilio.com/docs/chat/rest/media
//      https://www.twilio.com/docs/chat/rest/media#properties
//  
// -----------------------------------------------------------------------------
// Setup to generate chat tokens.
// 
// Create environment variables which are used in the generateToken() function.
//
var ACCOUNT_SID = process.env.ACCOUNT_SID;
//
// Create a Chat Service:
//  https://www.twilio.com/console/chat/dashboard
var CHAT_SERVICE_SID = process.env.CHAT_SERVICE_SID;
//
// Create an API key and secret string:
//  https://www.twilio.com/console/chat/runtime/api-keys
var CHAT_API_KEY = process.env.CHAT_API_KEY;
var CHAT_API_KEY_SECRET = process.env.CHAT_API_KEY_SECRET;
//
// The following is used the updating an about to expire token.
//      Use the same method to update, as was last used to generate the token.
const TOKEN_METHOD_URL = 'URL';
const TOKEN_METHOD_ENVIRONMENT_VARIABLES = 'ENV';
var TOKEN_METHOD = '';

// -----------------------------------------------------------------------------
// Required for SMS:
var AUTH_TOKEN = process.env.AUTH_TOKEN;
//
// Defaults:
var smsSendFrom = process.env.PHONE_NUMBER3;    // sms from <phone number>
var smsSendTo = process.env.PHONE_NUMBER4;      // sms to <phone number>

// Required for SMS and HTTP
var request = require('request');

// Not used in chatserver.js because it does not relay.
var RELAY_URL = '';

// ----------------------------------
function generateToken(theIdentity) {
    // Documentation: https://www.twilio.com/docs/api/rest/access-tokens
    //
    if (theIdentity === "") {
        sayRequirement("Required: user identity for creating a chat token.");
        doPrompt();
        return "";
    }
    sayMessage("+ Generate token, chat user ID: " + theIdentity);
    const AccessToken = require('twilio').jwt.AccessToken;
    // Create a Chat token: https://www.twilio.com/docs/chat/create-tokens
    const token = new AccessToken(
            ACCOUNT_SID,
            CHAT_API_KEY,
            CHAT_API_KEY_SECRET
            );
    // Create a Chat service: https://www.twilio.com/console/chat/services
    const chatGrant = new AccessToken.ChatGrant({
        serviceSid: CHAT_SERVICE_SID        // Begins with 'IS'
    });
    token.addGrant(chatGrant);
    token.identity = theIdentity;
    token.ttl = 1200;          // Token time to live, in seconds. 1200 = 20 minutes.
    //
    // Output the token.
    theToken = token.toJwt();
    debugMessage("+ theToken " + theToken);
    TOKEN_METHOD = TOKEN_METHOD_ENVIRONMENT_VARIABLES;
    return(theToken);
}

// -----------------------------------------------------------------------------
console.log("+++ Chat program is starting up.");

var userIdentity = process.argv[2] || "";
if (userIdentity !== "") {
    console.log("+ User identity: " + userIdentity);
}
var userJoinChannel = process.argv[3] || "";
if (userJoinChannel !== "") {
    console.log("+ User channel to join: " + userJoinChannel);
}

// $ npm install --save twilio-chat
const Chat = require('twilio-chat');
//
var request = require('request');

// Chat presence.
var presenceState = 0; // 0 off

var firstInit = "";
var setChannelListeners = "";
var thisChatClient = "";
var thisChatChannelName = "";
var chatChannelDescription = "";
var thisToken = "";
var thisChannel = "";

// This is to count channel messages read. Needs work to initialize and maintain the count.
// Needs to be reset when changing channels.
var totalMessages = 0;

// -----------------------------------------------------------------------------
var debugState = 0;    // 0 off
var debugOnOff = process.argv[4] || "";
if (debugOnOff === "debug") {
    debugState = 1;    // 1 on
    debugMessage("Debug on.");
}
function debugMessage(message) {
    if (debugState !== 0) {
        console.log("?- " + message);
    }
}

var returnMessage = '';
function sayMessage(message) {
    returnMessage = returnMessage + message + "<br>";
    console.log(message);
}

function sayRequirement(message) {
    console.log("- " + message);
}

// Since the code is from the command line version, I left this code in.
var thePromptPrefix = "+ Command, ";
var thePrompt = "Enter > ";
function doPrompt() {
    // No line feed after the prompt.
    process.stdout.write(thePromptPrefix + thePrompt);
}

// -----------------------------------------------------------------------------
function createChatClientObject(token, theChannel) {
    if (userIdentity === "") {
        sayRequirement("Required: user identity for creating a chat object.");
        doPrompt();
        return;
    }
    if (token === "") {
        sayRequirement("Required: chat access token.");
        doPrompt();
        return;
    }
    sayMessage("+ Creating chat client object.");
    // -------------------------------
    Chat.Client.create(token).then(chatClient => {
        thisChatClient = chatClient;
        thisChatClient.on('tokenAboutToExpire', onTokenAboutToExpire);
        debugMessage("Chat client object created: thisChatClient: " + thisChatClient);
        sayMessage("++ Chat client object created for the user: " + userIdentity);
        // thisChatClient.getSubscribedChannels();
        thisChatClient.getSubscribedChannels().then(function (paginator) {
            sayMessage("++ Chat client Subscribed Channels: ");
            if (firstInit === "") {
                firstInit = "initialized";
            }
            for (i = 0; i < paginator.items.length; i++) {
                const channel = paginator.items[i];
                console.log('+++ Channel: ' + channel.friendlyName);
            }
            if (theChannel !== '') {
                console.log('+ Join Channel: ' + theChannel);
                joinChatChannel(theChannel, '');
            } else {
                doPrompt();
            }
        });
    });
}

function onTokenAboutToExpire() {
    debugMessage("onTokenAboutToExpire: Refresh the token using client id: " + userIdentity);
    theUpdateToken = '';
    if (TOKEN_METHOD === TOKEN_METHOD_ENVIRONMENT_VARIABLES) {
        theUpdateToken = generateToken(userIdentity);
    } else {
        // david, need to test.
        var createClientObject = false;
        // Not available at this time in chatserver.js
        // theUpdateToken = getTokenSeverSide(userIdentity, createClientObject);
    }
    if (theUpdateToken === '') {
        sayMessage("- onTokenAboutToExpire: Error refreshing the chat client token.");
        return;
    }
    debugMessage("Updated token: " + theUpdateToken);
    thisChatClient.updateToken(theUpdateToken);
    sayMessage("Token updated.");
}

// -----------------------------------------------------------------------------
function joinChatChannel(chatChannelName, chatChannelDescription) {
    debugMessage("joinChatChannel(" + chatChannelName + ", " + chatChannelDescription + ")");
    if (thisChatClient === "") {
        sayRequirement("Required: create a Chat Client.");
        doPrompt();
        return;
    }
    if (chatChannelName === "") {
        sayRequirement("Required: Channel name.");
        doPrompt();
        return;
    }
    // sayMessage("+ Join the channel: " + chatChannelName);
    thisChatClient.getChannelByUniqueName(chatChannelName)
            .then(function (channel) {
                thisChannel = channel;
                thisChatChannelName = chatChannelName;
                debugMessage("Channel exists: " + chatChannelName + " : " + thisChannel);
                joinChannel();
                debugMessage("Channel Attributes: "
                        // + channel.getAttributes()
                        + " SID: " + channel.sid
                        + " name: " + channel.friendlyName
                        );
                sayMessage('+ You have joined the channel: ' + chatChannelName);
                doPrompt();
            })
            .catch(function () {
                debugMessage("Channel doesn't exist, created the channel.");
                if (chatChannelDescription === "") {
                    chatChannelDescription = chatChannelName;
                }
                thisChatClient.createChannel({
                    uniqueName: chatChannelName,
                    friendlyName: chatChannelDescription
                }).then(function (channel) {
                    sayMessage("++ Channel created: " + chatChannelName + ", " + chatChannelDescription);
                    thisChannel = channel;
                    thisChatChannelName = chatChannelName;
                    joinChannel();
                }).catch(function (channel) {
                    sayMessage('-- Failed to create the channel: ' + channel);
                    // Following happened when the token had expired.
                    // -- Failed to create the channel: Error: Can't add command: Can't connect to twilsock
                });
            });
}

function joinChannel() {
    debugMessage('joinChannel() ' + thisChannel.uniqueName);
    thisChannel.join().then(function (channel) {
        debugMessage('Joined channel as ' + userIdentity);
        sayMessage('++ You have joined the channel: ' + thisChannel.friendlyName);
        doCountZero();
        doPrompt();
    }).catch(function (err) {
        doCountZero();
        if (err.message === "Member already exists") {
            debugMessage("++ You already exist in the channel.");
        } else if (err.message === "Channel member limit exceeded") {
            // To handle this properly, would need to list the channel members to see if join has truly failed.
            debugMessage("Join failed: Channel member limit exceeded.");
            sayMessage("- If you are not already a member of this channel, the join has failed.");
        } else {
            debugMessage("- Join failed: " + thisChannel.uniqueName + ' :' + err.message + ":");
            sayMessage("- Join failed: " + err.message);
        }
    });
    // if (setChannelListeners === "") {
    setChannelListnerFunctions();
    // }
}

function setChannelListnerFunctions() {
    // Only set this once, else can cause issues when re-joining or joining other channels.
    setChannelListeners = "joined";
    debugMessage("+ Set channel event listeners.");
    //
    thisChannel.on('messageAdded', function (message) {
        onMessageAdded(message);
    });
}

function incCount() {
    totalMessages++;
    debugMessage('+ Increment Total Messages:' + totalMessages);
    thisChannel.getMessages().then(function (messages) {
        thisChannel.updateLastConsumedMessageIndex(totalMessages);
    });
}

function doCountZero() {
    debugMessage("+ Called: doCountZero(): thisChannel.setNoMessagesConsumed();");
    totalMessages = 0;
    thisChannel.setNoMessagesConsumed();
}

// -----------------------------------------------------------------------------
function listChannels() {
    debugMessage("listChannels()");
    if (thisChatClient === "") {
        sayRequirement("Required: Chat Client.");
        doPrompt();
        return;
    }
    sayMessage("+ ------------------------------------------------------------------------------");
    sayMessage("+ List of public channels (++ uniqueName: friendlyName: createdBy):");
    thisChatClient.getPublicChannelDescriptors().then(function (paginator) {
        for (i = 0; i < paginator.items.length; i++) {
            const channel = paginator.items[i];
            let listString = '++ ' + channel.uniqueName + ": " + channel.friendlyName + ": " + channel.createdBy;
            if (channel.uniqueName === thisChatChannelName) {
                listString += " *";
            }
            sayMessage(listString);
        }
        sayMessage("+ End of list.");
        doPrompt();
    }).catch(function (err) {
        sayMessage("- Error listing channels: " + err);
        doPrompt();
    });
}

function deleteChannel(chatChannelName) {
    debugMessage("deleteChannel()");
    if (thisChatClient === "") {
        sayRequirement("Required: Chat Client.");
        doPrompt();
        return;
    }
    if (chatChannelName === "") {
        sayRequirement("Required: Channel name.");
        doPrompt();
        return;
    }
    sayMessage('+ Delete channel: ' + chatChannelName);
    thisChatClient.getChannelByUniqueName(chatChannelName).then(function (channel) {
        thisChannel = channel;
        debugMessage("Channel exists: " + chatChannelName + ", created by: " + thisChannel.createdBy);
        thisChannel.delete().then(function (channel) {
            sayMessage('++ Channel deleted: ' + chatChannelName);
            if (chatChannelName === thisChatChannelName) {
                thisChatChannelName = "";
            }
            doPrompt();
        }).catch(function (err) {
            // Not handled: SessionError: User unauthorized for command.
            if (thisChannel.createdBy !== userIdentity) {
                sayMessage("- Can only be deleted by the creator: " + thisChannel.createdBy);
            } else {
                debugMessage("- Delete failed: " + thisChannel.uniqueName);
                sayMessage("- Delete failed: " + err);
            }
            doPrompt();
        });
    }).catch(function () {
        sayMessage("- Channel doesn't exist, cannot delete it: " + chatChannelName);
        doPrompt();
    });
}

// -----------------------------------------------------------------------------
// For the channel you have joined:

function listMembers() {
    debugMessage("listMembers()");
    if (thisChannel === "") {
        sayRequirement("Required: join a channel.");
        doPrompt();
        return;
    }
    var members = thisChannel.getMembers();
    sayMessage("+ ------------------------------------------------------------------------------");
    sayMessage("+ Members of channel: " + thisChannel.uniqueName);
    members.then(function (currentMembers) {
        var i = 1;
        currentMembers.forEach(function (member) {
            if (member.lastConsumedMessageIndex !== null) {
                sayMessage("++ " + member.identity + ", Last Consumed Message Index = " + member.lastConsumedMessageIndex);
            } else {
                sayMessage("++ " + member.identity);
            }
            if (currentMembers.length === i++) {
                doPrompt();
            }
        });
    });
}

function listMessageHistory() {
    debugMessage("listMessageHistory()");
    if (thisChatChannelName === "") {
        sayRequirement("Required: join a channel.");
        doPrompt();
        return;
    }
    thisChannel.getMessages().then(function (messages) {
        totalMessages = messages.items.length;
        sayMessage('Total Messages: ' + totalMessages);
        sayMessage("+ -----------------------");
        sayMessage("+ All current messages:");
        // const messages = messagesPaginator.items[0];
        for (i = 0; i < totalMessages; i++) {
            const message = messages.items[i];
            if (message.type === 'text') {
                sayMessage("> " + message.type + " from: " + message.author + " : " + message.body);
            } else {
                sayMessage("> " + message.type + " from: " + message.author + " SID: " + message.media.sid);
            }
            if (message.type === 'media') {
                // debugMessage('Media message attributes', message.media.toString());
                message.media.getContentUrl().then(function (url) {
                    sayMessage("+ Media from: " + message.author
                            + ", Media contentType: " + message.media.contentType
                            + ", filename: " + message.media.filename
                            + ", size: " + message.media.size
                            + ", SID: " + message.media.sid);
                    sayMessage("++ Media temporary URL: " + url);
                });
            }
        }
        thisChannel.updateLastConsumedMessageIndex(totalMessages);
        sayMessage('+ Total Messages: ' + totalMessages);
        doPrompt();
    });
}

// -----------------------------------------------------------------------------
function doSend(theCommand) {
    if (thisChatChannelName === "") {
        sayRequirement("Required: join a channel.");
        doPrompt();
    } else {
        commandLength = 'send'.length + 1;
        sayRequirement("+ To the chat channel: " + thisChatChannelName + ", Send: " + theCommand.substring(commandLength));
        if (theCommand.length > commandLength) {
            // david, need error handling on this:
            thisChannel.sendMessage(theCommand.substring(commandLength));
        } else {
            if (sendMode === 0) {
                sayMessage("+ You are now in send mode.");
                thePromptPrefix = "+ Send, ";
                sendMode = 1;
            } else {
                sayMessage("+ Returned to command mode.");
                thePromptPrefix = "+ Command, ";
                sendMode = 0;
            }
            doPrompt();
        }
    }
}

function doSendMedia(theCommand) {
    var fs = require("fs");
    if (thisChatChannelName === "") {
        sayRequirement("Required: join a channel.");
        doPrompt();
    } else {
        commandLength = 'sendmedia'.length + 1;
        if (theCommand.length > commandLength) {
            // Need to use formdata to send the filename, not the buffer which I'm using here.
            theMediaFile = theCommand.substring(commandLength);
            sayMessage("++ Send media file: " + theMediaFile);

            // https://media.twiliocdn.com/sdk/js/chat/releases/2.0.0/docs/Channel.html#sendMessage__anchor
            //  sendMessage(message, messageAttributes)
            //  
            // Form data option not working for me.
            // // formData.append('file', $('#formInputFile')[0].files[0]);
            //
            // var FormData = require('form-data');
            // const formData = new FormData();
            // formData.append('file', fs.createReadStream(theMediaFile));
            // The following don't help:
            //  formData.append('contentType', 'application/x-www-form-urlencoded');
            //  formData.append('contentType', 'image/jpg');
            //  formData.append('media', fs.createReadStream(theMediaFile));
            thisChatClient.getChannelBySid(thisChannel.sid).then(function (channel) {

                // The following gives: Error: Media content <Channel#SendMediaOptions> must contain non-empty contentType and media
                // channel.sendMessage(formData);

                // The following works. But only when using form data can I send the filename.
                channel.sendMessage({media: fs.readFileSync(theMediaFile), contentType: 'image/jpg'});

            });

        } else {
            sayRequirement("+ Media filename required: sendmedia <filename>");
            doPrompt();
        }
    }
}

function test0() {
    // Only form data send option allows the sending of a filename.
    thisChatClient.getChannelBySid(thisChannel.sid).then(function (channel) {
        channel.sendMessage({
            // contentType: 'application/x-www-form-urlencoded',
            contentType: 'image/jpg',
            media: fs.readFileSync(theMediaFile)
        });
    });
}

// -----------------------------------------------------------------------------
function listUsers() {
    sayMessage("+ List users.");
    // https://www.twilio.com/docs/chat/rest/users#properties
    const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
    var i = 1;
    client.chat.services(CHAT_SERVICE_SID).users.list({limit: 30}).then(users => {
        users.forEach(user => {
            var theInfo = user.sid + " Role: " + user.roleSid + " " + user.identity;
            if (user.friendlyName !== null) {
                theInfo = theInfo + ", " + user.friendlyName;
            }
            if (user.isOnline !== null) {
                theInfo = theInfo + " isOnline: " + user.isOnline;
            }
            sayMessage("++ " + theInfo);
            if (i++ === users.length) {
                doPrompt();
            }
        });
    });
}
// -----------------------------------------------------------------------------
function doShow() {
    sayMessage("------------------------------------------------------------------------------");
    sayMessage("+ Show chat client attribute settings: ");
    if (thisChatChannelName) {
        sayMessage("++ Joined to channel: " + thisChatChannelName);
    } else {
        sayMessage("++ Not joined to any channel.");
    }
    if (userIdentity) {
        sayMessage("++ User identity: " + userIdentity);
    } else {
        sayMessage("++ User identity is required.");
    }
    if (thisChatClient === "") {
        sayMessage("++ Chat Client object not created.");
    } else {
        sayMessage("++ Chat Client object is created.");
    }
    sayMessage("-----------------------");
    sayMessage("+ Environment variables:");
    if (ACCOUNT_SID !== "") {
        sayMessage("++ Account SID: " + ACCOUNT_SID);
    }
    if (AUTH_TOKEN !== "") {
        sayMessage("++ Account auth token is set.");
    }
    if (CHAT_SERVICE_SID !== "") {
        sayMessage("++ Chat service SID: " + CHAT_SERVICE_SID);
    }
    if (CHAT_API_KEY !== "") {
        sayMessage("++ Chat API key: " + CHAT_API_KEY);
    }
    if (CHAT_API_KEY_SECRET !== "") {
        sayMessage("++ Chat API key secret is set.");
    }
    if (TOKEN_METHOD === "") {
        sayMessage("++ Token method not set.");
    } else {
        sayMessage("++ Token method: " + TOKEN_METHOD);
    }
    sayMessage("-----------------------");
    if (debugState === 0) {
        sayMessage("++ Debug: off");
    } else {
        sayMessage("++ Debug: on");
    }
    sayMessage("-----------------------");
    // if (smsSendFrom !== "") {
    //     sayMessage("++ SMS send from phone number: " + smsSendFrom);
    // }
    // if (smsSendTo !== "") {
    //     sayMessage("++ SMS send to phone number:   " + smsSendTo);
    // }

}

if (userIdentity !== "") {
    token = generateToken(userIdentity);
    if (token !== "") {
        createChatClientObject(token, userJoinChannel);
    }
} else {
    firstInit = "initialized";
    sayMessage("+ Ready for commands such as: help, user, init or generate.");
    doPrompt();
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

function doSendSms(smsFrom, smsTo, theMessage) {
    var theType = "json";
    var theRequest = "https://" + ACCOUNT_SID + ":" + AUTH_TOKEN + "@" + "api.twilio.com/2010-04-01/Accounts/" + ACCOUNT_SID + "/Messages." + theType;
    var options = {
        method: 'POST',
        'uri': theRequest,
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        formData: {
            From: smsFrom,
            To: smsTo,
            Body: theMessage
        }
    };
    var request = require('request');
    debugMessage('URL request: ' + theRequest);
    function callback(error, response, body) {
        debugMessage("response.statusCode: " + response.statusCode);
        if (!error) {
            const jsonData = JSON.parse(body);
            sayMessage("++  Message status = " + jsonData.status + ", From: " + smsFrom + ", To: " + smsTo);
            debugMessage("jsonData: " + body);
        } else {
            sayMessage("++ error: " + error);
        }
        doPrompt();
    }
    request(options, callback);
}

function onMessageAdded(message) {
    // Other message properties: message.sid, message.friendlyName
    if (message.author === userIdentity) {
        debugMessage("> " + userIdentity + " : " + message.channel.uniqueName + ":" + thisChatChannelName + " : " + message.body);
    } else {
        sayMessage("< " + message.author + " : " + message.channel.uniqueName + " : " + message.body);
        theResponse = message.body;
        if (userIdentity.startsWith("+") && thisChatChannelName.startsWith("+")) {
            doSendSms(userIdentity, thisChatChannelName, "Author: " + message.author + ", text: " + message.body);
        }
        if (httpResponseObject !== '') {
            // Process the HTTP GET response, when it's returned.
            sayMessage('+ Check for HTTP GET response :' + httpRequestUri + ':');
            const seconds = 3;  // david, should be a settable value.
            console.log("+ Wait for " + seconds + " seconds.");
            var counter = 0;
            while (counter < seconds) {
                if (theResponse !== '') {
                    break;
                }
                sleep(1);
                counter++;
                console.log("+ counter = " + counter);
            }
            if (theResponse === '') {
                sayMessage('+ No HTTP GET response.');
                httpResponseObject.send("+ No HTTP GET response.");
            } else {
                sayMessage("+ Return HTTP response.");
                debugMessage("+ HTTP GET response: " + theResponse);
                httpResponseObject.send(theResponse);
            }
            httpResponseObject = '';
        }
    }
    incCount();
    doPrompt();
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// Web server interface to call functions.
// -----------------------------------------------------------------------------
// 
// $ npm install express --save
const express = require('express');
const path = require('path');
const url = require("url");
const PORT = process.env.PORT || 8000;
var app = express();

var theResponse = '';
function sleep(seconds) {
    var waitTill = new Date(new Date().getTime() + seconds * 1000);
    while (waitTill > new Date()) {
        if (theResponse !== '') {
            break;
        }
    }
}

// -----------------------------------------------------------------------------
var httpRequestUri = '';
var httpRequestQueryJson = '';
var httpRequestQueryString = '';
app.get('*', function (request, res, next) {
    console.log("------------------");
    if (debugState !== 0) {
        console.log("+ HTTP headers:");
        var theHeaders = JSON.stringify(request.headers).split('","');
        for (var i = 0; i < theHeaders.length; i++) {
            if (i === 0) {
                console.log('++ ' + theHeaders[i].substring(1, theHeaders[i].length) + '"');
            } else if (i === theHeaders.length - 1) {
                console.log('++ "' + theHeaders[i] + '');
            } else {
                console.log('++ "' + theHeaders[i].substring(0, theHeaders[i].length - 1) + '"');
            }
        }
        console.log("---");
    }
    httpRequestUri = url.parse(request.url).pathname;
    httpRequestQueryJson = url.parse(request.url).query;
    var theQueryString = '';
    httpRequestQueryString = '';
    if (httpRequestQueryJson !== null) {
        theQueryString = JSON.stringify(httpRequestQueryJson);
        httpRequestQueryString = theQueryString.substring(1, theQueryString.length - 1);
        theQueryString = " ? " + httpRequestQueryString;
    }
    var urlComponentMessage = '+ URL components : ' + request.method + ' :' + httpRequestUri + ":" + theQueryString;
    console.log(urlComponentMessage);
    next();
});

// -----------------------------------------------------------------------------
// HTTP GET relay requests.
// The response will be from a chat message.

// david
var httpResponseObject = '';
const RELAY_REST_API_GET_PREFIX = '/http/get';
app.get('/http/get/*', function (request, res) {
    // 
    // Future, make the following URL work, where "relay" is the channel name:
    //      http://localhost:8000/http/get/relay/def?p1=abc&p2=def
    // Request received by the server:
    //      + /http/get/* : /http/get/relay/def ? "p1=abc&p2=def"
    // 
    // To use, set setserver.js:
    //      var userIdentity = "relay";
    //      var theChannel = "relay";
    // Run 2 times.
    //      $ node setserver.js
    // Then send make a relay request.
    //      http://localhost:8000/http/get/hello.txt
    //      http://localhost:8000/send?message=/http/get/hello.txt
    //      
    //      http://localhost:8000/send?message=/http/get/twiml?p1=abc%26p2=def
    //      https://tigchat.herokuapp.com/send?message=/http/get/twiml?p1=abc%26p2=def
    //
    theResponse = '';
    if (httpRequestQueryString) {
        sayMessage('+ Chat message :' + httpRequestUri + "?" + httpRequestQueryString + ':');
        doSend("send " + httpRequestUri + "?" + httpRequestQueryString);
    } else {
        sayMessage('+ Chat message :' + httpRequestUri + ':');
        doSend("send " + httpRequestUri);
    }
    httpResponseObject = res;
    sayMessage('+ HTTP GET request.');
    sleep(1);
    if (httpRequestUri.endsWith(".xml")) {
        httpResponseObject.header('Content-Type', 'text/xml');
    } else if (httpRequestUri.endsWith(".html")) {
        httpResponseObject.header('Content-Type', 'text/html');
    } else {
        httpResponseObject.header('Content-Type', 'text/plain');
    }

    // return;
});

// -----------------------------------------------------------------------------
app.get('/smstochat', function (req, res) {
    // ----------------------
    // Incoming SMS message: /smstochat?From=%2B16505551111&To=%2B16505552222&Body=yes+got+it
    //      User sending chat: +16505551111
    //      To chat channel:   +16505552222
    //      Message:           yes got it
    // ----------------------
    // server.js:
    //      user:              +16505551111
    //      join channel:      +16505552222
    // ----------------------
    // chatcli.js
    //      user:              +16505552222
    //      join channel:      +16505552222
    // $ node chatcli.js +16505552222
    // > join +16505552222
    // 
    if (req.query.Body) {
        returnMessage = '';
        var smsFrom = req.query.From;
        var smsTo = req.query.To;
        var smsBody = req.query.Body;
        sayMessage("+ Message From: " + smsFrom);       // + Message From: +16505552222
        sayMessage("+ Message To: " + smsTo);
        sayMessage("+ Sent Chat message: " + smsBody);
        doSend("send " + smsBody);
        res.send(returnMessage);
    } else {
        res.send('+ No Chat message to send.');
    }
});

app.get('/send', function (req, res, next) {
    httpResponseObject = '';
    // http://localhost:8000/send?message=hello2
    if (req.query.message) {
        var smsBody = req.query.message;
        doSend("send " + smsBody);
        res.send("+ Sent Chat message: " + smsBody);
    } else {
        res.send('+ No Chat message to send.');
    }
});

app.get('/smssend', function (req, res) {
// /smssend?Body=hello
    if (req.query.Body) {
        doSendSms(userIdentity, thisChatChannelName, req.query.Body);
        returnMessage = "+ Send SMS Message From: " + userIdentity + " To: " + thisChatChannelName + " : " + req.query.Body;
        sayMessage(returnMessage);
        res.send(returnMessage);
    } else {
        res.send('+ No SMS message to send.');
    }
});

// -----------------------------------------------------------------------------
app.get('/set', function (req, res) {
    // /set?user=16505551111
    // /set?debug=on or off
    if (req.query.user) {
        userIdentity = req.query.user;
        res.send('+ userIdentity :' + userIdentity + ':');
    } else if (req.query.debug) {
        if (req.query.debug === "on") {
            debugState = 1;
            sayMessage("++ Debug: on = " + debugState);
            res.send("++ Debug: on");
        } else {
            debugState = 0;
            sayMessage("++ Debug: off = " + debugState);
            res.send("++ Debug: off");
        }
    } else {
        res.send('- Required: set [ user "identity"|debug [on|off] ]');
    }
});
app.get('/join', function (req, res) {
    // /join?channel=%2B16505552222
    if (req.query.channel) {
        thisChatChannelName = decodeURIComponent(req.query.channel);
        joinChatChannel(thisChatChannelName, thisChatChannelName);
        res.send('+ channel :' + thisChatChannelName + ':');
    } else {
        res.send('- Required: channel.');
    }
});
app.get('/generate', function (req, res) {
    // /generate?channel=relay
    if (req.query.user) {
        userIdentity = req.query.user;
    }
    if (req.query.channel) {
        thisChatChannelName = decodeURIComponent(req.query.channel);
    }
    createChatClientObject(generateToken(userIdentity), thisChatChannelName);
    res.send('+ getToken Sever Side Set ClientObject.');
});
app.get('/show', function (req, res) {
    returnMessage = '';
    doShow();
    res.send(returnMessage);
});
app.get('/exit', function (req, res) {
    res.send("Exit server.");
    sayMessage("+++ Exit.");
    process.exit();
});
app.get('/generateToken', function (req, res) {
    sayMessage("+ Generate Chat Token.");
    if (req.query.identity) {
        res.send(generateToken(req.query.identity));
    } else {
        sayMessage("- Parameter required: identity.");
        res.send(0);
    }
});
// -----------------------------------------------------------------------------
app.get('/echo', function (req, res) {
    if (req.query.SmsSid) {
        res.send('SID ' + req.query.SmsSid + '.');
    } else {
        res.send('Nothing to echo.');
    }
});
// Documentation: http://expressjs.com/en/api.html
//
app.get('/hello', function (req, res) {
    res.send('+ hello there.');
});
//
app.param(['id', 'page'], function (req, res, next, value) {
    console.log('+ hello there: ' + value);
    res.send('+ hello there: ' + value);
    // next();
});
app.get('/hello/:id', function (req, res) {
    console.log('+ /hello/:id ');
    res.send('+ hello there 2');
});
app.get('*', function (req, res, next) {
    console.log('+ * uri: ' + url.parse(req.url).pathname);
    next();
});
// -----------------------------------------------------------------------------
app.use(express.static('docroot'));
app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('HTTP Error 500.');
});
app.listen(PORT, function () {
    console.log('+ Listening on port: ' + PORT);
});

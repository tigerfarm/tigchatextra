// -----------------------------------------------------------------------------
// Easy to use. This program runs standalone. You can download it and run it.
// 
// Install required modules.
//  $ npm install request
//  $ npm install twilio
//  $ npm install twilio-chat
//  
// Run the Chat command line program.
//  $ node chatcli.js
// Display the help message.
//  + Command, Enter > help
// 
// ------------------------------
// Setup to generate chat tokens:
// 
//  1. Either create environment variables with your chat token values
//      which are used in the generateToken() function.
//      
// Required, if generating the chat tokens in this program:
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
//  2. Or create a server side program to generate tokens
//      and add the URL (command: url) to call the program,
//      which is used in getTokenSeverSide() function.
//  url https://about-time-2357.twil.io/tokenchat
var CHAT_GENERATE_TOKEN_URL = process.env.CHAT_GENERATE_TOKEN_URL;
//
// Create a Twilio Function(example path "/tokenchat") to generate access tokens:
//  https://www.twilio.com/console/runtime/functions/manage
// Twilio Function code to generate a token:
//  https://github.com/tigerfarm/owlchat/blob/master/generateToken.js
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
// Values can be set using the Chat CLI command: sms.
var smsSendFrom = process.env.PHONE_NUMBER3;    // sms from <phone number>
var smsSendTo = process.env.PHONE_NUMBER4;      // sms to <phone number>

// Required for SMS and HTTP
var request = require('request');

var RELAY_URL = 'http://localhost:8000';

// ------------------------------
// Run the following commands:
//  $ npm install --save twilio-chat
//  $ node chatcli.js
//  ...
//  + Command, Enter > user me
//  + Command, Enter > url https://about-time-2357.twil.io/tokenchat
//  + Command, Enter > init
//  + Command, Enter > list
//  
// -----------------------------------------------------------------------------
// To do:
// 
//  Improve tokenAboutToExpire:
//      Auto token refresh using tokenAboutToExpire.
//      Create the update token using the same function as when it was first generated.
//  
//  Delete abc channel, current error: - Delete failed: SessionError: User unauthorized for command
//      https://www.twilio.com/docs/chat/rest/users
//      https://www.twilio.com/docs/chat/permissions
//  
//  Presence: 1) subscribe/unsubscribe to users. 2) Check who is online.
//  
//  SMS Chat gateway.
//  Properly mantain the message count for a user for their current channel
//  Make this npm available?
//      https://docs.npmjs.com/creating-node-js-modules
//
//  Multi-user HTTP GET relay
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
//  Blog: How to build a CLI with Node.js
//      https://www.youtube.com/watch?v=rTsz09zRuTU
//      https://www.twilio.com/blog/how-to-build-a-cli-with-node-js
//  

// -----------------------------------------------------------------------------
function doHelp() {
    sayMessage("------------------------------------------------------------------------------\n\
Commands:\n\
\n\
> show\n\
++ Show chat client settings.\n\
\n\
> debug\n\
++ Toggle debug on and off.\n\
\n\
> help\n\
\n\
> clear : clear the console window.\n\
\n\
> exit\n\
\n\
-------------------------\n\
> users\n\
++ List chat users, the first 30. \n\
\n\
> user <identity>\n\
++ Set your chat user identity. \n\
\n\
> generate\n\
++ Generate a token using the local environment variables, and initialize the chat client object.\n\
\n\
> url <URL to retrieve a token>\n\
++ Set the token URL value. This URL is used to retrieve a chat access token.\n\
> init\n\
++ Get a token using the token retrieval URL, and initialize the chat client object.\n\
\n\
-------------------------\n\
> list\n\
++ List public channels.\n\
> join <channel>\n\
> join <channel> [<description>]\n\
> joinns <channel> (Join a channel but don't subscribe to the channel)\n\
> members\n\
++ List channel members.\n\
> history\n\
++ List channel messages.\n\
> delete <channel>\n\
\n\
-------------------------\n\
> send\n\
++ Toggle send mode. When on, send messages.\n\
++ Enter blank line to exit send mode.\n\
> send <message>\n\
\n\
-------------------------\n\
> sms\n\
++ Toggle SMS send mode. When on, send messages.\n\
++ Enter blank line to exit send mode.\n\
> sms send <message>\n\
> sms to <phone number>\n\
++ Set to phone number.\n\
> sms from <phone number>\n\
++ Set from phone number.\n\
\n\
-------------------------\n\
++ Set the HTTP Relay host.\n\
relay <URL to the local relay host>\n\
> relay http://localhost:8000\n\
> relay off\n\
"
            );
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

var request = require('request');

// Chat presence.
var presenceState = 0; // 0 off

var firstInit = "";
var setChannelListeners = "";
var thisChatClient = "";
var thisChatChannelName = "";
var chatChannelDescription = "";
let thisChannelObject = "";

// This is to count channel messages read. Needs work to initialize and maintain the count.
// Needs to be reset when changing channels.
let totalMessages = 0;

// -----------------------------------------------------------------------------
let debugState = 0;    // 0 off
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

var thePromptPrefix = "+ Command, ";
var thePrompt = "Enter > ";
function doPrompt() {
    // No line feed after the prompt.
    process.stdout.write(thePromptPrefix + thePrompt);
}

function sayMessage(message) {
    console.log(message);
}
function sayRequirement(message) {
    console.log("- " + message);
}

function clearScreen() {
    process.stdout.write('\x1Bc');
    sayMessage('+ Running cli.');
    doPrompt();
}

// -----------------------------------------------------------------------------
function generateToken(theIdentity) {
    //
    // Generate a chat token using environment variables.
    //
    // Documentation: https://www.twilio.com/docs/api/rest/access-tokens
    //
    if (theIdentity === "") {
        sayRequirement("Required: user identity for creating a chat token.");
        doPrompt();
        return "";
    }
    sayMessage("+ Generate token, chat user ID: " + theIdentity);
    const AccessToken = require('twilio').jwt.AccessToken;
    // Create an API key and secret string: https://www.twilio.com/console/chat/runtime/api-keys
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

function getTokenSeverSide(userIdentity, createClientObject) {
    var newToken = "";
    debugMessage("getTokenSeverSide(" + userIdentity + ", createClientObject :" + createClientObject + ")");
    if (firstInit === "") {
        firstInit = "initialized";
        sayMessage("+ Ready for commands such as: help, init, or generate.");
        doPrompt();
        return;
    }
    if (userIdentity === "") {
        sayRequirement("Required: user identity for creating a chat object.");
        doPrompt();
        return;
    }
    if (CHAT_GENERATE_TOKEN_URL === "") {
        sayRequirement("Required: the token URL.");
        doPrompt();
        return;
    }
    var newTokenUrl = CHAT_GENERATE_TOKEN_URL + "?identity=" + userIdentity + "&device=cli";
    request(newTokenUrl, function (error, response, responseString) {
        if (error) {
            sayMessage('- error:', error);
        }
        var theStatus = response && response.statusCode;
        debugMessage('statusCode: ' + theStatus);
        if (theStatus === 404) {
            sayMessage('- Error, invalid token URL: ' + newTokenUrl);
            doPrompt();
            return;
        }
        newToken = responseString;
        if (responseString.indexOf("token") > 0) {
            newToken = JSON.parse(responseString).token;
        }
        debugMessage('token: ' + newToken);
        sayMessage("+ New token retrieved.");
        TOKEN_METHOD = TOKEN_METHOD_URL;
        if (createClientObject) {
            createChatClientObject(newToken, '');
        }
        return;
    });
}

// -----------------------------------------------------------------------------
// $ npm install --save twilio-chat
const Chat = require('twilio-chat');
//
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
                sayMessage("+ Ready for commands such as: help or join.");
            }
            for (i = 0; i < paginator.items.length; i++) {
                const channel = paginator.items[i];
                console.log('+++ Channel: ' + channel.friendlyName);
            }
            if (theChannel !== '') {
                console.log('+ Join Channel: ' + theChannel);
                createChannelObject(theChannel, '', "subscribe");
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
        theUpdateToken = getTokenSeverSide(userIdentity, createClientObject);
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
function createChannelObject(chatChannelName, chatChannelDescription, doSubscribe) {
    debugMessage("createChannelObject(" + chatChannelName + ", " + chatChannelDescription + ", " + doSubscribe + ")");
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
    if (chatChannelDescription === "") {
        chatChannelDescription = chatChannelName;
    }
    // sayMessage("+ Join the channel: " + chatChannelName);
    thisChatClient.getChannelByUniqueName(chatChannelName)
            .then(function (channel) {
                sayMessage("++ Channel exists: " + chatChannelName + ", " + channel.friendlyName);
                // debugMessage("Channel Attributes: "+ " SID: " + channel.sid + " name: " + channel.friendlyName);
                thisChannelObject = channel;
                thisChatChannelName = chatChannelName;
                joinChannel(doSubscribe);
            })
            .catch(function () {
                debugMessage("Channel doesn't exist, created the channel.");
                thisChatClient.createChannel({
                    uniqueName: chatChannelName,
                    friendlyName: chatChannelDescription
                }).then(function (channel) {
                    sayMessage("++ Channel created: " + chatChannelName + ", " + chatChannelDescription);
                    thisChannelObject = channel;
                    thisChatChannelName = chatChannelName;
                    joinChannel(doSubscribe);
                }).catch(function (channel) {
                    sayMessage('-- Failed to create the channel: ' + channel);
                    // Following happened when the token had expired.
                    // -- Failed to create the channel: Error: Can't add command: Can't connect to twilsock
                });
            });
}

function joinChannel(doSubscribe) {
    sayMessage('joinChannel( ' + doSubscribe + ' ) ' + thisChannelObject.uniqueName);
    thisChannelObject.join().then(function (channel) {
        // New to the channel.
        debugMessage('New to the channel as ' + userIdentity);
        joinChannelCompleted(doSubscribe);
    }).catch(function (err) {
        // Not new to the channel, or there is an error.
        if (err.message === "Member already exists") {
            debugMessage("++ You already exist in the channel.");
        } else if (err.message === "Channel member limit exceeded") {
            // To handle this properly, would need to list the channel members to see if join has truly failed.
            debugMessage("Join failed: Channel member limit exceeded.");
            sayMessage("- If you are not already a member of this channel, the join has failed.");
        } else if (err.message === "Webhook cancelled processing of command") {
            sayMessage("++ You have joined the channel.");
        } else {
            debugMessage("- Join failed: " + thisChannelObject.uniqueName + ' :' + err.message + ":");
            sayMessage("- Join failed: " + err.message);
        }
        joinChannelCompleted(doSubscribe);
    });
}

function joinChannelCompleted(doSubscribe) {
    sayMessage('++ You have joined the channel: ' + thisChannelObject.friendlyName);
    if (doSubscribe === "subscribe") {
        subscribeToTheChannel();
    }
    doCountZero();
    if (sendMode === 0) {
        sayMessage("+ You are now in send mode.");
        thePromptPrefix = "+ Send, ";
        sendMode = 1;
    }
    doPrompt();
}

function subscribeToTheChannel() {
    // Only set this once, else can cause issues when re-joining or joining other channels.
    setChannelListeners = "joined";
    sayMessage("++ You have subscribed to the channel event listeners.");
    //
    thisChannelObject.on('messageAdded', function (message) {
        onMessageAdded(message);
    });
}

function doCountZero() {
    debugMessage("+ Called: doCountZero(): thisChannelObject.setNoMessagesConsumed();");
    totalMessages = 0;
    thisChannelObject.setNoMessagesConsumed();
}

function incCount() {
    totalMessages++;
    debugMessage('+ Increment Total Messages:' + totalMessages);
    thisChannelObject.getMessages().then(function (messages) {
        thisChannelObject.updateLastConsumedMessageIndex(totalMessages);
    });
}

// -----------------------------------------------------------------------------
const RELAY_REST_API_GET_PREFIX = '/http/get';
function onMessageAdded(message) {
    // Other message properties: message.sid, message.friendlyName
    if (message.author === userIdentity) {
        debugMessage("> " + message.channel.uniqueName + " : " + message.author + " : " + message.body);
    } else {
        sayMessage("< " + message.channel.uniqueName + " : " + message.author + " : " + message.body);
        if (message.body.startsWith(RELAY_REST_API_GET_PREFIX)) {
            // Example: /http/get/twiml.xml?p1=abc&p2=def
            doRelayHttpGetRequest(message.body.substring(RELAY_REST_API_GET_PREFIX.length).trim());
        }
    }
    incCount();
    doPrompt();
}

function doRelayHttpGetRequest(relayUri) {
    //
    //  HTTP GET Relay Request
    //  
    if (RELAY_URL === '') {
        debugMessage("Since the relay host is not set, this is not an HTTP GET Relay node.");
        // doPrompt();
        return;
    }
    if (relayUri === '') {
        relayUri = "/";
    }
    var theUrl = RELAY_URL + relayUri;
    sayMessage("+ Get relay host response from: " + theUrl);
    request({method: "GET", url: theUrl},
            function (error, response, body) {
                debugMessage("Get response: " + body);
                sayMessage("+ Got the response from the HTTP GET request.");
                doSend("send " + body);
            });
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
        thisChannelObject = channel;
        debugMessage("Channel exists: " + chatChannelName + ", created by: " + thisChannelObject.createdBy);
        thisChannelObject.delete().then(function (channel) {
            sayMessage('++ Channel deleted: ' + chatChannelName);
            if (chatChannelName === thisChatChannelName) {
                thisChatChannelName = "";
            }
            doPrompt();
        }).catch(function (err) {
            // Not handled: SessionError: User unauthorized for command.
            if (thisChannelObject.createdBy !== userIdentity) {
                sayMessage("- Can only be deleted by the creator: " + thisChannelObject.createdBy);
            } else {
                debugMessage("- Delete failed: " + thisChannelObject.uniqueName);
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
    if (thisChannelObject === "") {
        sayRequirement("Required: join a channel.");
        doPrompt();
        return;
    }
    var members = thisChannelObject.getMembers();
    sayMessage("+ ------------------------------------------------------------------------------");
    sayMessage("+ Members of channel: " + thisChannelObject.uniqueName);
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
    thisChannelObject.getMessages().then(function (messages) {
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
        thisChannelObject.updateLastConsumedMessageIndex(totalMessages);
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
        if (theCommand.length > commandLength) {
            thisChannelObject.sendMessage(theCommand.substring(commandLength));
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
            thisChatClient.getChannelBySid(thisChannelObject.sid).then(function (channel) {

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
    thisChatClient.getChannelBySid(thisChannelObject.sid).then(function (channel) {
        channel.sendMessage({
            // contentType: 'application/x-www-form-urlencoded',
            contentType: 'image/jpg',
            media: fs.readFileSync(theMediaFile)
        });
    });
}

// -----------------------------------------------------------------------------
function doSendSms(theMessage) {
    if (AUTH_TOKEN === undefined) {
        sayMessage("-- Not authorized to send SMS.");
    }
    var theType = "json";
    var theRequest = "https://" + ACCOUNT_SID + ":" + AUTH_TOKEN + "@" + "api.twilio.com/2010-04-01/Accounts/" + ACCOUNT_SID + "/Messages." + theType;
    // var basicAuth = "Basic " + new Buffer(ACCOUNT_SID + ":" + AUTH_TOKEN).toString("base64");
    var options = {
        method: 'POST',
        'uri': theRequest,
        headers: {
            // "Authorization": basicAuth,
            'content-type': 'application/x-www-form-urlencoded'
        },
        formData: {
            From: smsSendFrom,
            To: smsSendTo,
            Body: theMessage
        }
    };
    // var request = require('request');
    debugMessage('URL request: ' + theRequest);
    function callback(error, response, body) {
        debugMessage("response.statusCode: " + response.statusCode);
        if (!error) {
            const jsonData = JSON.parse(body);
            sayMessage("++  Message status = " + jsonData.status);
            debugMessage("jsonData: " + body);
        } else {
            sayMessage("++ error: " + error);
        }
        doPrompt();
    }
    request(options, callback);
}

// -----------------------------------------------------------------------------
function listUsers() {
    sayMessage("+ List users.");
    if (AUTH_TOKEN === undefined) {
        sayMessage("-- Not authorized to list users.");
    }
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
    sayMessage("+ Show chat client attribute settings:");
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
    if (AUTH_TOKEN !== undefined) {
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
    if (CHAT_GENERATE_TOKEN_URL === "") {
        sayMessage("++ Token URL is required, if you are not generating tokens using local environment variables.");
    } else {
        sayMessage("++ Token URL: " + CHAT_GENERATE_TOKEN_URL);
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
    if (smsSendFrom !== "") {
        sayMessage("++ SMS send from phone number: " + smsSendFrom);
    }
    if (smsSendTo !== "") {
        sayMessage("++ SMS send to phone number:   " + smsSendTo);
    }
    sayMessage("-----------------------");
    if (RELAY_URL === "") {
        sayMessage("++ Relay host URL is not set. Therefore, this is not a relay host.");
    } else {
        sayMessage("++ Relay host URL: " + RELAY_URL);
    }
    sayMessage("-----------------------");

}

function runProgram(theCommand) {
    const exec = require('child_process').exec;
    exec(theCommand, (error, stdout, stderr) => {
        theResponse = `${stdout}`;
        // console.log('+ theResponse: ');
        console.log(theResponse.substring(0, theResponse.length - 1));
        if (error !== null) {
            console.log(`exec error: ${error}`);
        }
        doPrompt();
    });
}

// -----------------------------------------------------------------------------
// Prompt the user for commands.
// Parse and run execute the commands.

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
var sendMode = 0;
var sendModeSms = 0;
var standard_input = process.stdin;
standard_input.setEncoding('utf-8');
standard_input.on('data', function (inputString) {
    theCommand = inputString.substring(0, inputString.length - 1).trim().replace(/  /g, ' ').replace(/  /g, ' ');
    if (sendMode === 1) {
        doSend("send " + theCommand);
    } else if (sendModeSms === 1) {
        if (theCommand !== '') {
            doSendSms(theCommand);
        } else {
            sendModeSms = 0;
            thePromptPrefix = "+ Command, ";
            doPrompt();
        }
    } else if (theCommand.startsWith('sendmedia')) {
        doSendMedia(theCommand);
    } else if (theCommand.startsWith('send')) {
        doSend(theCommand);
    } else if (theCommand === 'sms') {
        if (sendModeSms === 0) {
            sayMessage("+ You are now in send mode SMS.");
            thePromptPrefix = "+ Send SMS, ";
            sendModeSms = 1;
        } else {
            sayMessage("+ Returned to command mode.");
            thePromptPrefix = "+ Command, ";
            sendModeSms = 0;
        }
        doPrompt();
        // ---------------------------------------------------
        // Channels
    } else if (theCommand === 'list') {
        listChannels();
    } else if (theCommand === 'members') {
        listMembers();
    } else if (theCommand === 'history') {
        listMessageHistory();
    } else if (theCommand.startsWith('joinns')) {
        // Join a channel but don't subscribe.
        // joinns abc
        commandLength = theCommand.length;
        commandWordLength = 'joinns'.length + 1;
        if (commandLength > commandWordLength) {
            theChannel = theCommand.substring(commandWordLength, commandLength);
            createChannelObject(theChannel, "", "NoSubscribe");
        } else {
            sayMessage("+ Syntax: joinns <channel>");
            doPrompt();
        }
    } else if (theCommand.startsWith('join')) {
        // join abc my new channel
        commandLength = theCommand.length;
        commandWordLength = 'join'.length + 1;
        if (commandLength > commandWordLength) {
            theChannel = theCommand.substring(commandWordLength, commandLength);
            theChannelDescription = "";
            ew = theCommand.indexOf(" ", commandWordLength + 1);
            if (ew > 1) {
                theChannel = theCommand.substring(commandWordLength, ew).trim();
                theChannelDescription = theCommand.substring(ew, commandLength).trim();
                debugMessage("theChannel :" + theChannel + ":");
                debugMessage("theChannelDescription :" + theChannelDescription + ":");
            }
            createChannelObject(theChannel, theChannelDescription, "subscribe");
        } else {
            sayMessage("+ Syntax: join <channel> [description]");
            doPrompt();
        }
    } else if (theCommand.startsWith('delete')) {
        commandLength = 'delete'.length + 1;
        if (theCommand.length > commandLength) {
            deleteChannel(theCommand.substring(commandLength).trim());
        } else {
            sayMessage("+ Syntax: delete <channel>");
            doPrompt();
        }
        // ---------------------------------------------------
        // Init chat object
    } else if (theCommand.startsWith('url')) {
        commandLength = 'url'.length + 1;
        if (theCommand.length > commandLength) {
            CHAT_GENERATE_TOKEN_URL = theCommand.substring(commandLength).trim();
        } else {
            sayMessage("+ Syntax: url <URL to retrieve a token>");
        }
        doPrompt();
    } else if (theCommand.startsWith('relay')) {
        commandLength = 'relay'.length + 1;
        if (theCommand.length > commandLength) {
            RELAY_URL = theCommand.substring(commandLength).trim();
            if (RELAY_URL === 'off') {
                RELAY_URL = '';
            }
        } else {
            sayMessage("+ Syntax: relay <<URL to the local relay host> | off>");
        }
        doPrompt();
    } else if (theCommand === 'init') {
        var createClientObject = true;
        getTokenSeverSide(userIdentity, createClientObject);
    } else if (theCommand === 'generate') {
        createChatClientObject(generateToken(userIdentity), '');
    } else if (theCommand === 'users') {
        listUsers();
    } else if (theCommand.startsWith('user')) {
        if (userIdentity !== "") {
            sayMessage("+ Warning: you have changed your user identity, which can cause issues.");
        }
        commandLength = 'user'.length + 1;
        if (theCommand.length > commandLength) {
            userIdentity = theCommand.substring(commandLength).trim();
        } else {
            sayMessage("+ Syntax: user <identity>");
        }
        doPrompt();
        // ---------------------------------------------------
        // Admin
    } else if (theCommand === 'show') {
        doShow();
        doPrompt();
    } else if (theCommand === 'debug') {
        if (debugState === 0) {
            debugState = 1;
        } else {
            debugState = 0;
        }
        if (debugState === 0) {
            sayMessage("+ Debug off.");
        } else {
            sayMessage("+ Debug on.");
        }
        doPrompt();
    } else if (theCommand === 'clear') {
        clearScreen();
    } else if (theCommand === 'help') {
        doHelp();
        doPrompt();
    } else if (theCommand === 'exit') {
        console.log("+++ Exit.");
        process.exit();
    } else if (theCommand === 'ls') {
        runProgram('ls');
    } else if (theCommand === 'time' || theCommand === 'date') {
        runProgram('date');
        // ---------------------------------------------------
    } else if (theCommand.startsWith('sms')) {
        // sms to <phone number>
        // sms from <phone number>
        // sms send <message>
        commandLength = 'sms'.length + 1;
        if (theCommand.length > commandLength) {
            thePhrase = theCommand.substring(commandLength).trim();
            debugMessage("thePhrase :" + thePhrase + ":");   // :to you:
            ew = thePhrase.indexOf(" ");
            if (ew > 1) {
                theVerb = thePhrase.substring(0, ew).trim();
                debugMessage("theVerb :" + theVerb + ":");   // :to you:
                if (ew > 1) {
                    stringText = thePhrase.substring(ew + 1).trim();
                    debugMessage("stringText :" + stringText + ":");
                    if (theVerb === 'send') {
                        doSendSms(stringText);
                    } else if (theVerb === 'to') {
                        smsSendTo = stringText;
                    } else if (theVerb === 'from') {
                        smsSendFrom = stringText;
                    } else {
                        sayMessage("+ Syntax: sms to|from|send <string>");
                    }
                } else {
                    sayMessage("+ Syntax: sms to|from|send <string>");
                }
            } else {
                sayMessage("+ Syntax: sms to|from|send <string>");
            }
        } else {
            sayMessage("+ Syntax: sms to|from|send <string>");
        }
        doPrompt();
        // ---------------------------------------------------
    } else if (theCommand === 'presence') {
        if (presenceState === 0) {
            presenceState = 1;
        } else {
            presenceState = 0;
        }
        if (presenceState === 0) {
            sayMessage("+ Presence off.");
        } else {
            sayMessage("+ Presence on.");
        }
        doPrompt();
    } else {
        if (theCommand !== "") {
            sayMessage('- Invaid command: ' + theCommand);
        }
        doPrompt();
    }
});

// -----------------------------------------------------------------------------
// eof
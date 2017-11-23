let bot_token = process.env.SLACK_BOT_TOKEN || '';
let RtmClient = require('@slack/client').RtmClient;
let RTM_EVENTS = require('@slack/client').RTM_EVENTS;
let rtm = new RtmClient(bot_token);
let CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
let WebClient = require('@slack/client').WebClient;
let web = new WebClient(bot_token);
let fs = require('fs');

let triggerWords = JSON.parse(fs.readFileSync('./trigger-words.json', 'utf8'));
let keys = Object.keys(triggerWords.public_commands);
let channel;
let botChannel = 'general';

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  for (const c of rtmStartData.channels) {
    if (c.is_member && c.name ==='general') { channel = c.id }
  }
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name} in channel ${channel}`);
});

// you need to wait for the client to fully connect before you can send messages
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
    web.conversations.list().then(info => {
        for(let i = 0; i < info.channels.length; i++) {
            console.log(info.channels[i].name);
            if(contains(info.channels[i].name, 'botchat')) {
                botChannel = info.channels[i].id;
            }
        }
        console.log(botChannel);
        rtm.sendMessage("Bot is online!", botChannel);
    });
});

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
    console.log(message);
    let channel = undefined;
    let command = undefined;
    let response = undefined;
    let publicChannelResponse = false;
    try {
        if(message.text.substr(0,1) === "!") {
            publicChannelResponse = true;
            console.log("Command is for public channel, remembering and removing ! from string");
            message.text = message.text.substr(1, message.text.length);
        }
        for(let i = 0; i < keys.length; i++) {
            //console.log('incoming text, possible command: ' +message.text + ', looping keys, matching: ' +keys[i]);
            if(message.text === keys[i] || message.text === 'help') {
                command = message.text;
            }
        }
        if(command !== undefined) {
            // TODO This duplication of code is really unnecessary. Fix it.
            if(command === 'help') {
                response = "Please tell me which topic below you would like to know more about, by typing it;\n\n" + Object.keys(triggerWords.public_commands).join("\n") + "\n\nIf you at any time want a reminder about these topics again, type `help` in a private chat to me, to show this message.";
                if(publicChannelResponse) {
                    console.log("This is a public message, responding to channel...");
                    channel = message.channel;

                    rtm.sendMessage(response, channel);
                } else {
                    console.log("This is a private message, responding to user...");
                    channel = message.user;
                    //console.log(response);
                    // https://github.com/slackapi/node-slack-sdk/issues/148
                    web.im.open(channel, function (err, resp) {
                        // Check `err` for any errors.
                        // `resp` is the parsed response from the api.
                        // Check API docs for what `resp` can be.
                        //console.log(resp);
                        rtm.sendMessage(response, resp.channel.id);
                    });
                }
                return;
            }
            console.log("Command found!: " +command);
            if(publicChannelResponse) {
                console.log("This is a public message, responding to channel...");
                channel = message.channel;
                response = triggerWords.public_commands[command];

                rtm.sendMessage(response, channel);
            } else {
                console.log("This is a private message, responding to user...");
                channel = message.user;
                response = triggerWords.public_commands[command];
                // https://github.com/slackapi/node-slack-sdk/issues/148
                web.im.open(channel, function(err, resp) {
                    // Check `err` for any errors.
                    // `resp` is the parsed response from the api.
                    // Check API docs for what `resp` can be.
                    // console.log(resp);
                    rtm.sendMessage(response, resp.channel.id);
                });
            }
        }
    } catch(e) {
        console.log('Error caught...');
        console.log(e);
    }
});

rtm.start();

/**
 * Helper method for finding if part of a string exists in another string,
 * case insensitive
 */
function contains(needle, haystack) {
    let v = (haystack || '').toLowerCase();
    let v2 = needle;
    if (v2) {
        v2 = v2.toLowerCase();
    }
    return v.indexOf(v2) > -1;
}

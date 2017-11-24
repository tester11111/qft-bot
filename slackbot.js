let bot_token = process.env.SLACK_BOT_TOKEN || '';
let RtmClient = require('@slack/client').RtmClient;
let RTM_EVENTS = require('@slack/client').RTM_EVENTS;
let rtm = new RtmClient(bot_token);
let CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
let WebClient = require('@slack/client').WebClient;
let web = new WebClient(bot_token);
let fs = require('fs');

let triggerWords = JSON.parse(fs.readFileSync('./trigger-words.json', 'utf8'));
let botChannel = undefined;

let TOPICS_RULES = Object.keys(triggerWords.public_commands.rules).join("\n");
let TOPICS_GENERAL = Object.keys(triggerWords.public_commands.general).join("\n");
let COMMANDS_PUBLIC = Object.assign({}, triggerWords.public_commands.rules, triggerWords.public_commands.general);
let HELP_RESPONSE = "Please tell me which topic below you would like to know more about, by typing it;\n\n*Rules*\n\n" + TOPICS_RULES + "\n\n*General*\n\n" + TOPICS_GENERAL + "\n\nIf you at any time want a reminder about these topics again, type `!help` in a private chat to me, to show this message.";
let HELP_PUBLIC_CHAT_RESPONSE = "_Kindly send me commands as direct messages (by talking to me directly). This keeps the channels nice and clean._\n\n";

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  for (const c of rtmStartData.channels) {
      if (c.is_member && c.name === 'botchat') {
          console.log('Found botchat');
          botChannel = c.id;
      }
  }
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name} in channel ${botChannel}`);
});

// you need to wait for the client to fully connect before you can send messages
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
    rtm.sendMessage("Bot is online!", botChannel);
});

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
    try {
        if(message.text.substr(0,1) === "!") {
            //console.log("Command is for DM channel, remembering and removing ! from string");
            //message.text = message.text.substr(1, message.text.length);
            try {
                web.channels.info(message.channel).then(info => {
                    if(info.ok) {
                        console.log("This is public channel sent");
                        prepareMessage(message.user, message, HELP_PUBLIC_CHAT_RESPONSE);
                    }
                }).catch(function (e) {
                    //console.log(e);
                    //console.log("This is private channel sent");
                    prepareMessage(message.user, message, "");
                });
            } catch(e) {
                //console.log('Error on matching channels.info with a channel');
            }
        }
    } catch(e) {
        //console.log(e);
    }
});

rtm.start();

/**
 * Pads and prepends and extends message strings before sending it to a
 * recipient
 * @param channel The channel the message is supposed to be sent to
 * @param message The contents of the message as it is now
 * @param prepend What to prepend the message with, if anything
 */
function prepareMessage(channel, message, prepend) {
    let command = undefined;
    let response = prepend;
    console.log(message.text);
    console.log(message.channel);

    // If message is help, skip checking if command exist
    if(message.text === '!help') {
        console.log("Command found!: " + message.text);
        command = message.text;
        response += HELP_RESPONSE;
    } else {
        // Walk through possible matches
        for(let i = 0; i < Object.keys(COMMANDS_PUBLIC).length; i++) {
            let item = Object.keys(COMMANDS_PUBLIC)[i];
            if(message.text === item) {
                console.log("Command found!: " + message.text);
                command = message.text;
            }
        }

        // Check if a valid command was found
        if(command !== undefined) {
            response += COMMANDS_PUBLIC[command];
        } else {
            console.log("Not understood...: " + message.text);
            response += "BLEEP, BLOOP. I didn't understand that command.\n\n" + HELP_RESPONSE;
        }
    }
    sendDM(channel, response);
}

/**
 * Sends a message to a recipient
 * @param channel The receiving channel; a user ID as a string
 * @param message The complete message as a string
 */
function sendDM(channel, message) {
    // https://github.com/slackapi/node-slack-sdk/issues/148
    web.im.open(channel, function(err, resp) {
        // Check `err` for any errors.
        // `resp` is the parsed response from the api.
        // Check API docs for what `resp` can be.
        // console.log(resp);
        rtm.sendMessage(message, resp.channel.id);
    });
}
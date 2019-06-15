const tmi = require("tmi.js");
const database = require("./database");
const loginInfo = require("./strings");
const helper = require("./helper");

const streamChannel = loginInfo.streamChannel;

const options = {
  options: {
    debug: true
  },
  connection: {
    cluster: "aws",
    reconnect: true
  },
  identity: {
    username: loginInfo.username,
    password: loginInfo.password
  },
  channels: [streamChannel]
};
const client = new tmi.client(options);
const messagesMap = new Map();

// checks if user has been spamming an emote I don't like called "WeirdChamp",
// it makes streamers angry and chat becomes very unenjoyable
// it checks the last minute of messages and console logs the username
// if the user spammed the emote more than N times.
// duplicate emotes in a message are only counted once
function detectSpam(user) {
  usermessages = [...messagesMap.get(user)];
  const nowInSeconds = new Date().getTime() / 1000;
  messagesFromlastMinute = usermessages.filter(
    messageObject =>
      nowInSeconds - new Date(messageObject.date).getTime() / 1000 < 60 &&
      !messageObject.weirdChampScanned
  );
  let weirdChampTimes = 0;
  const maxWeirdChamp = 5;
  //messages containing "WeirdChamp" in quotes aren't considered
  //because it's usually someone complaining about WeirdChamp spammers
  messagesFromlastMinute.forEach(messageObject => {
    if (!messageObject.weirdChampScanned) {
      if (
        messageObject.text.includes("WeirdChamp") &&
        !messageObject.text.includes('"WeirdChamp"')
      ) {
        weirdChampTimes++;
      }
    }
    if (weirdChampTimes > maxWeirdChamp) {
      console.log(user + " is a WeirdChamp spammer");
    }
  });

  //every time a WeirdChamp was detected, flags those messages as "scanned"
  //to prevent them counting twice for the same streak
  if (weirdChampTimes > maxWeirdChamp) {
    messagesFromlastMinute.map(msgObj => (msgObj.scanned = true));
    database.insertSpamDetailsInDatabase(
      new helper.spamDetails(user, messagesFromlastMinute, helper.getDateTime())
    );
  }
}

client.on("chat", (channel, user, message, self) => {
  if (channel === "#" + streamChannel) {
    const msg = new helper.message(message, helper.getDateTime()); //mudar de true para false ou deixar em branco (ver se deixar em branco funciona)
    if (!messagesMap.has(user.username)) {
      const userMessages = [msg];
      messagesMap.set(user.username, userMessages);
    } else {
      messagesMap.get(user.username).push(msg);
    }
    detectSpam(user.username);
  }
});

//clears the map every N milliseconds, to prevent using too much system memory
//drawback: cutting off a spam streak by clearing user's messages
//TODO clean only messages that aren't the most recent
//(maybe older than the last 60?)
function cleanupService(timeoutSeconds) {
  if (database.getdbready()) {
    setTimeout(() => {
      oldMessagesMap = new Map(messagesMap);
      messagesMap.clear();
      for (var key of oldMessagesMap.keys()) {
        detectSpam(key);
      }
      cleanupService();
    }, timeoutSeconds * 1000);
  }
}

// I disabled the backup service because it isn't intended
// for this program to keep all messages in permanent storage.
main();
function main() {
  //backupService();
  cleanupService(600);
  client.connect();
}

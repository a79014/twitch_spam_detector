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

  //messages containing "WeirdChamp" in quotes aren't considered
  //because it's usually someone complaining about WeirdChamp spammers
  messagesFromlastMinute.forEach(messageObject => {
    if (!messageObject.weirdChampScanned) {
      if (
        messageObject.message.includes("WeirdChamp") &&
        !messageObject.message.includes('"WeirdChamp"')
      ) {
        weirdChampTimes++;
      }
    }
    if (weirdChampTimes > 5) {
      console.log(user + " is a WeirdChamp spammer");
      console.log(messagesFromlastMinute);
    }
  });

  //every time a WeirdChamp was detected, flags those messages as "scanned"
  //to prevent them counting twice for the same streak
  if (weirdChampTimes > 5) {
    let spamDetails = {
      spamDate: null,
      messages: null,
      user: null
    };
    messagesFromlastMinute.forEach(messageObject => {
      messageObject.weirdChampScanned = true;
    });
    spamDetails.spamDate = helper.getDateTime();
    spamDetails.messages = messagesFromlastMinute;
    spamDetails.user = user;
    database.insertSpamDetailsInDatabase(spamDetails);
  }
}

client.on("chat", (channel, user, message, self) => {
  if (channel === "#" + streamChannel) {
    const msg = {
      message: message,
      date: helper.getDateTime(),
      weirdChampScanned: false
    };
    if (!messagesMap.has(user.username)) {
      const userMessages = [msg];
      messagesMap.set(user.username, userMessages);
    } else {
      messagesMap.get(user.username).push(msg);
    }
    detectSpam(user.username);
  }
});

// I disabled the backup service because it isn't intended
// for this program to keep all messages in permanent storage.
main();
function main() {
  //backupService();
  client.connect();
}

//things I don't use

//

function backupService() {
  if (database.getdbready()) {
    //database.printInfo(db);
  }
  setTimeout(() => {
    //this clears the messagesMap to receive new messages,
    //while the DB gets inserted the old messages on old_messagesMap
    //let old_messagesMap = new Map(messagesMap);
    //messagesMap.clear();
    //database.insertNewMessagesInDatabase(old_messagesMap);
    backupService();
  }, 5000);
}

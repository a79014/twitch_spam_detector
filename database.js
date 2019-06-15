const sqlite3 = require("sqlite3").verbose();
/*
  Today I learned that you can't export directly a variable if you intend to change it later and get its new value. 
  To do what I wanted (check if the database tables were created before I used it), I created a variable that would
  be changed to true whenever the createTables() function finishes.
  The proper way to do this is exporting an object that returns the variable. This reminds me of the OOP concepts I
  learned too, where you shouldn't access a variable from an object directly, but use its getter - encapsulation.
  https://stackoverflow.com/questions/32662435/node-js-changing-the-value-of-an-exported-integer
*/
let dbReady = false;

const db = new sqlite3.Database(
  "chat.db",
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  err => {
    if (err) {
      console.error(err.message);
    } else {
      console.log("Connected to the users database.");
      createTables();
    }
  }
);

function createTables() {
  console.log("creating database tables if they don't exist");
  db.serialize(() => {
    db.run(
      "CREATE TABLE IF NOT EXISTS User(userId INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL);"
    );
    db.run(
      "CREATE TABLE IF NOT EXISTS Spam(spamId INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, userId INTEGER NOT NULL, spamDate DATETIME NOT NULL);"
    );
    db.run(
      "CREATE TABLE IF NOT EXISTS Message(messageId INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL, spamId INTEGER NOT NULL, messageText TEXT NOT NULL, messageDate DATETIME NOT NULL);",
      () => {
        dbReady = true;
      }
    );
  });
}

function insertSpamMessagesInDatabase(spamId, messages) {
  let messagesCommand = db.prepare(
    "INSERT INTO Message(spamId, messageText, messagedate) VALUES(?,?,?);"
  );
  for (messageObject of messages) {
    messagesCommand.run(spamId, messageObject.text, messageObject.date);
  }
  messagesCommand.finalize(() => {
    console.log(messages);
  });
}

function insertSpamRowInDatabase(spamDetails) {
  db.serialize(() => {
    let command =
      "SELECT userId FROM User WHERE username='" + spamDetails.user + "';";
    db.all(command, [], function(err, rows) {
      if (err) {
        console.log(err);
      } else {
        let userId = rows[0].userId;
        command = `INSERT INTO Spam(userId, spamDate) 
        VALUES(
          '${userId}', 
          '${spamDetails.spamDate}'
        )`;
        db.run(command, function(err) {
          if (!err) {
            insertSpamMessagesInDatabase(this.lastID, spamDetails.messages);
          } else {
            console.log(err);
          }
        });
      }
    });
  });
}

function insertUserInDatabase(spamDetails) {
  db.run(
    "INSERT INTO User(username) VALUES('" + spamDetails.user + "');",
    function(err) {
      if (!err) {
        console.log("inserted new user with Id: " + this.lastID);
        insertSpamRowInDatabase(spamDetails);
      } else {
        console.log(err);
      }
    }
  );
}

module.exports = {
  DB: db,
  getdbready: function() {
    return dbReady;
  },
  printInfo: function(db) {
    let command = "SELECT * FROM Message";
    db.all(command, [], (err, rows) => {
      if (err) {
        console.log(err);
      } else {
        rows.forEach(row => {
          console.log(row);
        });
      }
    });
  },

  insertSpamDetailsInDatabase: function(spamDetails) {
    let command =
      "SELECT EXISTS (SELECT 1 FROM User WHERE username='" +
      spamDetails.user +
      "') AS E;";
    db.all(command, [], (err, rows) => {
      let userexists = 0;
      if (err) {
        console.log(err);
      } else {
        rows.forEach(row => {
          userexists = row.E;
        });
        if (!userexists) {
          insertUserInDatabase(spamDetails);
        } else {
          insertSpamRowInDatabase(spamDetails);
        }
      }
    });
  }
};
